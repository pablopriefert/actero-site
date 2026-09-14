# Formules trimestrielle et annuelle, retour au Checkout Stripe — Design

**Date :** 14 septembre 2026
**Statut :** design validé par Pablo le 14 septembre, révisé le même jour (annuel à
12 mois pour le prix de 11, fin de l'essai de 7 jours) — en cours d'implémentation
**Remplace :** `2026-07-08-stripe-payment-element-design.md` (paiement intégré au site)
**Suite :** chantier B, closers et commissions — spec séparée, qui dépend de celle-ci

## Pourquoi

Actero recrute des closers freelances. Pablo veut trois formules, un avantage simple
par formule, et le paiement sur la page Stripe classique plutôt que dans le site. La
commission d'un closer dépend de la formule signée : ce chantier passe donc en
premier.

## Décisions validées

1. **Trois formules** pour Starter et Pro : mensuel, trimestriel, annuel.
2. **Mensuel** : sans engagement, payé dès l'inscription. **Plus d'essai gratuit de
   7 jours**, nulle part sur le site. Le mois offert de la campagne publicitaire et du
   parrainage reste, et ne concerne que le mensuel.
3. **Trimestriel** : −50 % sur le premier mois, c'est-à-dire un coupon appliqué une
   seule fois, sur le premier trimestre.
4. **Annuel** : **12 mois pour le prix de 11, à −10 %**, payé d'avance et renouvelé
   chaque année aux mêmes conditions.
5. **Pas de cumul** : chaque formule a son avantage, un seul par abonnement.
6. **Le −50 % du trimestriel ne s'obtient qu'une fois par client** : un client qui a
   déjà eu un abonnement n'y a plus droit, ni au mois offert.
7. **Marchands facturés par Shopify** (toute boutique présente dans
   `client_shopify_connections`) : ils s'abonnent chez Shopify, au mois ou à l'année
   (règle 1.2.1 de l'App Store). Aucun changement de code pour eux.
8. **Paiement** : uniquement la page Stripe Checkout hébergée. Le formulaire intégré
   est supprimé.

## Grille

| Formule | Starter | Pro | Avantage |
|---|---|---|---|
| Mensuel | 99 € / mois | 399 € / mois | sans engagement (mois offert si campagne ou parrainage) |
| Trimestriel | 297 € / 3 mois, 1er trimestre 247,50 € | 1 197 € / 3 mois, 1er trimestre 997,50 € | coupon −49,50 € / −199,50 €, une fois |
| Annuel | 980,10 € / an | 3 950,10 € / an | 12 mois pour le prix de 11, à −10 % |

- Trimestriel = 3 × le mensuel. Coupon = 50 % d'un mois.
- Annuel = 11 × le mensuel × 0,9, facturé chaque année (`interval: 'year'`).
  Équivalent affiché : 81,68 € et 329,18 € par mois (prix ÷ 12).
- Code promo (par exemple Actero for Startups) : sur le mensuel, il s'applique ; sur
  le trimestriel, il **remplace** le coupon ; sur l'annuel, il s'applique. Stripe
  n'accepte qu'une réduction par Checkout.

## Historique de la décision

La première version validée donnait **13 mois à chaque renouvellement** pour le prix
de 12 à −10 %, avec un prix Stripe « tous les 13 mois ». Pablo l'a remplacée le jour
même par **12 mois pour le prix de 11, à −10 %** : un prix annuel ordinaire, que
Shopify sait aussi proposer. Ont été écartés pour la version 13 mois, et n'ont plus
lieu d'être : `billing_cycle_anchor` à +13 mois (Stripe exige un ancrage dans la
première période), un essai de 13 mois avec paiement ponctuel (Stripe aurait affiché
« essai gratuit de 395 jours »), un planning Stripe « 13 mois la première année ».

Garder le formulaire intégré à côté du Checkout reste écarté : deux chemins de
paiement dérivent, c'est ce qui donnait 30, 7 ou 0 jours d'essai selon le bouton
(voir `api/lib/essai-gratuit.js`).

## Architecture

### 1. Le catalogue — `api/lib/formules.js` (pur)

Une seule définition des six formules payantes :
`{ plan, periode, lookupKey, montantCentimes, recurring: { interval, interval_count }, mois, coupon? }`.

- Clés de recherche (`lookup_key`) : `actero_starter_mensuel`,
  `actero_starter_trimestriel`, `actero_starter_annuel`, et les mêmes pour `pro`.
- Montants : 9 900 / 29 700 / 98 010 centimes pour Starter, 39 900 / 119 700 / 395 010
  pour Pro. Annuel : `recurring: { interval: 'year', interval_count: 1 }`, `mois: 12`.
- Coupons dont l'identifiant porte le montant : `actero-trimestriel-starter-4950`
  (4 950 centimes) et `actero-trimestriel-pro-19950` (19 950 centimes),
  `duration: once`, `currency: eur`, `applies_to.products` limité au produit du plan.
  Un coupon Stripe ne change plus de montant : un nouveau montant crée un nouveau
  coupon.
- Fonctions : `formulePour(plan, periode)`, `formuleDuPrix(price)` (par
  `lookup_key`), `prixConforme(formule, price)` (le prix facture-t-il exactement le
  catalogue ?), `periodeDepuisApi(valeur)` (période reçue du navigateur, clés
  héritées refusées), `mensualiteCentimes(price)` (montant ÷ nombre de mois de la
  période, pour le MRR), `premierPaiementCentimes`, `libellePeriodeStripe`.
- Le catalogue est figé (gel profond) : il est partagé par toutes les requêtes d'une
  instance et par le navigateur.

**Les identifiants de prix quittent les variables Vercel.** Le serveur retrouve
chaque prix par sa clé (`stripe.prices.list({ lookup_keys })`). Les quatre variables
`STRIPE_PRICE_*` et leur copier-coller disparaissent.

### 2. L'essai et l'avantage de bienvenue — `api/lib/essai-gratuit.js`

- `joursEssaiPour(client)` ne donne plus d'essai standard : 30 jours si parrainage ou
  campagne, sinon aucun (`undefined`). La constante `ESSAI_STANDARD_JOURS` disparaît.
- Nouvelle fonction pure `offreDeBienvenue({ client, periode, dejaAbonne })` :

| Période | Client éligible | Client non éligible |
|---|---|---|
| mensuel | `{ essaiJours }` si parrainage ou campagne, sinon `{}` | `{}` |
| trimestriel | `{ coupon }` | `{}` |
| annuel | `{}` | `{}` |

Éligible = `dejaAbonne` faux **et** `client.trial_ends_at` vide. `dejaAbonne` est lu
par la route chez Stripe (`stripe.subscriptions.list({ customer, status: 'all',
limit: 1 })`). Si la lecture échoue, la route répond une erreur : on n'accorde rien
sur un « je ne sais pas ».

### 3. La route — `api/billing/upgrade.js`

- `billing_period` accepte `monthly`, `quarterly`, `annual`.
- La garde Shopify reste en tête (`refuserFacturationStripe`).
- Prix résolu par sa clé ; introuvable → 503.
- Avantage calculé par `offreDeBienvenue`. La session porte `discounts` (coupon ou
  code promo) **ou** `allow_promotion_codes`, jamais les deux.
- `subscription_data.metadata` porte **toujours** `client_id`, `actero_client_id` et
  `formule` : sans `client_id`, un impayé ne ferait jamais repasser le compte en Free.
- Abonné existant :
  - même période, abonnement `active` ou `trialing` **avec** moyen de paiement
    (`resolveCustomerCard`) → changement de plan immédiat au prorata, qui pose aussi
    `default_payment_method`, **sans écrire le plan en base** (le webhook l'accorde) ;
  - abonnement sans moyen de paiement → nouveau Checkout ;
  - autre période → 409 `changement_de_formule`, renvoi vers le support.

### 4. Le webhook — `api/stripe-webhook.js` et `api/lib/subscription-plan.js`

- `planUpdateFromSubscription(subscription, { aUneCarte })` trouve le plan par
  `formuleDuPrix`. Un prix sans clé connue n'accorde aucun plan, et laisse une trace
  dans le journal quand l'abonnement est actif (offre sur mesure ou clé mal posée).
- La carte se résout comme dans la route (`resolveCustomerCard`).
- `checkout.session.completed` (branche upgrade) écrit aussi `billing_period` et
  `billing_provider: 'stripe'`.

### 5. Le code qui lit la période d'un prix

- `api/stripe-billing.js` (MRR admin) : mensualité = montant ÷ mois de la période.
- `AdminBillingView.jsx` : « / mois », « / 3 mois », « / an ».
- `api/admin/setup-stripe-products.js` (via `api/lib/configuration-stripe.js`) : pour
  chaque formule, retrouve le prix par sa clé, sinon par ses caractéristiques
  (produit, montant, périodicité) — il reçoit alors sa clé —, sinon le crée, sur le
  produit Starter ou Pro existant. Un prix qui porte la clé mais ne facture plus le
  montant du catalogue est remplacé, la clé passant au nouveau prix. Crée les deux
  coupons. Désactive les **anciens**
  prix annuels (948 € et 3 828 €) : tout prix annuel d'un produit Actero qui n'est pas
  celui d'une formule du catalogue. L'ancien script reconnaissait « le mensuel » à
  `interval === 'month'`, ce que le trimestriel vérifie aussi.
- `api/admin/stripe-status.js` et `AdminStripeSetupView.jsx` : état des six prix (clé
  posée et montant conforme) et des deux coupons. La route de paiement refuse un prix
  non conforme plutôt que de facturer un autre montant que celui affiché.

### 6. Le front

- **Sélecteur Mensuel / Trimestriel / Annuel** sur `/tarifs`, la page de choix du
  plan et la facturation du tableau de bord ; montants dérivés du catalogue.
- **La formule suit le visiteur** : `/tarifs` la mémorise, la page de choix du plan la
  relit (ou `?formule=`), et ne code plus « monthly » en dur.
- **Marchand facturé par Shopify** : pas de trimestriel affiché.
- **Offre de bienvenue** : « 1er trimestre à 247,50 € » et le badge −50 % ne
  s'affichent pas dans la facturation d'un client déjà abonné ou qui a eu un essai.
- **Paiement** : tout bouton payant appelle `/api/billing/upgrade`, puis redirige vers
  Stripe. Après un changement immédiat, le front attend que le webhook ait écrit le
  nouveau plan.
- **Supprimés** : `PaymentModal.jsx`, `stripe-client.js`, `create-subscription.js` et
  son test, `@stripe/stripe-js`, `@stripe/react-stripe-js`,
  `VITE_STRIPE_PUBLISHABLE_KEY` dans `.env.example`, les prix annuels de `plans.js`.
- **Textes** :
  - la remise annuelle de 20 % disparaît (`PricingPage.jsx`, `FaqPage.jsx`,
    `ClientBillingView.jsx`, `PricingA.jsx`) ;
  - **l'essai de 7 jours disparaît de tout le site** : boutons et bandeaux
    (`StickyCTA`, `StickyCTABar`, `UpgradeBanner`, `PricingA`, `ROISimulator`,
    `GorgiasCostCalculator`, `AlternativeTemplate`, `VsTemplate`, `PortalSavView`),
    `plans.js` (`trial`, `cta`), `PricingPage.jsx` (listes, FAQ, bouton, SEO),
    `PlanSelectionPage.jsx`, `SignupPage.jsx`, `SupportGuidePage.jsx`. Les bandeaux
    « Essai gratuit — J-x » du tableau de bord restent : ils servent le mois offert.

### Non concerné

Le tunnel de vente (`api/create-checkout-session.js`, tarifs sur mesure — il perd
seulement l'essai standard via `joursEssaiPour`) et la facturation Shopify.

## Conséquences assumées

- Le mensuel se paie à l'inscription : la page Stripe demande la carte et encaisse
  tout de suite, sauf mois offert.
- Le paiement quitte actero.fr pour la page Stripe, puis revient sur
  `/client/overview?upgrade=success`.
- Un abonné qui veut changer de formule passe par le support.

## Tests — chacun échoue si le défaut revient

1. `api/lib/formules.test.js` : trimestriel 297 et 247,50 ; annuel 980,10 et
   3 950,10, facturé chaque année ; coupon égal à 50 % d'un mois ; le mensuel égal au
   prix de `plans.js`.
2. `api/lib/essai-gratuit.test.js` : plus d'essai standard ; mois offert si campagne
   ou parrainage ; matrice de `offreDeBienvenue`.
3. `api/lib/subscription-plan.test.js` : un prix trimestriel et un prix annuel donnent
   le bon plan, sans variable d'environnement ; une carte rangée sur le client Stripe
   suffit ; sans carte, rien.
4. MRR : un trimestriel compte pour un tiers, un annuel pour un douzième.
5. Setup : les anciens annuels sont désactivés, les nouveaux jamais.
6. Gardes de source : `upgrade.js` pose toujours `metadata.client_id` et n'écrit
   jamais `plan` ; plus d'import de l'ancien paiement intégré ; la page de choix du
   plan ne code plus la période ; plus de remise annuelle de 20 % ; **plus aucune
   promesse d'essai de 7 jours** dans `src/`.
7. `api/lib/conformite-app-store.test.js` : mis à jour ; la garde Shopify reste exigée
   sur `upgrade.js`.

## Ta part (Pablo)

1. Admin → « Configurer Stripe » : crée les prix et les coupons, pose les clés,
   désactive les anciens annuels.
2. Stripe → Portail client : ajouter les nouveaux prix si « changer de formule » est
   activé, sinon le désactiver.
3. Vercel, après déploiement : retirer `VITE_STRIPE_PUBLISHABLE_KEY` et les quatre
   `STRIPE_PRICE_*`.
4. Shopify Partner Dashboard : annuel à 980,10 € et 3 950,10 €, et **0 jour d'essai**
   sur les plans Shopify, pour s'aligner.
5. En mode test Stripe : un paiement par formule et par plan avant la production.

## Hors périmètre

- Le changement de formule d'un abonné existant.
- Les closers et leurs commissions : chantier B.
- Le trimestriel pour les marchands Shopify.
