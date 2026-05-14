-- Harden security + add missing foreign-key indexes
-- Applied 2026-05-14
--
-- Why:
--   1. prospect_audits SELECT policy was USING (true) for authenticated → privacy leak
--   2. 3 admin_* SECURITY DEFINER RPCs were executable by anon (privilege escalation surface)
--   3. set_prospect_audit_updated_at had a mutable search_path
--   4. 14 foreign keys had no covering index (perf cliff as data grows)

-- ── 1. Tighten prospect_audits RLS (privacy leak fix)
-- The original policy was USING (true) for authenticated, exposing every
-- prospect's email/contact/analysis to all authenticated users.
drop policy if exists "Authenticated users can read prospect audits" on public.prospect_audits;
drop policy if exists "Anyone authenticated can read prospect_audits" on public.prospect_audits;
drop policy if exists prospect_audits_select_all on public.prospect_audits;

create policy prospect_audits_admin_select
  on public.prospect_audits for select
  to authenticated
  using (public.is_admin());

-- (service_role bypasses RLS, used by /api/leads/audit-report public endpoint with token check)

-- ── 2. Revoke anon execute on privileged SECURITY DEFINER RPCs
revoke execute on function public.admin_onboard_client from anon;
revoke execute on function public.admin_resend_magic_link from anon;
revoke execute on function public.admin_get_onboarding_status from anon;
-- Keep authenticated execute — app-level admin check still gates them.

-- ── 3. Pin search_path on set_prospect_audit_updated_at to prevent search_path attacks
create or replace function public.set_prospect_audit_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 4. Add 14 missing foreign-key indexes (preempts perf cliff as data grows)
create index if not exists idx_admin_alert_rules_created_by on public.admin_alert_rules (created_by);
create index if not exists idx_admin_audit_log_admin_user_id on public.admin_audit_log (admin_user_id);
create index if not exists idx_admin_client_notes_author_id on public.admin_client_notes (author_id);
create index if not exists idx_admin_impersonation_tokens_admin_id on public.admin_impersonation_tokens (admin_id);
create index if not exists idx_admin_impersonation_tokens_client_id on public.admin_impersonation_tokens (client_id);
create index if not exists idx_client_webhook_deliveries_client_id on public.client_webhook_deliveries (client_id);
create index if not exists idx_client_webhooks_created_by on public.client_webhooks (created_by);
create index if not exists idx_clients_referred_by_client_id on public.clients (referred_by_client_id);
create index if not exists idx_engine_run_tags_flagged_by on public.engine_run_tags (flagged_by);
create index if not exists idx_error_reports_resolved_by on public.error_reports (resolved_by);
create index if not exists idx_error_reports_user_id on public.error_reports (user_id);
create index if not exists idx_partner_access_tokens_created_by on public.partner_access_tokens (created_by);
create index if not exists idx_slack_events_seen_client_id on public.slack_events_seen (client_id);
create index if not exists idx_startup_applications_reviewed_by on public.startup_applications (reviewed_by);
