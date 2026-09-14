-- ACT-25 — le secret de webhook échappait à ACT-7 en se cachant dans un jsonb.
--
-- ACT-7 a fermé `api_key` et `access_token` au navigateur. `extra_config` est
-- resté ouvert, parce qu'il porte des champs d'affichage (email, username,
-- hôte SMTP). Il portait aussi `webhook_secret` : le secret partagé qui
-- authentifie les webhooks entrants de Zendesk et Gorgias.
--
-- Vérifié le 10 septembre 2026 sur la base de production :
--   api_key        lisible par authenticated : NON
--   access_token   lisible par authenticated : NON
--   extra_config   lisible par authenticated : OUI   ← et il contenait le secret
--
-- Ce n'est pas une fuite entre marchands : chacun ne lit que ses propres
-- lignes. Mais un secret qui transite par un navigateur est un secret qu'on ne
-- contrôle plus, et celui-ci permet de forger des webhooks entrants — donc
-- d'injecter de faux tickets dans le moteur d'un marchand.

alter table public.client_integrations
  add column if not exists webhook_secret_encrypted text;

comment on column public.client_integrations.webhook_secret_encrypted is
  'Secret partagé des webhooks entrants (ACT-25). Sorti de extra_config, lisible par le navigateur.';

update public.client_integrations
   set webhook_secret_encrypted = extra_config->>'webhook_secret',
       extra_config = extra_config - 'webhook_secret'
 where extra_config ? 'webhook_secret';

-- Le chiffrement est appliqué par le code à la prochaine écriture ;
-- decryptToken laisse passer une valeur encore en clair, comme pour api_key.
revoke select (webhook_secret_encrypted) on public.client_integrations from anon, authenticated;
