# Audit pré-lancement POC 72h — Findings

Date de l'audit : 2026-04-17
Exécuté par : Claude (inline execution), branch `claude/quirky-easley`

## Synthèse

| # | Sujet | État | Action |
|---|---|---|---|
| 1 | Route `/signup` (frontend) | ✅ OK | — |
| 2 | Route `/signup/plan` (post-signup) | ✅ OK | — |
| 3 | Deux flows auth : direct signup + magic code | ✅ OK | Les deux à modifier pour UTM |
| 4 | Capture UTM frontend | 🔴 Absent | **Task 3** (plan) |
| 5 | Capture UTM backend (`signup.js`, `send-verification-code.js`, `verify-code.js`) | 🔴 Absent | **Task 3** |
| 6 | Colonne `clients.acquisition_source` | 🔴 Absente (confirmé via MCP Supabase) | **Task 2** (migration) |
| 7 | Welcome email transactionnel | 🟡 Existe, fonctionnel | Acceptable pour POC, upgrade post-POC |
| 8 | Notif Slack sur nouveau signup | 🔴 Absente | **Task 7** |
| 9 | PostHog installé | 🔴 Non installé (`grep posthog package.json` = zéro) | **Task 5 simplifiée** → tracker via SQL direct sur `clients.acquisition_source` au lieu d'installer PostHog en POC |
| 10 | Stripe coupon `POC_PRO_199` | 🔴 À créer | **Task 4 (USER)** |
| 11 | Google Sheet tracking | 🔴 À créer | **Task 8 (USER)** |
| 12 | Referral code captation (URL + cookie) | ✅ OK, pattern déjà là | À dupliquer pour UTM |

## Détails techniques

### Flow signup actuel (compris)

1. **Directement** (fallback) : `POST /api/auth/signup` → crée user Supabase + client + settings + welcome email → redirect `/signup/plan`
2. **Magic code** (flow principal) : `POST /api/auth/send-verification-code` → email Resend avec code 6 chiffres → `POST /api/auth/verify-code` → création idem + welcome email → redirect `/signup/plan`

Les deux chemins doivent capter les UTM pour ne pas avoir de trou d'attribution.

### Welcome email — analyse

`api/lib/welcome-email.js` :
- ✅ Resend intégré
- ✅ From "Pablo de Actero <contact@actero.fr>"
- ✅ Non-blocking (try/catch)
- ✅ Has_referral flag → message bonus parrainage
- 🟡 Branding : utilise `#0F5F35` (proche de notre `--primary-deep`) mais **pas la palette complète Actero** du skill (pas de Playfair Display, pas de cream canvas, pas de gold accent, pas de 4px accent bar)
- **Décision POC** : acceptable pour les 72h. À upgrade après POC avec le template du skill `actero-branding` pour cohérence totale avec le reste de la stack.

### Colonnes DB existantes pertinentes

Déjà en place sur `clients` : `referral_code`, `referral_first_month_free`, `referred_by_client_id`. **Pas** de `acquisition_source`, `utm_*`, ou équivalent.

### PostHog — décision POC

Package absent de `dependencies` et `devDependencies`. Installer PostHog en urgence sur 2h avec l'environnement n'est pas raisonnable (risque de casser le build, config env vars, test du Insight Tag).

**Alternative POC** : tracker directement via `clients.acquisition_source` (JSONB) + queries SQL sur `automation_events` et `stripe_subscriptions`. Les KPIs POC (signups par canal, clients payants attribués) sont lisibles en 1 query.

Post-POC : installer PostHog proprement (separate ticket).

## Go/no-go audit : GO ✅

Rien de critique ne bloque le démarrage. Les 🔴 sont tous adressés par les tasks 2, 3, 7 du plan (code) + tasks 4, 8 (user actions en parallèle).

## Ajustements au plan suite à l'audit

1. **Task 3** doit toucher 3 fichiers backend (`signup.js`, `send-verification-code.js`, `verify-code.js`), pas juste 1 → 3 edits courts au lieu de 1 long
2. **Task 5 (PostHog)** → remplacée par **Task 5-bis : instrumenter analytics via Supabase events** (ajout d'événements dans une table dédiée ou via `automation_events` élargie)
3. **Task 6 (welcome email)** → skip création, marquer "acceptable tel quel"
4. Le reste du plan reste inchangé

## Next actions immédiates

1. ✅ Audit terminé
2. → Task 2 : migration `acquisition_source`
3. → Task 3 : capture UTM (3 fichiers backend + 1 frontend)
4. → Task 5-bis : analytics via Supabase SQL + event table
5. → Task 7 : notif Slack signup
