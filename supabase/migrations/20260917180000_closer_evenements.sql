-- Fil d'activité de l'espace closer (17 septembre 2026).
--
-- Spec : docs/superpowers/specs/2026-09-17-closers-fil-activite-design.md
--
-- Migration additive : une table, une fonction commune, quatre déclencheurs.
-- Aucune ligne existante n'est modifiée.
--
-- Le closer voit les étapes de ses clients (paiement, abonnement, mise en
-- route) et les ouvertures de son lien. Jamais un montant, une adresse, un
-- message ni un volume : la contrainte sur `details` le garantit en base,
-- quelle que soit la route qui écrirait.
--
-- QUI LIT ET ÉCRIT : les routes serveur (service_role) et les déclencheurs
-- ci-dessous. RLS activée sans politique, droits d'anon et d'authenticated
-- retirés, comme closers et closer_commissions.

set lock_timeout = '5s';

-- 1. closer_evenements --------------------------------------------------------

create table if not exists public.closer_evenements (
  id          uuid primary key default gen_random_uuid(),
  closer_id   uuid not null references public.closers (id) on delete cascade,
  -- CASCADE : ce fil n'est pas une pièce comptable. L'effacement d'un client
  -- (delete_client_data, ACT-25) efface aussi son parcours.
  client_id   uuid references public.clients (id) on delete cascade,
  -- Identifiant aléatoire du visiteur du lien, posé dans son cookie : relie ses
  -- ouvertures du lien à son inscription. Aucune IP n'est stockée.
  visite_id   uuid,
  type        text not null check (type in (
                'lien_ouvert',
                'inscription',
                'paiement_ouvert',
                'paiement_abandonne',
                'abonnement_demarre',
                'renouvellement_paye',
                'paiement_echoue',
                'formule_changee',
                'resiliation_programmee',
                'resiliation_annulee',
                'abonnement_termine',
                'rembourse',
                'app_desinstallee',
                'boutique_connectee',
                'agent_premiere_reponse',
                'agent_en_pause',
                'agent_reactive'
              )),
  details     jsonb not null default '{}'::jsonb
                check (jsonb_typeof(details) = 'object'
                       and (details - array['plan', 'formule', 'plateforme', 'partiel']) = '{}'::jsonb),
  source_key  text not null unique,
  survenu_le  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

comment on table public.closer_evenements is
  'Fil d''activité des closers : étapes des clients rattachés et ouvertures du lien. Lue et écrite uniquement côté serveur.';

create index if not exists closer_evenements_closer_survenu_idx on public.closer_evenements (closer_id, survenu_le desc);
create index if not exists closer_evenements_client_id_idx on public.closer_evenements (client_id);
create index if not exists closer_evenements_visite_id_idx on public.closer_evenements (visite_id) where visite_id is not null;

alter table public.closer_evenements enable row level security;
revoke all on public.closer_evenements from anon, authenticated;

-- 2. Écriture depuis la base --------------------------------------------------
--
-- SECURITY DEFINER : les déclencheurs tournent parfois sous le rôle du
-- navigateur (client_settings est écrit depuis le tableau de bord), qui n'a
-- aucun droit sur closer_evenements. L'exécution directe est retirée à tous :
-- PostgREST expose les fonctions du schéma public, et celle-ci ne doit pas
-- devenir un moyen d'écrire dans le fil d'un closer.
--
-- Le bloc EXCEPTION est la règle centrale : une panne du fil ne fait jamais
-- échouer l'action du marchand (connexion de boutique, réponse de l'agent,
-- mise en pause).

