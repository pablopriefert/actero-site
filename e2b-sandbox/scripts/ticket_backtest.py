"""
Ticket backtest harness (DRY-RUN replay).

Replays a client's imported historical support tickets through Actero's
brain via the /api/engine/backtest-classify firewall endpoint, which runs
ONLY inference (never the executor, never sends anything). Produces the
sales proof: "Actero would have resolved X% of your past tickets".

payload: { backtest_id, limit }
env:     CLIENT_ID, PUBLIC_API_URL, CRON_SECRET (+ standard lib_actero env)

Side effects (intentional, allowed):
  - reads ai_conversations (read-only)
  - PATCHes the ticket_backtests row identified by backtest_id
  - updates the e2b_jobs row via job_progress()
Nothing else is touched.
"""

import os

from lib_actero import load_payload, job_progress, supabase_request, safe_main

import requests

PUBLIC_API_URL = os.environ.get("PUBLIC_API_URL", "https://actero.fr").rstrip("/")
CRON_SECRET = os.environ.get("CRON_SECRET", "")
CLIENT_ID = os.environ.get("CLIENT_ID")

SAMPLE_SIZE = 8


def _patch_backtest(backtest_id: str, fields: dict) -> None:
    """Patch the ticket_backtests row. Best-effort (never raises)."""
    try:
        supabase_request(
            "PATCH",
            "/rest/v1/ticket_backtests",
            params={"id": f"eq.{backtest_id}"},
            json=fields,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[ticket_backtest] patch failed: {exc}")


def _classify(message: str, provider=None, model=None) -> dict:
    """Call the dry-run firewall endpoint for one ticket, optionally forcing a
    specific LLM provider/model (for the Claude-vs-GPT comparison)."""
    body = {"client_id": CLIENT_ID, "message": message}
    if provider:
        body["provider"] = provider
    if model:
        body["model"] = model
    resp = requests.post(
        f"{PUBLIC_API_URL}/api/engine/backtest-classify",
        headers={
            "Authorization": f"Bearer {CRON_SECRET}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()


def run() -> None:
    payload = load_payload()
    backtest_id = payload.get("backtest_id")
    limit = int(payload.get("limit") or 500)
    # Optional provider/model override — set by the compare mode to measure a
    # specific config (e.g. openai / gpt-5.4-mini). Absent = ambient provider.
    provider = payload.get("provider")
    model = payload.get("model")

    if not backtest_id:
        raise RuntimeError("payload.backtest_id is required")
    if not CLIENT_ID:
        raise RuntimeError("CLIENT_ID env is required")

    job_progress(5, "Chargement des tickets…")

    # Read up to `limit` most-recent historical tickets for this client.
    resp = supabase_request(
        "GET",
        "/rest/v1/ai_conversations",
        params={
            "client_id": f"eq.{CLIENT_ID}",
            "select": "id,customer_message,subject,created_at",
            "order": "created_at.desc",
            "limit": str(limit),
        },
    )
    if not resp.ok:
        raise RuntimeError(
            f"Failed to load ai_conversations: {resp.status_code} {resp.text[:300]}"
        )

    tickets = resp.json() or []
    total = len(tickets)

    if total == 0:
        _patch_backtest(
            backtest_id,
            {
                "status": "completed",
                "total_tickets": 0,
                "would_resolve_count": 0,
                "would_escalate_count": 0,
                "resolution_rate": 0,
                "sample": [],
                "completed_at": _now_iso(),
            },
        )
        job_progress(
            100,
            "Aucun ticket historique à rejouer",
            final_status="completed",
            result={"total_tickets": 0, "resolution_rate": 0},
        )
        return

    job_progress(10, f"Rejeu de {total} tickets en dry-run…")

    would_resolve = 0
    would_escalate = 0
    sample: list[dict] = []
    last_pct = 10

    for idx, ticket in enumerate(tickets):
        message = (ticket.get("customer_message") or "").strip()
        if not message:
            # No customer text to classify — count as escalate (a human
            # would have had to read it), but never abort the run.
            would_escalate += 1
            continue

        try:
            result = _classify(message, provider, model)
            resolved = bool(result.get("would_resolve"))
            if resolved:
                would_resolve += 1
            else:
                would_escalate += 1

            if len(sample) < SAMPLE_SIZE:
                sample.append(
                    {
                        "message": message[:280],
                        "classification": result.get("classification"),
                        "would_resolve": resolved,
                        "confidence": result.get("confidence"),
                    }
                )
        except Exception as exc:  # noqa: BLE001 — one bad ticket never aborts
            print(f"[ticket_backtest] ticket {ticket.get('id')} failed: {exc}")
            would_escalate += 1

        # Progress every ~10% (map 10→95 over the ticket loop).
        pct = 10 + int(((idx + 1) / total) * 85)
        if pct >= last_pct + 10 or idx + 1 == total:
            last_pct = pct
            job_progress(
                min(95, pct),
                f"{idx + 1}/{total} tickets rejoués…",
            )

    resolution_rate = round((would_resolve / total) * 100, 2) if total else 0

    _patch_backtest(
        backtest_id,
        {
            "status": "completed",
            "total_tickets": total,
            "would_resolve_count": would_resolve,
            "would_escalate_count": would_escalate,
            "resolution_rate": resolution_rate,
            "sample": sample,
            "completed_at": _now_iso(),
        },
    )

    job_progress(
        100,
        "Terminé",
        final_status="completed",
        result={
            "total_tickets": total,
            "would_resolve_count": would_resolve,
            "would_escalate_count": would_escalate,
            "resolution_rate": resolution_rate,
        },
    )


def _now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


def main() -> None:
    payload = load_payload()
    backtest_id = payload.get("backtest_id")
    try:
        run()
    except BaseException as exc:  # noqa: BLE001 — mark the row failed too
        if backtest_id:
            _patch_backtest(
                backtest_id,
                {
                    "status": "failed",
                    "error": str(exc)[:2000],
                    "completed_at": _now_iso(),
                },
            )
        # Re-raise so safe_main marks the e2b_jobs row failed.
        raise


if __name__ == "__main__":
    safe_main(main)
