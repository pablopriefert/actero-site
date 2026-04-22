-- Fix funnel_clients RLS: public read was `using (true)` which exposed
-- company_name, email, stripe_session_id, stripe_customer_id,
-- stripe_subscription_id, setup_price, monthly_price, status, etc. to every
-- anon caller through the Supabase REST endpoint.
--
-- Replace with:
--   (1) an RPC function that returns only safe columns for a given slug,
--       SECURITY DEFINER so it bypasses RLS and reveals no other rows;
--   (2) admin-only read/write via public.is_actero_admin();
--   (3) no public SELECT policy at all — anon goes through the RPC.

-- Drop the insecure public policy
drop policy if exists "Public read by slug" on public.funnel_clients;

-- Tighten the "authenticated = admin" policy to real admins only.
drop policy if exists "Admin full access" on public.funnel_clients;

create policy "Admins manage funnel_clients"
  on public.funnel_clients
  for all
  using (public.is_actero_admin())
  with check (public.is_actero_admin());

-- Service role bypass for our server routes (stripe-webhook,
-- create-portal-session, etc.) which already use SUPABASE_SERVICE_ROLE_KEY
-- and bypass RLS by design — belt-and-suspenders policy.
drop policy if exists "Service role all access funnel_clients"
  on public.funnel_clients;
create policy "Service role all access funnel_clients"
  on public.funnel_clients
  for all
  to service_role
  using (true)
  with check (true);

-- Public RPC: returns ONLY non-sensitive columns for a given slug.
-- Used by the /start/<slug> landing page to render the payment CTA.
create or replace function public.get_funnel_client_public(p_slug text)
returns table (
  company_name text,
  setup_price integer,
  monthly_price integer,
  client_type text,
  status text
)
language sql
security definer
stable
set search_path = public
as $$
  select f.company_name,
         f.setup_price,
         f.monthly_price,
         f.client_type,
         f.status
  from public.funnel_clients f
  where f.slug = p_slug
  limit 1;
$$;

grant execute on function public.get_funnel_client_public(text)
  to anon, authenticated;
