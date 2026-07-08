"""
Actero — Shopify onboarding heavy-lift (E2B sandbox).

Triggered by api/shopify/callback.js after a successful OAuth.

Steps:
  1. Pull recent products (cursor-paginated)
  2. Count recent customers (last N days)
  3. Count recent orders (last N days)
  4. Build initial knowledge base entries from product descriptions + policies
  5. Mark client.onboarding_status = 'ready' (best-effort — no schema change)

This script is intentionally conservative on the first run: we sync 90 days
by default (override via JOB_PAYLOAD.sync_range = '180d' | '365d' | 'all').

IMPORTANT — GraphQL only. New public Shopify apps are forbidden from the REST
Admin API (App Store requirement 2.2.4). Calling `/admin/api/<ver>/*.json`
returns "403 Client Error: Forbidden" and aborts onboarding, which is what got
the App Store submission suspended. Every Shopify call below therefore goes
through the GraphQL Admin API (`/admin/api/<ver>/graphql.json`).

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


def shopify_graphql(query: str, variables: dict | None = None) -> dict:
    """POST a GraphQL query to the Shopify Admin API and return its `data`.

    Retries once on HTTP 429 and on GraphQL THROTTLED errors. Raises on any
    other error so callers can decide whether to fail hard or skip soft.
    """
    url = f"https://{SHOP}/admin/api/{API_VERSION}/graphql.json"
    r = requests.post(
        url,
        headers={
            "X-Shopify-Access-Token": TOKEN,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json={"query": query, "variables": variables or {}},
        timeout=30,
    )
    if r.status_code == 429:
        time.sleep(2)
        return shopify_graphql(query, variables)
    r.raise_for_status()
    body = r.json()
    errors = body.get("errors")
    if errors:
        throttled = any(
            isinstance(e, dict) and (e.get("extensions") or {}).get("code") == "THROTTLED"
            for e in errors
        )
        if throttled:
            time.sleep(2)
            return shopify_graphql(query, variables)
        raise RuntimeError(f"GraphQL error: {errors}")
    return body.get("data") or {}


def days_from_range(s: str) -> int:
    return {
        "30d": 30, "90d": 90, "180d": 180, "365d": 365, "all": 3650,
    }.get(s, 90)


def _numeric_id(gid: str) -> str:
    """gid://shopify/Product/12345 → 12345"""
    return gid.rsplit("/", 1)[-1] if gid else ""


PRODUCTS_QUERY = """
query Products($cursor: String) {
  products(first: 100, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        id
        title
        descriptionHtml
        handle
        vendor
        productType
        tags
      }
    }
  }
}
"""


def pull_products() -> int:
    """Returns count of products imported."""
    job_progress(15, "Importing products from Shopify…")
    count = 0
    cursor: str | None = None
    while True:
        data = shopify_graphql(PRODUCTS_QUERY, {"cursor": cursor})
        conn = data.get("products") or {}
        edges = conn.get("edges") or []
        if not edges:
            break

        rows = []
        for e in edges:
            node = e.get("node") or {}
            description = node.get("descriptionHtml") or ""
            if not description.strip():
                continue
            rows.append({
                "client_id": CLIENT_ID,
                "title": (node.get("title") or "")[:500],
                "content": description[:50_000],
                "source_type": "shopify_product",
                "source_id": _numeric_id(node.get("id", "")),
                "source_url": f"https://{SHOP}/products/{node.get('handle', '')}",
                "metadata": {
                    "vendor": node.get("vendor"),
                    "product_type": node.get("productType"),
                    "tags": node.get("tags"),
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

        page = conn.get("pageInfo") or {}
        if not page.get("hasNextPage"):
            break
        cursor = page.get("endCursor")

    return count


CUSTOMERS_QUERY = """
query Customers($q: String!) {
  customers(first: 250, query: $q) { edges { node { id } } }
}
"""


def pull_customers(since_days: int) -> int:
    job_progress(45, f"Pulling customers (last {since_days}d)…")
    since = (datetime.now(timezone.utc) - timedelta(days=since_days)).strftime("%Y-%m-%d")
    count = 0
    try:
        data = shopify_graphql(CUSTOMERS_QUERY, {"q": f"updated_at:>={since}"})
        count = len((data.get("customers") or {}).get("edges") or [])
        # We don't persist customers right now — Actero engine fetches them
        # on-demand when a ticket comes in. Counting is enough for stats.
    except Exception as e:
        sys.stderr.write(f"[customers] skipped: {e}\n")
    return count


ORDERS_QUERY = """
query Orders($q: String!) {
  orders(first: 250, query: $q) { edges { node { id } } }
}
"""


def pull_orders(since_days: int) -> int:
    job_progress(65, f"Pulling orders (last {since_days}d)…")
    since = (datetime.now(timezone.utc) - timedelta(days=since_days)).strftime("%Y-%m-%d")
    count = 0
    try:
        data = shopify_graphql(ORDERS_QUERY, {"q": f"updated_at:>={since}"})
        count = len((data.get("orders") or {}).get("edges") or [])
    except Exception as e:
        sys.stderr.write(f"[orders] skipped: {e}\n")
    return count


POLICIES_QUERY = """
query Policies {
  shop {
    shopPolicies { id title body url type }
  }
}
"""


def import_shop_policies() -> int:
    """Pulls the merchant's published policies (refund / shipping / privacy)
    and stores them as knowledge base entries — these are gold for the engine."""
    job_progress(80, "Importing shop policies…")
    count = 0
    try:
        data = shopify_graphql(POLICIES_QUERY)
        policies = (data.get("shop") or {}).get("shopPolicies") or []
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
                "source_id": _numeric_id(p.get("id", "")),
                "source_url": p.get("url"),
                "metadata": {"policy_type": p.get("type") or p.get("title")},
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
        data = shopify_graphql("query { shop { name } }")
        shop_name = (data.get("shop") or {}).get("name") or SHOP
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
