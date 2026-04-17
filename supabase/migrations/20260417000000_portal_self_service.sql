-- Customer self-service portal — data model
-- Spec: docs/superpowers/specs/2026-04-17-customer-self-service-portal-design.md

-- 1) Merchant-side columns on clients
alter table clients
  add column if not exists portal_enabled boolean not null default false,
  add column if not exists portal_custom_domain text unique,
  add column if not exists portal_logo_url text,
  add column if not exists portal_primary_color text,
  add column if not exists portal_display_name text;

-- 2) Magic-link + active session storage (server-only, never read from browser)
create table if not exists portal_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  customer_email text not null,
  token_hash text not null,
  purpose text not null check (purpose in ('magic_link', 'session')),
  expires_at timestamptz not null,
  used_at timestamptz,
  ip_inet inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists portal_sessions_client_email_idx on portal_sessions (client_id, lower(customer_email));
create index if not exists portal_sessions_token_idx on portal_sessions (token_hash);
create index if not exists portal_sessions_expires_idx on portal_sessions (expires_at);

-- 3) Audit log for every portal action
create table if not exists portal_action_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  customer_email text not null,
  action text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_inet inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists portal_action_logs_customer_idx on portal_action_logs (client_id, lower(customer_email), created_at desc);

-- 4) RLS — both tables are service-role-only from the API
alter table portal_sessions enable row level security;
alter table portal_action_logs enable row level security;

create policy "portal_sessions service role only" on portal_sessions
  for all to service_role using (true) with check (true);

create policy "portal_action_logs service role only" on portal_action_logs
  for all to service_role using (true) with check (true);

create policy "portal_action_logs admin read" on portal_action_logs
  for select to authenticated using (
    client_id in (
      select id from clients where owner_user_id = auth.uid()
    )
    or exists (select 1 from auth.users where id = auth.uid() and email like '%@actero.fr')
  );
