"""
Knowledge Base — DEEP storefront crawl + periodic refresh (E2B sandbox).

Unbounded counterpart of the shipped serverless api/knowledge/crawl-site.js.
That endpoint is capped (10 pages, 60s Vercel limit). This sandbox version
crawls the merchant's ENTIRE help center with a far more generous budget
(up to ~60 SAV pages, batched Tavily Extract, multi-chunk Claude) so the KB
is deeply seeded, and re-runs periodically to keep it fresh.

Mirrors crawl-site.js exactly for the parts that matter:
  - the SAV URL keyword filter (identical list, FR + EN)
  - the Claude model + JSON-entries prompt + anti-duplication-vs-existing-titles
  - the insert shape: source='auto_crawl', needs_review=true, is_active=true,
    sort_order continuing after the current max for the client

Bounded / cost-aware (it's a 30-min sandbox, not infinite):
  - URLS_CAP        max SAV URLs extracted
  - EXTRACT_BATCH   URLs per Tavily Extract call
  - MAX_CHUNKS      max Claude calls (each chunk ~CHUNK_CHARS of content)
  - CHUNK_CHARS     content sent to Claude per chunk

Env (via spawnJob): TAVILY_API_KEY, ANTHROPIC_API_KEY + lib_actero defaults
(JOB_ID, SUPABASE_URL, SUPABASE_SERVICE_KEY, CLIENT_ID, JOB_PAYLOAD).
"""

from __future__ import annotations

import os
import sys
import json
from datetime import datetime, timezone

import requests

from lib_actero import (  # noqa: E402
    load_payload,
    job_progress,
    supabase_request,
    safe_main,
    fail,
)

CLIENT_ID = os.environ.get("CLIENT_ID")
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

# Same SAV-relevant page keywords (FR + EN) as crawl-site.js. Matched
# case-insensitively against the URL so we only crawl support-useful pages.
SAV_KEYWORDS = [
    "faq", "aide", "help", "support",
    "livraison", "shipping", "delivery",
    "retour", "return", "remboursement", "refund",
    "cgv", "terms", "conditions",
    "contact", "a-propos", "about",
    "garantie", "warranty",
    "taille", "size", "guide",
    "paiement", "payment",
]

# Cost-aware caps. "Deep" but still bounded — see module docstring.
MAP_LIMIT = 200          # Tavily map: discover up to 200 URLs
MAP_MAX_DEPTH = 3        # crawl 3 levels deep
URLS_CAP = 60            # max SAV URLs we extract (vs 10 in the capped version)
EXTRACT_BATCH = 10       # URLs per Tavily Extract call
PER_RESULT_CAP = 8000    # chars kept per extracted page
MAX_CHUNKS = 6           # max Claude calls
CHUNK_CHARS = 9000       # content per Claude chunk (matches import-url cap)

CLAUDE_MODEL = "claude-sonnet-4-20250514"


def _storefront_url() -> str | None:
    """Resolve storefront from client_shopify_connections (same as crawl-site.js)."""
    resp = supabase_request(
        "GET",
        "/rest/v1/client_shopify_connections",
        params={
            "client_id": f"eq.{CLIENT_ID}",
            "select": "shop_domain",
            "limit": "1",
        },
    )
    if not resp.ok:
        return None
    rows = resp.json() or []
    shop = (rows[0].get("shop_domain") if rows else None) or None
    if not shop:
        return None
    if shop.lower().startswith("http://") or shop.lower().startswith("https://"):
        return shop
    return f"https://{shop}"


def _tavily_map(domain_url: str) -> list[str]:
    """Tavily map -> flat list of URLs. Never throws."""
    try:
        res = requests.post(
            "https://api.tavily.com/map",
            json={
                "api_key": TAVILY_API_KEY,
                "url": domain_url,
                "limit": MAP_LIMIT,
                "max_depth": MAP_MAX_DEPTH,
            },
            timeout=60,
        )
        if not res.ok:
            sys.stderr.write(f"[kb_deep_crawl] tavily map {res.status_code}\n")
            return []
        data = res.json() or {}
    except Exception as e:
        sys.stderr.write(f"[kb_deep_crawl] tavily map failed: {e}\n")
        return []

    # Normalise the various shapes Tavily may return (same logic as kb-extract.js).
    raw = None
    for candidate in (
        data.get("results"),
        data.get("links"),
        data if isinstance(data, list) else None,
        (data.get("data") or {}).get("results") if isinstance(data.get("data"), dict) else None,
        data.get("data") if isinstance(data.get("data"), list) else None,
    ):
        if isinstance(candidate, list):
            raw = candidate
            break
    if raw is None:
        raw = []

    urls = []
    for item in raw:
        if isinstance(item, str):
            u = item
        elif isinstance(item, dict):
            u = item.get("url") or item.get("href") or item.get("link") or ""
        else:
            u = ""
        if isinstance(u, str) and (u.lower().startswith("http://") or u.lower().startswith("https://")):
            urls.append(u)
    # de-dupe, preserve order
    seen: set[str] = set()
    out = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def _tavily_extract(urls: list[str]) -> str:
    """Tavily Extract a batch of URLs -> concatenated markdown. Never throws."""
    if not urls:
        return ""
    try:
        res = requests.post(
            "https://api.tavily.com/extract",
            json={
                "api_key": TAVILY_API_KEY,
                "urls": urls,
                "extract_depth": "advanced",
                "format": "markdown",
            },
            timeout=120,
        )
        if not res.ok:
            sys.stderr.write(f"[kb_deep_crawl] tavily extract {res.status_code}\n")
            return ""
        data = res.json() or {}
    except Exception as e:
        sys.stderr.write(f"[kb_deep_crawl] tavily extract failed: {e}\n")
        return ""

    results = data.get("results") if isinstance(data.get("results"), list) else []
    parts = []
    for r in results:
        raw = (r or {}).get("raw_content") or (r or {}).get("content")
        if not raw:
            continue
        clean = str(raw).strip()
        if len(clean) < 1:
            continue
        head = f"## {r.get('url')}\n\n" if r.get("url") else ""
        parts.append(head + clean[:PER_RESULT_CAP])
    return "\n\n---\n\n".join(parts).strip()


