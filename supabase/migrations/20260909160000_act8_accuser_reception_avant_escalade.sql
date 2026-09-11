-- ACT-8 — accuser réception avant d'escalader.
--
-- Révélé par le banc du 9 septembre, cas 17 : « combien de temps pour être
-- remboursé ? » — une question de FAQ parfaitement bénigne — est classée
-- `remboursement`, dont le plan valait `["escalate"]`. Sans `send_reply`,
-- brain.js ne fait tourner aucun agent : le client n'obtient AUCUNE réponse,
-- pas même un accusé de réception, tandis qu'un ticket humain est créé.
--
-- Le cas 1 (« TROIS SEMAINES, c'est une honte, remboursez-moi ») mérite bien un
-- humain. Le cas 17 non — et les deux tombaient dans la même règle.
--
-- On ajoute donc `send_reply` EN PREMIER : l'exécuteur parcourt le plan dans
-- l'ordre, donc l'accusé de réception part avant l'escalade. L'agent répond
-- sans rien promettre, et le ticket monte quand même.
--
-- Ce que l'on ne touche PAS, et pourquoi :
--
--   agent_vocal / reclamation        — le canal de réponse est l'appel en
--                                      cours, pas un email ; ajouter
--                                      `send_reply` enverrait un message
--                                      parasite.
--   comptabilite_auto / *            — automatisation interne, il n'y a aucun
--                                      client au bout.
--
-- Prérequis livré dans le même lot : `gateway.js` déclenche désormais ticket et
-- alerte marchand même quand il met le message en revue sans exécuter le plan.
-- Sans ce correctif, ajouter `send_reply` ici aurait pu router un client
-- agressif vers `engine_reviews_v2` — une file que rien ne surveille et qui ne
-- notifie personne.

-- Un UPDATE par couple (playbook, classification). Une forme `UPDATE ... FROM`
-- plus compacte aurait été fausse : quand la sous-requête produit plusieurs
-- lignes pour un même playbook — vip_customer_care en a deux — Postgres n'en
-- applique qu'une, arbitrairement, et la seconde clé serait restée en place.

update public.engine_playbooks
   set decision_rules = jsonb_set(decision_rules, '{remboursement}',
         '["send_reply"]'::jsonb || (decision_rules -> 'remboursement'))
 where name = 'sav_ecommerce'
   and decision_rules ? 'remboursement'
   and not (decision_rules -> 'remboursement' ? 'send_reply');

update public.engine_playbooks
   set decision_rules = jsonb_set(decision_rules, '{remboursement}',
         '["send_reply"]'::jsonb || (decision_rules -> 'remboursement'))
 where name = 'vip_customer_care'
   and decision_rules ? 'remboursement'
   and not (decision_rules -> 'remboursement' ? 'send_reply');

update public.engine_playbooks
   set decision_rules = jsonb_set(decision_rules, '{reclamation}',
         '["send_reply"]'::jsonb || (decision_rules -> 'reclamation'))
 where name = 'vip_customer_care'
   and decision_rules ? 'reclamation'
   and not (decision_rules -> 'reclamation' ? 'send_reply');

update public.engine_playbooks
   set decision_rules = jsonb_set(decision_rules, '{bug_report}',
         '["send_reply"]'::jsonb || (decision_rules -> 'bug_report'))
 where name = 'support_technique'
   and decision_rules ? 'bug_report'
   and not (decision_rules -> 'bug_report' ? 'send_reply');
