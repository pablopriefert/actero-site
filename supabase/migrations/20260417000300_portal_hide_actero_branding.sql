-- 2026-04-17 — Portal: allow Pro+ clients to hide the "Propulsé par Actero" footer.
--
-- Context:
--   - Custom domain support (`portal_custom_domain`) landed in the portal self-service migration.
--   - This migration only adds the hide-branding toggle (defaults to false = Actero credit shown).
--   - Enforcement of Pro+ gating happens in the API layer, not at the DB level.

alter table public.clients
  add column if not exists portal_hide_actero_branding boolean not null default false;

comment on column public.clients.portal_hide_actero_branding is
  'When true and plan is Pro/Enterprise, the portal footer will not display "Propulsé par Actero".';
