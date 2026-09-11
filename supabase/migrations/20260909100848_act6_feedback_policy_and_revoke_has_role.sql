-- ACT-6 — deux correctifs de l'audit RLS du 8 septembre.
--
-- 1. conversation_feedback avait RLS activée et ZÉRO policy : la table était
--    donc inaccessible à tout le monde sauf service_role. Ce n'était pas une
--    fuite, c'était une fonctionnalité morte — AdminCsatPanel.jsx lit cette
--    table depuis le navigateur (donc sous RLS) et ne voyait jamais rien.
--
-- 2. has_role(uuid, app_role) est SECURITY DEFINER et exécutable par anon.
--    C'est la seule fonction definer qui accepte un identifiant utilisateur
--    ARBITRAIRE en paramètre : n'importe qui pouvait donc interroger le rôle
--    de n'importe quel utilisateur. Vérifié avant de révoquer : aucune policy,
--    aucune autre fonction et aucune ligne de code applicatif ne l'appelle.

-- ── 1. Lecture du CSAT ──
-- Les membres d'un client voient les retours de leur boutique ; les admins
-- Actero voient tout. Même motif que les autres tables à client_id.
create policy cf_select_client on public.conversation_feedback
  for select
  using (
    client_id in (select public.get_my_client_ids())
    or public.get_my_role() = 'admin'
  );

-- L'écriture reste réservée au moteur, qui passe en service_role et contourne
-- RLS (api/engine/webhooks/widget.js). Aucune policy d'insertion n'est donc
-- nécessaire, et ne pas en créer évite qu'un client fabrique de faux avis.

-- ── 2. Fermeture de has_role ──
revoke execute on function public.has_role(uuid, public.app_role) from anon;
revoke execute on function public.has_role(uuid, public.app_role) from authenticated;
