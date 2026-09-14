-- La bulle de chat peut disparaître d'une boutique sans que personne ne le voie.
--
-- `widget_qa` vérifie depuis le 9 septembre que le script Actero est bien
-- présent sur la vitrine du marchand. Le contrôle ne se déclenchait QUE depuis
-- un écran d'administration, à la main : il fallait qu'un humain de chez nous y
-- pense.
--
-- Or le scénario est banal — une mise à jour de thème retire le script, ou le
-- marchand restaure une sauvegarde de son thème. L'agent cesse alors de
-- recevoir des conversations et **rien ne le signale** : il n'y a pas d'erreur,
-- juste un silence qui ressemble à une boutique calme.
--
-- Cette colonne rend l'alerte idempotente. Même motif que
-- `usage_counters.alerted_80_at` (voir api/lib/quota-alerts.js) : on la
-- réclame par un UPDATE conditionnel `WHERE alerted_at IS NULL` AVANT
-- d'envoyer, donc deux passages simultanés du cron n'envoient qu'un message.
--
-- Elle ne vaut que pour les lignes où une alerte a RÉELLEMENT été envoyée. Les
-- lignes examinées puis écartées — première vérification d'une boutique, ou
-- panne déjà connue — la laissent à NULL et sortent de la fenêtre de scan
-- (48 h) d'elles-mêmes.

alter table public.widget_health
  add column if not exists alerted_at timestamptz;

comment on column public.widget_health.alerted_at is
  'Horodatage de l''alerte envoyée au marchand pour CETTE vérification. '
  'Réclamée par UPDATE … WHERE alerted_at IS NULL avant envoi : un seul '
  'message même si le cron passe deux fois. NULL = aucune alerte envoyée '
  'pour cette ligne (cas normal).';

-- Le cron cherche, par client, la vérification la plus récente puis la
-- précédente. Sans index c'est un tri complet de la table à chaque passage.
create index if not exists idx_widget_health_client_checked
  on public.widget_health (client_id, checked_at desc);
