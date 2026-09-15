-- Sécurité : le rôle d'un compte et la facturation d'une boutique ne se modifient
-- plus depuis le navigateur (15 septembre 2026).
--
-- Faille 1 — profiles. La règle « update own profile » laissait tout compte
-- connecté, y compris un compte Free créé sur le site, écrire role = 'admin' sur
-- sa propre ligne avec la clé publique. get_my_role() et is_admin() lisent cette
-- colonne : le compte obtenait les règles d'administration de 29 tables et les
-- routes /api/admin. Rien sur le site n'écrit profiles : la ligne naît dans
-- handle_new_user (SECURITY DEFINER), et profiles n'a pas d'autre colonne que
-- id, role et created_at.
--
-- Faille 2 — clients. La règle « clients_update » laissait le propriétaire
-- écrire n'importe quelle colonne de sa boutique, dont plan, trial_ends_at et
-- stripe_subscription_id : un plan payant sans payer, ou une offre de bienvenue
-- remise à zéro. Depuis le navigateur, le site n'écrit que brand_name et
-- contact_email (ClientProfileView) et crée la boutique en Free
-- (resolve-client). Tout le reste passe par le serveur (service_role), qui
-- n'est pas concerné, pas plus que les fonctions SECURITY DEFINER et les
-- admins Actero.

-- 1. profiles --------------------------------------------------------------

drop policy if exists "update own profile" on public.profiles;
drop policy if exists "insert own profile" on public.profiles;
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;

-- Garde-fou si un droit d'écriture revenait un jour (GRANT global, nouvelle règle).
create or replace function public.profiles_role_immuable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.role is not distinct from old.role then
      return new;
    end if;
  end if;
  raise exception 'Le rôle d''un compte ne se modifie que côté serveur.'
    using errcode = '42501';
end;
$$;

drop trigger if exists profiles_role_immuable on public.profiles;
create trigger profiles_role_immuable
  before insert or update on public.profiles
  for each row execute function public.profiles_role_immuable();

-- 2. clients ---------------------------------------------------------------

create or replace function public.clients_facturation_cote_serveur()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Liste blanche : une colonne ajoutée plus tard est protégée par défaut.
  modifiables constant text[] := array['brand_name', 'contact_email'];
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - modifiables) is distinct from (to_jsonb(old) - modifiables) then
      raise exception 'Depuis le navigateur, seuls le nom de la boutique et l''email de contact se modifient.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- INSERT : une boutique créée depuis le navigateur démarre en Free, sans
  -- historique de facturation, de parrainage ni d'attribution commerciale.
  if new.plan is distinct from 'free'
     or new.trial_ends_at is not null
     or new.plan_updated_at is not null
     or new.stripe_customer_id is not null
     or new.stripe_subscription_id is not null
     or new.billing_provider is not null
     or new.billing_period is not null
     or new.shopify_subscription_id is not null
     or new.pending_shopify_subscription_id is not null
     or new.payment_received_at is not null
     or new.referred_by_client_id is not null
     or new.referral_code is not null
     or coalesce(new.referral_first_month_free, false)
     or coalesce(new.campaign_first_month_free, false)
     or coalesce(new.portal_enabled, false)
     or coalesce(new.portal_hide_actero_branding, false)
     or new.portal_custom_domain is not null
     or new.acquisition_source is distinct from '{}'::jsonb
  then
    raise exception 'Une boutique créée depuis le navigateur démarre en Free, sans facturation.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists clients_facturation_cote_serveur on public.clients;
create trigger clients_facturation_cote_serveur
  before insert or update on public.clients
  for each row execute function public.clients_facturation_cote_serveur();
