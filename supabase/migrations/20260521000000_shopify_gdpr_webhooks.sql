-- =====================================================================
-- Shopify App Store — mandatory GDPR webhooks
--
-- Adds:
--   1. `clients.status` + `clients.uninstalled_at` so app/uninstalled can mark
--      a tenant as inactive without deleting their row (data deletion only
--      happens 48h later via shop/redact, per Shopify's contract).
--   2. `shopify_gdpr_log` — append-only audit trail for every GDPR webhook
--      we process, so we can prove compliance if Shopify (or a data subject)
--      asks. Stores the payload hash, not the payload itself (PII-safe).
--
-- Strictly additive — no existing column or row is modified.
-- =====================================================================

-- 1. clients.status + uninstalled_at -------------------------------------------------
alter table public.clients
  add column if not exists status text,
  add column if not exists uninstalled_at timestamptz;

comment on column public.clients.status is
  'Lifecycle status. NULL = active (default). Known values: ''uninstalled'' (Shopify app removed; data still present pending shop/redact).';

comment on column public.clients.uninstalled_at is
  'Timestamp the Shopify app/uninstalled webhook fired for this client. NULL while installed or re-installed.';

-- 2. shopify_gdpr_log ------------------------------------------------------------------
create table if not exists public.shopify_gdpr_log (
  id           uuid primary key default gen_random_uuid(),
  webhook_type text not null check (webhook_type in (
    'customers/data_request',
    'customers/redact',
    'shop/redact',
    'app/uninstalled'
  )),
  shop_domain    text,
  customer_email text,
  client_id      uuid references public.clients(id) on delete set null,
  payload_hash   text,           -- sha256 of raw body, for forensics without storing PII
  rows_affected  jsonb default '{}'::jsonb,
  http_status    int  not null,
  processed_at   timestamptz not null default now(),
  notes          text
);

comment on table public.shopify_gdpr_log is
  'Append-only audit trail for Shopify GDPR / lifecycle webhooks. Never store the raw payload — only its SHA-256 hash plus the action we took.';

create index if not exists shopify_gdpr_log_processed_at_idx
  on public.shopify_gdpr_log (processed_at desc);

create index if not exists shopify_gdpr_log_shop_domain_idx
  on public.shopify_gdpr_log (shop_domain);

create index if not exists shopify_gdpr_log_webhook_type_idx
  on public.shopify_gdpr_log (webhook_type);

-- RLS: service role only. No client/merchant should ever read this table.
alter table public.shopify_gdpr_log enable row level security;

drop policy if exists "shopify_gdpr_log_no_public_access" on public.shopify_gdpr_log;
create policy "shopify_gdpr_log_no_public_access"
  on public.shopify_gdpr_log
  for all
  to authenticated, anon
  using (false)
  with check (false);
