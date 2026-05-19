-- Additive only. New result tables for the E2B feature bundle.
-- Applied 2026-05-18
--
-- Bundle: ticket backtest (dry-run replay), widget install QA,
-- deep KB crawl + periodic refresh. No existing table/constraint is
-- altered. e2b_jobs.job_type has no CHECK constraint (free text) so
-- new job types need no DDL.

-- 1. Ticket backtest results (dry-run replay of historical tickets)
create table if not exists public.ticket_backtests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  job_id uuid,
  status text not null default 'running'
    check (status in ('running','completed','failed')),
  total_tickets integer not null default 0,
  would_resolve_count integer not null default 0,
  would_escalate_count integer not null default 0,
  resolution_rate numeric(5,2),
  sample jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_ticket_backtests_client on public.ticket_backtests (client_id, created_at desc);
alter table public.ticket_backtests enable row level security;
create policy ticket_backtests_admin_read on public.ticket_backtests
  for select to authenticated using (public.is_admin());

-- 2. Widget install health checks (headless visit of the live storefront)
create table if not exists public.widget_health (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  job_id uuid,
  url_checked text,
  widget_found boolean not null default false,
  widget_visible boolean not null default false,
  error text,
  checked_at timestamptz not null default now()
);
create index if not exists idx_widget_health_client on public.widget_health (client_id, checked_at desc);
alter table public.widget_health enable row level security;
create policy widget_health_admin_read on public.widget_health
  for select to authenticated using (public.is_admin());

-- 3. KB deep-crawl / refresh tracking (reuses client_knowledge_base for rows)
alter table public.client_settings
  add column if not exists kb_last_deep_crawl_at timestamptz;
