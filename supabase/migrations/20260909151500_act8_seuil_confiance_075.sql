-- ACT-8 — remonter le seuil de confiance de 0,4 à 0,75.
--
-- En dessous du seuil, brain.js n'envoie rien : il rédige une proposition et la
-- met en revue humaine. Au-dessus, l'agent répond seul au client.
--
-- Les treize playbooks étaient à 0,4 — y compris ceux créés à l'installation
-- Shopify (api/shopify/callback.js écrivait cette valeur en dur). L'agent
-- répondait donc seul dès 40 % de certitude du classifieur, c'est-à-dire alors
-- qu'il avait plus de chances de se tromper que d'avoir raison. Le 0,85 prévu
-- par playbook-loader.js n'était jamais atteint, puisque la base fournissait
-- toujours une valeur.
--
-- Arbitrage de Pablo le 9 septembre 2026 : 0,75. Plus de tickets partent en
-- revue, mais on ne découvre pas une réponse à côté de la plaque par un client
-- mécontent — position tenable pendant la review Shopify et les premiers vrais
-- marchands.
--
-- Portée vérifiée avant écriture : le seuil ne gouverne que les messages
-- ENTRANTS. Seuls gateway.js, webhooks/inbound-email.js, webhooks/widget.js et
-- voice/custom-llm.js appellent runBrain. Les campagnes sortantes (relance
-- panier, avis, winback) ne passent pas par ce chemin et ne sont pas affectées.

update public.engine_playbooks
   set confidence_threshold = 0.75
 where confidence_threshold < 0.75;

-- Les surcharges par client valent plus que le playbook (playbook-loader.js:39).
-- Les laisser à 0,4 aurait annulé la migration pour les clients existants.
update public.engine_client_playbooks
   set custom_config = jsonb_set(
         coalesce(custom_config, '{}'::jsonb),
         '{confidence_threshold}',
         '0.75'::jsonb,
         true
       )
 where (custom_config->>'confidence_threshold')::numeric < 0.75;