def _existing_titles() -> list[str]:
    """Active KB titles for this client -> Claude dedups against them."""
    resp = supabase_request(
        "GET",
        "/rest/v1/client_knowledge_base",
        params={
            "client_id": f"eq.{CLIENT_ID}",
            "is_active": "eq.true",
            "select": "title",
        },
    )
    if not resp.ok:
        return []
    return [r["title"] for r in (resp.json() or []) if r.get("title")]


def _max_sort_order() -> int:
    """Continue sort_order after the current max for this client (same as crawl-site.js)."""
    resp = supabase_request(
        "GET",
        "/rest/v1/client_knowledge_base",
        params={
            "client_id": f"eq.{CLIENT_ID}",
            "select": "sort_order",
            "order": "sort_order.desc",
            "limit": "1",
        },
    )
    if not resp.ok:
        return -1
    rows = resp.json() or []
    if not rows:
        return -1
    return rows[0].get("sort_order") if rows[0].get("sort_order") is not None else -1


def _claude_entries(content: str, source_label: str, existing_titles: list[str]) -> list[dict]:
    """Same model / prompt / dedup instruction / repair logic as kb-extract.js.

    Returns [] on any failure for this chunk (per-chunk resilience — never
    aborts the whole run).
    """
    system = (
        "Tu es un extracteur de contenu pour un agent de support client IA. "
        "A partir du contenu d'une page web, genere des entrees pour une base "
        "de connaissances.\n\n"
        "Genere entre 5 et 15 entrees, melange de:\n"
        "- FAQ (question/reponse) — categorie \"faq\"\n"
        "- Politiques (livraison, retour, remboursement) — categorie \"policy\"\n"
        "- Informations produit — categorie \"product\"\n\n"
        "Reponds UNIQUEMENT en JSON valide:\n"
        "[\n"
        "  {\"category\": \"faq|policy|product\", \"title\": \"titre ou question\", "
        "\"content\": \"contenu detaille de la reponse\"}\n"
        "]\n\n"
        "Pas de markdown, pas de commentaires, juste le JSON."
    )
    if existing_titles:
        listed = "\n".join(f"- {t}" for t in existing_titles[:200])
        system += (
            "\n\nVoici les titres déjà présents dans la base :\n"
            f"{listed}\n"
            "N'ajoute QUE des informations nouvelles. Ne duplique pas, ne "
            "reformule pas un doublon, ne contredis pas une entrée existante."
        )

    try:
        res = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
            },
            json={
                "model": CLAUDE_MODEL,
                "max_tokens": 2000,
                "system": system,
                "messages": [
                    {
                        "role": "user",
                        "content": f"Contenu de la page {source_label}:\n\n{content[:CHUNK_CHARS]}",
                    }
                ],
            },
            timeout=120,
        )
        if not res.ok:
            sys.stderr.write(f"[kb_deep_crawl] claude {res.status_code}\n")
            return []
        data = res.json() or {}
    except Exception as e:
        sys.stderr.write(f"[kb_deep_crawl] claude call failed: {e}\n")
        return []

    try:
        raw_text = (data.get("content") or [{}])[0].get("text") or "[]"
    except Exception:
        return []

    raw_text = raw_text.strip()
    for prefix in ("```json", "```"):
        if raw_text.lower().startswith(prefix):
            raw_text = raw_text[len(prefix):].strip()
    if raw_text.endswith("```"):
        raw_text = raw_text[:-3].strip()

    start = raw_text.find("[")
    end = raw_text.rfind("]")
    if start != -1 and end != -1 and end > start:
        raw_text = raw_text[start : end + 1]

    entries = None
    try:
        entries = json.loads(raw_text)
    except Exception:
        try:
            entries = json.loads(raw_text.replace(",]", "]").replace(",}", "}"))
        except Exception:
            return []

    if not isinstance(entries, list):
        return []
    return entries


