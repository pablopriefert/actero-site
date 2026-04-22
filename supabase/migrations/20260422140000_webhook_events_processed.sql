-- Idempotency table for inbound webhooks (Stripe, Shopify, Slack, etc.).
-- Each row marks a (provider, event_id) tuple as already processed so a
-- retry from the upstream provider cannot re-execute side effects (creating
-- a duplicate client, charging twice, etc.).

create table if not exists public.webhook_events_processed (
  provider text not null,
  event_id text not null,
  processed_at timestamptz not null default now(),
  primary key (provider, event_id)
);

-- Auto-purge rows older than 30 days. Stripe replays only within ~3 days,
-- Shopify within ~24h — 30d gives ample margin and keeps the table small.
create index if not exists idx_webhook_events_processed_at
  on public.webhook_events_processed (processed_at);

-- RLS: only service role writes here; nobody else needs to see it.
alter table public.webhook_events_processed enable row level security;

drop policy if exists "service role only webhook_events_processed"
  on public.webhook_events_processed;
create policy "service role only webhook_events_processed"
  on public.webhook_events_processed
  for all
  to service_role
  using (true)
  with check (true);
