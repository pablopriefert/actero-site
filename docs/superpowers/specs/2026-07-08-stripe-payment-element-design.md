# Paiement Stripe intégré (Payment Element) — Design

**Date:** 2026-07-08
**Statut:** approuvé (Pablo) — style Actero clair, layout split-panel

## Objectif

Les inscriptions directes actero.fr paient **sur le site** (modale on-brand) au lieu
d'être redirigées vers Stripe Checkout. Les marchands installés via **Shopify** restent
facturés via Shopify Billing (conformité App Store 1.2) — inchangé.

## Contexte technique actuel

- Backend : SDK `stripe` v20 présent. `api/billing/upgrade.js` crée une **Checkout Session**
  et renvoie `checkout_url` ; le front fait `window.location.assign`.
- Front : **aucune** intégration Stripe (pas de `@stripe/stripe-js`, pas de clé publishable).
- Activation du plan : webhook `api/stripe-webhook.js`.
  - Chemin Checkout → `checkout.session.completed` (metadata `actero_client_id` + `upgrade_to`).
  - `customer.subscription.updated` (ligne 702) mappe `priceId → plan` et lit
    `subscription.metadata.client_id`. **C'est le chemin utilisé par Payment Element.**

## Architecture

### Backend — `api/billing/create-subscription.js` (nouveau)
Mirroir de `upgrade.js` (mêmes imports : `withSentry`, `@supabase/supabase-js`, `Stripe`,
`isActeroAdmin`). Étapes :
1. Auth bearer + vérif user↔client (comme upgrade.js).
2. Refuse `free`/`enterprise`, refuse downgrade.
3. `STRIPE_SECRET_KEY` absent → 503.
4. Get-or-create Stripe customer (persisté sur `clients.stripe_customer_id`).
5. Essai : parrainage 30j prioritaire, sinon 7j si jamais eu d'essai.
6. **Sous existant actif** → swap de prix instantané (`subscriptions.update`) + MAJ
   `clients.plan` → renvoie `{ instant: true }`.
7. Sinon `subscriptions.create({ payment_behavior:'default_incomplete',
   payment_settings:{ save_default_payment_method:'on_subscription' },
   trial_period_days?, metadata:{ client_id, actero_client_id, upgrade_to, upgrade_from,
   referral_code?, promo_code? }, expand:['latest_invoice.payment_intent',
   'pending_setup_intent'] })`.
   - Promo → résout `promotionCodes.list` → `discounts:[{promotion_code}]`.
   - Persiste `clients.stripe_subscription_id`.
8. Renvoie `{ subscription_id, mode, client_secret }` :
   - `mode:'setup'` si essai (→ `pending_setup_intent.client_secret`).
   - `mode:'payment'` sinon (→ `latest_invoice.payment_intent.client_secret`).

Le webhook `customer.subscription.updated` active le plan quand l'abonnement passe
`active`/`trialing` (metadata `client_id` + priceId mappé). **Aucune modif webhook.**

### Front
- Deps : `@stripe/stripe-js`, `@stripe/react-stripe-js`.
- `src/lib/stripe-client.js` : singleton `loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)`.
- `src/components/billing/PaymentModal.jsx` : split-panel on-brand.
  - Gauche (cream) : nom plan, prix (Instrument Serif), ligne essai, 3 inclus, badges
    « Sécurisé par Stripe · Sans engagement · Annulable ».
  - Droite (blanc) : `<LinkAuthenticationElement>` + `<PaymentElement>` (Appearance API :
    `colorPrimary #0E653A`, radius, DM Sans) + bouton vert + zone erreur.
  - `confirmSetup`/`confirmPayment` selon `mode`, `redirect:'if_required'` (3DS si besoin),
    succès → `onSuccess()` → navigation `/client/overview?upgrade=success`.

### Points d'intégration
`PlanSelectionPage.jsx` + `ClientBillingView.jsx` : garder `resolveUpgrade` (Shopify d'abord) ;
si `channel==='stripe'` → **ouvrir PaymentModal** au lieu de la redirection Checkout.

### Fallback
`VITE_STRIPE_PUBLISHABLE_KEY` absente → on retombe sur le Checkout `upgrade.js` actuel.
Rien ne casse.

## Erreurs
Carte refusée / 3DS échoué (message inline), échec création (message + fallback possible),
abandon (fermeture propre), clé absente (fallback Checkout).

## Tests
- Vitest `create-subscription.test.js` (Stripe + supabase mockés) : essai→`setup`,
  sans-essai→`payment`, sous existant→`instant`, clé manquante→503, auth refusée→401/403,
  downgrade→400.
- Modale : rendu + build via preview (Elements non testables unitairement).

## Env (côté Pablo)
`VITE_STRIPE_PUBLISHABLE_KEY=pk_live_…` sur Vercel (Production).
