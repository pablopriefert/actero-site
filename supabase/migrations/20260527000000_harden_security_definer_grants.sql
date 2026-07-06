-- =====================================================================
-- Security hardening — lock down SECURITY DEFINER function EXECUTE grants
--
-- SECURITY DEFINER functions run as their owner and BYPASS row-level
-- security. Supabase's security advisor flagged a batch of them as
-- callable by the `anon` / `authenticated` roles over PostgREST RPC
-- (/rest/v1/rpc/<fn>). That let an unauthenticated caller:
--   • onboard clients / resend magic links (admin_* functions)
--   • tamper with ANY client's credits, metrics, ticket usage and
--     automation events (consume_credits, increment_*, log_automation_event…)
--   • invoke trigger-only functions directly (handle_new_user, trg_fn_*)
--
-- Fix: revoke EXECUTE from PUBLIC/anon/authenticated and re-grant to
-- service_role only (the backend calls these with the service key).
--
-- Left untouched on purpose:
--   • is_admin / has_role / get_my_client_ids / get_my_role — RLS helper
--     functions used inside policies; they only read the caller's own
--     context, and revoking them would break policy evaluation.
--   • get_funnel_client_public — intentionally public (checkout funnel).
--
-- recompute_client_metrics + mark_ai_recommendation are called from the
-- dashboard, so they keep EXECUTE for `authenticated` (anon revoked).
-- =====================================================================

-- ── Backend-only (service_role) ─────────────────────────────────────
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.admin_get_onboarding_status(p_email text)',
    'public.admin_onboard_client(p_brand_name text, p_email text)',
    'public.admin_resend_magic_link(p_email text)',
    'public.consume_credits(p_client_id uuid, p_amount integer, p_description text, p_event_id uuid)',
    'public.increment_ticket_usage(p_client_id uuid, p_period text)',
    'public.increment_metrics(client_uuid uuid, tasks_inc integer, minutes_inc integer, roi_inc numeric)',
    'public.log_automation_event(p_client_id uuid, p_event_category text, p_ticket_type text, p_time_saved_seconds integer, p_revenue_amount numeric, p_metadata jsonb)',
    'public.enqueue_ai_execution_from_reco(p_reco_id uuid)',
    'public.fill_actero_monthly_price()',
    'public.handle_new_user()',
    'public.trg_fn_ai_reco_implemented()'
  ]
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- ── Frontend-called (authenticated), anon revoked ───────────────────
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.recompute_client_metrics(p_client_id uuid)',
    'public.mark_ai_recommendation(p_id uuid, p_status text)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end $$;
