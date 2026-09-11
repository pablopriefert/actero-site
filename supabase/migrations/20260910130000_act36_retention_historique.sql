-- ACT-36 — la rétention d'historique, enfin appliquée.
--
-- La page tarifs vend « Historique 7 jours » sur Free, « 90 jours » sur
-- Starter et « illimité » sur Pro. La valeur existe dans src/lib/plans.js ET
-- dans api/lib/plan-limits.js, et **elle n'était lue que pour être affichée**.
-- Aucune route, aucun cron, aucun composant ne s'en servait pour filtrer quoi
-- que ce soit : un compte gratuit gardait son historique aussi longtemps qu'un
-- compte Pro.
--
-- Ce n'est pas un client lésé, c'est une différenciation qui n'existe pas — et
-- au moment où la publicité va amener des inscriptions gratuites, c'est
-- précisément le mur qui doit exister pour qu'un marchand ait une raison de
-- passer au payant.
--
-- POURQUOI EN BASE, ET PAS DANS L'INTERFACE
-- Le tableau de bord interroge Supabase directement depuis le navigateur. Un
-- filtre posé dans le composant ne serait pas une limite, seulement une
-- politesse : le marchand a son propre jeton et peut refaire la requête sans
-- le filtre. C'est exactement le défaut corrigé ce matin sur le portail, où
-- une fonctionnalité payante n'était gardée que par un bouton grisé.
--
-- CE QUI N'EST PAS TOUCHÉ
-- Rien n'est effacé. Les lignes restent : le jour où le marchand passe au
-- plan supérieur, son historique réapparaît en entier. Une limite qui détruit
-- la donnée détruit aussi l'argument de vente.
-- Le rôle de service (moteur, crons, exports RGPD) et les administrateurs
-- gardent un accès complet : leurs politiques sont séparées, et PostgreSQL
-- combine les politiques permissives par OU.

-- ── La limite, une seule définition ──────────────────────────────────────
-- NULL = pas de limite. Volontairement `stable` : le plan d'un client ne
-- change pas au milieu d'une requête, PostgreSQL peut donc mettre le résultat
-- en cache pour la durée de l'instruction.
create or replace function public.retention_limite(p_client_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select case
    -- Un essai donne accès à tout : c'est le principe d'un essai.
    when c.trial_ends_at is not null and c.trial_ends_at > now() then null
    when coalesce(c.plan, 'free') in ('pro', 'enterprise') then null
    when coalesce(c.plan, 'free') = 'starter' then now() - interval '90 days'
    else now() - interval '7 days'
  end
  from clients c
  where c.id = p_client_id
$$;

comment on function public.retention_limite(uuid) is
  'ACT-36 — début de la fenêtre d''historique visible pour ce client. NULL = illimité. Doit rester aligné sur limits.history_days dans src/lib/plans.js et api/lib/plan-limits.js.';

-- ── Le compteur qui rend la limite vendeuse ──────────────────────────────
-- Sans lui, les lignes disparaissent en silence et le marchand ne sait pas
-- qu'il lui manque quelque chose — donc il n'a aucune raison de payer. Il
-- renvoie une date et deux nombres, jamais un contenu : ce qui est hors
-- fenêtre reste hors de portée.
create or replace function public.historique_masque(p_client_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limite timestamptz;
  v_conv bigint;
  v_evt bigint;
begin
  -- `security definer` contourne RLS : le contrôle d'appartenance doit être
  -- refait ici, sinon n'importe qui compterait chez n'importe qui.
  if not exists (
    select 1 from clients where id = p_client_id and owner_user_id = auth.uid()
    union all
    select 1 from client_users where client_id = p_client_id and user_id = auth.uid()
  ) then
    raise exception 'historique_masque : accès refusé' using errcode = 'insufficient_privilege';
  end if;

  v_limite := retention_limite(p_client_id);
  if v_limite is null then
    return jsonb_build_object('limite', null, 'conversations', 0, 'evenements', 0);
  end if;

  select count(*) into v_conv from ai_conversations
   where client_id = p_client_id and created_at < v_limite;
  select count(*) into v_evt from automation_events
   where client_id = p_client_id and created_at < v_limite;

  return jsonb_build_object('limite', v_limite, 'conversations', v_conv, 'evenements', v_evt);
end;
$$;

comment on function public.historique_masque(uuid) is
  'ACT-36 — ce que la limite de rétention du plan masque : une date et deux compteurs. Sert la bannière de montée en gamme.';

revoke all on function public.historique_masque(uuid) from public;
grant execute on function public.historique_masque(uuid) to authenticated, service_role;
grant execute on function public.retention_limite(uuid) to authenticated, service_role;

-- ── La politique de lecture ──────────────────────────────────────────────
-- Seule la politique du MARCHAND est resserrée. Celle des administrateurs
-- (`ai_conversations_admin_select`) et celle du rôle de service restent
-- intactes : PostgreSQL combine les politiques permissives par OU, un admin
-- continue donc de tout voir.
drop policy if exists "Users view own client conversations" on public.ai_conversations;

create policy "Users view own client conversations"
  on public.ai_conversations
  for select
  using (
    (
      client_id in (select id from clients where owner_user_id = auth.uid())
      or client_id in (select client_id from client_users where user_id = auth.uid())
    )
    and (
      retention_limite(client_id) is null
      or created_at >= retention_limite(client_id)
    )
  );

-- La politique de MISE À JOUR n'est pas touchée. Un marchand ne peut de toute
-- façon pas désigner une ligne qu'il ne peut pas lire, et resserrer les deux
-- d'un coup aurait doublé la surface d'erreur pour aucun gain.

-- ── Le fil d'activité, qui est l'historique que le marchand consulte ─────
-- L'onglet « Activité » lit automation_events, pas ai_conversations : limiter
-- la seconde sans la première aurait laissé l'historique entièrement visible
-- là où il est réellement consulté.
--
-- DEUX politiques marchandes, pas une. PostgreSQL combine les politiques
-- permissives par OU : n'en resserrer qu'une laisserait l'autre tout ouvrir.
-- Même piège que le fournisseur de webhooks, qui avait deux blocs d'écriture
-- et dont un seul avait été migré.
drop policy if exists "ae_select_client" on public.automation_events;
drop policy if exists "ae_select_member" on public.automation_events;

create policy "ae_select_client" on public.automation_events
  for select using (
    client_id in (select id from clients where owner_user_id = auth.uid())
    and (retention_limite(client_id) is null or created_at >= retention_limite(client_id))
  );

create policy "ae_select_member" on public.automation_events
  for select using (
    is_member_of_client(client_id)
    and (retention_limite(client_id) is null or created_at >= retention_limite(client_id))
  );