create or replace function public.closer_evenement_depuis_la_base(
  p_client_id uuid,
  p_type text,
  p_details jsonb,
  p_source_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closer uuid;
begin
  select c.closer_id into v_closer from public.clients c where c.id = p_client_id;
  if v_closer is null then
    return;
  end if;
  insert into public.closer_evenements (closer_id, client_id, type, details, source_key)
  values (v_closer, p_client_id, p_type, coalesce(p_details, '{}'::jsonb), p_source_key)
  on conflict (source_key) do nothing;
exception when others then
  raise warning 'closer_evenements : % (type %)', sqlerrm, p_type;
end;
$$;

revoke all on function public.closer_evenement_depuis_la_base(uuid, text, jsonb, text) from public, anon, authenticated;

-- 2a. Première réponse de l'agent (non escaladée) ------------------------------

create or replace function public.closer_evenement_reponse_agent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.client_id is not null and coalesce(new.was_escalated, false) = false then
    perform public.closer_evenement_depuis_la_base(
      new.client_id, 'agent_premiere_reponse', '{}'::jsonb, 'premiere_reponse:' || new.client_id
    );
  end if;
  return new;
end;
$$;

revoke all on function public.closer_evenement_reponse_agent() from public, anon, authenticated;

drop trigger if exists closer_evenement_reponse_agent on public.engine_responses;
create trigger closer_evenement_reponse_agent
  after insert on public.engine_responses
  for each row execute function public.closer_evenement_reponse_agent();

-- 2b. Boutique Shopify connectée -----------------------------------------------

create or replace function public.closer_evenement_boutique_shopify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.client_id is not null then
    perform public.closer_evenement_depuis_la_base(
      new.client_id, 'boutique_connectee', jsonb_build_object('plateforme', 'shopify'),
      'boutique:' || new.client_id || ':shopify'
    );
  end if;
  return new;
end;
$$;

revoke all on function public.closer_evenement_boutique_shopify() from public, anon, authenticated;

drop trigger if exists closer_evenement_boutique_shopify on public.client_shopify_connections;
create trigger closer_evenement_boutique_shopify
  after insert or update of client_id on public.client_shopify_connections
  for each row execute function public.closer_evenement_boutique_shopify();

-- 2c. Boutique WooCommerce ou Webflow connectée --------------------------------

create or replace function public.closer_evenement_boutique_integration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.client_id is not null
     and new.provider in ('woocommerce', 'webflow')
     and new.status = 'active'
     and (tg_op = 'INSERT' or old.status is distinct from 'active')
  then
    perform public.closer_evenement_depuis_la_base(
      new.client_id, 'boutique_connectee', jsonb_build_object('plateforme', new.provider),
      'boutique:' || new.client_id || ':' || new.provider
    );
  end if;
  return new;
end;
$$;

revoke all on function public.closer_evenement_boutique_integration() from public, anon, authenticated;

drop trigger if exists closer_evenement_boutique_integration on public.client_integrations;
create trigger closer_evenement_boutique_integration
  after insert or update of status on public.client_integrations
  for each row execute function public.closer_evenement_boutique_integration();

-- 2d. Agent mis en pause ou réactivé -------------------------------------------
--
-- agent_enabled NULL vaut « actif » (AgentControlCenterView : `!== false`).

create or replace function public.closer_evenement_agent_etat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avant boolean;
  v_apres boolean := coalesce(new.agent_enabled, true);
begin
  if tg_op = 'INSERT' then
    v_avant := true;
  else
    v_avant := coalesce(old.agent_enabled, true);
  end if;
  if new.client_id is null or v_avant = v_apres then
    return new;
  end if;
  perform public.closer_evenement_depuis_la_base(
    new.client_id,
    case when v_apres then 'agent_reactive' else 'agent_en_pause' end,
    '{}'::jsonb,
    (case when v_apres then 'reactivation:' else 'pause:' end)
      || new.client_id || ':' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint
  );
  return new;
end;
$$;

revoke all on function public.closer_evenement_agent_etat() from public, anon, authenticated;

drop trigger if exists closer_evenement_agent_etat on public.client_settings;
create trigger closer_evenement_agent_etat
  after insert or update of agent_enabled on public.client_settings
  for each row execute function public.closer_evenement_agent_etat();

reset lock_timeout;
