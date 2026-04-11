# WhatsApp Business Integration

Backend pour l'onboarding WhatsApp Business via Meta Embedded Signup, le webhook Cloud API, et les endpoints d'administration.

## Flow

1. Le merchant clique le bouton "Connecter WhatsApp" cote frontend.
2. `FB.login({ config_id: META_CONFIG_ID, ... })` ouvre la popup Meta (Embedded Signup).
3. A la fin de la popup, `authResponse.code` (court-vie) est POST sur `/api/integrations/whatsapp/exchange-code`.
4. Ce endpoint echange le code contre un access_token business permanent, discover la business portfolio + WABA + phone number, enregistre le numero sur Cloud API, subscribe notre app au webhook WABA, chiffre le token et persiste le tout dans `whatsapp_accounts`.
5. Les messages entrants arrivent sur `/api/engine/webhooks/whatsapp`, sont signes HMAC par Meta, lookup par `phone_number_id`, passes a `runBrain()`, puis la reponse IA est envoyee via `sendWhatsAppMessage`.

## Env vars

| Variable                          | Obligatoire | Description |
|-----------------------------------|-------------|-------------|
| `META_APP_ID`                     | oui         | ID de l'app Meta (App Dashboard → Settings → Basic) |
| `META_APP_SECRET`                 | oui         | Secret de l'app Meta (jamais expose cote client) |
| `META_CONFIG_ID`                  | oui (front) | ID de la configuration Embedded Signup (App Dashboard → WhatsApp → Configuration) |
| `META_WEBHOOK_VERIFY_TOKEN`       | oui         | Random string que tu mets dans App Dashboard → WhatsApp → Webhooks → Callback URL config |
| `META_GRAPH_VERSION`              | optionnel   | Defaut `v21.0` |
| `WHATSAPP_TOKEN_ENCRYPTION_KEY`   | recommande  | Cle 32 bytes hex. Si absente, on derive via SHA-256(`SUPABASE_SERVICE_ROLE_KEY`) — moins propre mais fonctionnel. |
| `PUBLIC_API_URL`                  | oui         | URL publique de l'API (pour le callback webhook Meta). Exemple: `https://actero.fr` |

## Endpoints

| Method | Path | Role |
|--------|------|------|
| POST   | `/api/integrations/whatsapp/exchange-code`    | Echange `code` → token + persist account |
| POST   | `/api/integrations/whatsapp/send-test`        | Envoie un message test "Actero est connecte" |
| POST   | `/api/integrations/whatsapp/disconnect`       | Unsubscribe + delete account |
| GET    | `/api/integrations/whatsapp/status`           | Retourne l'etat du compte |
| GET    | `/api/engine/webhooks/whatsapp`               | Handshake Meta (hub.mode / hub.verify_token) |
| POST   | `/api/engine/webhooks/whatsapp`               | Webhook inbound (signature HMAC obligatoire) |

## Config cote Meta App Dashboard

1. **Products → WhatsApp → Configuration** : creer une configuration Embedded Signup.
   - Type: `whatsapp_business_app_onboarding`
   - Noter le `configuration_id` → `META_CONFIG_ID`
2. **Products → WhatsApp → Webhooks** :
   - Callback URL: `https://actero.fr/api/engine/webhooks/whatsapp`
   - Verify token: `META_WEBHOOK_VERIFY_TOKEN`
   - Subscribe au field `messages`
3. **Settings → Basic** : recuperer `META_APP_ID` + `META_APP_SECRET`

## Livraison en prod — paperasse Meta obligatoire

- **Business Verification** sur le Meta Business Portfolio (documents d'entreprise). Sans ca, seules les 5 numeros de test fonctionnent.
- **App Review** pour les permissions :
  - `whatsapp_business_management`
  - `whatsapp_business_messaging`
  - `business_management`
- **Advanced Access** sur ces permissions (par defaut Standard Access → limite aux users-admins de l'app).
- **Ajout du domaine** dans "App Settings → Basic → App Domains" pour que le FB JS SDK accepte la popup.

Tant que ces trois etapes ne sont pas terminees, l'integration ne marche qu'en sandbox / test. Prevoir 5-10 jours ouvres pour la review Meta.

## Docs Meta

- https://developers.facebook.com/docs/whatsapp/embedded-signup/overview
- https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
- https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
