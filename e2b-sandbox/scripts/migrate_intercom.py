"""
Actero — Intercom historical conversation migration (E2B sandbox).

Pulls conversations via the Intercom REST API v2.

Env:
  INTERCOM_TOKEN, CLIENT_ID, JOB_ID, JOB_PAYLOAD, SUPABASE_URL, SUPABASE_SERVICE_KEY

API: https://developers.intercom.com/intercom-api-reference/reference/listconversations
Auth: Bearer <access_token>
"""

from __future__ import annotations
import os
import sys
import time
from typing import Iterable

sys.path.insert(0, "/")
from lib_actero import job_progress, supabase_request, load_payload, safe_main, fail  # noqa: E402

import requests  # noqa: E402

TOKEN = os.environ.get("INTERCOM_TOKEN")
CLIENT_ID = os.environ.get("CLIENT_ID")

BASE = "https://api.intercom.io"
API_VERSION = "2.11"


def headers() -> dict:
    return {
        "Authorization": f"Bearer {TOKEN}",
        "Intercom-Version": API_VERSION,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def ic_request(method: str, path: str, **kw) -> dict:
    r = requests.request(method, f"{BASE}{path}", headers=headers(), timeout=30, **kw)
    if r.status_code == 429:
        time.sleep(int(r.headers.get("Retry-After", "5")))
        return ic_request(method, path, **kw)
    r.raise_for_status()
    return r.json()


def iter_conversations(since_ts: int | None, limit: int | None) -> Iterable[dict]:
    """Use the search endpoint to filter by created_at; fall back to list."""
    fetched = 0
    starting_after: str | None = None
    query: dict = {
        "query": {"field": "created_at", "operator": ">", "value": since_ts or 0}
        if since_ts else {"field": "id", "operator": "!=", "value": "0"},
        "pagination": {"per_page": 50},
    }
    while True:
        if starting_after:
            query["pagination"]["starting_after"] = starting_after
        try:
            data = ic_request("POST", "/conversations/search", json=query)
        except Exception as e:
            sys.stderr.write(f"[search] {e}\n")
            return

        for c in data.get("conversations", []):
            yield c
            fetched += 1
            if limit and fetched >= limit:
                return

        pages = data.get("pages") or {}
        next_page = pages.get("next")
        if not next_page:
            return
        starting_after = next_page.get("starting_after")
        if not starting_after:
            return


def fetch_full_conversation(conv_id: str) -> dict | None:
    try:
        return ic_request("GET", f"/conversations/{conv_id}")
    except Exception as e:
        sys.stderr.write(f"[conv {conv_id}] {e}\n")
        return None


def to_actero_row(conv: dict) -> dict:
    parts = (conv.get("conversation_parts") or {}).get("conversation_parts", [])
    source = conv.get("source") or {}
    contacts = (conv.get("contacts") or {}).get("contacts", [])
    contact = contacts[0] if contacts else {}

    customer_first = source.get("body") or ""
    agent_msg = ""
    for p in parts:
        author = p.get("author") or {}
        body = p.get("body") or ""
        if author.get("type") in ("admin", "team") and body and not agent_msg:
            agent_msg = body
        elif author.get("type") == "user" and body and not customer_first:
            customer_first = body

    return {
        "client_id": CLIENT_ID,
        "channel": "imported_intercom",
        "customer_email": (contact.get("email") or "")[:255],
        "customer_name": (contact.get("name") or "")[:255],
        "subject": (source.get("subject") or "")[:500],
        "user_message": (customer_first or "")[:20_000],
        "ai_response": "",
        "human_response": (agent_msg or "")[:20_000],
        "intent": None,
        "created_at": _ts_to_iso(conv.get("created_at")),
        "added_to_kb": True,
        "metadata": {
            "imported_from": "intercom",
            "intercom_id": conv.get("id"),
            "state": conv.get("state"),
            "tags": [t.get("name") for t in (conv.get("tags") or {}).get("tags", [])],
        },
    }


def _ts_to_iso(ts: int | None) -> str | None:
    if not ts:
        return None
    from datetime import datetime, timezone
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()
    except Exception:
        return None


def main() -> None:
    if not (TOKEN and CLIENT_ID):
        fail("Missing INTERCOM_TOKEN or CLIENT_ID")

    payload = load_payload()
    since_iso = payload.get("since")
    limit = payload.get("limit")

    since_ts = None
    if since_iso:
        from datetime import datetime
        try:
            since_ts = int(datetime.fromisoformat(since_iso.replace("Z", "+00:00")).timestamp())
        except Exception:
            since_ts = None

    job_progress(2, "Connecting to Intercom…")
    try:
        ic_request("GET", "/me")
    except Exception as e:
        fail(f"Intercom auth failed: {e}")

    imported = 0
    skipped = 0
    batch = []
    last_progress = 0

    for conv_summary in iter_conversations(since_ts, limit):
        full = fetch_full_conversation(conv_summary.get("id")) or conv_summary
        try:
            row = to_actero_row(full)
        except Exception as e:
            sys.stderr.write(f"[conv {full.get('id')}] transform: {e}\n")
            skipped += 1
            continue

        batch.append(row)
        if len(batch) >= 50:
            resp = supabase_request("POST", "/rest/v1/ai_conversations", json=batch)
            if resp.ok:
                imported += len(batch)
            else:
                skipped += len(batch)
            batch = []

        if limit:
            new_progress = min(95, int((imported / max(limit, 1)) * 90) + 5)
        else:
            new_progress = min(95, 5 + (imported // 100))
        if new_progress > last_progress + 4:
            job_progress(new_progress, f"Imported {imported} conversations…")
            last_progress = new_progress

    if batch:
        resp = supabase_request("POST", "/rest/v1/ai_conversations", json=batch)
        if resp.ok:
            imported += len(batch)

    job_progress(
        100,
        f"Migration done — {imported} conversations imported (skipped {skipped})",
        final_status="completed",
        result={"provider": "intercom", "imported": imported, "skipped": skipped, "since": since_iso},
    )


if __name__ == "__main__":
    safe_main(main)
