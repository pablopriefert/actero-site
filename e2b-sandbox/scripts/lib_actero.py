"""
Shared helpers for Actero E2B sandbox scripts.

Pattern:
    from lib_actero import job_progress, supabase_request

    job_progress(10, "Pulling products...")
    supabase_request("POST", "/rest/v1/client_knowledge_base", json=row)
    job_progress(100, "Done", final_status="completed", result={"rows": 1234})
"""

from __future__ import annotations
import os
import sys
import json
import time
import traceback
from typing import Optional, Any

import requests

JOB_ID = os.environ.get("JOB_ID")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
CLIENT_ID = os.environ.get("CLIENT_ID")


def _headers(extra: dict | None = None) -> dict:
    h = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


def supabase_request(
    method: str,
    path: str,
    *,
    params: dict | None = None,
    json: Any = None,
    prefer: Optional[str] = None,
) -> requests.Response:
    """Hit Supabase REST API. `path` should start with /rest/v1/<table>."""
    url = f"{SUPABASE_URL}{path}"
    extra = {"Prefer": prefer} if prefer else None
    resp = requests.request(
        method,
        url,
        params=params,
        json=json,
        headers=_headers(extra),
        timeout=30,
    )
    if not resp.ok:
        sys.stderr.write(f"[supabase {method} {path}] {resp.status_code}: {resp.text[:500]}\n")
    return resp


def job_progress(
    percent: int,
    message: str,
    *,
    final_status: Optional[str] = None,
    result: Any = None,
    error: Optional[str] = None,
    cost_usd: Optional[float] = None,
) -> None:
    """Update e2b_jobs row with current progress.

    final_status:
        None         -> just write progress + message (status stays 'running')
        'completed'  -> mark done with optional result payload
        'failed'     -> mark failed with optional error string
    """
    if not JOB_ID:
        print(f"[no JOB_ID] progress={percent}% {message}")
        return

    payload: dict = {
        "progress": max(0, min(100, int(percent))),
        "progress_message": message[:500],
    }
    if final_status:
        payload["status"] = final_status
        payload["completed_at"] = "now()"
    if result is not None:
        payload["result"] = result
    if error:
        payload["error"] = error[:2000]
    if cost_usd is not None:
        payload["cost_usd"] = round(float(cost_usd), 4)

    # PostgREST quirk: completed_at='now()' must come through SQL — easier to
    # send a server-generated timestamp from Python.
    if "completed_at" in payload:
        from datetime import datetime, timezone
        payload["completed_at"] = datetime.now(timezone.utc).isoformat()

    supabase_request(
        "PATCH",
        "/rest/v1/e2b_jobs",
        params={"id": f"eq.{JOB_ID}"},
        json=payload,
    )


def load_payload() -> dict:
    raw = os.environ.get("JOB_PAYLOAD") or "{}"
    try:
        return json.loads(raw)
    except Exception:
        return {}


def fail(message: str, exc: Optional[BaseException] = None) -> None:
    """Mark the job failed and exit. Optionally include traceback in error."""
    if exc:
        tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
        full = f"{message}\n\n{''.join(tb)}"
    else:
        full = message
    job_progress(0, message[:200], final_status="failed", error=full)
    sys.exit(1)


def safe_main(fn) -> None:
    """Wrap the entrypoint so any uncaught exception marks the job failed."""
    try:
        fn()
    except SystemExit:
        raise
    except BaseException as exc:
        fail(f"Uncaught exception: {exc}", exc=exc)
