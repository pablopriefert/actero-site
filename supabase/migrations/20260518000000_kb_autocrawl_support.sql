-- Auto-crawl KB seeding from the merchant's website at onboarding (Tavily).
-- Applied 2026-05-18
--
-- After the E2B Shopify onboarding job seeds the KB from structured Shopify
-- data, a Node endpoint (api/knowledge/crawl-site.js) maps the merchant's
-- storefront, extracts the SAV pages (FAQ / shipping / returns / …) via
-- Tavily, and adds net-new entries (Claude dedups against the existing KB).
-- Those entries are flagged needs_review so the dashboard can nudge the
-- merchant to verify them. A per-client flag makes the crawl idempotent.

-- client_knowledge_base.source already exists (text) — reused with value
-- 'auto_crawl' for these entries.

alter table public.client_knowledge_base
  add column if not exists needs_review boolean not null default false;

create index if not exists idx_ckb_needs_review
  on public.client_knowledge_base (client_id) where needs_review = true;

alter table public.client_settings
  add column if not exists kb_autocrawl_done boolean not null default false;
