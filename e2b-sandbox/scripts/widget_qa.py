"""
Widget Install QA — verifies the Actero chat widget is actually present on a
client's live storefront. Catches broken installs (theme reverted, script
stripped by a theme update, widget block commented out) before the client
notices.

Approach: requests-only (no headless browser).
  The shared E2B runner (api/lib/e2b-runner.js) pip-installs a FIXED package
  list (requests / pydantic / python-dotenv) and exposes no mechanism to add
  playwright + chromium without modifying the runner (out of scope here). So
  we fetch the storefront HTML over HTTP and look for the EXACT markers the
  installer injects into the merchant theme.

Markers (source of truth):
  - api/engine/shopify-widget.js  ->  WIDGET_TAG = '<!-- ACTERO-WIDGET -->'
    and the injected tag:
    <script src="https://actero.fr/widget.js?v=..." data-actero-key="..."></script>
  - public/widget.js header documents the same install snippet
    (data-actero-key attribute, widget.js src).

widget_found   = the widget <script ... widget.js ... data-actero-key ...> tag
                 is present in served HTML.
widget_visible = the tag is present AND not neutralised (not inside an HTML
                 comment, not type="text/template", not a disabled/commented
                 ACTERO-WIDGET block). True visual visibility cannot be
                 asserted without a browser; this is a best-effort static
                 check and is reported honestly (visible == found when the
                 script is live and not disabled).

Payload: { "health_id": "<uuid>" }   CLIENT_ID comes from env.
Writes ONLY to: widget_health (id=health_id) + the e2b_jobs row (via lib).
Pure read of the public storefront.
"""

from __future__ import annotations

import re
import sys
from datetime import datetime, timezone

import requests

from lib_actero import load_payload, job_progress, supabase_request, safe_main, CLIENT_ID

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# Pages to probe (homepage first; widget is theme-wide so homepage is usually
# enough). Capped at 3 fetches total per the non-regression contract.
EXTRA_PATHS = ["/cart", "/pages/contact"]

# Core signature: a <script> tag that loads widget.js AND carries the
# data-actero-key attribute. Order-independent (attrs can be in any order).
SCRIPT_TAG_RE = re.compile(r"<script\b[^>]*>", re.IGNORECASE)
WIDGET_SRC_RE = re.compile(r"""src\s*=\s*['"][^'"]*\bwidget\.js""", re.IGNORECASE)
ACTERO_KEY_RE = re.compile(r"data-actero-key\s*=", re.IGNORECASE)
WIDGET_COMMENT_MARKER = "ACTERO-WIDGET"  # from WIDGET_TAG '<!-- ACTERO-WIDGET -->'


def _find_widget_script_tags(html: str) -> list[str]:
    """Return every <script ...> open tag that looks like the Actero widget."""
    tags = []
    for m in SCRIPT_TAG_RE.finditer(html):
        tag = m.group(0)
        if WIDGET_SRC_RE.search(tag) and ACTERO_KEY_RE.search(tag):
            tags.append(tag)
    return tags


def _strip_html_comments(html: str) -> str:
    """Remove <!-- ... --> blocks so we can tell a live tag from a commented one."""
    return re.sub(r"<!--.*?-->", "", html, flags=re.DOTALL)


def _analyze(html: str) -> tuple[bool, bool]:
    """Return (widget_found, widget_visible) for one page's HTML."""
    found = bool(_find_widget_script_tags(html))
    if not found:
        return False, False

    # "visible" best-effort: the widget script must still be present AFTER we
    # strip HTML comments (so a commented-out ACTERO-WIDGET block does NOT count
    # as visible), and it must not be neutralised as an inert template script.
    live_html = _strip_html_comments(html)
    live_tags = _find_widget_script_tags(live_html)
    visible = False
    for tag in live_tags:
        # type="text/template" / type="text/x-..." => script never executes.
        type_m = re.search(r"""type\s*=\s*['"]([^'"]+)['"]""", tag, re.IGNORECASE)
        if type_m:
            t = type_m.group(1).strip().lower()
            if t not in ("text/javascript", "module", "application/javascript"):
                continue
        visible = True
        break
    return found, visible


def _fetch(url: str) -> tuple[str, int]:
    resp = requests.get(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"},
        timeout=20,
        allow_redirects=True,
    )
    return (resp.text or ""), resp.status_code


# --- Contrôle au navigateur -------------------------------------------------
#
# Le contrôle statique répond « la balise <script> est-elle dans le HTML ? ».
# Ce n'est pas la question du marchand. La sienne est « la bulle apparaît-elle
# sur ma boutique ? », et les deux se séparent dès que quelque chose casse
# APRÈS le chargement de la page : widget.js qui part en 404, une erreur JS
# dans le script, une Content-Security-Policy du thème qui bloque le domaine.
# Dans ces trois cas la balise est bien là — et le client ne voit rien.
#
# Playwright n'est installé que si api/jobs/widget-qa.js le demande. S'il
# manque, si Chromium n'a pas pu s'installer, ou si la page met trop longtemps,
# on renvoie None et l'appelant garde le verdict statique. Un contrôle dégradé
# vaut mieux qu'un contrôle absent ; un contrôle qui MENT ne vaut rien.

WIDGET_SELECTOR = "#actero-widget-btn"   # public/widget.js:386


