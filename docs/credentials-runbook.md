# Identifiants clients : où ils vivent, qui y accède, comment les faire tourner

Réponse aux quatre questions d'ACT-7. Document interne — il n'est pas publié
sur la documentation Mintlify (celle-ci ne prend que les `.mdx` référencés dans
`docs.json`).

Dernière vérification : 9 septembre 2026.

## 1. Où vivent les secrets

| Table | Colonnes | Contenu | État |
|---|---|---|---|
| `client_integrations` | `api_key` | mot de passe SMTP/IMAP, clés Resend, AfterShip, Gorgias… | chiffré AES-256-GCM |
| `client_integrations` | `access_token`, `refresh_token` | jetons OAuth (Slack, Zendesk, Notion, Gmail…) | chiffré AES-256-GCM |
| `client_shopify_connections` | `access_token` | jeton Admin API de la boutique | chiffré AES-256-GCM |
| `client_api_keys`, `client_settings.widget_api_key` | — | clés **émises par nous**, pas des secrets tiers | en clair, par conception |
| `client_integrations.extra_config` | `webhook_secret` | secret de signature des webhooks | **en clair (jsonb)** |

Le chiffrement passe par `api/lib/crypto.js` (`encryptToken` / `decryptToken`),
format `enc:v1:<base64(iv|tag|ciphertext)>`. La clé vient de `ENCRYPTION_KEY`,
avec repli sur `SUPABASE_SERVICE_ROLE_KEY`.

`decryptToken` laisse passer intactes les valeurs non préfixées : les lignes
antérieures au chiffrement continuent donc de fonctionner. C'est voulu, et c'est
ce qui permet de chiffrer progressivement sans interruption.

### Ce qui reste à traiter

- **`extra_config.webhook_secret` n'est pas chiffré.** Le champ est un `jsonb`
  lu par le front pour l'affichage, on ne peut donc pas le chiffrer en bloc sans
  séparer d'abord les champs publics des champs secrets.
- **Aucune route de suppression de compte** n'existe (`api/client/` n'en
  contient pas). Le départ d'un client se traite aujourd'hui à la main.

## 2. Qui y a accès

Depuis la migration `20260909143000_act7_lock_credential_columns` :

| Rôle | Colonnes lisibles | Colonnes modifiables |
|---|---|---|
| `anon` | **0** | 0 |
| `authenticated` | 15 sur 18 — **jamais** `api_key`, `access_token`, `refresh_token` | `status`, `status_message`, `updated_at` |
| `service_role` | 18 | 18 |

Conséquence concrète : une session volée, une extension de navigateur
malveillante ou une faille XSS sur le dashboard ne donnent plus accès au mot de
passe email du marchand. Seules les routes serveur, qui utilisent la
`service_role`, peuvent lire ces colonnes.

L'isolation entre marchands est assurée séparément par les policies RLS
(`client_id IN (client_users… UNION clients.owner_user_id…)`) — un marchand ne
voit que ses propres lignes.

## 3. Rotation si un secret fuite

**Un secret ayant séjourné en clair doit être remplacé, pas seulement chiffré.**
Chiffrer une valeur déjà exposée conserve l'exposition.

Pour une intégration donnée :

1. Révoquer le secret **chez le fournisseur** (Resend → API Keys → Revoke ;
   Google → mots de passe d'application → Supprimer ; Shopify → désinstaller
   l'app). C'est la seule étape qui coupe réellement l'accès.
2. Dashboard Actero → **Intégrations** → déconnecter, puis reconnecter avec le
   nouveau secret. `api/integrations/disconnect.js` supprime la ligne (`DELETE`,
   pas un simple passage en `disconnected`), donc l'ancienne valeur disparaît.
3. Vérifier que la nouvelle ligne est bien chiffrée :

```sql
select provider,
       case when api_key like 'enc:v1:%' then 'chiffré' else 'EN CLAIR' end
from public.client_integrations where client_id = '<uuid>';
```

Si `ENCRYPTION_KEY` elle-même fuite, il faut faire tourner **tous** les secrets :
la clé est unique pour toute l'instance, il n'y a pas de dérivation par client.

## 4. Suppression quand un client part

- **Une intégration** : le bouton « déconnecter » supprime la ligne.
- **Tout un client** : pas de procédure automatisée. À faire à la main —
  supprimer les lignes `client_integrations` du client, révoquer les accès chez
  chaque fournisseur, puis désinstaller l'app Shopify côté marchand.

Les sauvegardes Supabase conservent les lignes supprimées pendant 7 jours
(rétention du plan Pro). Un secret supprimé aujourd'hui reste donc dans les
sauvegardes jusqu'à une semaine — raison de plus pour révoquer chez le
fournisseur plutôt que de se contenter d'effacer la ligne.
