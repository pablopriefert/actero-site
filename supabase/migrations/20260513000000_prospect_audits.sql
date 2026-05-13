-- Prospect Audits table
-- Stores automated audit results from review scraping + Claude AI analysis.
-- Used by the cold email outreach pipeline.

create table if not exists public.prospect_audits (
  id uuid primary key default gen_random_uuid(),
  store_name text not null,
  store_url text,
  contact_email text,
  contact_name text,
  report_token text not null unique,
  average_rating numeric(3,1) default 0,
  total_reviews integer default 0,
  negative_reviews_count integer default 0,
  reviews_source text default 'google',
  raw_reviews jsonb default '[]'::jsonb,
  analysis jsonb default '{}'::jsonb,
  support_score integer default 0,
  email_status text default 'pending' check (email_status in ('pending','sent','opened','replied')),
  email_sent_at timestamptz,
  report_opened_at timestamptz,
  resend_email_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for common queries
create index if not exists idx_prospect_audits_report_token on public.prospect_audits (report_token);
create index if not exists idx_prospect_audits_email_status on public.prospect_audits (email_status);
create index if not exists idx_prospect_audits_created_at on public.prospect_audits (created_at desc);

-- RLS: service_role only (no public access, admin endpoints use service_role key)
alter table public.prospect_audits enable row level security;

-- Allow service role full access (API endpoints use SUPABASE_SERVICE_ROLE_KEY)
-- service_role bypasses RLS automatically.
-- Authenticated users can read (admin check is app-level in the dashboard).
create policy "Authenticated users can read prospect_audits"
  on public.prospect_audits for select to authenticated using (true);

-- Auto-update updated_at
create or replace function public.set_prospect_audit_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger prospect_audits_updated_at
  before update on public.prospect_audits
  for each row
  execute function public.set_prospect_audit_updated_at();
