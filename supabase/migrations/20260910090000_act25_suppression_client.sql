-- ACT-25 — la suppression d'un compte client échouait pour les vrais marchands.
--
-- La page de confidentialité promet le droit à l'effacement, exercé par email.
-- C'est légalement recevable : rien n'oblige à un bouton en self-service. Mais
-- quand la demande arrive, il faut savoir quoi faire, et le RGPD laisse un mois.
--
-- Ce qui existait : une action admin `delete_client` qui fait
-- `delete from clients where id = ...`. Elle ne peut pas fonctionner.
--
-- 71 clés étrangères pointent vers clients.id :
--   57 en CASCADE      — suivent la suppression (dont les credentials, la base
--                        de connaissances, les mémoires clients, les photos)
--    6 en SET NULL     — commissions, journaux : conservés, lien coupé
--    8 en NO ACTION    — BLOQUENT la suppression
--
-- Vérifié en base le 10 septembre 2026, par une suppression tentée dans un
-- bloc qui s'annule : les deux clients ayant réellement connecté une boutique
-- Shopify sont BLOQUÉS par `client_shopify_connections_client_id_fkey`. Les
-- seuls qui passaient étaient ceux sans boutique — le compte interne, le compte
-- de Pablo, et le client de démonstration.
--
-- Autrement dit : le chemin d'effacement échouait précisément dans le seul cas
-- qui compte, celui d'un marchand réel.
--
-- Cette fonction traite les huit bloqueurs explicitement. Le choix entre
-- supprimer et détacher n'est pas technique, il est juridique : on efface ce
-- qui est une donnée personnelle, on conserve ce qui fait foi (comptabilité,
-- audit) en coupant le lien. Trois tables ne peuvent pas être détachées, leur
-- colonne étant NOT NULL — c'est écrit ligne par ligne ci-dessous.

create or replace function public.delete_client_data(p_client_id uuid)
returns table (etape text, lignes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom      text;
  v_n        integer;
  v_inconnus text;
  -- Les huit bloqueurs connus au 10 septembre 2026, chacun traité plus bas.
  v_connus text[] := array[
    'admin_action_logs', 'call_notes', 'client_shopify_connections', 'clients',
    'deployment_requests', 'deployments', 'escalation_tickets', 'funnel_clients'
  ];
begin
  -- Auto-vérification. Une nouvelle table portant une clé étrangère NO ACTION
  -- vers clients.id casserait la suppression sans prévenir : elle échouerait au
  -- milieu, sur une violation de contrainte illisible. Mieux vaut refuser de
  -- commencer, en nommant la table à traiter.
  --
  -- Vérifié en créant une table témoin avec une telle clé : la fonction refuse
  -- et la nomme. Témoin supprimé ensuite.
  select string_agg(distinct tc.table_name, ', ')
    into v_inconnus
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    join information_schema.referential_constraints rc
      on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
   where tc.constraint_type = 'FOREIGN KEY'
     and tc.table_schema = 'public'
     and ccu.table_name = 'clients' and ccu.column_name = 'id'
     and rc.delete_rule = 'NO ACTION'
     and tc.table_name <> all (v_connus);

  if v_inconnus is not null then
    raise exception
      'delete_client_data : table(s) non traitée(s) avec une clé étrangère NO ACTION vers clients.id : %. Ajouter leur traitement (détacher ou supprimer) avant de poursuivre — voir docs/runbook-suppression-client.md',
      v_inconnus
      using errcode = 'raise_exception';
  end if;
  select brand_name into v_nom from clients where id = p_client_id;
  if v_nom is null then
    raise exception 'delete_client_data : aucun client %', p_client_id
      using errcode = 'no_data_found';
  end if;

  -- ── Détacher : la ligne survit, le lien vers le client est coupé ────────
  -- Piste d'audit. C'est elle qui prouvera que la suppression a eu lieu :
  -- la détruire priverait de la preuve qu'on a bien répondu à la demande.
  update admin_action_logs set client_id = null where client_id = p_client_id;
  get diagnostics v_n = row_count;
  etape := 'admin_action_logs (détaché)'; lignes := v_n; return next;

  -- Historique opérationnel : combien de temps a pris un déploiement. Aucune
  -- donnée personnelle une fois le lien coupé.
  update deployment_requests set client_id = null where client_id = p_client_id;
  get diagnostics v_n = row_count;
  etape := 'deployment_requests (détaché)'; lignes := v_n; return next;

  -- Analytique d'acquisition, agrégée.
  update funnel_clients set onboarded_client_id = null where onboarded_client_id = p_client_id;
  get diagnostics v_n = row_count;
  etape := 'funnel_clients (détaché)'; lignes := v_n; return next;

  -- Parrainage : un autre client peut avoir été parrainé par celui-ci.
  update clients set referred_by_client_id = null where referred_by_client_id = p_client_id;
  get diagnostics v_n = row_count;
  etape := 'clients.referred_by (détaché)'; lignes := v_n; return next;

  -- ── Supprimer : donnée personnelle, ou colonne NOT NULL ─────────────────
  -- Contient le jeton d'accès à la boutique du marchand. Le conserver après
  -- une demande d'effacement serait le pire des oublis.
  delete from client_shopify_connections where client_id = p_client_id;
  get diagnostics v_n = row_count;
  etape := 'client_shopify_connections (supprimé)'; lignes := v_n; return next;

  -- Tickets escaladés : ils portent les emails et les messages des clients DU
  -- marchand. Colonne NOT NULL, donc pas détachables — et de toute façon à
  -- effacer.
  delete from escalation_tickets where client_id = p_client_id;
  get diagnostics v_n = row_count;
  etape := 'escalation_tickets (supprimé)'; lignes := v_n; return next;

  -- Notes d'appel commercial. Colonne NOT NULL : impossible de conserver la
  -- ligne en coupant le lien. Elles parlent du marchand, donc elles partent.
  delete from call_notes where client_id = p_client_id;
  get diagnostics v_n = row_count;
  etape := 'call_notes (supprimé)'; lignes := v_n; return next;

  -- Historique de déploiement. Colonne NOT NULL, même raisonnement.
  delete from deployments where client_id = p_client_id;
  get diagnostics v_n = row_count;
  etape := 'deployments (supprimé)'; lignes := v_n; return next;

  -- ── Le client, et les 57 tables qui suivent en cascade ──────────────────
  delete from clients where id = p_client_id;
  get diagnostics v_n = row_count;
  etape := format('clients « %s » + 57 tables en cascade', v_nom); lignes := v_n; return next;

  return;
end;
$$;

comment on function public.delete_client_data(uuid) is
  'Efface un client et ses données (ACT-25). Détache ce qui fait foi, supprime ce qui est personnel. Renvoie le décompte par étape.';

-- Personne ne doit pouvoir appeler ça depuis un navigateur.
revoke all on function public.delete_client_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_client_data(uuid) to service_role;
