# Formules trimestrielle et annuelle 13 mois, retour au Checkout Stripe — Design

**Date :** 14 septembre 2026
**Statut :** design validé par Pablo le 14 septembre — spec à relire
**Remplace :** `2026-07-08-stripe-payment-element-design.md` (paiement intégré au site)
**Suite :** chantier B, closers et commissions — spec séparée, qui dépend de celle-ci

## Pourquoi

Actero recrute des closers freelances. Pablo veut trois formules, une offre simple
par formule, et le paiement sur la page Stripe classique plutôt que dans le site.
La commission d'un closer dépend de la formule signée : ce chantier passe donc en
premier.

## Décisions validées

1. **Trois formules** pour Starter et Pro : mensuel, trimestriel, annuel.
2. **Trimestriel** : −50 % sur le premier mois, c'est-à-dire un coupon appliqué une
   seule fois, sur le premier trimestre.
3. **Annuel** : −10 % au lieu de −20 %, payé d'avance, **13 mois d'accès à chaque
   renouvellement**.
4. **Pas de cumul** : la formule détermine l'offre, une seule par abonnement.
5. **Une seule offre de bienvenue par client, à vie** : l'essai du mensuel et le
   −50 % du trimestriel ne s'obtiennent qu'une fois. C'est une règle nouvelle : un
   client qui a déjà eu un abonnement, même sans essai, n'en retrouve pas.
6. **Marchands facturés par Shopify** (toute boutique présente dans
   `client_shopify_connections`) : inchangé.
7. **Paiement** : uniquement la page Stripe Checkout hébergée. Le formulaire intégré
   est supprimé.

## Grille

| Formule | Starter | Pro | Offre |
|---|---|---|---|
| Mensuel | 99 € / mois | 399 € / mois | essai 7 j, 30 j si parrainage ou campagne (inchangé) |
| Trimestriel | 297 € / 3 mois, 1er trimestre 247,50 € | 1 197 € / 3 mois, 1er trimestre 997,50 € | coupon −49,50 € / −199,50 €, une fois. Pas d'essai |
| Annuel | 1 069,20 € / 13 mois | 4 309,20 € / 13 mois | 13e mois compris dans le prix. Pas d'essai |

- Trimestriel = 3 × le mensuel. Coupon = 50 % d'un mois.
- Annuel = 12 × le mensuel × 0,9, facturé tous les 13 mois. Équivalent affiché :
  82,25 € et 331,48 € par mois (prix ÷ 13).
