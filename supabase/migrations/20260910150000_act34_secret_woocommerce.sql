-- ACT-34 — le secret WooCommerce sort du jsonb lisible par le navigateur.
--
-- `api/integrations/woocommerce/callback.js` écrivait le consumer secret dans
-- `extra_config.consumer_secret`. Il était **bien chiffré** (AES-256-GCM,
-- ACT-7) : ce n'était donc pas une fuite. Mais `extra_config` est la colonne
-- que le navigateur du marchand peut lire — c'est exactement pour ça qu'ACT-25
-- en avait sorti `webhook_secret`.
--
-- Ce qui coûtait ici, ce n'était pas la gravité, c'était l'incohérence : deux
-- secrets de même nature, deux traitements. Le prochain qui ajoute une
-- plateforme copie l'exemple qu'il trouve, et rien ne dit lequel il trouvera.
--
-- PROPRIÉTÉ UTILE DU MODÈLE DE DROITS
-- ACT-7 a remplacé le droit de lecture sur la table entière par une **liste
-- blanche de colonnes** pour le rôle `authenticated`. Une colonne nouvelle
-- n'est donc lisible par personne tant qu'elle n'est pas explicitement
-- ajoutée à cette liste : le défaut est fermé. C'est l'inverse de
-- `extra_config`, qui est dans la liste et emporte avec lui tout ce qu'on y
-- range.
--
-- AUCUNE REPRISE DE DONNÉES
-- Vérifié le 10 septembre : **zéro intégration WooCommerce en base**. Il n'y
-- a donc rien à migrer, et surtout pas de chemin de repli à écrire. C'est une
-- bonne nouvelle : le repli est précisément ce qui s'était retourné contre
-- nous sur Gorgias, où le code lisait une colonne qu'il n'avait pas
-- sélectionnée et retombait **sans bruit** sur l'ancien chemin.

alter table public.client_integrations
  add column if not exists consumer_secret_encrypted text;

comment on column public.client_integrations.consumer_secret_encrypted is
  'ACT-34 — consumer secret WooCommerce, chiffré (enc:v1:). Volontairement hors de extra_config, que le navigateur peut lire. Ne jamais ajouter cette colonne au grant de `authenticated`.';
