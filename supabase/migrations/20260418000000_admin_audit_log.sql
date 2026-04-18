-- Admin audit log
-- ----------------
-- Records every destructive / privileged action performed by an admin
-- (client deletion, memory wipe, API key regen, subscription mutations…)
-- so we can:
--   1. review what happened when support has to explain a lost account
--   2. detect misuse (hostile takeover, rogue admin)
--   3. forensics on data-loss incidents
--
-- Writes are append-only by convention — no UPDATE / DELETE policy is added.
-- Reads are admin-only via RLS. Admin detection matches app-level logic:
-- an admin is any row present in `admin_users` (keyed by auth.users.id).

create table if not exists admin_audit_log (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  -- who
  admin_user_id uuid references auth.users(id) on delete set null,
  admin_email text,
  -- what + where
  action text not null,                -- e.g. 'client.delete', 'client.wipe_memory', 'keys.rotate'
  target_type text,                    -- 'client', 'partner', 'subscription', …
  target_id text,                      -- human-readable id of the affected row
  -- context
  details jsonb not null default '{}'::jsonb,  -- reason, before/after snapshot, ip, user-agent
  ip_address inet,
  user_agent text
);

create index if not exists idx_admin_audit_log_created_at on admin_audit_log (created_at desc);
create index if not exists idx_admin_audit_log_admin_email on admin_audit_log (admin_email);
create index if not exists idx_admin_audit_log_action on admin_audit_log (action);
create index if not exists idx_admin_audit_log_target on admin_audit_log (target_type, target_id);

alter table admin_audit_log enable row level security;

drop policy if exists "admins read audit log" on admin_audit_log;
drop policy if exists "admins insert audit log" on admin_audit_log;

-- Read: any row in admin_users (= app-level admin) can read the log.
create policy "admins read audit log" on admin_audit_log
  for select to authenticated
  using (
    exists (select 1 from admin_users au where au.user_id = auth.uid())
  );

-- Insert: admins can only insert rows attributed to themselves (prevents
-- a compromised admin session from masquerading as a different admin).
create policy "admins insert audit log" on admin_audit_log
  for insert to authenticated
  with check (
    exists (select 1 from admin_users au where au.user_id = auth.uid())
    and admin_user_id = auth.uid()
  );

-- No UPDATE / DELETE policies = append-only by default.

comment on table admin_audit_log is 'Append-only record of destructive/privileged admin actions. Read/insert restricted to admins.';
comment on column admin_audit_log.action is 'Dot-separated event name, e.g. client.delete or keys.rotate.';
comment on column admin_audit_log.details is 'Free-form JSON context (reason, before/after snapshot, etc.).';
