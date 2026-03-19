-- Table: funnel_clients
-- Stores private funnel client data for payment links

create table if not exists public.funnel_clients (
  id uuid default gen_random_uuid() primary key,
  company_name text not null,
  slug text not null unique,
  email text not null,
  setup_price integer not null default 800,
  monthly_price integer not null default 800,
  message text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'canceled')),
  stripe_session_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- Index for fast slug lookups (public pages)
create index if not exists idx_funnel_clients_slug on public.funnel_clients (slug);

-- RLS: allow authenticated users (admin) full access
alter table public.funnel_clients enable row level security;

-- Admin can do everything
create policy "Admin full access" on public.funnel_clients
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Anonymous users can read (for public /start/[slug] page)
create policy "Public read by slug" on public.funnel_clients
  for select
  using (true);
