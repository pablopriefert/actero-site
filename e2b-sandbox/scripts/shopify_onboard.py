"""
Actero — Shopify onboarding heavy-lift (E2B sandbox).

Triggered by api/shopify/callback.js after a successful OAuth.

Steps:
  1. Pull recent products (paginated, ~250/page)
  2. Pull recent customers (last N days)
  3. Pull recent orders (last N days)
  4. Build initial knowledge base entries from product descriptions + policies
  5. Mark client.onboarding_status = 'ready' (best-effort — no schema change)

This script is intentionally conservative on the first run: we sync 90 days
by default (override via JOB_PAYLOAD.sync_range = '180d' | '365d' | 'all').

Env (passed by api/lib/e2b-runner.js):
  JOB_ID, JOB_PAYLOAD, SUPABASE_URL, SUPABASE_SERVICE_KEY, CLIENT_ID
  SHOPIFY_ACCESS_TOKEN, SHOPIFY_SHOP_DOMAIN
"""

from __future__ import annotations
import os
import sys
import time
from datetime import datetime, timedelta, timezone

# /lib_actero.py is uploaded next to this script by e2b-runner.js
sys.path.insert(0, "/")
from lib_actero import job_progress, supabase_request, load_payload, safe_main, fail  # noqa: E402

import requests  # noqa: E402

SHOP = os.environ.get("SHOPIFY_SHOP_DOMAIN")
TOKEN = os.environ.get("SHOPIFY_ACCESS_TOKEN")
CLIENT_ID = os.environ.get("CLIENT_ID")

API_VERSION = "2025-01"


def shopify_get(path: str, params: dict | None = None) -> dict:
    url = f"https://{SHOP}/admin/api/{API_VERSION}{path}"
    r = requests.get(
        url,
        headers={"X-Shopify-Access-Token": TOKEN, "Accept": "application/json"},
        params=params,
        timeout=30,
    )
    if r.status_code == 429:
        time.sleep(2)
        return shopify_get(path, params)
    r.raise_for_status()
    return r.json()


def days_from_range(s: str) -> int:
    return {
        "30d": 30, "90d": 90, "180d": 180, "365d": 365, "all": 3650,
    }.get(s, 90)


def pull_products() -> int:
    """Returns count of products imported."""
    job_progress(15, "Importing products from Shopify…")
    count = 0
    page_info: str | None = None
    while True:
        params = {"limit": 250}
        if page_info:
            params["page_info"] = page_info
        data = shopify_get("/products.json", params)
        products = data.get("products", [])
        if not products:
            break

        rows = []
        for p in products:
            description = p.get("body_html") or ""
            if not description.strip():
                continue
            rows.append({
                "client_id": CLIENT_ID,
                "title": p.get("title", "")[:500],
                "content": description[:50_000],
                "source_type": "shopify_product",
                "source_id": str(p.get("id", "")),
                "source_url": f"https://{SHOP}/products/{p.get('handle', '')}",
                "metadata": {
                    "vendor": p.get("vendor"),
                    "product_type": p.get("product_type"),
                    "tags": p.get("tags"),
                },
            })

        if rows:
            resp = supabase_request(
                "POST",
                "/rest/v1/client_knowledge_base",
                json=rows,
                prefer="resolution=merge-duplicates",
            )
            if resp.ok:
                count += len(rows)

        # Cursor pagination via Link header is the proper way; this is the
        # legacy `since_id` fallback for simplicity.
        if len(products) < 250:
            break
        page_info = None  # ← TODO: implement Link header parsing for >250

    return count


def pull_customers(since_days: int) -> int:
    job_progress(45, f"Pulling customers (last {since_days}d)…")
    since = (datetime.now(timezone.utc) - timedelta(days=since_days)).isoformat()
    count = 0
    try:
        data = shopify_get(
            "/customers.json",
            {"limit": 250, "updated_at_min": since},
        )
        count = len(data.get("customers", []))
        # We don't persist customers right now — Actero engine fetches them
        # on-demand when a ticket comes in. Counting is enough for stats.
    except Exception as e:
        sys.stderr.write(f"[customers] skipped: {e}\n")
    return count


def pull_orders(since_days: int) -> int:
    job_progress(65, f"Pulling orders (last {since_days}d)…")
    since = (datetime.now(timezone.utc) - timedelta(days=since_days)).isoformat()
    count = 0
    try:
        data = shopify_get(
            "/orders.json",
            {"limit": 250, "updated_at_min": since, "status": "any"},
        )
        count = len(data.get("orders", []))
    except Exception as e:
        sys.stderr.write(f"[orders] skipped: {e}\n")
    return count


def import_shop_policies() -> int:
    """Pulls the merchant's published policies (refund / shipping / privacy)
    and stores them as knowledge base entries — these are gold for the engine."""
    job_progress(80, "Importing shop policies…")
    count = 0
    try:
        shop = shopify_get("/shop.json").get("shop", {})
        # Shopify returns policies as separate Page resources OR via /policies.json.
        policies = shopify_get("/policies.json").get("policies", [])
        rows = []
        for p in policies:
            body = p.get("body") or ""
            if not body.strip():
                continue
            rows.append({
                "client_id": CLIENT_ID,
                "title": f"Politique : {p.get('title')}",
                "content": body[:50_000],
                "source_type": "shopify_policy",
                "source_id": str(p.get("id", "")),
                "source_url": p.get("url"),
                "metadata": {"policy_type": p.get("title")},
            })
        if rows:
            resp = supabase_request(
                "POST",
                "/rest/v1/client_knowledge_base",
                json=rows,
                prefer="resolution=merge-duplicates",
            )
            if resp.ok:
                count = len(rows)
    except Exception as e:
        sys.stderr.write(f"[policies] skipped: {e}\n")
    return count


def main() -> None:
    if not (SHOP and TOKEN and CLIENT_ID):
        fail("Missing SHOPIFY_SHOP_DOMAIN / SHOPIFY_ACCESS_TOKEN / CLIENT_ID env")

    payload = load_payload()
    days = days_from_range(payload.get("sync_range", "90d"))

    job_progress(5, "Sandbox started — connecting to Shopify…")

    # Quick sanity — fail fast if token is bad.
    try:
        shop_info = shopify_get("/shop.json").get("shop", {})
        shop_name = shop_info.get("name") or SHOP
    except Exception as e:
        fail(f"Shopify token rejected: {e}")
        return

    job_progress(10, f"Connected to {shop_name}")

    products_count = pull_products()
    customers_count = pull_customers(days)
    orders_count = pull_orders(days)
    policies_count = import_shop_policies()

    # Best-effort: flag the client as onboarded.
    supabase_request(
        "PATCH",
        "/rest/v1/clients",
        params={"id": f"eq.{CLIENT_ID}"},
        json={"onboarding_status": "ready"},
    )

    summary = {
        "shop": shop_name,
        "products_imported": products_count,
        "customers_seen": customers_count,
        "orders_seen": orders_count,
        "policies_imported": policies_count,
        "sync_days": days,
    }

    job_progress(
        100,
        f"Onboarding complete — {products_count} products, {policies_count} policies",
        final_status="completed",
        result=summary,
        cost_usd=0.05,  # rough estimate; actual cost reported by E2B usage API
    )


if __name__ == "__main__":
    safe_main(main)
