-- Programme closers : fiches, rattachement des clients, commissions (17 septembre 2026).
--
-- Spec : docs/superpowers/specs/2026-09-14-closers-espace-commissions-design.md
--
-- Migration additive : deux tables, trois colonnes sur `clients`, et une
-- nouvelle version du trigger `clients_facturation_cote_serveur`. Aucune ligne
-- existante n'est modifiée.
--
-- QUI LIT ET ÉCRIT : uniquement les routes serveur (service_role), qui
-- vérifient l'identité de l'appelant. RLS est activée SANS AUCUNE POLITIQUE, et
-- les droits d'anon et d'authenticated sont retirés : une politique mal écrite
-- ne peut donc pas exposer les commissions ou l'IBAN d'un autre closer. Le
-- REVOKE n'est pas décoratif : les privilèges par défaut du schéma public
-- accordent tout à anon et authenticated sur chaque nouvelle table.

-- Base en production : si un verrou sur `clients` ne s'obtient pas en 5
-- secondes, la migration échoue au lieu de faire attendre tout le site derrière
-- elle. On la relance simplement plus tard.
set lock_timeout = '5s';

-- 1. closers ------------------------------------------------------------------

create table if not exists public.closers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users (id) on delete cascade,
  prenom         text not null check (char_length(prenom) between 1 and 80),
  nom            text not null check (char_length(nom) between 1 and 80),
  email          text not null,
  telephone      text check (telephone is null or char_length(telephone) between 6 and 20),
  siret          text check (siret is null or siret ~ '^[0-9]{14}$'),
  titulaire_iban text check (titulaire_iban is null or char_length(titulaire_iban) between 2 and 120),
  -- Chiffré par encryptToken (api/lib/crypto.js). La contrainte refuse un IBAN
  -- écrit en clair, quelle que soit la route qui se tromperait.
  iban_chiffre   text check (iban_chiffre is null or iban_chiffre like 'enc:v1:%'),
  -- Posée à chaque changement d'IBAN : l'admin voit qu'un IBAN vient de
  -- changer avant de virer (compte volé, virement détourné).
  iban_modifie_le timestamptz,
  code           text not null unique check (code ~ '^ACT-[A-Z0-9]{5}$'),
  statut         text not null default 'actif' check (statut in ('actif', 'suspendu')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.closers is
  'Closers freelances (programme closers, 17 septembre 2026). Lue et écrite uniquement par les routes serveur.';
comment on column public.closers.iban_chiffre is
  'IBAN chiffré (enc:v1:…). Jamais en clair en base ni dans une réponse closer ; lu en clair par /api/admin/closer-iban, chaque lecture journalisée.';

alter table public.closers enable row level security;
revoke all on public.closers from anon, authenticated;

-- 2. clients : le closer qui a signé le client --------------------------------

alter table public.clients
  add column if not exists closer_id uuid references public.closers (id) on delete set null,
  add column if not exists closer_attribue_at timestamptz,
  add column if not exists closer_source text check (closer_source is null or closer_source in ('lien', 'manuel'));

comment on column public.clients.closer_id is
  'Closer qui a signé ce client. Posé uniquement côté serveur : /api/closer/attribuer (source lien) ou l''admin (source manuel).';

create index if not exists clients_closer_id_idx on public.clients (closer_id);

-- 3. closer_commissions -------------------------------------------------------

create table if not exists public.closer_commissions (
  id                  uuid primary key default gen_random_uuid(),
  closer_id           uuid not null references public.closers (id) on delete restrict,
  -- SET NULL : une commission fait foi (comptabilité). L'effacement d'un
  -- client (delete_client_data, ACT-25) coupe le lien sans la détruire, et
  -- n'est pas bloqué par elle.
  client_id           uuid references public.clients (id) on delete set null,
  montant_centimes    integer not null check (montant_centimes > 0),
  -- Ce que le client a réellement payé sur la facture (Stripe) : affiché dans
  -- la file de validation, et signalé quand il est inférieur à la commission.
  montant_facture_centimes integer check (montant_facture_centimes is null or montant_facture_centimes >= 0),
  plan                text not null check (plan in ('starter', 'pro', 'enterprise')),
  formule             text not null check (formule in ('mensuel', 'trimestriel', 'annuel')),
  type                text not null check (type in ('mensuelle', 'unique')),
  source              text not null check (source in ('stripe', 'manuel')),
  -- stripe:<facture> | manuel:<client>:<AAAA-MM> | unique:<client>.
  -- L'unicité est portée par la base : un événement Stripe rejoué, ou deux
  -- saisies du même mois, ne créent jamais deux commissions.
  source_key          text not null unique,
  stripe_invoice_id   text,
  payee_par_client_le timestamptz,
  statut              text not null default 'a_valider'
                        check (statut in ('a_valider', 'validee', 'payee', 'refusee', 'annulee')),
  validee_at          timestamptz,
  validee_par         uuid references auth.users (id) on delete set null,
  payee_at            timestamptz,
  note                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.closer_commissions is
  'Commissions des closers : créées par le webhook Stripe (invoice.paid) ou saisies dans l''admin, validées puis payées par Actero.';

create index if not exists closer_commissions_closer_id_idx on public.closer_commissions (closer_id);
create index if not exists closer_commissions_client_id_idx on public.closer_commissions (client_id);
create index if not exists closer_commissions_validee_par_idx on public.closer_commissions (validee_par);
create index if not exists closer_commissions_stripe_invoice_id_idx on public.closer_commissions (stripe_invoice_id);
create index if not exists closer_commissions_statut_created_idx on public.closer_commissions (statut, created_at desc);

alter table public.closer_commissions enable row level security;
revoke all on public.closer_commissions from anon, authenticated;

-- 4. Une boutique créée depuis le navigateur ne naît pas rattachée ------------
--
-- En modification, la liste blanche du trigger (brand_name, contact_email)
-- protège déjà les trois nouvelles colonnes. En INSERTION, il ne contrôle
-- qu'une liste précise : sans cette version, un compte connecté pourrait créer
-- sa boutique depuis le navigateur déjà rattachée au closer de son choix. Le
-- rattachement ne se fait que côté serveur (service_role).
--
-- Corps identique à 20260915180215_securite_role_et_facturation.sql, plus les
-- trois colonnes closer. CREATE OR REPLACE garde la fonction et donc le
-- trigger qui l'appelle ; rien d'autre à recréer.

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
     or new.closer_id is not null
     or new.closer_attribue_at is not null
     or new.closer_source is not null
  then
    raise exception 'Une boutique créée depuis le navigateur démarre en Free, sans facturation.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

reset lock_timeout;