def main() -> None:
    load_payload()  # no fields needed; keeps the lib_actero contract explicit

    if not CLIENT_ID:
        fail("CLIENT_ID not set")
    if not TAVILY_API_KEY or not ANTHROPIC_API_KEY:
        fail("TAVILY_API_KEY / ANTHROPIC_API_KEY not configured")

    job_progress(5, "Résolution de la boutique...")
    storefront = _storefront_url()
    if not storefront:
        # No storefront — still mark scheduling state so refresh doesn't loop.
        _mark_settings()
        job_progress(100, "Aucune boutique", final_status="completed",
                     result={"imported": 0, "urls": [], "skipped": "no_storefront"})
        return

    job_progress(15, "Cartographie du site (Tavily map)...")
    mapped = _tavily_map(storefront)

    filtered: list[str] = []
    seen: set[str] = set()
    for u in mapped:
        low = str(u).lower()
        if any(kw in low for kw in SAV_KEYWORDS) and u not in seen:
            seen.add(u)
            filtered.append(u)
        if len(filtered) >= URLS_CAP:
            break

    if not filtered:
        _mark_settings()
        job_progress(100, "Aucune page SAV", final_status="completed",
                     result={"imported": 0, "urls": [], "skipped": "no_sav_pages"})
        return

    job_progress(30, f"Extraction de {len(filtered)} pages...")
    content_parts: list[str] = []
    for i in range(0, len(filtered), EXTRACT_BATCH):
        batch = filtered[i : i + EXTRACT_BATCH]
        try:
            txt = _tavily_extract(batch)
            if txt:
                content_parts.append(txt)
        except Exception as e:
            # Per-batch resilience — one bad batch never aborts the run.
            sys.stderr.write(f"[kb_deep_crawl] extract batch failed: {e}\n")
        done = min(len(filtered), i + EXTRACT_BATCH)
        job_progress(30 + int(25 * done / max(1, len(filtered))),
                     f"Extraction {done}/{len(filtered)}...")

    full_content = "\n\n---\n\n".join(content_parts).strip()
    if len(full_content) < 100:
        _mark_settings()
        job_progress(100, "Contenu insuffisant", final_status="completed",
                     result={"imported": 0, "urls": filtered, "skipped": "no_content"})
        return

    job_progress(60, "Préparation de la déduplication...")
    existing_titles = _existing_titles()
    base_order = _max_sort_order() + 1

    # Chunk the content; cap total Claude calls at MAX_CHUNKS (cost guard).
    chunks: list[str] = []
    for i in range(0, len(full_content), CHUNK_CHARS):
        chunks.append(full_content[i : i + CHUNK_CHARS])
        if len(chunks) >= MAX_CHUNKS:
            break

    all_entries: list[dict] = []
    seen_titles_lower = {t.lower() for t in existing_titles}
    for idx, chunk in enumerate(chunks):
        try:
            entries = _claude_entries(chunk, storefront, existing_titles)
        except Exception as e:
            # Per-chunk resilience.
            sys.stderr.write(f"[kb_deep_crawl] claude chunk {idx} failed: {e}\n")
            entries = []
        for e in entries or []:
            title = (e.get("title") or "").strip()
            body = (e.get("content") or "").strip()
            if not title or not body:
                continue
            if title.lower() in seen_titles_lower:
                continue  # extra in-run dedup across chunks
            seen_titles_lower.add(title.lower())
            all_entries.append(
                {
                    "client_id": CLIENT_ID,
                    "category": (e.get("category") or "faq"),
                    "title": title,
                    "content": body,
                    "sort_order": base_order + len(all_entries),
                    "is_active": True,
                    "source": "auto_crawl",
                    "needs_review": True,
                }
            )
        job_progress(60 + int(25 * (idx + 1) / max(1, len(chunks))),
                     f"Analyse IA {idx + 1}/{len(chunks)}...")

    imported = 0
    if all_entries:
        resp = supabase_request(
            "POST",
            "/rest/v1/client_knowledge_base",
            json=all_entries,
        )
        if resp.ok:
            imported = len(all_entries)
        else:
            sys.stderr.write(f"[kb_deep_crawl] insert failed {resp.status_code}\n")

    job_progress(90, "Mise à jour des paramètres...")
    _mark_settings()

    job_progress(
        100,
        f"{imported} entrées importées",
        final_status="completed",
        result={"imported": imported, "urls": filtered},
    )


def _mark_settings() -> None:
    """PATCH client_settings: kb_last_deep_crawl_at=now(), kb_autocrawl_done=true.

    Best-effort — never aborts the run.
    """
    try:
        supabase_request(
            "PATCH",
            "/rest/v1/client_settings",
            params={"client_id": f"eq.{CLIENT_ID}"},
            json={
                "kb_last_deep_crawl_at": datetime.now(timezone.utc).isoformat(),
                "kb_autocrawl_done": True,
            },
        )
    except Exception as e:
        sys.stderr.write(f"[kb_deep_crawl] _mark_settings failed: {e}\n")


if __name__ == "__main__":
    safe_main(main)
