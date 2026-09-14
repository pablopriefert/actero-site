-- ACT-9 — un même email ne doit pas produire deux réponses au client.
--
-- Deux mécanismes relèvent les boîtes email des marchands :
--   • le cron Vercel `poll-inbound-emails`, toutes les 2 minutes ;
--   • les workflows n8n créés par client par `engine/setup-email-polling.js`.
--
-- Rien ne les empêchait de traiter le même message. L'index sur
-- `ai_conversations.email_message_id` existait mais n'était PAS unique, et la
-- seule protection réelle était la marque « lu » posée dans la boîte après
-- lecture — protection perdue dès que les deux pollers lisent avant que l'un
-- des deux ne marque.
--
-- Conséquence : deux réponses automatiques au même client, sur le même
-- message. Pour un produit de SAV, c'est le genre de défaut qui se remarque
-- immédiatement et qui ne se rattrape pas.
--
-- Vérifié avant d'agir : ce défaut n'a JAMAIS eu lieu. Il y a 0 ligne portant
-- un `email_message_id` en base — cohérent avec l'arrêt du moteur du 11 juillet
-- au 8 septembre. C'est donc un risque latent, qui se manifesterait
-- exactement le jour où le produit se remet à traiter des emails.
--
-- L'index est partiel : `client_id` est nullable sur cette table, et deux
-- marchands distincts pourraient théoriquement recevoir le même Message-ID
-- (un client en copie de deux boutiques). On déduplique donc par couple, et
-- seulement quand les deux valeurs sont présentes.

create unique index if not exists ai_conversations_client_email_message_uniq
  on public.ai_conversations (client_id, email_message_id)
  where client_id is not null and email_message_id is not null;