- Le mois offert du parrainage et de la campagne ne concerne que le mensuel.
- Code promo (par exemple Actero for Startups) : sur le mensuel, rien ne change (il
  s'ajoute à l'essai, comme aujourd'hui) ; sur le trimestriel, il **remplace** le
  coupon ; sur l'annuel, il s'applique. Stripe n'accepte qu'une réduction par
  Checkout.

## Pistes écartées

| Piste | Pourquoi non |
|---|---|
| `billing_cycle_anchor` à +13 mois sur un prix annuel | Stripe exige un ancrage à l'intérieur de la première période, et interdit les prix ponctuels quand `proration_behavior` vaut `none` ([doc, section Limitations](https://docs.stripe.com/payments/checkout/billing-cycle)) |
| Essai de 13 mois + paiement ponctuel | Statut `trialing` pendant 13 mois ; la page Stripe annonce « essai gratuit de 395 jours » à quelqu'un qui paie 1 069 € ; l'e-mail `trial_will_end` part |
| 13 mois la 1re année seulement, via un planning Stripe | Écartée par Pablo : plus de code à écrire et tester, pour environ 82 € de plus par an et par client Starter |
| Garder le formulaire intégré à côté du Checkout | Deux chemins de paiement dérivent : c'est ce qui donnait 30, 7 ou 0 jours d'essai selon le bouton (voir `api/lib/essai-gratuit.js`) |

Stripe accepte un intervalle de facturation jusqu'à trois ans (`interval_count`
jusqu'à 36 pour `interval: month`) : un prix « tous les 13 mois » est un prix
ordinaire ([référence API](https://docs.stripe.com/api/prices/create)).

## Architecture

### 1. Le catalogue — `api/lib/formules.js` (nouveau, pur)

Une seule définition des six formules payantes :
`{ plan, periode, lookupKey, montantCentimes, recurring: { interval, interval_count }, mois, coupon? }`.

- Clés de recherche (`lookup_key`) : `actero_starter_mensuel`,
  `actero_starter_trimestriel`, `actero_starter_annuel`, et les mêmes pour `pro`.
- Coupons à identifiant fixe : `actero-trimestriel-starter` (4 950 centimes) et
  `actero-trimestriel-pro` (19 950 centimes), `duration: once`, `currency: eur`,
  `applies_to.products` limité au produit du plan.
- Fonctions : `formulePour(plan, periode)`, `formuleDuPrix(price)` (par
  `lookup_key`), `mensualiteCentimes(price)` (montant ÷ nombre de mois de la
  période, pour le MRR).

**Les identifiants de prix quittent les variables Vercel.** Le serveur retrouve
chaque prix par sa clé (`stripe.prices.list({ lookup_keys })`). Les quatre variables
`STRIPE_PRICE_*` et leur copier-coller disparaissent : une étape manuelle est une
étape qu'on finit par rater.

### 2. L'offre — `api/lib/essai-gratuit.js`

Nouvelle fonction pure `offreDeBienvenue({ client, periode, dejaAbonne })` :

| Période | Client éligible | Client non éligible |
|---|---|---|
| mensuel | `{ essaiJours: joursEssaiPour(client) }` (règles actuelles) | `{}` |
| trimestriel | `{ coupon }` | `{}` |
| annuel | `{}` (le 13e mois est dans le prix) | `{}` |

Éligible = `dejaAbonne` faux **et** `client.trial_ends_at` vide.

`dejaAbonne` est calculé par la route : le client Stripe a-t-il déjà eu un
abonnement, quel qu'en soit le statut (`stripe.subscriptions.list({ customer,
status: 'all', limit: 1 })`) ? Un client sans identifiant Stripe n'en a jamais eu.
Stripe fait foi, aucune colonne à ajouter. Si l'appel échoue, la route répond une
erreur et le front propose de réessayer : on n'accorde pas d'offre sur un « je ne
sais pas ».

### 3. La route — `api/billing/upgrade.js`

- `billing_period` accepte `monthly`, `quarterly`, `annual`.
- La garde Shopify reste en tête (`refuserFacturationStripe`), inchangée.
- Prix résolu par sa clé ; introuvable → 503, comme aujourd'hui quand une variable
  manque.
- Offre calculée par `offreDeBienvenue`. La session porte `discounts` (coupon ou code
  promo) **ou** `allow_promotion_codes`, jamais les deux.
- `subscription_data.metadata` porte **toujours** `client_id`, `actero_client_id` et
  `formule`. `customer.subscription.updated` retrouve le client par `client_id` :
  sans lui, un impayé ou une résiliation ne ferait jamais repasser le compte en
  Free. Le formulaire intégré posait ce champ, le Checkout actuel ne le pose que pour
  un parrainage.
- Abonné existant :
  - même période, abonnement `active` ou `trialing` **avec** moyen de paiement
    (résolu par `resolveCustomerCard`) → changement de plan immédiat au prorata, qui
    pose aussi `default_payment_method` sur l'abonnement, **sans écrire le plan en
    base** : le webhook l'accorde (défaut relevé par l'audit : le plan payant était
    inscrit avant toute confirmation de Stripe) ;
  - abonnement sans moyen de paiement (essai sans carte laissé par l'ancien
    formulaire) → nouveau Checkout ; l'ancien abonnement s'annule seul à la fin de
    l'essai, et comme `clients.stripe_subscription_id` pointe alors vers le nouveau,
    sa suppression ne rétrograde personne ;
  - autre période → 409 `changement_de_formule`, le front renvoie vers le support.

### 4. Le webhook — `api/stripe-webhook.js` et `api/lib/subscription-plan.js`

- `planUpdateFromSubscription(subscription, { aUneCarte })` trouve le plan par
  `formuleDuPrix`, et non plus par une table construite depuis quatre variables
  d'environnement. Un prix sans clé connue n'accorde aucun plan, comme aujourd'hui un
  prix absent de la table.
- La carte se résout comme dans la route : `resolveCustomerCard` (carte de
  l'abonnement, sinon carte par défaut du client Stripe), calculée par le webhook et
  passée à la fonction pure. Aujourd'hui, seul `subscription.default_payment_method`
  compte : si Stripe range la carte sur le client plutôt que sur l'abonnement, un
  client qui a payé n'obtiendrait jamais son plan par ce chemin.
- `checkout.session.completed`, branche upgrade : écrit aussi `billing_period` et
  `billing_provider: 'stripe'`.

### 5. Le code qui lit la période d'un prix

- `api/stripe-billing.js` (MRR de l'admin) : mensualité = montant ÷ mois de la
  période. Aujourd'hui, `interval === 'month'` compterait un prix « tous les 13
  mois » pour 1 069,20 € de MRR au lieu de 82,25 €, et un trimestriel trois fois
  trop.
- `src/components/admin/AdminBillingView.jsx` : affiche « / 3 mois » et « / 13
  mois ».
- `api/admin/setup-stripe-products.js` : pour chaque formule, retrouve le prix par sa
  clé, sinon par `metadata.actero_plan` + `metadata.actero_periode` (il reçoit alors
  sa clé), sinon le crée — rattaché au produit Starter ou Pro **existant**, puisque
  les fonctionnalités Stripe Entitlements sont portées par le produit. Crée les deux
  coupons. Désactive les anciens prix annuels à 948 € et 3 828 € (réactivables ;
  aucun abonné dessus au 14 septembre). Aujourd'hui, ce script reconnaît « le
  mensuel » à `interval === 'month'`, ce que les prix trimestriels et 13 mois
  vérifient aussi.
- `api/admin/stripe-status.js` et `AdminStripeSetupView.jsx` : montrent l'état des
  six prix et des deux coupons au lieu de quatre variables.

### 6. Le front

- **Sélecteur Mensuel / Trimestriel / Annuel** sur `/tarifs`, sur la page de choix du
  plan et dans la facturation du tableau de bord. Les montants affichés viennent de
  `src/lib/plans.js`, qui reste la source d'affichage.
- **La formule suit le visiteur** : `/tarifs` transmet la formule choisie
  (`?formule=trimestriel`) à la page de choix du plan, qui ne code plus « monthly »
  en dur. Aujourd'hui, choisir l'annuel sur `/tarifs` mène à un paiement mensuel.
- **Marchand facturé par Shopify** : ni trimestriel ni 13e mois affichés ; le renvoi
  vers Shopify reste inchangé. Le serveur refuse de toute façon.
- **Paiement** : tout bouton payant appelle `/api/billing/upgrade`, puis redirige vers
  Stripe. Après un changement immédiat, le front attend que le webhook ait écrit le
  nouveau plan avant de l'annoncer.
- **Supprimés** : `src/components/billing/PaymentModal.jsx`,
  `src/lib/stripe-client.js`, `api/billing/create-subscription.js` et son test, les
  dépendances `@stripe/stripe-js` et `@stripe/react-stripe-js`, la ligne
  `VITE_STRIPE_PUBLISHABLE_KEY` de `.env.example`.
- **Textes** : la remise de 20 % disparaît de `PricingPage.jsx` (FAQ et calcul du
  pourcentage), `FaqPage.jsx`, `ClientBillingView.jsx` et `PricingA.jsx` (« 79 €/mois
  en annuel »).

### Non concerné

Le tunnel de vente (`api/create-checkout-session.js`, tarifs sur mesure) et la
facturation Shopify (`api/billing/shopify-billing.js`,
`api/billing/shopify-callback.js`).

## Conséquences assumées

- La carte est demandée dès l'essai de 7 jours (comportement par défaut du Checkout).
  C'était déjà l'intention de `plans.js` (`requires_card: true`), et cela tranche
  ACT-33.
- Le paiement quitte actero.fr pour la page Stripe, puis revient sur
  `/client/overview?upgrade=success`.
- Un abonné qui veut changer de formule passe par le support.

## Tests — chacun échoue si le défaut revient

1. `api/lib/formules.test.js` : les montants (297 et 247,50 ; 1 069,20 pour 13 mois ;
   4 309,20), le coupon égal à 50 % d'un mois, et `src/lib/plans.js` qui affiche les
   mêmes montants que le catalogue.
2. `api/lib/essai-gratuit.test.js` : la matrice de `offreDeBienvenue` — déjà abonné,
   rien ; trimestriel, coupon ; annuel, rien ; mensuel, règles actuelles.
3. `api/lib/subscription-plan.test.js` : un prix trimestriel et un prix 13 mois
   donnent le bon plan, sans aucune variable d'environnement ; une carte rangée sur
   le client Stripe suffit à accorder le plan ; sans carte nulle part, rien n'est
   accordé.
4. MRR : un prix 13 mois compte pour un treizième, un trimestriel pour un tiers.
5. Setup : mensuel, trimestriel et 13 mois ne se confondent jamais.
6. Gardes de source, commentaires retirés avant lecture : `upgrade.js` pose toujours
   `metadata.client_id` et n'écrit jamais `plan` dans `clients` ; aucun fichier
   n'importe `PaymentModal`, `stripe-client` ou `create-subscription` ; la page de
   choix du plan ne code plus la période en dur ; plus aucune remise annuelle de
   20 % dans `src/`.
7. `api/lib/conformite-app-store.test.js` : mis à jour (il cite
   `create-subscription`) ; la garde Shopify reste exigée sur `upgrade.js`.

## Ta part (Pablo)

1. Admin → « Configurer Stripe » : crée les prix et les coupons et pose les clés.
   **Plus rien à copier dans Vercel.**
2. Stripe → Portail client : si l'option « changer de formule » est activée, y
   ajouter les nouveaux prix ou la désactiver.
3. Vercel, une fois le déploiement fait : retirer `VITE_STRIPE_PUBLISHABLE_KEY` et
   les quatre `STRIPE_PRICE_*`, qui ne sont plus lus.
4. Facultatif — Shopify Partner Dashboard : l'annuel à −10 % pour les marchands de
   l'App Store.
5. En mode test Stripe, avant la production : un paiement par formule et par plan.

## Hors périmètre

- Le changement de formule d'un abonné existant.
- Les closers et leurs commissions : chantier B.
- Trimestriel et 13e mois pour les marchands Shopify : Shopify ne propose que le
  mensuel et l'annuel.
