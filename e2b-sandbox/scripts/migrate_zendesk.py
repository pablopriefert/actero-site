"""
Actero — Zendesk historical ticket migration (E2B sandbox).

Pulls tickets via the Zendesk Support REST API v2.

Env:
  ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, ZENDESK_API_TOKEN,
  CLIENT_ID, JOB_ID, JOB_PAYLOAD, SUPABASE_URL, SUPABASE_SERVICE_KEY

Auth: Basic <email/token:api_token> base64. Note the literal "/token".
API: https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/#list-tickets
"""

from __future__ import annotations
import os
import sys
import base64
import time
from typing import Iterable

sys.path.insert(0, "/")
from lib_actero import job_progress, supabase_request, load_payload, safe_main, fail  # noqa: E402

import requests  # noqa: E402

SUBDOMAIN = os.environ.get("ZENDESK_SUBDOMAIN")
EMAIL = os.environ.get("ZENDESK_EMAIL")
API_TOKEN = os.environ.get("ZENDESK_API_TOKEN")
CLIENT_ID = os.environ.get("CLIENT_ID")

BASE = f"https://{SUBDOMAIN}.zendesk.com/api/v2"


def auth_header() -> dict:
    creds = f"{EMAIL}/token:{API_TOKEN}".encode("utf-8")
    return {
        "Authorization": f"Basic {base64.b64encode(creds).decode()}",
        "Accept": "application/json",
    }


def zd_get(path: str, params: dict | None = None) -> dict:
    r = requests.get(f"{BASE}{path}", headers=auth_header(), params=params, timeout=30)
    if r.status_code == 429:
        time.sleep(int(r.headers.get("Retry-After", "10")))
        return zd_get(path, params)
    r.raise_for_status()
    return r.json()


def iter_tickets(since: str | None, limit: int | None) -> Iterable[dict]:
    """Use incremental export endpoint when no `since` constraint, otherwise
    fall back to /tickets.json with cursor pagination."""
    fetched = 0
    if since:
        # Convert ISO date to unix timestamp for incremental export.
        from datetime import datetime
        try:
            ts = int(datetime.fromisoformat(since.replace("Z", "+00:00")).timestamp())
        except Exception:
            ts = 0
        url = f"{BASE}/incremental/tickets/cursor.json"
        params = {"start_time": ts}
    else:
        url = f"{BASE}/tickets.json"
        params = {"per_page": 100}

    while True:
        r = requests.get(url, headers=auth_header(), params=params, timeout=30)
        if r.status_code == 429:
            time.sleep(int(r.headers.get("Retry-After", "10")))
            continue
        r.raise_for_status()
        data = r.json()
        for t in data.get("tickets", []):
            yield t
            fetched += 1
            if limit and fetched >= limit:
                return
        # Pagination: cursor incremental returns `after_cursor`+`end_of_stream`
        if "after_cursor" in data and not data.get("end_of_stream", True):
            url = data.get("after_url") or f"{BASE}/incremental/tickets/cursor.json"
            params = {"cursor": data.get("after_cursor")}
        elif data.get("next_page"):
            url = data["next_page"]
            params = None
        else:
            return


def fetch_comments(ticket_id: int) -> list[dict]:
    try:
        data = zd_get(f"/tickets/{ticket_id}/comments.json")
        return data.get("comments", [])
    except Exception:
        return []


def to_actero_row(ticket: dict, comments: list[dict]) -> dict:
    sorted_c = sorted(comments, key=lambda c: c.get("created_at") or "")
    customer_msg = next(
        (c.get("body") or c.get("plain_body") or "" for c in sorted_c if c.get("public")),
        "",
    )
    agent_msg = next(
        (c.get("body") or c.get("plain_body") or "" for c in reversed(sorted_c)
         if not c.get("public") is False),
        "",
    )

    return {
        "client_id": CLIENT_ID,
        "channel": "imported_zendesk",
        "customer_email": (ticket.get("via", {}).get("source", {}).get("from", {}).get("address") or "")[:255],
        "customer_name": "",
        "subject": (ticket.get("subject") or "")[:500],
        "user_message": (customer_msg or "")[:20_000],
        "ai_response": "",
        "human_response": (agent_msg or "")[:20_000],
        "intent": ticket.get("type") or None,
        "created_at": ticket.get("created_at"),
        "added_to_kb": True,
        "metadata": {
            "imported_from": "zendesk",
            "zendesk_ticket_id": ticket.get("id"),
            "tags": ticket.get("tags") or [],
            "priority": ticket.get("priority"),
        },
    }


def main() -> None:
    if not (SUBDOMAIN and EMAIL and API_TOKEN and CLIENT_ID):
        fail("Missing ZENDESK_* env vars or CLIENT_ID")

    payload = load_payload()
    since = payload.get("since")
    limit = payload.get("limit")

    job_progress(2, "Connecting to Zendesk…")
    try:
        zd_get("/users/me.json")
    except Exception as e:
        fail(f"Zendesk auth failed: {e}")

    imported = 0
    skipped = 0
    batch = []
    last_progress = 0

    for ticket in iter_tickets(since=since, limit=limit):
        comments = fetch_comments(ticket["id"])
        try:
            row = to_actero_row(ticket, comments)
        except Exception as e:
            sys.stderr.write(f"[ticket {ticket.get('id')}] transform error: {e}\n")
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
            job_progress(new_progress, f"Imported {imported} tickets…")
            last_progress = new_progress

    if batch:
        resp = supabase_request("POST", "/rest/v1/ai_conversations", json=batch)
        if resp.ok:
            imported += len(batch)

    job_progress(
        100,
        f"Migration done — {imported} tickets imported (skipped {skipped})",
        final_status="completed",
        result={"provider": "zendesk", "imported": imported, "skipped": skipped, "since": since},
    )


if __name__ == "__main__":
    safe_main(main)
