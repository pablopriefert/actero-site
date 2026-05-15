-- Batch prospect-audit pipeline + cold-email compliance (RGPD/LCEN)
-- Applied 2026-05-14

-- 1. Track each prospect's stage through the batch pipeline
alter table public.prospect_audits
  add column if not exists pipeline_status text not null default 'queued'
  check (pipeline_status in ('queued','audited','emailed','skipped','failed'));

alter table public.prospect_audits
  add column if not exists pipeline_error text;

alter table public.prospect_audits
  add column if not exists batch_id text;

create index if not exists idx_prospect_audits_pipeline_status
  on public.prospect_audits (pipeline_status);

-- Existing rows that already have an analysis are 'audited' (or 'emailed' if sent)
update public.prospect_audits
  set pipeline_status = case
    when email_status in ('sent','opened','replied') then 'emailed'
    when analysis is not null and analysis <> '{}'::jsonb then 'audited'
    else 'queued'
  end
  where pipeline_status = 'queued';

-- 2. Permanent opt-out / suppression list (CAN-SPAM / LCEN art. L34-5)
create table if not exists public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  reason text not null default 'unsubscribe'
    check (reason in ('unsubscribe','bounce','complaint','manual')),
  source text default 'prospect_audit',
  created_at timestamptz not null default now()
);

create index if not exists idx_email_suppressions_email
  on public.email_suppressions (lower(email));

-- RLS: service-role only (admin endpoints use service key, public unsubscribe
-- endpoint uses service key after validating a signed token)
alter table public.email_suppressions enable row level security;

create policy email_suppressions_admin_read
  on public.email_suppressions for select
  to authenticated
  using (public.is_admin());