def _verifier_au_navigateur(url: str):
    """La bulle est-elle réellement rendue ? True / False / None (indécidable)."""
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        return None

    try:
        with sync_playwright() as pw:
            navigateur = pw.chromium.launch(args=["--no-sandbox"])
            try:
                page = navigateur.new_page(user_agent=USER_AGENT)
                page.goto(url, wait_until="domcontentloaded", timeout=30_000)
                # La bulle s'injecte après le chargement du script : on lui
                # laisse le temps d'apparaître plutôt que de regarder trop tôt.
                try:
                    page.wait_for_selector(WIDGET_SELECTOR, state="attached", timeout=15_000)
                except Exception:
                    return False
                return bool(page.is_visible(WIDGET_SELECTOR))
            finally:
                navigateur.close()
    except Exception as exc:
        print(f"[widget_qa] contrôle navigateur indisponible : {exc}", file=sys.stderr)
        return None


def _patch_health(health_id: str, fields: dict) -> None:
    fields = dict(fields)
    fields["checked_at"] = datetime.now(timezone.utc).isoformat()
    supabase_request(
        "PATCH",
        "/rest/v1/widget_health",
        params={"id": f"eq.{health_id}"},
        json=fields,
    )


def main() -> None:
    payload = load_payload()
    health_id = payload.get("health_id")
    if not health_id:
        # Nothing we can update; fail the job loudly.
        job_progress(0, "health_id manquant dans le payload",
                     final_status="failed", error="payload.health_id is required")
        sys.exit(1)

    if not CLIENT_ID:
        _patch_health(health_id, {"error": "CLIENT_ID manquant"})
        job_progress(0, "CLIENT_ID manquant", final_status="failed",
                     error="CLIENT_ID env not set")
        sys.exit(1)

    job_progress(10, "Résolution de la boutique…")

    # Resolve storefront domain — same convention as api/knowledge/crawl-site.js.
    resp = supabase_request(
        "GET",
        "/rest/v1/client_shopify_connections",
        params={
            "client_id": f"eq.{CLIENT_ID}",
            "select": "shop_domain",
            "limit": "1",
        },
    )
    rows = []
    try:
        rows = resp.json() if resp.ok else []
    except Exception:
        rows = []
    shop_domain = (rows[0].get("shop_domain") if rows else None) or None

    if not shop_domain:
        msg = "Aucune boutique Shopify connectée pour ce client"
        _patch_health(health_id, {"error": msg, "widget_found": False,
                                  "widget_visible": False})
        job_progress(100, msg, final_status="completed",
                     result={"found": False, "visible": False,
                             "skipped": "no_storefront"})
        return

    base = shop_domain if re.match(r"^https?://", shop_domain, re.I) else f"https://{shop_domain}"
    base = base.rstrip("/")

    job_progress(20, "Visite de la boutique…")

    found = False
    visible = False
    checked_url = base
    last_error = None
    fetches = 0
    MAX_FETCHES = 3

    candidates = [base] + [base + p for p in EXTRA_PATHS]
    for url in candidates:
        if fetches >= MAX_FETCHES:
            break
        fetches += 1
        try:
            html, status = _fetch(url)
            checked_url = url
            if status >= 400:
                last_error = f"HTTP {status} sur {url}"
                # Homepage failing is fatal-ish; still try other pages.
                continue
            last_error = None
            page_found, page_visible = _analyze(html)
            if page_found:
                found = True
                visible = page_visible
                checked_url = url
                break  # widget is theme-wide; one hit is enough
        except requests.RequestException as exc:
            last_error = f"Échec du chargement de {url}: {exc}"[:300]
            continue

    job_progress(80, "Analyse du widget…")

    # La balise est là : reste à savoir si la bulle APPARAÎT. C'est la seule
    # question qui intéresse le marchand, et le HTML ne peut pas y répondre.
    methode = "html"
    if found:
        job_progress(85, "Vérification du rendu dans un navigateur…")
        rendu = _verifier_au_navigateur(checked_url)
        if rendu is not None:
            methode = "navigateur"
            visible = rendu

    # If we never found it but every fetch errored, surface that as the error.
    error_msg = None
    if not found and last_error:
        error_msg = last_error

    _patch_health(health_id, {
        "url_checked": checked_url,
        "widget_found": found,
        "widget_visible": visible,
        "error": error_msg,
    })

    if not found and error_msg:
        # Reachability problem — record it but don't crash the job; the row
        # carries the diagnostic for the admin.
        job_progress(
            100,
            "Terminé (boutique injoignable)",
            final_status="completed",
            result={"found": False, "visible": False, "error": error_msg},
        )
        return

    if found and visible:
        summary = "Bulle présente et affichée"
    elif found and methode == "navigateur":
        # Le cas que le contrôle statique ne savait pas voir : la balise est
        # dans la page, la bulle n'apparaît pas. Script en 404, erreur JS, ou
        # CSP du thème.
        summary = "Balise présente mais la bulle ne s’affiche pas"
    elif found:
        summary = "Widget présent mais désactivé/commenté"
    else:
        summary = "Widget introuvable sur la boutique"
    job_progress(
        100,
        summary,
        final_status="completed",
        result={"found": found, "visible": visible, "url": checked_url, "methode": methode},
    )


if __name__ == "__main__":
    safe_main(main)
