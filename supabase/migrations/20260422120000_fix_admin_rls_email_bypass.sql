-- Fix admin RLS bypass via email string.
--
-- Several policies accepted any user whose email ended in '@actero.fr' as an
-- admin. Email strings can come from unverified sign-ups, SSO flows or
-- Supabase invites and are not a secure trust signal. Replace the email check
-- with the authoritative server-only markers: auth.users.raw_app_meta_data
-- role = 'admin' OR a row in public.admin_users or public.profiles.

-- Helper function used by every patched policy. SECURITY DEFINER so it can
-- read auth.users / admin_users even when called from a RLS context.
create or replace function public.is_actero_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'
  )
  or exists (
    select 1 from public.admin_users where user_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_actero_admin() to authenticated, anon;

-- ─── client_integrations (20260328) ────────────────────────────────────
drop policy if exists "Admins have full access to integrations"
  on public.client_integrations;

create policy "Admins have full access to integrations"
  on public.client_integrations
  for all
  using (public.is_actero_admin())
  with check (public.is_actero_admin());

-- ─── startup_applications (20260413) ───────────────────────────────────
drop policy if exists "Admins have full access to startup_applications"
  on public.startup_applications;

create policy "Admins have full access to startup_applications"
  on public.startup_applications
  for all
  using (public.is_actero_admin())
  with check (public.is_actero_admin());

-- ─── portal_action_logs (20260417) ─────────────────────────────────────
drop policy if exists "portal_action_logs admin read"
  on public.portal_action_logs;

create policy "portal_action_logs admin read"
  on public.portal_action_logs
  for select
  to authenticated
  using (
    client_id in (
      select id from public.clients where owner_user_id = auth.uid()
    )
    or public.is_actero_admin()
  );
