-- ACT-18 — le marchand peut voir son propre essai à blanc.
--
-- `ticket_backtests` rejoue les anciens tickets d'une boutique dans le cerveau
-- et produit la phrase qui vend Actero : « sur vos 1 240 tickets, l'agent en
-- aurait réglé 61 % tout seul ». Le harnais tourne depuis le 9 septembre.
--
-- Il portait UNE politique RLS, `ticket_backtests_admin_read` : seul un admin
-- Actero pouvait lire une ligne. La preuve la plus convaincante qu'on ait, sur
-- les données du marchand lui-même, était donc invisible pour lui — il fallait
-- qu'un humain de chez nous la lance depuis un écran d'administration et la lui
-- raconte.
--
-- Deux politiques plutôt qu'une, et c'est volontaire : le motif de la maison
-- (voir `ae_select_client` / `ae_select_member` sur `automation_events`)
-- distingue le PROPRIÉTAIRE du compte des MEMBRES de l'équipe. Les deux
-- existent pour de vrai — `resolve-client.js` écrit `clients.owner_user_id` et
-- une ligne `client_users`, mais rien ne garantit que les deux soient toujours
-- présentes, et `api/jobs/kb-deep-crawl.js` vérifie déjà les deux à la main
-- pour cette raison. Une seule politique en manquerait la moitié.
--
-- LECTURE SEULE, ET SEULEMENT ÇA. Aucune politique d'écriture n'est ajoutée :
-- les lignes sont créées et mises à jour par le service_role (la route qui
-- lance le travail, puis le bac à sable E2B). Un marchand qui pourrait écrire
-- ici s'inventerait un taux de résolution.

create policy "ticket_backtests_client_read"
  on public.ticket_backtests
  for select
  to authenticated
  using (
    client_id in (
      select clients.id from public.clients
      where clients.owner_user_id = auth.uid()
    )
  );

create policy "ticket_backtests_member_read"
  on public.ticket_backtests
  for select
  to authenticated
  using (public.is_member_of_client(client_id));

comment on table public.ticket_backtests is
  'Essai à blanc : rejeu des tickets historiques dans le cerveau, sans jamais '
  'rien envoyer (pare-feu api/engine/backtest-classify.js, garde '
  'api/engine/backtest-etancheite.test.js). Lisible par l''équipe du marchand '
  'et par les admins ; écrit uniquement par le service_role.';
