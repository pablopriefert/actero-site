# Formules trimestrielle et annuelle, Checkout Stripe hébergé — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** vendre Starter et Pro au mois (sans essai), au trimestre (−50 % sur le premier mois) et à l'année (12 mois pour le prix de 11, à −10 %), uniquement par la page Stripe Checkout hébergée, et retirer l'essai de 7 jours de tout le site.

**Architecture :** un catalogue pur (`api/lib/formules.js`) décrit les six formules et leurs clés Stripe (`lookup_key`) ; il est importé par le serveur (route de paiement, webhook, MRR, configuration Stripe) et par le front (affichage des prix). L'avantage de bienvenue et les paramètres de la session Checkout sont deux fonctions pures testées sans Stripe. Le formulaire de paiement intégré (Payment Element) est supprimé.

**Tech stack :** Vercel serverless (Node, ESM), Stripe SDK v20, Supabase, React + Vite, Vitest (environnement node ; `// @vitest-environment jsdom` au besoin), ESLint.

**Spec :** `docs/superpowers/specs/2026-09-14-formules-trimestrielle-annuelle-checkout-design.md` (révisée le 14 septembre : annuel à 12 mois pour le prix de 11, plus d'essai de 7 jours).

**Règles du dépôt à respecter :**
- Les fichiers de `api/` hors `api/lib/` deviennent des fonctions Vercel : les helpers vont dans `api/lib/`.
- Les gardes de source retirent les commentaires avant d'analyser (`sansCommentaires`).
- Commentaires et messages en français, qui disent *pourquoi*.
- Commit après chaque tâche, message en français, terminé par une ligne `Co-Authored-By:` au nom du modèle qui écrit le commit. **Ne pas pousser.**
- Branche : `feat/formules-checkout`.

---

## Carte des fichiers

| Fichier | Rôle | Action |
|---|---|---|
| `api/lib/formules.js` | Catalogue des six formules, conversions de période, mensualité et conformité d'un prix Stripe | Créé (Task 1), révisé (Tasks 1 bis et 1 ter) |
| `api/lib/essai-gratuit.js` | Plus d'essai standard ; + `offreDeBienvenue()` (coupon lu dans le catalogue) | Modifier (Tasks 2 et 2 bis) |
| `api/lib/formules-stripe.js` | Deux lectures Stripe : prix d'une formule, « déjà abonné ? » | Créer |
| `api/lib/checkout-formule.js` | Paramètres purs de la session Checkout | Créer |
| `api/lib/configuration-stripe.js` | Crée ou retrouve prix, clés et coupons (idempotent) | Créer |
| `api/lib/subscription-plan.js` | Plan déduit de la clé du prix + carte | Modifier |
| `api/billing/upgrade.js` | Seule route de paiement Stripe self-serve | Réécrire |
| `api/stripe-webhook.js` | Branchement du nouveau `planUpdateFromSubscription`, période écrite | Modifier |
| `api/stripe-billing.js` | MRR normalisé par la durée de la période | Modifier |
| `api/admin/setup-stripe-products.js`, `api/admin/stripe-status.js` | Configuration et état Stripe | Réécrire |
| `src/lib/affichage-formules.js` | Montants affichés, mémorisation de la formule choisie | Créer |
| `src/components/billing/SelecteurFormule.jsx` | Sélecteur Mensuel / Trimestriel / Annuel | Créer |
| `src/pages/PricingPage.jsx`, `src/pages/PlanSelectionPage.jsx`, `src/components/client/ClientBillingView.jsx` | Formules, Checkout seul | Modifier |
| `src/components/admin/AdminStripeSetupView.jsx`, `src/components/admin/AdminBillingView.jsx` | Admin Stripe | Modifier |
| `src/lib/plans.js`, bandeaux et boutons (liste Task 13) | Plus d'essai de 7 jours | Modifier |
| `docs/essentials/quickstart.mdx`, `docs/essentials/facturation.mdx`, `public/llms.txt`, `public/og-image.svg` | Documentation et textes publics : ni essai de 7 jours, ni ancien annuel | Modifier |
| `src/components/landing/PricingA.jsx`, `src/pages/FaqPage.jsx` | Textes « −20 % » | Modifier |
| `PaymentModal.jsx`, `stripe-client.js`, `create-subscription.js` (+ test) | Paiement intégré | Supprimer |
| `api/billing/paiement-heberge.test.js` | Gardes de source du chantier | Créer |

---

### Task 1 : le catalogue des formules — LIVRÉE

Livrée en `53fb816` (fichiers `api/lib/formules.js` et `api/lib/formules.test.js`), dans la version « 13 mois à chaque renouvellement ». La Task 1 bis la révise.

---

### Task 1 bis : l'annuel devient 12 mois pour le prix de 11, à −10 %

**Files :**
- Modify : `api/lib/formules.js`
- Test : `api/lib/formules.test.js`

- [ ] **Step 1 : modifier les tests (ils doivent échouer)**

Dans `api/lib/formules.test.js` :

1. Dans le commentaire d'en-tête, remplacer `« tous les 13 mois » a lui aussi \`interval: 'month'\`.` par `trimestriel a lui aussi \`interval: 'month'\`.`

2. Remplacer tout le test `it('l’annuel vaut douze mensualités moins 10 %, facturées tous les 13 mois', …)` par :

```js
  it('l’annuel vaut onze mensualités moins 10 %, pour 12 mois facturés chaque année', () => {
    // Révision du 14 septembre : « 12 mois pour le prix de 11, à −10 % ».
    for (const plan of ['starter', 'pro']) {
      const mensuel = formulePour(plan, 'mensuel').montantCentimes
      const annuel = formulePour(plan, 'annuel')
      expect(annuel.montantCentimes).toBe(Math.round(11 * mensuel * 0.9))
      expect(annuel.recurring).toEqual({ interval: 'year', interval_count: 1 })
      expect(annuel.mois).toBe(12)
      expect(annuel.coupon).toBeUndefined()
    }
  })
```

3. Dans le test `les montants validés par Pablo le 14 septembre`, remplacer `.toBe(106920)` par `.toBe(98010)` et `.toBe(430920)` par `.toBe(395010)`.

4. Dans le test `la mensualité d’un prix Stripe tient compte du nombre de mois`, remplacer la ligne

```js
    expect(mensualiteCentimes({ unit_amount: 106920, recurring: { interval: 'month', interval_count: 13 } })).toBe(8225)
```

par

```js
    expect(mensualiteCentimes({ unit_amount: 98010, recurring: { interval: 'year', interval_count: 1 } })).toBe(8168)
```

5. Dans le test `un libellé de période lisible`, remplacer `interval_count: 13 })).toBe('13 mois')` par `interval_count: 6 })).toBe('6 mois')`.

- [ ] **Step 2 : lancer, vérifier l'échec**

Run : `npx vitest run api/lib/formules.test.js`
Attendu : FAIL sur l'annuel (106920 reçu au lieu de 98010, `interval: 'month'` au lieu de `'year'`).

- [ ] **Step 3 : modifier le catalogue**

Dans `api/lib/formules.js` :

1. Dans l'en-tête, remplacer

```js
 *   annuel       12 mensualités −10 %, facturées TOUS LES 13 MOIS : 13 mois
 *                d'accès à chaque renouvellement
```

par

```js
 *   annuel       12 mois pour le prix de 11, à −10 %, facturés chaque année
 *                (révisé le même jour : la première version donnait 13 mois
 *                pour le prix de 12, avec un prix « tous les 13 mois »)
```

2. Dans le typedef, remplacer `recurring: { interval: 'month', interval_count: number },` par `recurring: { interval: 'month'|'year', interval_count: number },`.

3. Remplacer les deux entrées annuelles :

```js
  { plan: 'starter', periode: 'annuel', lookupKey: 'actero_starter_annuel', montantCentimes: 106920, recurring: { interval: 'month', interval_count: 13 }, mois: 13 },
```

par

```js
  { plan: 'starter', periode: 'annuel', lookupKey: 'actero_starter_annuel', montantCentimes: 98010, recurring: { interval: 'year', interval_count: 1 }, mois: 12 },
```

et

```js
  { plan: 'pro', periode: 'annuel', lookupKey: 'actero_pro_annuel', montantCentimes: 430920, recurring: { interval: 'month', interval_count: 13 }, mois: 13 },
```

par

```js
  { plan: 'pro', periode: 'annuel', lookupKey: 'actero_pro_annuel', montantCentimes: 395010, recurring: { interval: 'year', interval_count: 1 }, mois: 12 },
```

4. Dans la docstring de `mensualiteCentimes`, remplacer

```js
 * `interval === 'month'` ne veut PAS dire « un mois » : le trimestriel et
 * l'annuel 13 mois sont eux aussi facturés « au mois ». Lire l'intervalle seul
 * comptait 1 069,20 € de MRR pour un client qui en rapporte 82,25.
```

par

```js
 * `interval === 'month'` ne veut PAS dire « un mois » : le trimestriel est lui
 * aussi facturé « au mois », tous les 3 mois. Lire l'intervalle seul comptait
 * 297 € de MRR pour un client trimestriel qui en rapporte 99.
```

5. Dans la docstring de `libellePeriodeStripe`, remplacer

```js
 * « mois », « 3 mois », « 13 mois », « an » — pour l'admin.
```

par

```js
 * « mois », « 3 mois », « an » — pour l'admin.
```

- [ ] **Step 4 : lancer, vérifier que tout passe**

Run : `npx vitest run api/lib/formules.test.js && npx eslint api/lib/formules.js api/lib/formules.test.js`
Attendu : 11 tests PASS, aucune erreur ESLint.

- [ ] **Step 5 : commit**

```bash
git add api/lib/formules.js api/lib/formules.test.js
git commit -m "fix(facturation): l'annuel devient 12 mois pour le prix de 11, à -10 %"
```

---

### Task 1 ter : corrections de la relecture qualité — LIVRÉE

Faites à la relecture du catalogue, avant la Task 2 : catalogue figé (`Object.freeze` profond), `periodeDepuisApi(valeur)`, `prixConforme(formule, price)`, identifiants de coupon portant leur montant (`actero-trimestriel-starter-4950`, `actero-trimestriel-pro-19950`) et tests de cohérence de chaque formule. Les tâches suivantes s'appuient sur ces fonctions.

---

### Task 2 : plus d'essai standard, et l'avantage de bienvenue

**Files :**
- Modify : `api/lib/essai-gratuit.js`
- Test : `api/lib/essai-gratuit.test.js`
- Modify : `api/billing/create-subscription.test.js` (le fichier disparaît à la Task 14 ; d'ici là, il doit rester vert)

> `api/create-checkout-session.js` appelle aussi `joursEssaiPour` : il perd l'essai de 7 jours du même coup, et c'est voulu.

- [ ] **Step 1 : modifier et ajouter les tests (ils doivent échouer)**

Dans `api/lib/essai-gratuit.test.js` :

1. Remplacer la ligne d'import 3 par :

```js
import { joursEssaiPour, offreDeBienvenue, ESSAI_PARRAINAGE_JOURS, ESSAI_CAMPAGNE_JOURS } from './essai-gratuit.js'
```

2. Remplacer le test `it('celui qui trouve Actero autrement garde l\'essai standard', …)` (avec son corps) par :

```js
  it('celui qui trouve Actero autrement n’a pas d’essai', () => {
    // Décision du 14 septembre 2026 : plus d'essai de 7 jours. Seul le mois
    // offert (campagne publicitaire, parrainage) reste.
    expect(joursEssaiPour({ campaign_first_month_free: false })).toBeUndefined()
  })
```

3. Remplacer le test `it('un nouveau marchand a l\'essai standard', …)` (avec son corps) par :

```js
  it('un nouveau marchand n’a pas d’essai', () => {
    expect(joursEssaiPour({})).toBeUndefined()
    expect(joursEssaiPour({ trial_ends_at: null })).toBeUndefined()
  })
```

4. Ajouter en fin de fichier :

```js
describe('avantage de bienvenue — selon la formule, une seule fois par client', () => {
  // Décisions du 14 septembre : mensuel sans essai (mois offert gardé si
  // campagne ou parrainage), trimestriel −50 % sur le premier mois, annuel sans
  // avantage de bienvenue (12 mois pour le prix de 11 est dans le prix). Un
  // client déjà abonné n'y a plus droit : sans ça, résilier puis se réabonner
  // redonnerait −50 % à chaque trimestre.

  it('mensuel : rien, sauf le mois offert de la campagne ou du parrainage', () => {
    expect(offreDeBienvenue({ client: {}, periode: 'mensuel', dejaAbonne: false })).toEqual({})
    expect(offreDeBienvenue({ client: { campaign_first_month_free: true }, periode: 'mensuel', dejaAbonne: false }))
      .toEqual({ essaiJours: ESSAI_CAMPAGNE_JOURS })
    expect(offreDeBienvenue({ client: { referral_first_month_free: true }, periode: 'mensuel', dejaAbonne: false }))
      .toEqual({ essaiJours: ESSAI_PARRAINAGE_JOURS })
  })

  it('trimestriel : le coupon du premier mois, jamais de mois offert', () => {
    expect(offreDeBienvenue({ client: {}, periode: 'trimestriel', dejaAbonne: false })).toEqual({ coupon: true })
    expect(offreDeBienvenue({ client: { referral_first_month_free: true }, periode: 'trimestriel', dejaAbonne: false }))
      .toEqual({ coupon: true })
  })

  it('annuel : rien', () => {
    expect(offreDeBienvenue({ client: { campaign_first_month_free: true }, periode: 'annuel', dejaAbonne: false })).toEqual({})
  })

  it('un client déjà abonné n’a plus rien', () => {
    for (const periode of ['mensuel', 'trimestriel', 'annuel']) {
      expect(offreDeBienvenue({ client: { campaign_first_month_free: true }, periode, dejaAbonne: true }), periode).toEqual({})
    }
  })

  it('un essai déjà pris ferme aussi le coupon', () => {
    expect(offreDeBienvenue({ client: { trial_ends_at: '2026-01-01T00:00:00Z' }, periode: 'trimestriel', dejaAbonne: false }))
      .toEqual({})
  })

  it('« déjà abonné ? » inconnu ne vaut jamais « jamais abonné »', () => {
    // Une erreur Stripe ne doit rien accorder : la route répond une erreur.
    expect(() => offreDeBienvenue({ client: {}, periode: 'mensuel', dejaAbonne: undefined })).toThrow()
  })
})
```

5. Dans `api/billing/create-subscription.test.js`, remplacer le début du test

```js
  it('trial (no prior trial) → mode setup with setup-intent secret', async () => {
    const res = makeRes();
```

par

```js
  it('mois offert (parrainage) → mode setup with setup-intent secret', async () => {
    // Plus d'essai standard depuis le 14 septembre 2026 : seul le mois offert
    // ouvre encore un essai sur ce chemin, supprimé à la Task 14.
    h.clientRow.referral_first_month_free = true;
    const res = makeRes();
```

puis, plus bas dans ce même test, `    expect(params.trial_period_days).toBe(7);` par `    expect(params.trial_period_days).toBe(30);`.

- [ ] **Step 2 : lancer, vérifier l'échec**

Run : `npx vitest run api/lib/essai-gratuit.test.js api/billing/create-subscription.test.js`
Attendu : FAIL — `offreDeBienvenue is not a function`, et `joursEssaiPour({})` vaut encore 7. Le test « mois offert (parrainage) » de `create-subscription` passe déjà : un parrainé avait déjà 30 jours.

- [ ] **Step 3 : implémenter**

Dans `api/lib/essai-gratuit.js` :

1. Remplacer le paragraphe d'en-tête

```js
 * DÉCISION QUI RESTE À PRENDRE
 * `ESSAI_STANDARD_JOURS` vaut 7 — la valeur que deux chemins sur trois
 * appliquaient déjà. Si la campagne annonce un mois, c'est **cette
 * constante** qu'on change, une fois, et les trois chemins suivent. Ce
 * fichier existe pour que ce soit une ligne et pas une chasse au trésor.
 */

/** Essai accordé à un marchand qui n'en a jamais eu. */
export const ESSAI_STANDARD_JOURS = 7
```

par

```js
 * DÉCISION DU 14 SEPTEMBRE 2026
 * Plus d'essai standard : le mensuel se paie dès l'inscription. Il ne reste
 * que le mois offert — parrainage ou campagne publicitaire —, et seulement sur
 * le mensuel (voir `offreDeBienvenue`). L'essai de 7 jours valait
 * `ESSAI_STANDARD_JOURS`, constante supprimée.
 */
```

2. Remplacer la dernière ligne de `joursEssaiPour`, `  return ESSAI_STANDARD_JOURS`, par :

```js
  return undefined
```

2 bis. Dans la docstring de `ESSAI_CAMPAGNE_JOURS`, remplacer

```js
 * marchand qui trouve Actero autrement garde l'essai standard.
```

par

```js
 * marchand qui trouve Actero autrement paie dès l'inscription (14 septembre 2026).
```

3. Ajouter en fin de fichier :

```js
/**
 * L'avantage de bienvenue de ce client pour cette formule — une seule fois.
 *
 * Décisions du 14 septembre 2026 :
 *   mensuel      aucun, sauf le mois offert (parrainage, campagne) — règles de
 *                `joursEssaiPour`
 *   trimestriel  −50 % sur le premier mois (coupon de la formule)
 *   annuel       aucun : « 12 mois pour le prix de 11 » est dans le prix
 *
 * Un client qui a déjà eu un abonnement Stripe, quel qu'il soit, n'en retrouve
 * aucun. `dejaAbonne` est lu chez Stripe par la route ; s'il est inconnu, on
 * lève plutôt que d'accorder quoi que ce soit sur un « je ne sais pas ».
 *
 * @param {{ client: any, periode: string, dejaAbonne: boolean }} p
 * @returns {{ essaiJours?: number, coupon?: boolean }}
 */
export function offreDeBienvenue({ client, periode, dejaAbonne }) {
  if (typeof dejaAbonne !== 'boolean') {
    throw new TypeError('offreDeBienvenue : dejaAbonne doit être connu (true ou false)')
  }
  if (dejaAbonne || client?.trial_ends_at) return {}
  if (periode === 'mensuel') {
    const essaiJours = joursEssaiPour(client)
    return essaiJours ? { essaiJours } : {}
  }
  if (periode === 'trimestriel') return { coupon: true }
  return {}
}
```

- [ ] **Step 4 : lancer**

Run : `npx vitest run api/lib/essai-gratuit.test.js api/billing/create-subscription.test.js && npx eslint api/lib/essai-gratuit.js api/lib/essai-gratuit.test.js api/billing/create-subscription.test.js`
Attendu : PASS, aucune erreur.

- [ ] **Step 5 : commit**

```bash
git add api/lib/essai-gratuit.js api/lib/essai-gratuit.test.js api/billing/create-subscription.test.js
git commit -m "feat(facturation): plus d'essai de 7 jours, et un avantage de bienvenue par formule"
```

---

### Task 2 bis : l'avantage de bienvenue lit le coupon dans le catalogue — LIVRÉE

Faite à la relecture qualité de la Task 2 : le contrat devient `offreDeBienvenue({ client, formule, dejaAbonne })` → `{ essaiJours }` (mensuel, mois offert), `{ couponId }` (le coupon de la formule, lu dans le catalogue) ou `{}`. Un client déjà facturé par Stripe (`billing_provider === 'stripe'`) n'a plus rien, comme dans la facturation du front. Lève si `dejaAbonne` n'est pas booléen, si `trial_ends_at` ou `billing_provider` n'ont pas été lus, ou si la formule n'est pas celle du catalogue. Les Tasks 4 et 5 ci-dessous utilisent ce contrat.

---

### Task 2 ter : une seule règle d'éligibilité — LIVRÉE

`peutAvoirUneOffreDeBienvenue(client)` (un essai déjà pris, un abonnement Stripe en cours ou une facturation Stripe passée ferment l'offre) est utilisée par `offreDeBienvenue` et par la facturation du tableau de bord (Task 11), bouton mensuel compris. `offreDeBienvenue` lève en nommant chaque colonne non lue : `trial_ends_at`, `billing_provider`, `stripe_subscription_id`, `referral_first_month_free`, `campaign_first_month_free`.

---

### Task 3 : le plan d'un abonnement se lit dans le catalogue

**Files :**
- Modify : `api/lib/subscription-plan.js` (réécriture)
- Modify : `api/stripe-webhook.js`
- Test : `api/lib/subscription-plan.test.js` (réécriture)

- [ ] **Step 1 : réécrire le test**

`api/lib/subscription-plan.test.js` :

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { planUpdateFromSubscription } from './subscription-plan.js'

const PRO_MENSUEL = { id: 'price_pm', lookup_key: 'actero_pro_mensuel' }
const sub = (over = {}, price = PRO_MENSUEL) => ({ status: 'active', items: { data: [{ price }] }, ...over })
const CARTE = { aUneCarte: true }
const SANS_CARTE = { aUneCarte: false }

function sansCommentaires(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('planUpdateFromSubscription', () => {
  it('n’accorde rien à un essai sans carte', () => {
    const u = planUpdateFromSubscription(sub({ status: 'trialing' }), SANS_CARTE)
    expect(u.plan).toBeUndefined()
    expect(u.status).toBeUndefined()
  })

  it('accorde en essai avec une carte', () => {
    const u = planUpdateFromSubscription(sub({ status: 'trialing', trial_end: 1893456000 }), CARTE)
    expect(u.plan).toBe('pro')
    expect(u.status).toBe('active')
    expect(u.trial_ends_at).toBeTruthy()
  })

  it('accorde un abonnement actif avec une carte', () => {
    expect(planUpdateFromSubscription(sub(), CARTE).plan).toBe('pro')
  })

  it('n’accorde rien sans carte', () => {
    expect(planUpdateFromSubscription(sub(), SANS_CARTE).plan).toBeUndefined()
  })

  it('sans information de carte, n’accorde rien', () => {
    expect(planUpdateFromSubscription(sub()).plan).toBeUndefined()
  })

  it('n’accorde rien pour incomplete', () => {
    expect(planUpdateFromSubscription(sub({ status: 'incomplete' }), CARTE).plan).toBeUndefined()
  })

  it('rétrograde en free sur canceled / unpaid, carte ou pas', () => {
    expect(planUpdateFromSubscription(sub({ status: 'canceled' }), SANS_CARTE).plan).toBe('free')
    expect(planUpdateFromSubscription(sub({ status: 'unpaid' }), CARTE).plan).toBe('free')
  })

  it('un prix trimestriel et un prix annuel donnent leur plan, sans variable d’environnement', () => {
    expect(planUpdateFromSubscription(sub({}, { id: 'p1', lookup_key: 'actero_starter_trimestriel' }), CARTE))
      .toMatchObject({ plan: 'starter', status: 'active', billing_period: 'quarterly', billing_provider: 'stripe' })
    expect(planUpdateFromSubscription(sub({}, { id: 'p2', lookup_key: 'actero_pro_annuel' }), CARTE))
      .toMatchObject({ plan: 'pro', billing_period: 'annual' })
  })

  it('un prix hors catalogue n’accorde aucun plan', () => {
    expect(planUpdateFromSubscription(sub({}, { id: 'price_sur_mesure', lookup_key: null }), CARTE).plan).toBeUndefined()
  })
})

describe('le webhook s’en sert comme prévu', () => {
  const webhook = sansCommentaires(readFileSync('api/stripe-webhook.js', 'utf8'))

  it('plus aucune table de prix construite depuis STRIPE_PRICE_*', () => {
    expect(webhook).not.toMatch(/STRIPE_PRICE_/)
  })

  it('la carte est résolue avant de décider du plan', () => {
    // Seul `subscription.default_payment_method` comptait : une carte rangée
    // sur le client Stripe n'accordait jamais le plan.
    const bloc = webhook.slice(webhook.indexOf("case 'customer.subscription.updated'"))
    expect(bloc).toMatch(/resolveCustomerCard\(/)
    expect(bloc).toMatch(/planUpdateFromSubscription\(subscription,\s*\{\s*aUneCarte/)
  })

  it('un abonnement payé hors catalogue laisse une trace', () => {
    // Offre sur mesure ou clé mal posée : aucun plan n'est accordé, et sans
    // trace, personne ne le verrait.
    const bloc = webhook.slice(webhook.indexOf("case 'customer.subscription.updated'"))
    expect(bloc).toMatch(/hors catalogue/)
  })
})
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run : `npx vitest run api/lib/subscription-plan.test.js`
Attendu : FAIL.

- [ ] **Step 3 : réécrire `api/lib/subscription-plan.js`**

```js
// @ts-check
import { formuleDuPrix, PERIODE_API } from './formules.js'

/**
 * Decide the clients-row update for a Stripe subscription event.
 *
 * MRR-critical: a `trialing` subscription with NO payment method must never
 * unlock a paid plan — otherwise "start free trial" without entering a card
 * grants Pro forever (0 € MRR). We therefore only GRANT a plan when a payment
 * method is on file AND the subscription is active/trialing. Terminal states
 * downgrade to free.
 *
 * 14 septembre 2026 — deux changements :
 *
 *   LE PLAN SE LIT DANS LE CATALOGUE. La table prix → plan venait de quatre
 *   variables STRIPE_PRICE_* : un prix trimestriel n'y figurait pas, et le
 *   client payait sans jamais obtenir son plan.
 *
 *   LA CARTE EST RÉSOLUE PAR L'APPELANT (resolveCustomerCard : abonnement,
 *   puis client Stripe, puis ses cartes). Seul `default_payment_method`
 *   comptait : une carte rangée sur le client n'accordait rien.
 *
 * @param {any} subscription — objet Subscription de Stripe
 * @param {{ aUneCarte?: boolean }} [options]
 * @returns {{ plan?: string, status?: string, trial_ends_at?: string, billing_period?: string, billing_provider?: string }}
 */
export function planUpdateFromSubscription(subscription, { aUneCarte = false } = {}) {
  /** @type {{ plan?: string, status?: string, trial_ends_at?: string, billing_period?: string, billing_provider?: string }} */
  const update = {}
  if (!subscription) return update

  const formule = formuleDuPrix(subscription.items?.data?.[0]?.price)
  const status = subscription.status

  if (formule && ['active', 'trialing'].includes(status) && aUneCarte) {
    update.plan = formule.plan
    update.status = 'active'
    update.billing_period = PERIODE_API[formule.periode]
    update.billing_provider = 'stripe'
  } else if (['canceled', 'unpaid', 'incomplete_expired'].includes(status)) {
    update.plan = 'free'
    update.status = 'inactive'
  }

  if (subscription.trial_end) {
    update.trial_ends_at = new Date(subscription.trial_end * 1000).toISOString()
  }

  return update
}
```

- [ ] **Step 4 : brancher le webhook**

Dans `api/stripe-webhook.js` :

1. Après la ligne `import { resolveCustomerCard } from './lib/stripe-customer.js';`, ajouter :

```js
import { formuleDuPrix, PERIODE_API } from './lib/formules.js';
```

2. Dans la branche upgrade de `checkout.session.completed`, remplacer :

```js
              const subscription = await stripe.subscriptions.retrieve(session.subscription);
              if (subscription.trial_end) {
                updateData.trial_ends_at = new Date(subscription.trial_end * 1000).toISOString();
              }
            } catch (subErr) {
              console.error('[UPGRADE] Failed to retrieve subscription (non-fatal):', subErr.message);
```

par :

```js
              const subscription = await stripe.subscriptions.retrieve(session.subscription);
              if (subscription.trial_end) {
                updateData.trial_ends_at = new Date(subscription.trial_end * 1000).toISOString();
              }
              // La formule payée, lue dans le catalogue par la clé du prix.
              const formule = formuleDuPrix(subscription.items?.data?.[0]?.price);
              if (formule) {
                updateData.billing_period = PERIODE_API[formule.periode];
                updateData.billing_provider = 'stripe';
              }
            } catch (subErr) {
              console.error('[UPGRADE] Failed to retrieve subscription (non-fatal):', subErr.message);
```

3. Dans `case 'customer.subscription.updated'`, remplacer :

```js
          const priceToplan = {};
          if (process.env.STRIPE_PRICE_STARTER_MONTHLY) priceToplan[process.env.STRIPE_PRICE_STARTER_MONTHLY] = 'starter';
          if (process.env.STRIPE_PRICE_STARTER_ANNUAL) priceToplan[process.env.STRIPE_PRICE_STARTER_ANNUAL] = 'starter';
          if (process.env.STRIPE_PRICE_PRO_MONTHLY) priceToplan[process.env.STRIPE_PRICE_PRO_MONTHLY] = 'pro';
          if (process.env.STRIPE_PRICE_PRO_ANNUAL) priceToplan[process.env.STRIPE_PRICE_PRO_ANNUAL] = 'pro';
          // Grant a paid plan ONLY when a real payment method is on file — a
          // card-less trial must not unlock the plan (0 MRR bug). See
          // api/lib/subscription-plan.js.
          const updateData = planUpdateFromSubscription(subscription, priceToplan);
```

par :

```js
          // Le plan vient du catalogue (clé du prix) ; la carte se résout comme
          // dans la route de paiement. Un essai sans carte n'accorde rien.
          // Voir api/lib/subscription-plan.js.
          const carte = await resolveCustomerCard(stripe, subscription, subscription.customer);
          const updateData = planUpdateFromSubscription(subscription, { aUneCarte: !!carte });
          if (['active', 'trialing'].includes(subscription.status) && !formuleDuPrix(subscription.items?.data?.[0]?.price)) {
            // Payé mais hors catalogue : offre sur mesure, ou clé de prix mal
            // posée. Aucun plan n'est accordé ; sans cette trace, personne ne le verrait.
            console.warn('[stripe-webhook] abonnement hors catalogue, aucun plan accordé :', subscription.id, subscription.items?.data?.[0]?.price?.lookup_key ?? '(sans lookup_key)');
          }
```

- [ ] **Step 5 : lancer**

Run : `npx vitest run api/lib/subscription-plan.test.js api/lib/statut-client.test.js && npx eslint api/lib/subscription-plan.js api/lib/subscription-plan.test.js api/stripe-webhook.js`
Attendu : PASS, aucune erreur.

- [ ] **Step 6 : commit**

```bash
git add api/lib/subscription-plan.js api/lib/subscription-plan.test.js api/stripe-webhook.js
git commit -m "fix(facturation): le webhook retrouve le plan de toutes les formules, et la carte où qu'elle soit"
```

---

### Task 3 bis : le webhook tient face aux pannes et aux vieux abonnements — LIVRÉE

Faite à la relecture qualité de la Task 3. `resolveCustomerCard(..., { strict: true })` relance une erreur Stripe au lieu de valoir « aucune carte » ; le webhook ne cherche la carte que si elle peut accorder un plan (`doitResoudreLaCarte`), et sur erreur libère la réservation de l'événement et répond 500 pour que Stripe réessaie. `ecritureAutorisee(miseAJour, client, subscription)` : seul l'abonnement courant (`clients.stripe_subscription_id`) peut rétrograder un client ; un accord pose `stripe_subscription_id` s'il est vide. `formuleDeLAbonnement` sert à la fois au plan et à l'alerte « hors catalogue », qui se tait pour un client ayant déjà un plan payant. L'analytics d'upgrade part de `session.metadata.upgrade_from`. Ensuite (même tâche) : le webhook relit l'abonnement chez Stripe avant de décider (un événement rejoué ou livré dans le désordre porte un état périmé) ; les appels Stripe du mode strict et cette relecture sont bornés par `OPTIONS_REQUETE_COURTE` (5 s, 1 nouvelle tentative), sous les 60 s d'une fonction Vercel ; un abonnement non courant ne peut écrire qu'un accord de plan payant ; l'écriture de la branche upgrade de `checkout.session.completed` est vérifiée et libère l'événement en cas d'échec. La route de paiement (Task 5) l'appelle aussi en mode strict pour un abonné existant : une panne répond 503 au lieu de créer un second abonnement pendant que le premier facture.

---

### Task 4 : les paramètres de la session Checkout, et deux lectures Stripe

**Files :**
- Create : `api/lib/checkout-formule.js`, `api/lib/formules-stripe.js`
- Test : `api/lib/checkout-formule.test.js`, `api/lib/formules-stripe.test.js`

- [ ] **Step 1 : écrire les tests qui échouent**

`api/lib/checkout-formule.test.js` :

```js
import { describe, it, expect } from 'vitest'
import { parametresCheckout } from './checkout-formule.js'
import { formulePour } from './formules.js'

const base = {
  clientId: 'c1', customer: 'cus_1', priceId: 'price_1', planActuel: 'free',
  siteUrl: 'https://actero.fr', promotionCodeId: null, parrainage: null, promoCode: null,
}
const params = (plan, periode, extra = {}) =>
  parametresCheckout({ ...base, formule: formulePour(plan, periode), offre: {}, ...extra })

describe('parametresCheckout', () => {
  it('pose toujours client_id sur l’abonnement', () => {
    // customer.subscription.updated retrouve le client par ce champ : sans lui,
    // un impayé ne ferait jamais repasser le compte en Free.
    for (const periode of ['mensuel', 'trimestriel', 'annuel']) {
      const p = params('pro', periode)
      expect(p.subscription_data.metadata.client_id, periode).toBe('c1')
      expect(p.subscription_data.metadata.formule).toBe(`pro_${periode}`)
    }
  })

  it('mensuel sans avantage : ni essai, ni remise, le champ code promo ouvert', () => {
    const p = params('starter', 'mensuel')
    expect(p.subscription_data.trial_period_days).toBeUndefined()
    expect(p.discounts).toBeUndefined()
    expect(p.allow_promotion_codes).toBe(true)
  })

  it('mensuel avec mois offert : l’essai accordé par le serveur', () => {
    expect(params('starter', 'mensuel', { offre: { essaiJours: 30 } }).subscription_data.trial_period_days).toBe(30)
  })

  it('trimestriel éligible : le coupon du plan, aucun essai', () => {
    const p = params('pro', 'trimestriel', { offre: { couponId: 'actero-trimestriel-pro-19950' } })
    expect(p.discounts).toEqual([{ coupon: 'actero-trimestriel-pro-19950' }])
    expect(p.subscription_data.trial_period_days).toBeUndefined()
    expect(p.allow_promotion_codes).toBeUndefined()
  })

  it('annuel : ni essai ni remise', () => {
    const p = params('starter', 'annuel')
    expect(p.subscription_data.trial_period_days).toBeUndefined()
    expect(p.discounts).toBeUndefined()
  })

  it('un code promo remplace le coupon du trimestriel', () => {
    const p = params('starter', 'trimestriel', { offre: { couponId: 'actero-trimestriel-starter-4950' }, promotionCodeId: 'promo_1' })
    expect(p.discounts).toEqual([{ promotion_code: 'promo_1' }])
  })

  it('discounts et allow_promotion_codes ne coexistent jamais', () => {
    for (const periode of ['mensuel', 'trimestriel', 'annuel']) {
      for (const offre of [{}, { essaiJours: 30 }, { couponId: 'actero-trimestriel-pro-19950' }]) {
        for (const promotionCodeId of [null, 'promo_1']) {
          const p = params('pro', periode, { offre, promotionCodeId })
          expect(!!p.discounts && !!p.allow_promotion_codes, `${periode} ${JSON.stringify(offre)} ${promotionCodeId}`).toBe(false)
        }
      }
    }
  })

  it('la carte est toujours demandée, mois offert compris', () => {
    expect(params('pro', 'mensuel', { offre: { essaiJours: 30 } }).payment_method_collection).toBe('always')
  })

  it('la session porte ce que la branche upgrade du webhook lit', () => {
    const p = params('pro', 'annuel', { planActuel: 'starter', promoCode: 'CODE' })
    expect(p.metadata).toMatchObject({ actero_client_id: 'c1', upgrade_from: 'starter', upgrade_to: 'pro', promo_code: 'CODE' })
    expect(p.line_items).toEqual([{ price: 'price_1', quantity: 1 }])
    expect(p.mode).toBe('subscription')
    expect(p.customer).toBe('cus_1')
  })

  it('parrainage : les métadonnées que le webhook et la récompense du parrain lisent', () => {
    const p = params('starter', 'mensuel', { parrainage: { parrainId: 'c0', code: 'PARRAIN1' } })
    expect(p.subscription_data.metadata).toMatchObject({ referral_first_month_free: 'true', referred_by_client_id: 'c0', referral_code: 'PARRAIN1' })
    expect(p.metadata.referral_code).toBe('PARRAIN1')
  })
})
```

`api/lib/formules-stripe.test.js` :

```js
import { describe, it, expect, vi } from 'vitest'
import { prixDeLaFormule, aDejaEuUnAbonnement } from './formules-stripe.js'
import { formulePour } from './formules.js'

describe('lectures Stripe des formules', () => {
  it('retrouve le prix actif d’une formule par sa clé', async () => {
    const list = vi.fn(async () => ({ data: [{ id: 'price_pa', lookup_key: 'actero_pro_annuel', unit_amount: 395010, currency: 'eur', recurring: { interval: 'year', interval_count: 1 } }] }))
    const prix = await prixDeLaFormule({ prices: { list } }, formulePour('pro', 'annuel'))
    expect(prix.id).toBe('price_pa')
    expect(list).toHaveBeenCalledWith({ lookup_keys: ['actero_pro_annuel'], active: true, limit: 1 })
  })

  it('renvoie null quand le prix n’existe pas', async () => {
    const stripe = { prices: { list: async () => ({ data: [] }) } }
    expect(await prixDeLaFormule(stripe, formulePour('starter', 'mensuel'))).toBeNull()
  })

  it('un prix qui ne facture plus le montant du catalogue n’est pas utilisé', async () => {
    const ancien = { id: 'price_ancien', lookup_key: 'actero_pro_annuel', unit_amount: 382800, currency: 'eur', recurring: { interval: 'year', interval_count: 1 } }
    const stripe = { prices: { list: async () => ({ data: [ancien] }) } }
    expect(await prixDeLaFormule(stripe, formulePour('pro', 'annuel'))).toBeNull()
  })

  it('« déjà abonné » regarde tous les statuts', async () => {
    const list = vi.fn(async () => ({ data: [{ id: 'sub_old', status: 'canceled' }] }))
    expect(await aDejaEuUnAbonnement({ subscriptions: { list } }, 'cus_1')).toBe(true)
    expect(list).toHaveBeenCalledWith({ customer: 'cus_1', status: 'all', limit: 1 })
  })

  it('un client Stripe sans abonnement n’a jamais été abonné', async () => {
    expect(await aDejaEuUnAbonnement({ subscriptions: { list: async () => ({ data: [] }) } }, 'cus_1')).toBe(false)
  })

  it('une erreur Stripe remonte, elle ne vaut pas « jamais abonné »', async () => {
    const stripe = { subscriptions: { list: async () => { throw new Error('réseau') } } }
    await expect(aDejaEuUnAbonnement(stripe, 'cus_1')).rejects.toThrow('réseau')
  })
})
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run : `npx vitest run api/lib/checkout-formule.test.js api/lib/formules-stripe.test.js`
Attendu : FAIL — imports introuvables.

- [ ] **Step 3 : implémenter**

`api/lib/checkout-formule.js` :

```js
// @ts-check
/**
 * Les paramètres d'une session Stripe Checkout d'abonnement — calcul pur.
 *
 * Seul endroit qui décide de l'essai, du coupon, des métadonnées et des champs
 * de la page Stripe. Testable sans Stripe, et lu par une seule route
 * (api/billing/upgrade.js) : deux chemins de paiement avaient fait dériver
 * l'essai à 30, 7 ou 0 jours selon le bouton (voir essai-gratuit.js).
 *
 * @param {{
 *   clientId: string,
 *   customer: string,
 *   priceId: string,
 *   formule: import('./formules.js').Formule,
 *   offre: { essaiJours?: number, couponId?: string },
 *   promotionCodeId?: string|null,
 *   planActuel: string,
 *   parrainage?: { parrainId: string, code?: string|null } | null,
 *   promoCode?: string|null,
 *   siteUrl: string,
 * }} p
 */
export function parametresCheckout(p) {
  const { clientId, customer, priceId, formule, offre, promotionCodeId, planActuel, parrainage, promoCode, siteUrl } = p
  const cleFormule = `${formule.plan}_${formule.periode}`

  /** @type {Record<string, any>} */
  const subscriptionData = {
    metadata: {
      // customer.subscription.updated retrouve le client par ce champ.
      client_id: clientId,
      actero_client_id: clientId,
      formule: cleFormule,
      ...(parrainage ? {
        referral_first_month_free: 'true',
        referred_by_client_id: parrainage.parrainId,
        ...(parrainage.code ? { referral_code: parrainage.code } : {}),
      } : {}),
    },
  }
  if (offre.essaiJours) subscriptionData.trial_period_days = offre.essaiJours

  // Stripe n'accepte qu'une réduction : un code promo remplace le coupon.
  const remise = promotionCodeId
    ? { promotion_code: promotionCodeId }
    : (offre.couponId ? { coupon: offre.couponId } : null)

  return {
    mode: 'subscription',
    customer,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: subscriptionData,
    ...(remise ? { discounts: [remise] } : { allow_promotion_codes: true }),
    // La carte est toujours demandée, mois offert compris : plus d'abonnement
    // d'essai sans moyen de paiement.
    payment_method_collection: 'always',
    metadata: {
      actero_client_id: clientId,
      upgrade_from: planActuel,
      upgrade_to: formule.plan,
      formule: cleFormule,
      ...(parrainage?.code ? { referral_code: parrainage.code } : {}),
      ...(promoCode ? { promo_code: promoCode } : {}),
    },
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    customer_update: { name: 'auto', address: 'auto' },
    payment_method_types: ['card', 'paypal', 'link'],
    custom_fields: [
      {
        key: 'company_name',
        label: { type: 'custom', custom: 'Nom de l\'entreprise (optionnel)' },
        type: 'text',
        optional: true,
      },
      {
        key: 'siret',
        label: { type: 'custom', custom: 'SIRET / Numero d\'entreprise (optionnel)' },
        type: 'text',
        optional: true,
      },
    ],
    success_url: `${siteUrl}/client/overview?upgrade=success&plan=${formule.plan}`,
    cancel_url: `${siteUrl}/client/billing?upgrade=cancel`,
  }
}
```

`api/lib/formules-stripe.js` :

```js
// @ts-check
/**
 * Les deux questions que la route de paiement pose à Stripe.
 */
import { prixConforme } from './formules.js'

/**
 * Le prix Stripe actif d'une formule, retrouvé par sa `lookup_key` — et seulement
 * s'il facture exactement le montant du catalogue.
 *
 * @param {any} stripe
 * @param {import('./formules.js').Formule} formule
 * @returns {Promise<any|null>}
 */
export async function prixDeLaFormule(stripe, formule) {
  const { data } = await stripe.prices.list({ lookup_keys: [formule.lookupKey], active: true, limit: 1 })
  const prix = data?.[0] || null
  if (prix && !prixConforme(formule, prix)) {
    // Le catalogue a changé mais Stripe garde l'ancien prix sous la clé :
    // facturer un autre montant que celui affiché serait pire qu'une erreur.
    // « Configurer Stripe » dans l'admin crée le bon prix.
    console.warn('[formules-stripe] prix non conforme au catalogue :', formule.lookupKey, prix.id)
    return null
  }
  return prix
}

/**
 * Ce client Stripe a-t-il déjà eu un abonnement, quel qu'en soit le statut ?
 * Une erreur Stripe remonte : elle ne doit jamais valoir « jamais abonné »,
 * sinon une panne accorderait un avantage de bienvenue.
 *
 * @param {any} stripe
 * @param {string} customerId
 * @returns {Promise<boolean>}
 */
export async function aDejaEuUnAbonnement(stripe, customerId) {
  if (!customerId) return false
  const { data } = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 1 })
  return (data?.length || 0) > 0
}
```

- [ ] **Step 4 : lancer**

Run : `npx vitest run api/lib/checkout-formule.test.js api/lib/formules-stripe.test.js && npx eslint api/lib/checkout-formule.js api/lib/formules-stripe.js api/lib/checkout-formule.test.js api/lib/formules-stripe.test.js`
Attendu : PASS, aucune erreur.

- [ ] **Step 5 : commit**

```bash
git add api/lib/checkout-formule.js api/lib/checkout-formule.test.js api/lib/formules-stripe.js api/lib/formules-stripe.test.js
git commit -m "feat(facturation): les paramètres de la page Stripe Checkout, en une fonction pure"
```

---

### Task 5 : la route de paiement

**Files :**
- Modify : `api/billing/upgrade.js` (réécriture complète)
- Test : `api/billing/upgrade.test.js` (création)

- [ ] **Step 1 : écrire le test qui échoue**

`api/billing/upgrade.test.js` :

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * La seule route de paiement Stripe self-serve — 14 septembre 2026.
 * Voir docs/superpowers/specs/2026-09-14-formules-trimestrielle-annuelle-checkout-design.md
 */

const h = vi.hoisted(() => ({
  user: { id: 'u1', email: 'u@ex.com' },
  clientRow: null,
  existingSub: null,
  customerCards: [],
  previousSubs: [],
  stripe: null,
  ecrituresClients: [],
  selectsClients: [],
}))

vi.mock('../lib/sentry.js', () => ({ withSentry: (fn) => fn, captureError: () => {} }))
vi.mock('../lib/admin-auth.js', () => ({ isActeroAdmin: () => Promise.resolve(false) }))
vi.mock('../lib/facturation-shopify.js', () => ({ refuserFacturationStripe: async () => false }))

vi.mock('@supabase/supabase-js', () => {
  function builder(table) {
    const b = {
      select: (colonnes) => { if (table === 'clients') h.selectsClients.push(colonnes); return b },
      eq: () => b, not: () => b, limit: () => b,
      update: (valeur) => { if (table === 'clients') h.ecrituresClients.push(valeur); return b },
      maybeSingle: async () => {
        if (table === 'client_users') return { data: { client_id: 'c1' }, error: null }
        if (table === 'funnel_clients') return { data: null, error: null }
        if (table === 'clients') return { data: h.clientRow, error: null }
        return { data: null, error: null }
      },
      single: async () => ({ data: h.clientRow, error: null }),
    }
    return b
  }
  return {
    createClient: () => ({
      auth: { getUser: async () => ({ data: { user: h.user }, error: null }) },
      from: (t) => builder(t),
    }),
  }
})

vi.mock('stripe', () => ({ default: function Stripe() { return h.stripe } }))

import handler from './upgrade.js'
import { FORMULES } from '../lib/formules.js'

function makeRes() {
  return {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this },
    json(b) { this.body = b; return this },
  }
}

function baseStripe() {
  return {
    customers: {
      create: vi.fn(async () => ({ id: 'cus_1' })),
      retrieve: vi.fn(async () => ({ id: 'cus_1', deleted: false })),
    },
    prices: {
      // Des prix conformes au catalogue : la route refuse un prix dont le montant
      // ne correspond plus (prixConforme).
      list: vi.fn(async ({ lookup_keys }) => {
        const f = FORMULES.find((x) => x.lookupKey === lookup_keys[0])
        return { data: f ? [{ id: `price_${f.lookupKey}`, lookup_key: f.lookupKey, unit_amount: f.montantCentimes, currency: 'eur', recurring: f.recurring }] : [] }
      }),
    },
    subscriptions: {
      retrieve: vi.fn(async () => h.existingSub),
      update: vi.fn(async () => ({})),
      list: vi.fn(async () => ({ data: h.previousSubs })),
    },
    promotionCodes: { list: vi.fn(async () => ({ data: [] })) },
    paymentMethods: { list: vi.fn(async () => ({ data: h.customerCards })) },
    checkout: { sessions: { create: vi.fn(async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_1' })) } },
  }
}

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_x'
  h.clientRow = {
    id: 'c1', plan: 'free', stripe_customer_id: 'cus_1', stripe_subscription_id: null,
    contact_email: 'u@ex.com', brand_name: 'Shop', trial_ends_at: null, billing_provider: null,
    referral_first_month_free: false, campaign_first_month_free: false, referred_by_client_id: null,
  }
  h.existingSub = null
  h.customerCards = []
  h.previousSubs = []
  h.ecrituresClients = []
  h.selectsClients = []
  h.stripe = baseStripe()
})

const post = (b) => ({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { client_id: 'c1', target_plan: 'starter', billing_period: 'monthly', ...b } })

describe('POST /api/billing/upgrade', () => {
  it('refuse une période inconnue, clés héritées comprises', async () => {
    for (const billing_period of ['weekly', 'toString']) {
      const res = makeRes()
      await handler(post({ billing_period }), res)
      expect(res.statusCode, billing_period).toBe(400)
    }
  })

  it('mensuel pour un nouveau client : page Stripe, sans essai', async () => {
    const res = makeRes()
    await handler(post(), res)
    expect(res.statusCode).toBe(200)
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(params.line_items[0].price).toBe('price_actero_starter_mensuel')
    expect(params.subscription_data.trial_period_days).toBeUndefined()
  })

  it('la route lit tout ce que l’avantage de bienvenue exige', async () => {
    // offreDeBienvenue lève si une colonne manque : sans ce test, un .select()
    // incomplet ferait échouer chaque paiement en production.
    const res = makeRes()
    await handler(post(), res)
    expect(res.statusCode).toBe(200)
    const colonnes = h.selectsClients.join(',')
    for (const c of ['trial_ends_at', 'billing_provider', 'stripe_subscription_id', 'referral_first_month_free', 'campaign_first_month_free']) {
      expect(colonnes, c).toContain(c)
    }
  })

  it('trimestriel pour un nouveau client : page Stripe avec le coupon du plan', async () => {
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'quarterly' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.checkout_url).toContain('checkout.stripe.com')
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(params.line_items[0].price).toBe('price_actero_pro_trimestriel')
    expect(params.discounts).toEqual([{ coupon: 'actero-trimestriel-pro-19950' }])
    expect(params.subscription_data.metadata.client_id).toBe('c1')
    expect(params.subscription_data.trial_period_days).toBeUndefined()
  })

  it('un client déjà abonné par le passé n’a plus de coupon', async () => {
    h.previousSubs = [{ id: 'sub_ancien', status: 'canceled' }]
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'quarterly' }), res)
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(params.discounts).toBeUndefined()
    expect(params.allow_promotion_codes).toBe(true)
  })

  it('Stripe indisponible pour « déjà abonné ? » : erreur, rien d’accordé', async () => {
    h.stripe.subscriptions.list = vi.fn(async () => { throw new Error('panne') })
    const res = makeRes()
    await handler(post(), res)
    expect(res.statusCode).toBe(503)
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('prix absent de Stripe : « Stripe not configured »', async () => {
    h.stripe.prices.list = vi.fn(async () => ({ data: [] }))
    const res = makeRes()
    await handler(post({ billing_period: 'annual' }), res)
    expect(res.statusCode).toBe(503)
    expect(res.body.error).toBe('Stripe not configured')
  })

  it('abonné avec carte, même période : changement immédiat, SANS écrire le plan en base', async () => {
    h.clientRow.plan = 'starter'
    h.clientRow.stripe_subscription_id = 'sub_1'
    h.existingSub = { id: 'sub_1', status: 'active', default_payment_method: 'pm_1', items: { data: [{ id: 'si_1', price: { lookup_key: 'actero_starter_mensuel' } }] } }
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'monthly' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.instant).toBe(true)
    const [, maj] = h.stripe.subscriptions.update.mock.calls[0]
    expect(maj.items).toEqual([{ id: 'si_1', price: 'price_actero_pro_mensuel' }])
    expect(maj.default_payment_method).toBe('pm_1')
    expect(maj.metadata.client_id).toBe('c1')
    // Le webhook accorde le plan une fois Stripe à jour — pas la route.
    expect(h.ecrituresClients.filter((v) => 'plan' in v)).toEqual([])
  })

  it('abonné avec une autre période : 409, rien ne change chez Stripe', async () => {
    h.clientRow.plan = 'starter'
    h.clientRow.stripe_subscription_id = 'sub_1'
    h.existingSub = { id: 'sub_1', status: 'active', default_payment_method: 'pm_1', items: { data: [{ id: 'si_1', price: { lookup_key: 'actero_starter_mensuel' } }] } }
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'annual' }), res)
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('changement_de_formule')
    expect(h.stripe.subscriptions.update).not.toHaveBeenCalled()
  })

  it('carte d’un abonné illisible (panne Stripe) : 503, ni échange ni nouvelle page Stripe', async () => {
    // Une panne ne vaut pas « pas de carte » : repasser par Checkout créerait un
    // second abonnement pendant que le premier continue de facturer.
    h.clientRow.plan = 'starter'
    h.clientRow.stripe_subscription_id = 'sub_1'
    h.existingSub = { id: 'sub_1', status: 'active', items: { data: [{ id: 'si_1', price: { lookup_key: 'actero_starter_mensuel' } }] } }
    h.stripe.paymentMethods.list = vi.fn(async () => { throw new Error('panne') })
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'monthly' }), res)
    expect(res.statusCode).toBe(503)
    expect(h.stripe.subscriptions.update).not.toHaveBeenCalled()
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('abonnement d’essai sans carte : nouvelle page Stripe, aucun échange de prix', async () => {
    h.clientRow.plan = 'starter'
    h.clientRow.stripe_subscription_id = 'sub_1'
    h.existingSub = { id: 'sub_1', status: 'trialing', items: { data: [{ id: 'si_1', price: { lookup_key: 'actero_starter_mensuel' } }] } }
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'monthly' }), res)
    expect(h.stripe.subscriptions.update).not.toHaveBeenCalled()
    expect(res.body.checkout_url).toBeTruthy()
  })

  it('déjà sur ce plan : 409 explicite', async () => {
    h.clientRow.plan = 'pro'
    const res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('deja_sur_ce_plan')
  })
})
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run : `npx vitest run api/billing/upgrade.test.js`
Attendu : FAIL (période `quarterly` refusée en 400, `prices.list` jamais appelé, plan écrit en base…).

- [ ] **Step 3 : réécrire `api/billing/upgrade.js`**

```js
import { withSentry } from '../lib/sentry.js'
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { isActeroAdmin } from '../lib/admin-auth.js'
import { getOrCreateStripeCustomer, resolveCustomerCard } from '../lib/stripe-customer.js'
import { offreDeBienvenue } from '../lib/essai-gratuit.js';
import { refuserFacturationStripe } from '../lib/facturation-shopify.js';
import { formulePour, formuleDuPrix, periodeDepuisApi } from '../lib/formules.js';
import { prixDeLaFormule, aDejaEuUnAbonnement } from '../lib/formules-stripe.js';
import { parametresCheckout } from '../lib/checkout-formule.js';

/**
 * POST /api/billing/upgrade — la seule route de paiement Stripe self-serve.
 *
 * Depuis le 14 septembre 2026, tout paiement passe par la page Stripe Checkout
 * hébergée : le formulaire intégré (create-subscription + PaymentModal) est
 * supprimé. Deux chemins de paiement avaient fait dériver l'essai à 30, 7 ou 0
 * jours selon le bouton.
 *
 * Body : { client_id, target_plan: 'starter'|'pro', billing_period:
 *          'monthly'|'quarterly'|'annual', promo_code? }
 *
 * Réponses : { checkout_url } | { instant: true } | 409 changement_de_formule |
 *            409 deja_sur_ce_plan | 400 | 401 | 403 | 503
 */

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise'];

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- Auth ---
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise.' });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise.' });

  const { client_id, target_plan, billing_period = 'monthly', promo_code } = req.body || {};

  if (!client_id || !target_plan) {
    return res.status(400).json({ error: 'Missing client_id or target_plan' });
  }

  const periode = periodeDepuisApi(billing_period);
  if (!periode) {
    return res.status(400).json({ error: 'billing_period must be monthly, quarterly or annual' });
  }

  // --- Verify user belongs to client ---
  const isAdmin = await isActeroAdmin(user, supabaseAdmin);
  if (!isAdmin) {
    const { data: link } = await supabaseAdmin
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('client_id', client_id)
      .maybeSingle();
    if (!link) return res.status(403).json({ error: 'Acces refuse.' });
  }

  try {
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('id, plan, stripe_customer_id, stripe_subscription_id, contact_email, brand_name, trial_ends_at, billing_provider, referral_first_month_free, campaign_first_month_free, referred_by_client_id')
      .eq('id', client_id)
      .single();

    if (clientErr || !client) {
      return res.status(404).json({ error: 'Client introuvable.' });
    }

    // App Store 1.2.1 — un marchand venu de Shopify se facture chez Shopify.
    if (await refuserFacturationStripe(supabaseAdmin, client_id, res)) return;

    const currentPlan = client.plan || 'free';

    if (target_plan === 'enterprise') {
      return res.status(400).json({
        error: 'enterprise_contact',
        message: 'Le plan Enterprise necessite un contact commercial.',
        calendly_url: 'https://calendly.com/actero-fr/30min',
      });
    }

    const currentIndex = PLAN_ORDER.indexOf(currentPlan);
    const targetIndex = PLAN_ORDER.indexOf(target_plan);
    if (targetIndex < 0) {
      return res.status(400).json({ error: 'Plan cible invalide.' });
    }
    if (targetIndex === currentIndex) {
      return res.status(409).json({
        error: 'deja_sur_ce_plan',
        message: 'Vous êtes déjà sur ce plan. Pour changer de formule, écrivez-nous à support@actero.fr.',
      });
    }
    if (targetIndex < currentIndex) {
      return res.status(400).json({ error: 'Seuls les upgrades sont autorises. Pour un downgrade, contactez le support.' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'Stripe not configured', hint: 'Contact support at support@actero.fr' });
    }

    const formule = formulePour(target_plan, periode);
    if (!formule) {
      return res.status(400).json({ error: 'Formule invalide.' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const prix = await prixDeLaFormule(stripe, formule);
    if (!prix) {
      return res.status(503).json({
        error: 'Stripe not configured',
        hint: `Prix introuvable pour ${formule.lookupKey}. Lancez « Configurer Stripe » dans l'admin.`,
      });
    }

    // --- Get or create Stripe customer (heals orphaned ids on key/mode change) ---
    let candidateId = client.stripe_customer_id;
    if (!candidateId) {
      const { data: funnel } = await supabaseAdmin
        .from('funnel_clients')
        .select('stripe_customer_id')
        .eq('onboarded_client_id', client_id)
        .not('stripe_customer_id', 'is', null)
        .limit(1)
        .maybeSingle();
      candidateId = funnel?.stripe_customer_id || null;
    }
    const stripeCustomerId = await getOrCreateStripeCustomer(stripe, supabaseAdmin, {
      clientId: client_id,
      currentId: candidateId,
      email: client.contact_email || user.email,
      name: client.brand_name,
    });

    // --- Abonné existant ---
    const existingSubId = client.stripe_subscription_id;
    if (existingSubId) {
      let subscription = null;
      try {
        subscription = await stripe.subscriptions.retrieve(existingSubId);
      } catch (subErr) {
        if (subErr?.code !== 'resource_missing' && subErr?.statusCode !== 404) throw subErr;
      }

      if (subscription && ['active', 'trialing'].includes(subscription.status)) {
        const item = subscription.items?.data?.[0];
        const actuelle = formuleDuPrix(item?.price);
        if (actuelle && actuelle.periode !== periode) {
          return res.status(409).json({
            error: 'changement_de_formule',
            message: 'Pour passer à une autre formule, écrivez-nous à support@actero.fr : on s’en occupe.',
          });
        }

        // Mode strict : une panne ne vaut pas « pas de carte ». Repasser par
        // Checkout créerait un second abonnement pendant que le premier continue
        // de facturer.
        let carte;
        try {
          carte = await resolveCustomerCard(stripe, subscription, stripeCustomerId, { strict: true });
        } catch (err) {
          console.error('[billing/upgrade] moyen de paiement illisible :', err.message);
          return res.status(503).json({ error: 'Paiement indisponible pour le moment, réessayez dans un instant.' });
        }
        if (item && carte) {
          await stripe.subscriptions.update(existingSubId, {
            items: [{ id: item.id, price: prix.id }],
            proration_behavior: 'create_prorations',
            default_payment_method: carte,
            metadata: {
              client_id,
              actero_client_id: client_id,
              formule: `${formule.plan}_${formule.periode}`,
              upgrade_from: currentPlan,
              upgrade_to: target_plan,
            },
          });

          // LE PLAN N'EST PAS ÉCRIT ICI. Il l'était, avant toute confirmation
          // de Stripe (audit du 11 septembre). customer.subscription.updated
          // l'accorde, carte vérifiée — voir api/lib/subscription-plan.js.
          return res.status(200).json({
            success: true,
            instant: true,
            plan_attendu: target_plan,
            message: `Passage au plan ${target_plan} en cours. La proration sera appliquée sur votre prochaine facture.`,
          });
        }
        // Sans carte : un essai laissé par l'ancien formulaire intégré. On passe
        // par la page Stripe ; l'ancien abonnement s'annule seul en fin d'essai.
      }
    }

    // --- Avantage de bienvenue : une seule fois par client ---
    let dejaAbonne;
    try {
      dejaAbonne = await aDejaEuUnAbonnement(stripe, stripeCustomerId);
    } catch (err) {
      console.error('[billing/upgrade] lecture des abonnements passés impossible :', err.message);
      return res.status(503).json({ error: 'Paiement indisponible pour le moment, réessayez dans un instant.' });
    }
    const offre = offreDeBienvenue({ client, formule, dejaAbonne });

    let parrainage = null;
    if (client.referral_first_month_free && client.referred_by_client_id) {
      const { data: referrerRow } = await supabaseAdmin
        .from('clients')
        .select('referral_code')
        .eq('id', client.referred_by_client_id)
        .maybeSingle();
      parrainage = { parrainId: client.referred_by_client_id, code: referrerRow?.referral_code || null };
    }

    let promotionCodeId = null;
    if (promo_code) {
      try {
        const promoList = await stripe.promotionCodes.list({ code: promo_code, active: true, limit: 1 });
        promotionCodeId = promoList.data[0]?.id || null;
      } catch (e) {
        console.warn('[billing/upgrade] could not resolve promo code', promo_code, e.message);
      }
    }

    // `customer` : toute session Checkout dit à qui elle appartient (garde ACT-39,
    // api/lib/client-stripe-unique.test.js).
    const session = await stripe.checkout.sessions.create(parametresCheckout({
      clientId: client_id,
      customer: stripeCustomerId,
      priceId: prix.id,
      formule,
      offre,
      promotionCodeId,
      planActuel: currentPlan,
      parrainage,
      promoCode: promo_code || null,
      siteUrl: process.env.SITE_URL || 'https://actero.fr',
    }));

    // ON NE CONSOMME RIEN ICI — ET C'EST DÉLIBÉRÉ.
    //
    // Les drapeaux de mois offert ne sont pas remis à false à la création de la
    // session : fermer la page Stripe sans payer brûlait le mois (constaté le
    // 10 septembre). Ce qui empêche d'en réclamer un second est ailleurs :
    // l'avantage de bienvenue refuse tout client déjà abonné ou ayant eu un essai.

    return res.status(200).json({ checkout_url: session.url });
  } catch (error) {
    console.error('Billing upgrade error:', error);
    return res.status(500).json({ error: 'Erreur interne. Reessayez ou contactez le support.' });
  }
}

export default withSentry(handler)
```

- [ ] **Step 4 : adapter la garde des durées d'essai**

Dans `api/lib/essai-gratuit.test.js`, test « aucun chemin de paiement ne redéfinit sa propre durée », remplacer la ligne :

```js
      if (!/joursEssaiPour\(/.test(src)) fautifs.push(`${f} : n'utilise pas joursEssaiPour()`)
```

par :

```js
      if (!/joursEssaiPour\(|offreDeBienvenue\(/.test(src)) {
        fautifs.push(`${f} : n'utilise ni joursEssaiPour() ni offreDeBienvenue()`)
      }
```

- [ ] **Step 5 : lancer**

Run : `npx vitest run api/billing/upgrade.test.js api/lib/essai-gratuit.test.js api/lib/conformite-app-store.test.js api/lib/client-stripe-unique.test.js && npx eslint api/billing/upgrade.js api/billing/upgrade.test.js`
Attendu : PASS, aucune erreur.

- [ ] **Step 6 : commit**

```bash
git add api/billing/upgrade.js api/billing/upgrade.test.js api/lib/essai-gratuit.test.js
git commit -m "feat(facturation): la route de paiement vend les trois formules et laisse le webhook accorder le plan"
```

---

### Task 6 : un MRR juste dans l'admin

**Files :**
- Modify : `api/stripe-billing.js`, `src/components/admin/AdminBillingView.jsx`
- Test : `api/billing/paiement-heberge.test.js` (création)

- [ ] **Step 1 : écrire la garde qui échoue**

Créer `api/billing/paiement-heberge.test.js` :

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Gardes du chantier « formules + Checkout hébergé » (14 septembre 2026).
 * Chacune vise un défaut qui passait sans bruit.
 */
function sansCommentaires(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('le MRR de l’admin', () => {
  it('ne lit plus l’intervalle seul', () => {
    // `interval === 'month'` comptait un trimestriel de 297 € comme 297 € de MRR.
    const src = sansCommentaires(readFileSync('api/stripe-billing.js', 'utf8'))
    expect(src).not.toMatch(/interval === 'month'\) return/)
    expect(src).toMatch(/mensualiteCentimes\(/)
  })
})
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run : `npx vitest run api/billing/paiement-heberge.test.js` → FAIL.

- [ ] **Step 3 : implémenter**

Dans `api/stripe-billing.js` :

1. Après `import { requireAdmin } from './lib/admin-auth.js';`, ajouter :

```js
import { mensualiteCentimes, libellePeriodeStripe } from './lib/formules.js';
```

2. Remplacer :

```js
    const mrr = activeSubs.reduce((sum, sub) => {
      const amount = sub.items.data.reduce((s, item) => {
        if (item.price.recurring?.interval === 'month') return s + item.price.unit_amount;
        if (item.price.recurring?.interval === 'year') return s + Math.round(item.price.unit_amount / 12);
        return s;
      }, 0);
      return sum + amount;
    }, 0);
```

par :

```js
    // Mensualité = montant ÷ mois de la période : un trimestriel est lui aussi
    // « au mois » pour Stripe, tous les 3 mois.
    const mrr = activeSubs.reduce(
      (sum, sub) => sum + sub.items.data.reduce((s, item) => s + mensualiteCentimes(item.price), 0),
      0,
    );
```

3. Dans `formattedSubs`, remplacer :

```js
      interval: sub.items.data[0]?.price?.recurring?.interval || 'month',
```

par :

```js
      interval: sub.items.data[0]?.price?.recurring?.interval || 'month',
      periode: libellePeriodeStripe(sub.items.data[0]?.price?.recurring),
```

Dans `src/components/admin/AdminBillingView.jsx`, remplacer :

```jsx
{(sub.amount / 100).toLocaleString('fr-FR')}€/{sub.interval === 'month' ? 'mois' : 'an'}
```

par :

```jsx
{(sub.amount / 100).toLocaleString('fr-FR')}€/{sub.periode || 'mois'}
```

- [ ] **Step 4 : lancer**

Run : `npx vitest run api/billing/paiement-heberge.test.js api/lib/formules.test.js && npx eslint api/stripe-billing.js src/components/admin/AdminBillingView.jsx api/billing/paiement-heberge.test.js`
Attendu : PASS, aucune erreur.

- [ ] **Step 5 : commit**

```bash
git add api/stripe-billing.js src/components/admin/AdminBillingView.jsx api/billing/paiement-heberge.test.js
git commit -m "fix(admin): le MRR divise par la vraie durée de la période"
```

---

### Task 7 : l'affichage des formules et le sélecteur

(Placée avant la configuration Stripe, dont l'écran admin l'importe.)

**Files :**
- Create : `src/lib/affichage-formules.js`, `src/components/billing/SelecteurFormule.jsx`
- Test : `src/lib/affichage-formules.test.js`

- [ ] **Step 1 : écrire le test qui échoue**

`src/lib/affichage-formules.test.js` :

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { affichagePrix, equivalentMensuel, memoriserFormuleChoisie, lireFormuleChoisie, PERIODES_AFFICHEES } from './affichage-formules.js'

const norme = (s) => s.replace(/[\u202f\u00a0]/g, ' ')

describe('affichage des formules', () => {
  beforeEach(() => localStorage.clear())

  it('mensuel : sans engagement, sans essai', () => {
    const a = affichagePrix('starter', 'mensuel')
    expect(norme(a.principal)).toBe('99 €')
    expect(a.suffixe).toBe('/mois')
    expect(a.detail).toBeNull()
    expect(a.offre).toBe('Sans engagement')
  })

  it('trimestriel : prix du trimestre et premier paiement', () => {
    const a = affichagePrix('pro', 'trimestriel')
    expect(norme(a.principal)).toBe('1 197 €')
    expect(a.suffixe).toBe('/3 mois')
    expect(norme(a.detail)).toBe('1er trimestre : 997,50 €')
    expect(a.offre).toBe('−50 % sur le premier mois')
  })

  it('trimestriel pour un client qui n’a plus droit à l’offre de bienvenue : prix plein, sans −50 %', () => {
    const a = affichagePrix('pro', 'trimestriel', { offreBienvenue: false })
    expect(norme(a.principal)).toBe('1 197 €')
    expect(a.detail).toBeNull()
    expect(a.offre).toBe('Payé tous les 3 mois')
  })

  it('annuel : 12 mois pour le prix de 11, et l’équivalent mensuel', () => {
    const a = affichagePrix('starter', 'annuel')
    expect(norme(a.principal)).toBe('980,10 €')
    expect(a.suffixe).toBe('/an')
    expect(norme(a.detail)).toBe('soit 81,68 € par mois')
    expect(a.offre).toBe('12 mois pour le prix de 11')
    expect(norme(equivalentMensuel('pro', 'annuel'))).toBe('329,18 €')
    expect(norme(affichagePrix('pro', 'annuel').principal)).toBe('3 950,10 €')
  })

  it('pas de formule pour Free et Enterprise', () => {
    expect(affichagePrix('free', 'mensuel')).toBeNull()
    expect(affichagePrix('enterprise', 'annuel')).toBeNull()
  })

  it('trois périodes proposées, dans l’ordre', () => {
    expect(PERIODES_AFFICHEES.map((p) => p.id)).toEqual(['mensuel', 'trimestriel', 'annuel'])
  })

  it('la formule de l’URL l’emporte', () => {
    expect(lireFormuleChoisie(new URLSearchParams('?plan=pro&formule=annuel'))).toEqual({ plan: 'pro', periode: 'annuel' })
  })

  it('sinon, la formule choisie sur /tarifs survit à l’inscription', () => {
    // L'inscription (code par e-mail ou Google) perd la chaîne de requête.
    memoriserFormuleChoisie({ plan: 'starter', periode: 'trimestriel' })
    expect(lireFormuleChoisie(new URLSearchParams(''))).toEqual({ plan: 'starter', periode: 'trimestriel' })
  })

  it('une valeur inconnue retombe sur le mensuel', () => {
    expect(lireFormuleChoisie(new URLSearchParams('?formule=hebdo'))).toEqual({ plan: null, periode: 'mensuel' })
  })
})
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run : `npx vitest run src/lib/affichage-formules.test.js` → FAIL (import introuvable).

- [ ] **Step 3 : implémenter**

`src/lib/affichage-formules.js` :

```js
import { formulePour, premierPaiementCentimes, PERIODES } from '../../api/lib/formules.js'

/**
 * Ce que le navigateur affiche des formules — dérivé du catalogue serveur,
 * jamais recopié. La page tarifs, la page de choix du plan, la facturation et
 * l'admin l'utilisent.
 */

export const PERIODES_AFFICHEES = [
  { id: 'mensuel', libelle: 'Mensuel', badge: null },
  // Badge de l'offre de bienvenue : masqué pour un client qui n'y a plus droit.
  { id: 'trimestriel', libelle: 'Trimestriel', badge: '−50 % le 1er mois', bienvenue: true },
  { id: 'annuel', libelle: 'Annuel', badge: '1 mois offert' },
]

/** « 99 € », « 247,50 € », « 3 950,10 € ». */
export function euros(centimes) {
  const valeur = centimes / 100
  const decimales = Number.isInteger(valeur) ? 0 : 2
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: 2 }).format(valeur)}\u00a0€`
}

/** L'équivalent mensuel d'une formule : « 81,68 € » pour Starter annuel. */
export function equivalentMensuel(plan, periode) {
  const f = formulePour(plan, periode)
  return f ? euros(Math.round(f.montantCentimes / f.mois)) : null
}

/**
 * Ce qu'une carte de prix affiche pour une formule.
 *
 * `offreBienvenue` : le −50 % du premier mois ne vaut qu'une fois par client.
 * Un client déjà abonné, ou qui a eu un essai, paiera le trimestre plein : lui
 * annoncer « 1er trimestre : 247,50 € » serait une promesse que Checkout ne
 * tiendrait pas.
 *
 * @param {string} plan
 * @param {string} periode
 * @param {{ offreBienvenue?: boolean }} [options]
 * @returns {{ principal: string, suffixe: string, detail: string|null, offre: string } | null}
 */
export function affichagePrix(plan, periode, { offreBienvenue = true } = {}) {
  const f = formulePour(plan, periode)
  if (!f) return null
  if (periode === 'trimestriel') {
    if (!offreBienvenue) {
      return { principal: euros(f.montantCentimes), suffixe: '/3 mois', detail: null, offre: 'Payé tous les 3 mois' }
    }
    return {
      principal: euros(f.montantCentimes),
      suffixe: '/3 mois',
      detail: `1er trimestre : ${euros(premierPaiementCentimes(f))}`,
      offre: '−50 % sur le premier mois',
    }
  }
  if (periode === 'annuel') {
    return {
      principal: euros(f.montantCentimes),
      suffixe: '/an',
      detail: `soit ${equivalentMensuel(plan, periode)} par mois`,
      offre: '12 mois pour le prix de 11',
    }
  }
  return { principal: euros(f.montantCentimes), suffixe: '/mois', detail: null, offre: 'Sans engagement' }
}

const CLE = 'actero_formule_choisie'
const DUREE_MS = 7 * 86400000

/** Mémorise la formule choisie : l'inscription perd la chaîne de requête. */
export function memoriserFormuleChoisie({ plan, periode }) {
  try {
    localStorage.setItem(CLE, JSON.stringify({ plan, periode, le: Date.now() }))
  } catch {
    // stockage indisponible (navigation privée) : on retombera sur le mensuel
  }
}

/**
 * La formule à présélectionner : celle de l'URL (`?formule=`, `?plan=`),
 * sinon celle mémorisée depuis moins de 7 jours, sinon le mensuel.
 *
 * @param {URLSearchParams} urlParams
 * @returns {{ plan: string|null, periode: string }}
 */
export function lireFormuleChoisie(urlParams) {
  const depuisUrl = urlParams?.get?.('formule')
  if (PERIODES.includes(depuisUrl)) return { plan: urlParams.get('plan') || null, periode: depuisUrl }
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) || 'null')
    if (brut && PERIODES.includes(brut.periode) && Date.now() - (brut.le || 0) < DUREE_MS) {
      return { plan: brut.plan || null, periode: brut.periode }
    }
  } catch {
    // valeur illisible : on l'ignore
  }
  return { plan: null, periode: 'mensuel' }
}
```

`src/components/billing/SelecteurFormule.jsx` :

```jsx
import React from 'react'
import { PERIODES_AFFICHEES } from '../../lib/affichage-formules'

/**
 * Mensuel / Trimestriel / Annuel. Un seul sélecteur pour la page tarifs, la
 * page de choix du plan et la facturation : trois copies finiraient par
 * annoncer trois offres différentes. `offreBienvenue` à false masque le badge
 * du −50 %, qui ne vaut qu'une fois par client.
 */
export function SelecteurFormule({ periode, onChange, taille = 'normale', offreBienvenue = true }) {
  const petit = taille === 'petite'
  return (
    <div role="group" aria-label="Formule de paiement" className="inline-flex flex-wrap items-center justify-center gap-1 p-1 rounded-full bg-surface border border-border-cream">
      {PERIODES_AFFICHEES.map((p) => {
        const actif = periode === p.id
        const badge = p.bienvenue && !offreBienvenue ? null : p.badge
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={actif}
            onClick={() => onChange(p.id)}
            className={`${petit ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-[13px]'} rounded-full font-semibold transition-colors flex items-center gap-1.5 ${actif ? 'bg-cta text-white' : 'text-ink-3 hover:text-ink'}`}
          >
            {p.libelle}
            {badge && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${actif ? 'bg-white/20 text-white' : 'bg-primary-tint text-primary'}`}>
                {badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4 : lancer**

Run : `npx vitest run src/lib/affichage-formules.test.js src/lib/couleurs.test.js src/lib/typographie.test.js && npx eslint src/lib/affichage-formules.js src/lib/affichage-formules.test.js src/components/billing/SelecteurFormule.jsx`
Attendu : PASS, aucune erreur.

- [ ] **Step 5 : commit**

```bash
git add src/lib/affichage-formules.js src/lib/affichage-formules.test.js src/components/billing/SelecteurFormule.jsx
git commit -m "feat(tarifs): un affichage des formules dérivé du catalogue, et un sélecteur partagé"
```

---

### Task 8 : configurer Stripe depuis l'admin

**Files :**
- Create : `api/lib/configuration-stripe.js`
- Test : `api/lib/configuration-stripe.test.js`
- Modify : `api/admin/setup-stripe-products.js`, `api/admin/stripe-status.js`, `src/components/admin/AdminStripeSetupView.jsx` (réécritures)

- [ ] **Step 1 : écrire le test qui échoue**

`api/lib/configuration-stripe.test.js` :

```js
import { describe, it, expect } from 'vitest'
import { configurerFormules } from './configuration-stripe.js'
import { FORMULES } from './formules.js'

/** Un compte Stripe en mémoire : juste ce que configurerFormules utilise. */
function faux({ produits = [], prix = [], coupons = [] } = {}) {
  const etat = { produits: [...produits], prix: [...prix], coupons: [...coupons], appels: [] }
  let n = 0
  const id = (p) => `${p}_${++n}`
  etat.stripe = {
    products: {
      list: async () => ({ data: etat.produits.filter((p) => p.active !== false), has_more: false }),
      create: async (d) => { const p = { id: id('prod'), active: true, ...d }; etat.produits.push(p); etat.appels.push(['products.create', d]); return p },
    },
    prices: {
      list: async () => ({ data: etat.prix.filter((p) => p.active !== false), has_more: false }),
      create: async (d) => {
        if (d.transfer_lookup_key) for (const x of etat.prix) if (x.lookup_key === d.lookup_key) x.lookup_key = null
        const p = { id: id('price'), active: true, currency: 'eur', ...d }; etat.prix.push(p); etat.appels.push(['prices.create', d]); return p
      },
      update: async (pid, d) => {
        if (d.transfer_lookup_key) for (const x of etat.prix) if (x.id !== pid && x.lookup_key === d.lookup_key) x.lookup_key = null
        const p = etat.prix.find((x) => x.id === pid); Object.assign(p, d); etat.appels.push(['prices.update', pid, d]); return p
      },
    },
    coupons: {
      retrieve: async (cid) => {
        const c = etat.coupons.find((x) => x.id === cid)
        if (!c) { const e = new Error('No such coupon'); e.code = 'resource_missing'; throw e }
        return c
      },
      create: async (d) => { etat.coupons.push(d); etat.appels.push(['coupons.create', d]); return d },
    },
  }
  return etat
}

describe('configurerFormules', () => {
  it('compte vierge : crée les produits, les six prix avec leur clé, et les deux coupons', async () => {
    const e = faux()
    const r = await configurerFormules(e.stripe)
    expect(e.produits).toHaveLength(2)
    for (const f of FORMULES) {
      const p = e.prix.find((x) => x.lookup_key === f.lookupKey)
      expect(p, f.lookupKey).toBeTruthy()
      expect(p.unit_amount).toBe(f.montantCentimes)
      expect(p.recurring).toEqual(f.recurring)
    }
    expect(e.coupons.map((c) => c.id).sort()).toEqual(['actero-trimestriel-pro-19950', 'actero-trimestriel-starter-4950'])
    expect(e.coupons.find((c) => c.id === 'actero-trimestriel-pro-19950')).toMatchObject({ amount_off: 19950, currency: 'eur', duration: 'once' })
    expect(r.formules.every((x) => x.action === 'cree')).toBe(true)
    expect(r.anciensPrixDesactives).toEqual([])
  })

  it('reprend l’ancien prix mensuel sans doublon, et désactive l’ancien annuel à 948 €', async () => {
    const e = faux({
      produits: [{ id: 'prod_s', metadata: { actero_plan: 'starter' } }, { id: 'prod_p', metadata: { actero_plan: 'pro' } }],
      prix: [
        { id: 'price_sm', product: 'prod_s', unit_amount: 9900, currency: 'eur', recurring: { interval: 'month', interval_count: 1 }, lookup_key: null, active: true },
        { id: 'price_sa', product: 'prod_s', unit_amount: 94800, currency: 'eur', recurring: { interval: 'year', interval_count: 1 }, lookup_key: null, active: true },
      ],
    })
    const r = await configurerFormules(e.stripe)
    expect(e.prix.find((p) => p.id === 'price_sm').lookup_key).toBe('actero_starter_mensuel')
    expect(e.prix.filter((p) => p.unit_amount === 9900)).toHaveLength(1)
    expect(e.prix.find((p) => p.id === 'price_sa').active).toBe(false)
    expect(r.anciensPrixDesactives).toEqual(['price_sa'])
    expect(e.produits).toHaveLength(2)
  })

  it('un prix qui porte la clé mais plus le bon montant est remplacé, et la clé passe au nouveau prix', async () => {
    // Un prix Stripe ne change plus de montant une fois créé : quand le catalogue
    // change (l'annuel a changé deux fois le 14 septembre), il faut un nouveau prix.
    const e = faux({
      produits: [{ id: 'prod_s', metadata: { actero_plan: 'starter' } }, { id: 'prod_p', metadata: { actero_plan: 'pro' } }],
      prix: [
        { id: 'price_13mois', product: 'prod_s', unit_amount: 106920, currency: 'eur', recurring: { interval: 'month', interval_count: 13 }, lookup_key: 'actero_starter_annuel', active: true },
      ],
    })
    const r = await configurerFormules(e.stripe)
    const annuel = r.formules.find((x) => x.lookupKey === 'actero_starter_annuel')
    expect(annuel.action).toBe('remplace')
    expect(e.prix.find((p) => p.id === annuel.prixId)).toMatchObject({ unit_amount: 98010, lookup_key: 'actero_starter_annuel' })
    expect(e.prix.find((p) => p.id === 'price_13mois').lookup_key).toBeNull()
  })

  it('deuxième passage : rien n’est créé, et les nouveaux annuels restent actifs', async () => {
    const e = faux()
    await configurerFormules(e.stripe)
    const avant = e.appels.length
    const r = await configurerFormules(e.stripe)
    expect(e.appels.slice(avant).filter(([nom]) => nom.endsWith('.create'))).toEqual([])
    expect(r.formules.every((x) => x.action === 'existant')).toBe(true)
    expect(r.anciensPrixDesactives).toEqual([])
    const annuels = e.prix.filter((p) => p.lookup_key?.endsWith('_annuel'))
    expect(annuels).toHaveLength(2)
    expect(annuels.every((p) => p.active)).toBe(true)
  })
})
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run : `npx vitest run api/lib/configuration-stripe.test.js` → FAIL (import introuvable).

- [ ] **Step 3 : implémenter `api/lib/configuration-stripe.js`**

```js
// @ts-check
import { FORMULES, prixConforme } from './formules.js'

/**
 * Crée ou retrouve, dans le compte Stripe, tout ce que les formules exigent.
 * Idempotent : on peut le relancer autant de fois qu'on veut.
 *
 *   - les produits Starter et Pro (metadata.actero_plan), réutilisés s'ils
 *     existent : les fonctionnalités Stripe Entitlements vivent sur le produit ;
 *   - les six prix, retrouvés par leur clé, sinon par leurs caractéristiques
 *     (produit, montant, périodicité) — ils reçoivent alors leur clé —, sinon
 *     créés. Un prix qui porte la clé mais ne facture plus le montant du
 *     catalogue (prixConforme) est remplacé : la clé passe au nouveau prix, et
 *     les abonnés existants gardent l'ancien ;
 *   - les deux coupons du trimestriel, à identifiant fixe ;
 *   - les ANCIENS prix annuels désactivés (948 € et 3 828 € avant le
 *     14 septembre) : tout prix annuel d'un produit Actero qui n'est pas celui
 *     d'une formule. Réactivables.
 *
 * L'ancien script reconnaissait « le mensuel » à `interval === 'month'`, ce que
 * le trimestriel vérifie aussi.
 *
 * @param {any} stripe
 */
export async function configurerFormules(stripe) {
  const rapport = {
    /** @type {{ lookupKey: string, prixId: string, action: 'existant'|'cle_posee'|'cree'|'remplace' }[]} */
    formules: [],
    /** @type {{ id: string, action: 'existant'|'cree' }[]} */
    coupons: [],
    /** @type {string[]} */
    anciensPrixDesactives: [],
  }

  const produits = await produitsParPlan(stripe)
  const prixActifs = await tousLesPrixActifs(stripe)

  for (const f of FORMULES) {
    const metadata = { actero_plan: f.plan, actero_periode: f.periode }
    const parCle = prixActifs.find((p) => p.lookup_key === f.lookupKey)
    if (parCle && prixConforme(f, parCle)) {
      rapport.formules.push({ lookupKey: f.lookupKey, prixId: parCle.id, action: 'existant' })
      continue
    }
    const semblable = prixActifs.find((p) => p.product === produits[f.plan] && prixConforme(f, p))
    if (semblable) {
      await stripe.prices.update(semblable.id, { lookup_key: f.lookupKey, transfer_lookup_key: true, metadata })
      rapport.formules.push({ lookupKey: f.lookupKey, prixId: semblable.id, action: 'cle_posee' })
      continue
    }
    const cree = await stripe.prices.create({
      product: produits[f.plan],
      unit_amount: f.montantCentimes,
      currency: 'eur',
      recurring: f.recurring,
      lookup_key: f.lookupKey,
      // La clé portée par un prix au mauvais montant passe au nouveau prix.
      ...(parCle ? { transfer_lookup_key: true } : {}),
      metadata,
    })
    rapport.formules.push({ lookupKey: f.lookupKey, prixId: cree.id, action: parCle ? 'remplace' : 'cree' })
  }

  for (const f of FORMULES) {
    if (!f.coupon) continue
    try {
      await stripe.coupons.retrieve(f.coupon.id)
      rapport.coupons.push({ id: f.coupon.id, action: 'existant' })
    } catch (err) {
      if (err?.code !== 'resource_missing' && err?.statusCode !== 404) throw err
      await stripe.coupons.create({
        id: f.coupon.id,
        name: `Trimestriel ${f.plan === 'pro' ? 'Pro' : 'Starter'} — premier mois à −50 %`,
        amount_off: f.coupon.montantCentimes,
        currency: 'eur',
        duration: 'once',
        applies_to: { products: [produits[f.plan]] },
      })
      rapport.coupons.push({ id: f.coupon.id, action: 'cree' })
    }
  }

  // Les prix des formules (existants ou clé posée) ne sont JAMAIS désactivés :
  // l'annuel du catalogue est lui aussi `interval: 'year'`.
  const prixDesFormules = new Set(rapport.formules.map((f) => f.prixId))
  const produitsActero = new Set(Object.values(produits))
  for (const p of prixActifs) {
    if (p.recurring?.interval === 'year' && produitsActero.has(p.product) && !prixDesFormules.has(p.id)) {
      await stripe.prices.update(p.id, { active: false })
      rapport.anciensPrixDesactives.push(p.id)
    }
  }

  return rapport
}

/** @param {any} stripe @returns {Promise<Record<'starter'|'pro', string>>} */
async function produitsParPlan(stripe) {
  const { data } = await stripe.products.list({ limit: 100, active: true })
  /** @type {Record<string, string>} */
  const produits = {}
  for (const plan of ['starter', 'pro']) {
    const existant = data.find((p) => p.metadata?.actero_plan === plan)
    produits[plan] = existant
      ? existant.id
      : (await stripe.products.create({ name: plan === 'pro' ? 'Actero Pro' : 'Actero Starter', metadata: { actero_plan: plan } })).id
  }
  return /** @type {Record<'starter'|'pro', string>} */ (produits)
}

/** @param {any} stripe @returns {Promise<any[]>} */
async function tousLesPrixActifs(stripe) {
  const tous = []
  let apres
  do {
    const page = await stripe.prices.list({ active: true, limit: 100, ...(apres ? { starting_after: apres } : {}) })
    tous.push(...page.data)
    apres = page.has_more ? page.data[page.data.length - 1]?.id : undefined
  } while (apres)
  return tous
}
```

- [ ] **Step 4 : réécrire les deux routes admin**

`api/admin/setup-stripe-products.js` :

```js
/**
 * Actero Admin — configure les formules dans Stripe.
 *
 * GET /api/admin/setup-stripe-products?confirm=yes
 *
 * Crée ou retrouve les six prix (avec leur lookup_key) et les deux coupons du
 * trimestriel, puis désactive les anciens prix annuels. Idempotent. Plus aucun
 * identifiant à copier dans Vercel : le serveur retrouve chaque prix par sa clé.
 *
 * Auth : admin (Bearer). Sécurité : ne fait rien sans `confirm=yes`.
 */
import { withSentry } from '../lib/sentry.js'
import Stripe from 'stripe'
import { authenticateAdmin } from './_helpers.js'
import { configurerFormules } from '../lib/configuration-stripe.js'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

  if (req.query.confirm !== 'yes') {
    return res.status(200).json({
      warning: 'Crée ou retrouve les 6 prix et les 2 coupons des formules Actero dans Stripe.',
      instruction: 'Ajoutez ?confirm=yes pour lancer.',
      url: '/api/admin/setup-stripe-products?confirm=yes',
    })
  }

  const auth = await authenticateAdmin(req, res)
  if (!auth) return

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'STRIPE_SECRET_KEY missing in env' })
  }

  try {
    const rapport = await configurerFormules(new Stripe(process.env.STRIPE_SECRET_KEY))
    return res.status(200).json({ status: 'ok', ...rapport })
  } catch (err) {
    console.error('[setup-stripe-products] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

export default withSentry(handler)
```

`api/admin/stripe-status.js` :

```js
/**
 * Actero Admin — état de la configuration Stripe.
 *
 * GET /api/admin/stripe-status
 *
 * Clés secrètes présentes, et, dans le compte Stripe : les six prix des formules
 * (par lookup_key, au montant du catalogue) et les deux coupons du trimestriel.
 * Auth : admin (Bearer).
 */
import { withSentry } from '../lib/sentry.js'
import Stripe from 'stripe'
import { authenticateAdmin } from './_helpers.js'
import { FORMULES, prixConforme } from '../lib/formules.js'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

  try {
    const auth = await authenticateAdmin(req, res)
    if (!auth) return

    const status = {
      stripe_secret_key: !!process.env.STRIPE_SECRET_KEY,
      stripe_webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET,
      formules: [],
      coupons: [],
      all_configured: false,
    }

    if (status.stripe_secret_key) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
      const { data } = await stripe.prices.list({ lookup_keys: FORMULES.map((f) => f.lookupKey), active: true, limit: 10 })
      // Configurée : un prix porte la clé ET facture exactement le catalogue.
      status.formules = FORMULES.map((f) => ({
        lookupKey: f.lookupKey,
        plan: f.plan,
        periode: f.periode,
        configuree: data.some((p) => p.lookup_key === f.lookupKey && prixConforme(f, p)),
      }))
      for (const f of FORMULES) {
        if (!f.coupon) continue
        let configure = false
        try {
          await stripe.coupons.retrieve(f.coupon.id)
          configure = true
        } catch {
          configure = false
        }
        status.coupons.push({ id: f.coupon.id, configure })
      }
    }

    status.all_configured = status.stripe_secret_key
      && status.stripe_webhook_secret
      && status.formules.length === FORMULES.length
      && status.formules.every((f) => f.configuree)
      && status.coupons.every((c) => c.configure)

    return res.status(200).json(status)
  } catch (err) {
    console.error('[admin/stripe-status] Error:', err.message)
    return res.status(500).json({ error: 'Internal error', message: err.message })
  }
}

export default withSentry(handler)
```

- [ ] **Step 5 : réécrire l'écran admin**

`src/components/admin/AdminStripeSetupView.jsx` :

```jsx
import React, { useState, useEffect } from 'react'
import { CreditCard, Check, X, AlertTriangle, Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../ui/PageHeader'
import { SectionCard } from '../ui/SectionCard'
import { StatusPill } from '../ui/StatusPill'
import { FORMULES } from '../../../api/lib/formules.js'
import { affichagePrix } from '../../lib/affichage-formules'

const ACTIONS = { existant: 'déjà en place', cle_posee: 'clé posée sur un prix existant', cree: 'créé', remplace: 'remplacé (le montant avait changé)' }

export function AdminStripeSetupView() {
  const [status, setStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Incrémenté après une configuration, pour relire le statut.
  const [lectureStatut, setLectureStatut] = useState(0)

  const getToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token
  }

  useEffect(() => {
    ;(async () => {
      try {
        const token = await getToken()
        const res = await fetch('/api/admin/stripe-status', { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) setStatus(await res.json())
      } catch {
        // statut indisponible : l'écran le dit plus bas
      } finally {
        setStatusLoading(false)
      }
    })()
  }, [lectureStatut])

  const handleCreate = async () => {
    if (!window.confirm('Créer ou retrouver les 6 prix et les 2 coupons des formules dans Stripe ? Les anciens prix annuels seront désactivés.')) return
    setCreating(true)
    setError(null)
    setResult(null)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/setup-stripe-products?confirm=yes', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
      setResult(data)
      setStatusLoading(true)
      setLectureStatut((n) => n + 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up">
      <PageHeader title="Configuration Stripe" subtitle="Les formules vendues, telles que Stripe les connaît" />

      <div className="p-6 space-y-6">
        <SectionCard title="Statut" icon={ShieldCheck}>
          {statusLoading ? (
            <div className="flex items-center gap-2 text-[13px] text-[#9ca3af]">
              <Loader2 className="w-4 h-4 animate-spin" /> Vérification…
            </div>
          ) : status ? (
            <div className="space-y-2">
              {[
                ['STRIPE_SECRET_KEY', status.stripe_secret_key],
                ['STRIPE_WEBHOOK_SECRET', status.stripe_webhook_secret],
              ].map(([nom, ok]) => (
                <div key={nom} className="flex items-center justify-between py-2 border-b border-[#f0f0f0]">
                  <code className="text-[12px] font-mono bg-surface px-2 py-0.5 rounded">{nom}</code>
                  {ok ? <StatusPill variant="success" icon={Check}>Présente</StatusPill> : <StatusPill variant="danger" icon={X}>Manquante</StatusPill>}
                </div>
              ))}
              {status.formules.map((f) => (
                <div key={f.lookupKey} className="flex items-center justify-between py-2 border-b border-[#f0f0f0]">
                  <code className="text-[12px] font-mono bg-surface px-2 py-0.5 rounded">{f.lookupKey}</code>
                  {f.configuree ? <StatusPill variant="success" icon={Check}>Prix en place</StatusPill> : <StatusPill variant="danger" icon={X}>À configurer</StatusPill>}
                </div>
              ))}
              {status.coupons.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0">
                  <code className="text-[12px] font-mono bg-surface px-2 py-0.5 rounded">{c.id}</code>
                  {c.configure ? <StatusPill variant="success" icon={Check}>Coupon en place</StatusPill> : <StatusPill variant="danger" icon={X}>Absent</StatusPill>}
                </div>
              ))}
              <div className="pt-3">
                {status.all_configured
                  ? <StatusPill variant="success" dot size="md">Tout est configuré</StatusPill>
                  : <StatusPill variant="warning" dot size="md">Configuration incomplète</StatusPill>}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-[#9ca3af]">Impossible de vérifier le statut.</p>
          )}
        </SectionCard>

        <SectionCard title="Configurer les formules" icon={CreditCard}>
          <div className="border border-[#f0f0f0] rounded-xl overflow-hidden mb-4">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface border-b border-[#f0f0f0]">
                  <th className="px-4 py-2.5 text-[11px] font-bold text-[#71717a] uppercase tracking-wider">Formule</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold text-[#71717a] uppercase tracking-wider">Prix</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold text-[#71717a] uppercase tracking-wider">Avantage</th>
                </tr>
              </thead>
              <tbody>
                {FORMULES.map((f) => {
                  const a = affichagePrix(f.plan, f.periode)
                  return (
                    <tr key={f.lookupKey} className="border-b border-[#f0f0f0] last:border-0">
                      <td className="px-4 py-3 text-[13px] font-semibold text-[#1a1a1a]">{f.plan === 'pro' ? 'Pro' : 'Starter'} · {f.periode}</td>
                      <td className="px-4 py-3 text-[13px] text-[#71717a]">{a.principal}{a.suffixe}{a.detail ? ` — ${a.detail}` : ''}</td>
                      <td className="px-4 py-3 text-[13px] text-[#71717a]">{a.offre}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-cta text-white hover:bg-cta-hover disabled:opacity-50 flex items-center gap-2"
          >
            {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Configuration en cours…</> : <><CreditCard className="w-4 h-4" /> Configurer Stripe</>}
          </button>

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-[12px] text-red-600">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-4 p-4 rounded-xl bg-primary-tint">
              <p className="text-[13px] font-semibold text-primary mb-2">Configuration terminée — rien à copier dans Vercel.</p>
              <ul className="space-y-1 text-[12px] text-[#3A3A3A]">
                {result.formules.map((f) => <li key={f.lookupKey}><code className="font-mono">{f.lookupKey}</code> : {ACTIONS[f.action]}</li>)}
                {result.coupons.map((c) => <li key={c.id}><code className="font-mono">{c.id}</code> : {ACTIONS[c.action]}</li>)}
                {result.anciensPrixDesactives.length > 0 && <li>Anciens prix annuels désactivés : {result.anciensPrixDesactives.join(', ')}</li>}
              </ul>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
```

- [ ] **Step 6 : lancer**

Run : `npx vitest run api/lib/configuration-stripe.test.js src/lib/couleurs.test.js && npx eslint api/lib/configuration-stripe.js api/lib/configuration-stripe.test.js api/admin/setup-stripe-products.js api/admin/stripe-status.js src/components/admin/AdminStripeSetupView.jsx`
Attendu : PASS, aucune erreur.

- [ ] **Step 7 : commit**

```bash
git add api/lib/configuration-stripe.js api/lib/configuration-stripe.test.js api/admin/setup-stripe-products.js api/admin/stripe-status.js src/components/admin/AdminStripeSetupView.jsx
git commit -m "feat(admin): configurer les formules dans Stripe en un clic, sans rien copier dans Vercel"
```

---

### Task 9 : la page tarifs

**Files :**
- Modify : `src/pages/PricingPage.jsx`

- [ ] **Step 1 : ajouter la garde qui échoue**

Ajouter à `api/billing/paiement-heberge.test.js` :

```js
describe('la formule suit le visiteur', () => {
  it('la page tarifs mémorise la formule choisie avant l’inscription', () => {
    const src = sansCommentaires(readFileSync('src/pages/PricingPage.jsx', 'utf8'))
    expect(src).toMatch(/memoriserFormuleChoisie\(/)
    expect(src).toMatch(/<SelecteurFormule/)
    expect(src, 'le vieux toggle mensuel/annuel est toujours là').not.toMatch(/isAnnual/)
  })
})
```

Run : `npx vitest run api/billing/paiement-heberge.test.js` → FAIL.

- [ ] **Step 2 : modifier `src/pages/PricingPage.jsx`**

1. Après `import { ComparisonTable } from "../components/landing/pricing/ComparisonTable";`, ajouter :

```js
import { SelecteurFormule } from "../components/billing/SelecteurFormule";
import { affichagePrix, equivalentMensuel, memoriserFormuleChoisie } from "../lib/affichage-formules";
```

2. Supprimer entièrement la fonction `computeAnnualSavingsPct` avec sa docstring, et la constante `ANNUAL_SAVINGS_PCT`.

3. Dans `const plans = PLAN_ORDER.map(...)`, supprimer la ligne `annualPrice: p.price.annual,`.

4. Remplacer l'entrée FAQ :

```js
  {
    q: "Proposez-vous un discount annuel ?",
    a: `Oui, la facturation annuelle vous fait économiser 20% par rapport au tarif mensuel. Par exemple, le plan Pro passe de ${PLANS.pro.price.monthly}\u20AC/mois à ${PLANS.pro.price.annual}\u20AC/mois (facturé annuellement).`,
  },
```

par :

```js
  {
    q: "Proposez-vous des formules trimestrielles ou annuelles ?",
    a: `Oui. Au trimestre, le premier mois est à -50 %. À l'année, vous payez 11 mois au lieu de 12, à -10 % : ${affichagePrix("starter", "annuel").principal} pour Starter, ${affichagePrix("pro", "annuel").principal} pour Pro.`,
  },
```

5. Remplacer `const [isAnnual, setIsAnnual] = useState(false);` par :

```js
  const [periode, setPeriode] = useState("mensuel");
```

6. Remplacer les trois fonctions `getPrice`, `getPeriod`, `getSubPrice` par :

```js
  const affichage = (plan) => (plan.monthlyPrice > 0 ? affichagePrix(plan.id, periode) : null);

  const getPrice = (plan) => {
    if (plan.monthlyPrice === null) return "Sur devis";
    if (plan.monthlyPrice === 0) return "0\u20AC";
    return affichage(plan).principal;
  };

  const getPeriod = (plan) => affichage(plan)?.suffixe || "";

  const getSubPrice = (plan) => {
    const a = affichage(plan);
    if (!a) return null;
    if (periode === "mensuel") return `ou ${equivalentMensuel(plan.id, "annuel")}/mois à l’année`;
    return a.detail;
  };
```

7. Dans `handleCTA`, remplacer :

```js
    trackEvent("Pricing_CTA_Clicked", { plan: plan.id, billing: isAnnual ? "annual" : "monthly" });
```

par :

```js
    trackEvent("Pricing_CTA_Clicked", { plan: plan.id, billing: periode });
    if (plan.id === "starter" || plan.id === "pro") {
      // L'inscription perd la chaîne de requête : la page de choix du plan
      // relira cette formule. Avant, choisir l'annuel ici menait au mensuel.
      memoriserFormuleChoisie({ plan: plan.id, periode });
    }
```

8. Remplacer tout le bloc du toggle — de `<div` portant `role="group"` et `aria-label="Facturation"` jusqu'à sa balise `</div>` fermante (juste avant `</motion.div>`) — par :

```jsx
                <SelecteurFormule periode={periode} onChange={setPeriode} />
```

9. Dans le rendu des cartes, supprimer le bloc :

```jsx
                      {isAnnual && plan.monthlyPrice > 0 && (
                        <span className={`line-through text-2xl font-bold ${plan.highlighted ? 'text-[#F4F5F7]/35' : 'text-[#9ca3af]'}`}>
                          {plan.monthlyPrice}€
                        </span>
                      )}
```

et remplacer `` key={`${plan.id}-${isAnnual}`} `` par `` key={`${plan.id}-${periode}`} ``.

10. Vérifier : `grep -n "isAnnual\|ANNUAL_SAVINGS_PCT\|annualPrice\|price.annual" src/pages/PricingPage.jsx` → aucune ligne.

- [ ] **Step 3 : lancer**

Run : `npx vitest run api/billing/paiement-heberge.test.js api/lib/promesses-tenues.test.js && npx eslint src/pages/PricingPage.jsx`
Attendu : PASS, aucune erreur.

- [ ] **Step 4 : commit**

```bash
git add src/pages/PricingPage.jsx api/billing/paiement-heberge.test.js
git commit -m "feat(tarifs): trois formules sur la page tarifs, et le choix suit le visiteur"
```

---

### Task 10 : la page de choix du plan

**Files :**
- Modify : `src/pages/PlanSelectionPage.jsx`

- [ ] **Step 1 : ajouter la garde qui échoue**

Ajouter à `api/billing/paiement-heberge.test.js`, dans `describe('la formule suit le visiteur', …)` :

```js
  it('la page de choix du plan ne code plus la période en dur', () => {
    const src = sansCommentaires(readFileSync('src/pages/PlanSelectionPage.jsx', 'utf8'))
    expect(src).not.toMatch(/billingPeriod: "monthly"|billing_period: "monthly"|billingPeriod="monthly"/)
    expect(src).toMatch(/lireFormuleChoisie\(/)
    expect(src).toMatch(/PERIODE_API\[/)
  })
```

Run → FAIL.

- [ ] **Step 2 : modifier `src/pages/PlanSelectionPage.jsx`**

1. Remplacer les imports :

```js
import { PLANS, PLAN_ORDER, getPlanHighlights } from "../lib/plans";
import { resolveUpgrade } from "../lib/billing-router";
import { PaymentModal } from "../components/billing/PaymentModal";
import { hasStripeElements } from "../lib/stripe-client";
```

par :

```js
import { PLANS, PLAN_ORDER } from "../lib/plans";
import { resolveUpgrade } from "../lib/billing-router";
import { SelecteurFormule } from "../components/billing/SelecteurFormule";
import { affichagePrix, lireFormuleChoisie } from "../lib/affichage-formules";
import { PERIODE_API } from "../../api/lib/formules.js";
```

2. Remplacer :

```js
  const [droitAuMois, setDroitAuMois] = useState(marqueurServeur);
  const [parParrainage, setParParrainage] = useState(false);
```

par :

```js
  const [droitAuMois, setDroitAuMois] = useState(marqueurServeur);
  const [parParrainage, setParParrainage] = useState(false);
  // La formule choisie sur /tarifs (ou dans le lien d'un closer) suit le
  // visiteur jusqu'ici. Avant, la page codait « monthly » en dur : choisir
  // l'annuel sur /tarifs menait à un paiement mensuel.
  const [periode, setPeriode] = useState(() => lireFormuleChoisie(urlParams).periode);
  // Une boutique Shopify s'abonne chez Shopify (App Store 1.2.1), qui ne
  // connaît pas le trimestriel : on ne le lui propose pas.
  const [boutiqueShopify, setBoutiqueShopify] = useState(false);
```

3. Dans le `useEffect`, juste après `if (!session?.user?.id) return;`, ajouter :

```js
        const { data: connexion } = await supabase
          .from("client_shopify_connections")
          .select("shop_domain")
          .limit(1)
          .maybeSingle();
        if (vivant && connexion?.shop_domain) setBoutiqueShopify(true);
```

4. Remplacer :

```js
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [payModal, setPayModal] = useState(null);

  const moisOffert = droitAuMois;
```

par :

```js
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  const moisOffert = droitAuMois;
  // Shopify et le code Startup (−50 % pendant 6 mois, au mois) restent au mensuel.
  const periodeEffective = boutiqueShopify || isStartupPromo ? "mensuel" : periode;
```

5. Dans `handleSelect`, remplacer :

```js
      const routed = await resolveUpgrade({
        token: session.access_token, clientId, targetPlan: planId, billingPeriod: "monthly",
      });
      if (routed.channel === "shopify") { window.location.assign(routed.url); return; }
      if (routed.channel === "error") { setError(routed.message); setLoading(null); return; }

      // On-site payment (Stripe Payment Element) when the publishable key is
      // set — otherwise fall through to the hosted Checkout redirect below.
      if (hasStripeElements()) {
        setPayModal({ planId, clientId, token: session.access_token });
        setLoading(null);
        return;
      }
```

par :

```js
      const routed = await resolveUpgrade({
        token: session.access_token, clientId, targetPlan: planId, billingPeriod: PERIODE_API[periodeEffective],
      });
      if (routed.channel === "shopify") { window.location.assign(routed.url); return; }
      if (routed.channel === "error") { setError(routed.message); setLoading(null); return; }
```

puis remplacer `billing_period: "monthly",` par `billing_period: PERIODE_API[periodeEffective],`, et remplacer :

```js
      } else if (data.error === "Stripe not configured") {
```

par :

```js
      } else if (data.error === "deja_sur_ce_plan" || data.error === "changement_de_formule") {
        setError(data.message);
        setLoading(null);
      } else if (data.error === "Stripe not configured") {
```

6. Remplacer `titre` et `sousTitre` par :

```js
  const titre = isStartupPromo
    ? "Bienvenue dans Actero for Startups"
    : moisOffert && periodeEffective === "mensuel"
      ? "Votre premier mois est offert"
      : "Choisissez votre plan";

  const sousTitre = isStartupPromo
    ? "Votre code Startup est actif : -50 % pendant six mois, sur Starter ou Pro."
    : periodeEffective === "trimestriel"
      ? "Au trimestre, le premier mois est à -50 %. Le premier trimestre se paie à l’inscription."
      : periodeEffective === "annuel"
        ? "À l’année, 12 mois pour le prix de 11, à -10 %."
        : moisOffert
          ? "Choisissez la formule qui vous ressemble. Vous ne serez pas débité avant le " + dateFacturation + ", et vous pouvez annuler en un clic."
          : "Commencez avec le plan Free, ou choisissez la formule qui vous convient. Sans engagement.";
```

7. Juste après la balise fermante `</motion.div>` du bloc « Titre » (avant `{/* ---------- Formules ---------- */}`), ajouter :

```jsx
        {!boutiqueShopify && !isStartupPromo && (
          <div className="flex justify-center px-6 pt-10">
            <SelecteurFormule periode={periode} onChange={setPeriode} />
          </div>
        )}
```

8. Dans la boucle des cartes, remplacer :

```js
              let prix;
              let periode = null;
              if (plan.price.monthly === null) {
                prix = "Sur devis";
              } else if (plan.price.monthly === 0) {
                prix = "Gratuit";
              } else {
                prix = `${hasDiscount ? discountedPrice : plan.price.monthly}€`;
                periode = "/mois";
              }
```

par :

```js
              let prix;
              let suffixe = null;
              let detail = null;
              if (plan.price.monthly === null) {
                prix = "Sur devis";
              } else if (plan.price.monthly === 0) {
                prix = "Gratuit";
              } else if (hasDiscount) {
                prix = `${discountedPrice}€`;
                suffixe = "/mois";
              } else {
                const affichage = affichagePrix(planId, periodeEffective);
                prix = affichage.principal;
                suffixe = affichage.suffixe;
                detail = affichage.detail;
              }
```

remplacer :

```js
              } else {
                ctaLabel = moisOffert ? "30 jours gratuits" : "Essai gratuit 7 jours";
                ctaStyle = "bg-cta text-white hover:bg-cta-hover";
              }
```

par :

```js
              } else {
                ctaLabel = periodeEffective === "trimestriel"
                  ? "Payer le premier trimestre"
                  : periodeEffective === "annuel"
                    ? "Payer l’année"
                    : (moisOffert ? "30 jours gratuits" : "Choisir ce plan");
                ctaStyle = "bg-cta text-white hover:bg-cta-hover";
              }
```

remplacer :

```jsx
                        {periode && <span className="text-ink-4 text-sm">{periode}</span>}
                      </div>
```

par :

```jsx
                        {suffixe && <span className="text-ink-4 text-sm">{suffixe}</span>}
                      </div>
                      {detail && (
                        <div className="text-[11px] text-ink-4 mt-1.5">{detail}</div>
                      )}
```

9. Dans la réassurance, remplacer :

```js
              [CreditCard, "Aucun débit avant le " + dateFacturation],
```

par :

```js
              [CreditCard, periodeEffective === "trimestriel"
                ? "Premier trimestre payé à l’inscription"
                : periodeEffective === "annuel"
                  ? "Année payée d’avance : 12 mois pour le prix de 11"
                  : moisOffert ? "Aucun débit avant le " + dateFacturation : "Payé à l’inscription, sans engagement"],
```

10. Supprimer le bloc `<PaymentModal … />` en fin de composant (de `<PaymentModal` à `/>` inclus).

- [ ] **Step 3 : lancer**

Run : `npx vitest run api/billing/paiement-heberge.test.js api/lib/essai-gratuit.test.js src/lib/campagne.test.js && npx eslint src/pages/PlanSelectionPage.jsx`
Attendu : PASS (le test « la page de plans annonce le mois » trouve toujours `moisOffert ? "30 jours gratuits"` et `urlParams.get("offre")`), aucune erreur.

- [ ] **Step 4 : commit**

```bash
git add src/pages/PlanSelectionPage.jsx api/billing/paiement-heberge.test.js
git commit -m "feat(tarifs): la page de choix du plan reprend la formule choisie et paie par Stripe Checkout"
```

---

### Task 11 : la facturation du tableau de bord

**Files :**
- Modify : `src/components/client/ClientBillingView.jsx`

- [ ] **Step 1 : ajouter la garde qui échoue**

Ajouter à `api/billing/paiement-heberge.test.js` :

```js
describe('la facturation du tableau de bord', () => {
  it('propose les trois formules et attend le webhook après un changement immédiat', () => {
    const src = sansCommentaires(readFileSync('src/components/client/ClientBillingView.jsx', 'utf8'))
    expect(src).toMatch(/<SelecteurFormule/)
    expect(src).toMatch(/PERIODE_API\[/)
    expect(src, 'l’ancien toggle mensuel/annuel est toujours là').not.toMatch(/setBillingPeriod|billingPeriod ===|\[billingPeriod\]/)
    expect(src, 'le badge « -20% » est toujours là').not.toMatch(/-20%/)
    // Même règle d'éligibilité que le serveur, pour le badge, le détail du
    // trimestre et le bouton mensuel : sinon la page annoncerait un −50 % ou un
    // mois offert que Checkout refuserait.
    expect(src).toMatch(/peutAvoirUneOffreDeBienvenue\(client\)/)
    expect(src).toMatch(/'mensuel' && offreBienvenue && boutiqueShopify === false \? joursEssaiPour\(client\)/)
  })
})
```

Run → FAIL.

- [ ] **Step 2 : modifier `src/components/client/ClientBillingView.jsx`**

1. Remplacer les imports :

```js
import { PLANS, PLAN_ORDER, getPlanConfig, getPlanHighlights } from '../../lib/plans'
import { resolveUpgrade } from '../../lib/billing-router'
import { PaymentModal } from '../billing/PaymentModal'
import { hasStripeElements } from '../../lib/stripe-client'
```

par :

```js
import { PLANS, PLAN_ORDER, getPlanConfig } from '../../lib/plans'
import { resolveUpgrade } from '../../lib/billing-router'
import { SelecteurFormule } from '../billing/SelecteurFormule'
import { affichagePrix } from '../../lib/affichage-formules'
import { PERIODE_API, periodeDepuisApi } from '../../../api/lib/formules.js'
```

puis `import { joursEssaiPour } from '../../../api/lib/essai-gratuit.js'` par `import { joursEssaiPour, peutAvoirUneOffreDeBienvenue } from '../../../api/lib/essai-gratuit.js'`.

2. Remplacer :

```js
  const [billingPeriod, setBillingPeriod] = useState('monthly')
  const [payModal, setPayModal] = useState(null)
```

par :

```js
  const [periode, setPeriode] = useState('mensuel')
```

3. Juste après `const plan = usePlan(client?.id)`, ajouter :

```js
  // Une boutique Shopify s'abonne chez Shopify (App Store 1.2.1), qui ne
  // propose pas le trimestriel.
  const { data: boutiqueShopify } = useQuery({
    queryKey: ['billing-shopify', client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_shopify_connections')
        .select('shop_domain')
        .eq('client_id', client.id)
        .maybeSingle()
      // Une lecture ratée ne vaut pas « pas de boutique Shopify » : React Query
      // laisse alors data à undefined, et rien qui dépend de Shopify n'est annoncé.
      if (error) throw error
      return !!data?.shop_domain
    },
  })
  const periodeEffective = boutiqueShopify ? 'mensuel' : periode
  // N'annoncer ni −50 % ni mois offert que Checkout refuserait : même règle que
  // le serveur (api/lib/essai-gratuit.js), qui vérifie en plus l'historique Stripe.
  const offreBienvenue = peutAvoirUneOffreDeBienvenue(client)
```

4. Dans `handleUpgrade`, remplacer :

```js
      const routed = await resolveUpgrade({
        token: session?.access_token, clientId, targetPlan, billingPeriod,
      })
      if (routed.channel === 'shopify') { window.location.assign(routed.url); return }
      if (routed.channel === 'error') { toast.error(routed.message); setUpgradingPlan(null); return }

      // On-site payment (Stripe Payment Element) when the publishable key is
      // set — otherwise fall through to the hosted Checkout redirect below.
      if (hasStripeElements()) {
        setPayModal({ planId: targetPlan, clientId, token: session?.access_token })
        setUpgradingPlan(null)
        return
      }
```

par :

```js
      const routed = await resolveUpgrade({
        token: session?.access_token, clientId, targetPlan, billingPeriod: PERIODE_API[periodeEffective],
      })
      if (routed.channel === 'shopify') { window.location.assign(routed.url); return }
      if (routed.channel === 'error') { toast.error(routed.message); setUpgradingPlan(null); return }
```

remplacer `billing_period: billingPeriod,` par `billing_period: PERIODE_API[periodeEffective],`, et remplacer :

```js
      if (data.instant && data.success) {
        // Instant upgrade — no redirect needed, plan switched server-side
        toast.success(data.message || `Plan mis a jour vers ${targetPlan} !`)
        // Refresh plan data
        window.location.reload()
      } else if (data.checkout_url) {
```

par :

```js
      if (data.instant && data.success) {
        toast.success(data.message || `Passage au plan ${targetPlan} en cours…`)
        // La route n'écrit plus le plan : le webhook Stripe l'accorde une fois
        // la carte vérifiée. On l'attend quelques secondes avant de recharger.
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 1000))
          const { data: ligne } = await supabase.from('clients').select('plan').eq('id', clientId).maybeSingle()
          if (ligne?.plan === targetPlan) break
        }
        window.location.reload()
      } else if (data.error === 'deja_sur_ce_plan' || data.error === 'changement_de_formule') {
        toast.error(data.message)
      } else if (data.checkout_url) {
```

5. Remplacer :

```js
  const planConfig = plan.config || getPlanConfig('free')
  const currentPrice = planConfig.price?.[billingPeriod]
```

par :

```js
  const planConfig = plan.config || getPlanConfig('free')
  // Le prix affiché pour le plan actuel est celui de SA formule, pas celle du
  // sélecteur.
  const periodeActuelle = periodeDepuisApi(client?.billing_period) || 'mensuel'
  const affichageActuel = ['starter', 'pro'].includes(plan.planId) ? affichagePrix(plan.planId, periodeActuelle, { offreBienvenue: false }) : null
```

5 bis. Dans l'en-tête de la page (le bloc « Prix »), remplacer :

```jsx
              <span className="text-lg font-bold text-[#1a1a1a] tabular-nums leading-tight">
                {formatPrice(currentPrice)}
              </span>
              <span className="text-[10px] text-[#9ca3af]">
                {currentPrice > 0 ? '/ mois' : ''}
              </span>
```

par :

```jsx
              <span className="text-lg font-bold text-[#1a1a1a] tabular-nums leading-tight">
                {affichageActuel ? affichageActuel.principal : formatPrice(planConfig.price?.monthly)}
              </span>
              <span className="text-[10px] text-[#9ca3af]">
                {affichageActuel ? affichageActuel.suffixe.replace('/', '/ ') : ''}
              </span>
```

6. Remplacer :

```jsx
            <p className="text-[28px] font-bold text-[#1a1a1a] tabular-nums">
              {formatPrice(currentPrice)}
            </p>
            {currentPrice > 0 && (
              <p className="text-[11px] text-[#9ca3af]">
                par mois{billingPeriod === 'annual' ? ' (facturé annuellement)' : ''}
              </p>
            )}
```

par :

```jsx
            <p className="text-[28px] font-bold text-[#1a1a1a] tabular-nums">
              {affichageActuel ? affichageActuel.principal : formatPrice(planConfig.price?.monthly)}
            </p>
            {affichageActuel && (
              <p className="text-[11px] text-[#9ca3af]">
                {affichageActuel.suffixe.replace('/', 'par ')}{affichageActuel.detail ? ` · ${affichageActuel.detail}` : ''}
              </p>
            )}
```

7. Dans le bandeau d'essai, remplacer `(plan.trialDaysLeft / 7) * 100` par `(plan.trialDaysLeft / 30) * 100` (il ne sert plus que le mois offert, de 30 jours).

8. Remplacer tout le bloc `{/* Billing period toggle */}` — de ce commentaire jusqu'au `</div>` qui ferme le groupe des deux boutons Mensuel/Annuel — par :

```jsx
          {!boutiqueShopify && (
            <SelecteurFormule periode={periode} onChange={setPeriode} taille="petite" offreBienvenue={offreBienvenue} />
          )}
```

9. Dans la boucle des cartes, remplacer `const price = p.price?.[billingPeriod]` par :

```js
            const affichage = isEnterprise ? null : affichagePrix(planKey, periodeEffective, { offreBienvenue })
```

remplacer :

```js
              const jours = joursEssaiPour(client)
```

par :

```js
              // Shopify facture et gère lui-même l'abonnement : aucun mois offert à
              // annoncer, ni tant qu'on ne sait pas encore si la boutique est sur Shopify.
              const jours = periodeEffective === 'mensuel' && offreBienvenue && boutiqueShopify === false ? joursEssaiPour(client) : undefined
```

et remplacer :

```jsx
                  <div className="mb-4">
                    <span className="text-[24px] font-bold text-[#1a1a1a] tabular-nums">
                      {formatPrice(price)}
                    </span>
                    {price > 0 && (
                      <span className="text-[11px] text-[#9ca3af] ml-1">/mois</span>
                    )}
                  </div>
```

par :

```jsx
                  <div className="mb-4">
                    <span className="text-[24px] font-bold text-[#1a1a1a] tabular-nums">
                      {affichage ? affichage.principal : formatPrice(p.price?.monthly)}
                    </span>
                    {affichage && (
                      <span className="text-[11px] text-[#9ca3af] ml-1">{affichage.suffixe}</span>
                    )}
                    {affichage?.detail && (
                      <p className="text-[11px] text-[#9ca3af] mt-0.5">{affichage.detail}</p>
                    )}
                  </div>
```

10. Supprimer le bloc `<PaymentModal … />` en fin de composant.

11. Vérifier : `grep -nE "billingPeriod|payModal|getPlanHighlights|hasStripeElements|currentPrice" src/components/client/ClientBillingView.jsx` → seule ligne admise : `billingPeriod: PERIODE_API[periodeEffective]` dans l'appel à `resolveUpgrade`.

- [ ] **Step 3 : lancer**

Run : `npx vitest run api/billing/paiement-heberge.test.js && npx eslint src/components/client/ClientBillingView.jsx`
Attendu : PASS, aucune erreur.

- [ ] **Step 4 : commit**

```bash
git add src/components/client/ClientBillingView.jsx api/billing/paiement-heberge.test.js
git commit -m "feat(facturation): trois formules dans le tableau de bord, et le plan accordé par le webhook"
```

---

### Task 12 : les textes « −20 % »

**Files :**
- Modify : `src/components/landing/PricingA.jsx`, `src/pages/FaqPage.jsx`

- [ ] **Step 1 : ajouter la garde qui échoue**

Ajouter à `api/billing/paiement-heberge.test.js` :

```js
describe('plus de remise annuelle de 20 %', () => {
  it('aucun texte n’annonce encore l’ancien annuel', () => {
    const fautifs = []
    for (const f of ['src/pages/PricingPage.jsx', 'src/pages/FaqPage.jsx', 'src/components/landing/PricingA.jsx', 'src/components/client/ClientBillingView.jsx']) {
      const src = sansCommentaires(readFileSync(f, 'utf8'))
      if (/-\s?20\s?%|20\s?% de réduction|économiser 20/.test(src)) fautifs.push(`${f} : remise de 20 %`)
      if (/\b(79|319)\s?€\/mois en annuel|948\s?€\/an|3\s?828\s?€\/an/.test(src)) fautifs.push(`${f} : ancien prix annuel`)
    }
    expect(fautifs).toEqual([])
  })
})
```

Run → FAIL (PricingA, FaqPage).

- [ ] **Step 2 : modifier**

`src/components/landing/PricingA.jsx` — ajouter aux imports :

```js
import { equivalentMensuel } from '../../lib/affichage-formules'
```

puis remplacer `sub: '/mois · 79€/mois en annuel',` par :

```js
      sub: `/mois · ${equivalentMensuel('starter', 'annuel')}/mois en annuel`,
```

et `sub: '/mois · 319€/mois en annuel',` par :

```js
      sub: `/mois · ${equivalentMensuel('pro', 'annuel')}/mois en annuel`,
```

`src/pages/FaqPage.jsx` — remplacer :

```js
          q: "Proposez-vous un discount annuel ?",
          a: "Oui, 20% de réduction sur la facturation annuelle. Le plan Starter passe de 99€ à 79€/mois (facturé 948€/an), le plan Pro de 399€ à 319€/mois (facturé 3 828€/an). Le plan Enterprise est négocié au cas par cas avec remises supplémentaires sur engagement pluriannuel.",
```

par :

```js
          q: "Proposez-vous des formules trimestrielles ou annuelles ?",
          a: "Oui. Au trimestre, le premier mois est à -50 %. À l'année, vous payez 11 mois au lieu de 12, à -10 % : 980,10 € pour Starter, 3 950,10 € pour Pro. Le plan Enterprise se négocie au cas par cas.",
```

- [ ] **Step 3 : lancer**

Run : `npx vitest run api/billing/paiement-heberge.test.js && npx eslint src/components/landing/PricingA.jsx src/pages/FaqPage.jsx`
Attendu : PASS.

- [ ] **Step 4 : commit**

```bash
git add src/components/landing/PricingA.jsx src/pages/FaqPage.jsx api/billing/paiement-heberge.test.js
git commit -m "fix(tarifs): plus aucune page n'annonce l'ancien annuel à -20 %"
```

---

### Task 13 : plus aucune promesse d'essai de 7 jours

**Files :**
- Modify : `src/lib/plans.js`, `src/components/ui/StickyCTA.jsx`, `src/components/ui/UpgradeBanner.jsx`, `src/components/ui/StickyCTABar.jsx`, `src/components/landing/PricingA.jsx`, `src/components/alternative/AlternativeTemplate.jsx`, `src/components/alternative/VsTemplate.jsx`, `src/components/landing/GorgiasCostCalculator.jsx`, `src/components/landing/ROISimulator.jsx`, `src/components/client/PortalSavView.jsx`, `src/pages/PricingPage.jsx`, `src/pages/SignupPage.jsx`, `src/pages/SupportGuidePage.jsx`, `src/pages/FaqPage.jsx`, `src/pages/AlternativeGorgias.jsx`, `src/pages/LandingPage.jsx`, `scripts/prerender-routes.mjs`, `public/llms.txt`, `public/og-image.svg` (et `public/og-image.png`, régénérée), `docs/essentials/quickstart.mdx`, `docs/essentials/facturation.mdx`

- [ ] **Step 1 : ajouter la garde qui échoue**

Ajouter à `api/billing/paiement-heberge.test.js` (et `readdirSync`, `statSync` aux imports de `node:fs`, `join` depuis `node:path`, en tête de fichier) :

```js
function fichiersSource(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) fichiersSource(p, acc)
    else if (/\.(jsx?|mjs)$/.test(e) && !e.includes('.test.')) acc.push(p)
  }
  return acc
}

// Toutes les formes sous lesquelles le site promettait un essai de 7 jours le
// 14 septembre 2026.
const PROMESSE_ESSAI = /essai (gratuit )?(de )?7 jours|7 jours gratuits|7 jours d.essai|essai 7 ?j\b|jours de trial|trial gratuit|essai gratuit sur starter|p[ée]riode d.essai de 7 jours|pendant sept jours|commencer mon essai gratuit|d[ée]marrer l.essai gratuit|essai gratuit · annulable/i

describe('plus d’essai gratuit de 7 jours', () => {
  it('aucune page ne le promet encore', () => {
    // Décision du 14 septembre 2026 : le mensuel se paie dès l'inscription. Seul
    // le mois offert (campagne, parrainage) reste — ses bandeaux « Essai
    // gratuit — J-x » du tableau de bord sont légitimes.
    const fautifs = []
    for (const f of [...fichiersSource('src'), ...fichiersSource('scripts')]) {
      const m = sansCommentaires(readFileSync(f, 'utf8')).match(PROMESSE_ESSAI)
      if (m) fautifs.push(`${f} : « ${m[0]} »`)
    }
    // Ce que lisent les assistants IA (llms.txt) et les réseaux sociaux (le
    // texte de l'image de partage, dont og-image.png est générée).
    for (const f of ['public/llms.txt', 'public/og-image.svg']) {
      const m = readFileSync(f, 'utf8').match(PROMESSE_ESSAI)
      if (m) fautifs.push(`${f} : « ${m[0]} »`)
    }
    expect(fautifs).toEqual([])
  })

  it('la documentation ne promet plus d’essai ni l’ancien annuel', () => {
    const fautifs = []
    for (const f of ['docs/essentials/quickstart.mdx', 'docs/essentials/facturation.mdx']) {
      const src = readFileSync(f, 'utf8')
      const m = src.match(PROMESSE_ESSAI)
      if (m) fautifs.push(`${f} : « ${m[0]} »`)
      if (/-\s?20\s?%/.test(src)) fautifs.push(`${f} : remise annuelle de 20 %`)
    }
    expect(fautifs).toEqual([])
  })

  it('les plans payants n’ont plus d’essai', () => {
    const src = sansCommentaires(readFileSync('src/lib/plans.js', 'utf8'))
    expect(src).not.toMatch(/\btrial:\s*\{/)
  })
})
```

Run : `npx vitest run api/billing/paiement-heberge.test.js` → FAIL (liste des fichiers fautifs).

- [ ] **Step 2 : `src/lib/plans.js`**

Dans le bloc `starter`, remplacer `    trial: { days: 7, requires_card: true },` par ces deux lignes — le commentaire sur sa propre ligne, car la garde ne retire que les commentaires qui ouvrent une ligne :

```js
    // Plus d'essai de 7 jours depuis le 14 septembre 2026 ; le mois offert passe par joursEssaiPour.
    trial: false,
```

puis `    cta: 'Essai gratuit 7 jours',` par `    cta: 'Choisir Starter',`.

Dans le bloc `pro`, mêmes remplacements, avec `    cta: 'Choisir Pro',`.

Vérifier : `grep -rnE "trial: \{|requires_card:" src --include='*.js' --include='*.jsx'` → aucune ligne.

- [ ] **Step 3 : boutons et bandeaux**

| Fichier | Remplacer | Par |
|---|---|---|
| `src/components/ui/StickyCTA.jsx` | `Essai gratuit 7 jours` | `Commencer gratuitement` |
| `src/components/ui/UpgradeBanner.jsx` | `Essai gratuit 7 jours, sans engagement` | `Sans engagement, résiliable à tout moment` |
| `src/components/ui/StickyCTABar.jsx` | `aria-label="Action rapide : démarrer l'essai gratuit"` | `aria-label="Action rapide : commencer gratuitement"` |
| `src/components/ui/StickyCTABar.jsx` | `Essai gratuit · Annulable en 1 clic` | `Plan gratuit · Sans carte bancaire` |
| `src/components/landing/PricingA.jsx` | `cta: 'Essai gratuit 7 jours',` (bloc Starter) | `cta: 'Choisir Starter',` |
| `src/components/landing/PricingA.jsx` | `cta: 'Essai gratuit 7 jours',` (bloc Pro) | `cta: 'Choisir Pro',` |
| `src/components/landing/PricingA.jsx` | `Essai 7 jours sur Starter et Pro.` | `Sans engagement sur Starter et Pro.` |
| `src/components/alternative/AlternativeTemplate.jsx` | `description: '1 000 tickets/mois, 3 workflows, essai 7 jours',` | `description: '1 000 tickets/mois, 3 workflows, sans engagement',` |
| `src/components/alternative/AlternativeTemplate.jsx` | `Installé en 15 minutes · Plan Free à vie · Essai gratuit sur Starter et Pro` | `Installé en 15 minutes · Plan Free à vie · Sans engagement sur Starter et Pro` |
| `src/components/alternative/AlternativeTemplate.jsx` (2 fois) | `Essai gratuit 7 jours` | `Commencer gratuitement` |
| `src/components/alternative/VsTemplate.jsx` (2 fois) | `Essai gratuit 7 jours` | `Commencer gratuitement` |
| `src/components/landing/GorgiasCostCalculator.jsx` | `Essai gratuit 7 jours` | `Commencer gratuitement` |
| `src/components/landing/ROISimulator.jsx` | `cta: 'Essai gratuit 7 jours'` (ligne Starter) | `cta: 'Choisir Starter'` |
| `src/components/landing/ROISimulator.jsx` | `cta: 'Essai gratuit 7 jours'` (ligne Pro) | `cta: 'Choisir Pro'` |
| `src/components/landing/ROISimulator.jsx` | `'Essai gratuit 7 jours — Sans engagement'` | `'Sans engagement'` |
| `src/components/client/PortalSavView.jsx` | `Essai gratuit 7 jours, sans engagement` | `Sans engagement, résiliable à tout moment` |
| `src/pages/PricingPage.jsx` (2 fois) | `"Essai 7 jours sans engagement",` | `"Sans engagement",` |
| `src/pages/PricingPage.jsx` | `Essai gratuit 7 jours` (bouton de fin de page) | `Commencer gratuitement` |
| `src/pages/SignupPage.jsx` | `) : "Commencer mon essai gratuit"}` | `) : "Créer mon compte"}` |
| `src/pages/AlternativeGorgias.jsx` | `support email 48h, essai 7 jours. Les agents` | `support email 48h, sans engagement. Les agents` |
| `src/pages/LandingPage.jsx` (description SEO) | `Installé en 15 min, essai gratuit 7 jours."` | `Installé en 15 min, plan Free gratuit à vie."` |
| `src/pages/LandingPage.jsx` (bouton de fin de page) | `Essai gratuit 7 jours` | `Commencer gratuitement` |
| `scripts/prerender-routes.mjs` (route `/tarifs`) | `Essai gratuit 7 jours sans carte bancaire.` | `Formule mensuelle sans engagement, trimestrielle ou annuelle.` |
| `public/llms.txt` | `**Essai gratuit 7 jours sans carte bancaire** sur le plan Free` | `**Plan Free gratuit à vie, sans carte bancaire** ; Starter et Pro sans engagement` |
| `public/og-image.svg` | `Conforme RGPD · Essai gratuit 7 jours` | `Conforme RGPD · Sans engagement` |

(Dans `AlternativeTemplate.jsx`, `VsTemplate.jsx` et `GorgiasCostCalculator.jsx`, garder le `<ArrowRight … />` qui suit le texte.)

- [ ] **Step 4 : textes longs**

`src/pages/PricingPage.jsx` — remplacer :

```js
    q: "L'essai gratuit est-il sans engagement ?",
    a: "Oui, l'essai de 7 jours est 100% gratuit et sans engagement. Aucune carte bancaire requise pour le plan Free. Pour Starter et Pro, vous pouvez annuler à tout moment pendant l'essai sans être débité.",
```

par :

```js
    q: "Y a-t-il un engagement ?",
    a: "Non. Le mensuel se résilie à tout moment. Le trimestriel et l'annuel sont payés d'avance pour leur période, et résiliables avant leur renouvellement. Le plan Free reste gratuit, sans carte bancaire.",
```

et, dans l'attribut `description` du composant `SEO`, remplacer `Essai gratuit sur Starter et Pro.` par `Sans engagement.`

`src/pages/SupportGuidePage.jsx` — remplacer le texte :

```js
        content: "Les nouveaux inscrits beneficient d'une période d'essai de 7 jours sur les plans payants (Starter et Pro). A la fin, vous basculez vers le plan Free (pas de coupure de service) sauf si vous souscrivez. Les parraines beneficient en plus de 30 jours offerts (cumulable avec le trial).",
```

par :

```js
        content: "Les plans payants (Starter et Pro) se prennent au mois, au trimestre ou à l'année, sans essai gratuit : le mensuel se paie dès l'inscription et se résilie à tout moment. Les marchands parrainés ou venus d'une campagne bénéficient d'un mois offert sur le mensuel. Sans abonnement, vous restez sur le plan Free.",
```

`src/pages/SupportGuidePage.jsx`, encore : remplacer `title: 'Trial gratuit',` par `title: 'Formules et mois offert',` (le titre de l'entrée réécrite ci-dessus), puis, dans l'entrée « Les recompenses », remplacer `30 jours gratuits a l'inscription sur n'importe quel plan payant. Cumulable avec les 7 jours de trial standard.` par `30 jours gratuits a l'inscription sur Starter ou Pro, en formule mensuelle.`

`src/pages/FaqPage.jsx` — remplacer :

```js
          q: "Comment fonctionne l'essai gratuit ?",
          a: "Le plan Free est gratuit à vie sans carte bancaire (50 tickets/mois, 1 workflow, intégration Shopify). Les plans Starter et Pro proposent 7 jours d'essai gratuit avec accès à toutes les fonctionnalités. Carte bancaire requise pour l'essai Starter/Pro mais aucun débit pendant les 7 jours — annulation en 1 clic sans justification.",
```

par :

```js
          q: "Peut-on essayer Actero gratuitement ?",
          a: "Oui, avec le plan Free : gratuit à vie, sans carte bancaire (50 tickets/mois, 1 workflow, intégration Shopify). Starter et Pro n'ont pas d'essai : la formule mensuelle est sans engagement et se résilie à tout moment. Les marchands parrainés ou venus d'une campagne ont leur premier mois offert.",
```

`docs/essentials/quickstart.mdx` — remplacer

```mdx
  Les essais Starter et Pro sont de 7 jours sans carte bancaire. Le plan Free reste gratuit à vie (50 tickets/mois).
```

par

```mdx
  Le plan Free reste gratuit à vie (50 tickets/mois), sans carte bancaire. Starter et Pro se prennent au mois (sans engagement), au trimestre ou à l'année.
```

`docs/essentials/facturation.mdx` — sept passages :

a. Remplacer

```mdx
- **Ton plan actuel** (Free / Starter / Pro / Entreprise) et un badge "Essai" si tu es en période d'essai
- **Le prix** actuel (€/mois ou €/an)
```

par

```mdx
- **Ton plan actuel** (Free / Starter / Pro / Entreprise) et un badge "Essai" pendant un mois offert
- **Le prix** de ta formule (par mois, par trimestre ou par an)
```

b. Remplacer

```mdx
### Si tu es en essai

Une bannière jaune affiche "Essai gratuit — J-X restants". Pendant l'essai, tu as accès à toutes les features de ton plan, sans carte bancaire.

À la fin de l'essai (7 jours par défaut), tu repasses automatiquement en plan Free si tu n'as pas saisi de moyen de paiement.
```

par

```mdx
### Si ton premier mois est offert

Starter et Pro n'ont pas d'essai gratuit. Si tu es arrivé par un parrainage ou une campagne, ton premier mois en formule mensuelle est offert : une bannière jaune affiche "Essai gratuit — J-X restants", et tu as accès à toutes les features de ton plan.

Ta carte est demandée dès le départ. Le premier prélèvement a lieu à la fin du mois offert ; tu peux annuler avant sans être débité.
```

c. Remplacer

```mdx
### Toggle Mensuel / Annuel

L'annuel donne **-20 %** sur le prix affiché. Tu paies une fois pour l'année, facturation immédiate.
```

par

```mdx
### Mensuel, trimestriel ou annuel

- **Mensuel** : sans engagement, payé chaque mois.
- **Trimestriel** : payé tous les 3 mois, avec **-50 % sur le premier mois** (premier trimestre à 247,50 € au lieu de 297 € sur Starter, 997,50 € au lieu de 1 197 € sur Pro).
- **Annuel** : **12 mois pour le prix de 11, à -10 %** (980,10 € par an sur Starter, 3 950,10 € sur Pro).

Si ta boutique passe par l'app Shopify, ton abonnement est facturé par Shopify, qui propose le mensuel et l'annuel.
```

d. Remplacer

```mdx
    Clique sur le bouton de la carte (ex : "Passer au Pro — Essai 7j gratuit").
```

par

```mdx
    Choisis ta formule, puis clique sur le bouton de la carte.
```

e. Remplacer

```mdx
    Saisis ta carte. Si c'est ton premier paiement Actero, l'essai de 7 jours démarre.
```

par

```mdx
    Saisis ta carte sur la page de paiement sécurisée de Stripe. Le paiement a lieu tout de suite, sauf si ton premier mois est offert.
```

f. Remplacer

```mdx
Si tu as déjà une carte enregistrée et que tu changes de plan sans changer ton mode de paiement, l'upgrade est instantané (pas de redirect Stripe). Le prorata est calculé automatiquement par Stripe.
```

par

```mdx
Si tu as déjà une carte enregistrée et que tu changes de plan dans la même formule, l'upgrade est instantané (pas de redirect Stripe). Le prorata est calculé automatiquement par Stripe. Pour changer de formule (par exemple passer du mensuel à l'annuel), écris à [support@actero.fr](mailto:support@actero.fr).
```

g. Remplacer

```mdx
## Référencement et 30 jours gratuits

Si tu es arrivé via un lien de parrainage, ton premier mois Starter ou Pro est offert pour 30 jours au lieu de 7. Le badge change : "Passer au Pro — 30 jours gratuits".
```

par

```mdx
## Parrainage et 30 jours gratuits

Si tu es arrivé via un lien de parrainage, ton premier mois Starter ou Pro est offert (30 jours) en formule mensuelle. Le bouton affiche alors "30 jours gratuits".
```

- [ ] **Step 5 : régénérer l'image de partage, puis lancer**

Run : `node scripts/generate-og-image.mjs && npx vitest run api/billing/paiement-heberge.test.js api/lib/promesses-tenues.test.js && npx eslint src/lib/plans.js src/components/ui src/components/landing src/components/alternative src/components/client/PortalSavView.jsx src/pages/PricingPage.jsx src/pages/SignupPage.jsx src/pages/SupportGuidePage.jsx src/pages/FaqPage.jsx src/pages/AlternativeGorgias.jsx src/pages/LandingPage.jsx scripts/prerender-routes.mjs`
Attendu : PASS, aucune erreur ; `public/og-image.png` a changé.

- [ ] **Step 6 : commit**

```bash
git add -A src scripts public docs/essentials api/billing/paiement-heberge.test.js
git commit -m "fix(tarifs): plus aucune page ni aucune doc ne promet un essai gratuit de 7 jours"
```

---

### Task 14 : supprimer le paiement intégré

**Files :**
- Delete : `src/components/billing/PaymentModal.jsx`, `src/lib/stripe-client.js`, `api/billing/create-subscription.js`, `api/billing/create-subscription.test.js`
- Modify : `package.json`, `package-lock.json`, `.env.example`, `src/lib/plans.js`, `api/lib/essai-gratuit.test.js`, `api/lib/conformite-app-store.test.js`, commentaires de `api/lib/essai-gratuit.js`, `api/lib/stripe-customer.js`, `api/lib/facturation-shopify.js`, `api/stripe-webhook.js`

- [ ] **Step 1 : ajouter la garde qui échoue**

Ajouter à `api/billing/paiement-heberge.test.js` (`existsSync` aux imports de `node:fs`) :

```js
describe('un seul chemin de paiement Stripe', () => {
  it('le formulaire intégré a disparu', () => {
    for (const f of ['src/components/billing/PaymentModal.jsx', 'src/lib/stripe-client.js', 'api/billing/create-subscription.js']) {
      expect(existsSync(f), `${f} existe encore`).toBe(false)
    }
  })

  it('plus personne ne l’importe ni ne l’appelle', () => {
    const fautifs = []
    for (const f of [...fichiersSource('src'), ...fichiersSource('api')]) {
      const src = sansCommentaires(readFileSync(f, 'utf8'))
      if (/PaymentModal|stripe-client|create-subscription|@stripe\/(react-)?stripe-js/.test(src)) fautifs.push(f)
    }
    expect(fautifs).toEqual([])
  })
})
```

Run → FAIL.

- [ ] **Step 2 : supprimer et désinstaller**

```bash
git rm src/components/billing/PaymentModal.jsx src/lib/stripe-client.js api/billing/create-subscription.js api/billing/create-subscription.test.js
npm uninstall @stripe/react-stripe-js @stripe/stripe-js
```

- [ ] **Step 3 : `.env.example`**

Supprimer la ligne `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...`. Remplacer les quatre lignes `STRIPE_PRICE_*=price_...` et le commentaire qui les précède par :

```
# Les prix Stripe ne se configurent plus ici : chaque formule est retrouvée par
# sa lookup_key (api/lib/formules.js). Admin → « Configurer Stripe » les crée.
```

- [ ] **Step 4 : retirer les anciens prix annuels de `src/lib/plans.js`**

Plus aucun écran ne lit `price.annual` (79 et 319 €, l'ancien annuel à −20 %). Remplacer `price: { monthly: 0, annual: 0 },` par `price: { monthly: 0 },`, `price: { monthly: 99, annual: 79 },` par `price: { monthly: 99 },`, `price: { monthly: 399, annual: 319 },` par `price: { monthly: 399 },` et `price: { monthly: null, annual: null }, // sur devis` par `price: { monthly: null }, // sur devis`.

Dans l'en-tête du fichier, remplacer

```js
 * NOTE: Stripe price_ids live on the server only (process.env.STRIPE_PRICE_*)
 * and are resolved by /api/billing/upgrade at upgrade time. We intentionally
 * do NOT expose them to the Vite bundle — no VITE_ duplication, no drift.
```

par

```js
 * NOTE: Stripe prices live on the server only — each formula is looked up by
 * its lookup_key (api/lib/formules.js) at checkout time. We intentionally do
 * NOT expose them to the Vite bundle — no VITE_ duplication, no drift.
```

Puis supprimer `getPlanHighlights` et sa docstring : plus personne ne l'importe depuis les Tasks 10 et 11.

```js
/**
 * Three honest, one-line selling points for a plan — derived from real limits,
 * so the payment recap never claims a feature that isn't live. Used by the
 * on-site payment modal.
 */
export function getPlanHighlights(planId) {
  const plan = getPlanConfig(planId)
  const tickets = plan.limits.tickets_per_month
  const workflows = plan.limits.workflows_active
  const supportLabel = {
    account_manager: 'Account manager dédié',
    priority_24h: 'Support prioritaire 24h',
    email_48h: 'Support email',
    docs: 'Documentation',
  }[plan.support] || 'Support'
  return [
    `${Number(tickets).toLocaleString('fr-FR')} tickets/mois`,
    workflows === Infinity || workflows < 0 ? 'Workflows illimités' : `${workflows} workflows`,
    supportLabel,
  ]
}
```

Vérifier : `grep -rn "price\??\.annual\|annual: 79\|annual: 319\|getPlanHighlights" src api --include='*.js' --include='*.jsx'` → aucune ligne.

- [ ] **Step 5 : mettre à jour les tests qui citaient l'ancien chemin**

`api/lib/conformite-app-store.test.js` : retirer `'api/billing/create-subscription.js',` de `ROUTES_STRIPE`, et renommer le test `'les trois routes Stripe refusent un client ayant une boutique Shopify'` en `'les routes Stripe refusent un client ayant une boutique Shopify'`.

`api/lib/essai-gratuit.test.js` :

a. `CHEMINS` devient :

```js
const CHEMINS = [
  'api/create-checkout-session.js',
  'api/billing/upgrade.js',
]
```

b. Dans les tests « les chemins qui lisent le drapeau de campagne le sélectionnent aussi » et « aucun chemin de paiement ne consomme le mois avant le paiement », remplacer `['api/billing/create-subscription.js', 'api/billing/upgrade.js']` par `['api/billing/upgrade.js']`.

c. Remplacer tout le test « l'écran de paiement annonce la durée que le SERVEUR a accordée » par :

```js
  it('la page Stripe affiche l’essai que le SERVEUR a accordé', () => {
    // Le formulaire intégré affichait « 7 jours » à un marchand qui en avait 30 :
    // il lisait la valeur commerciale de plans.js au lieu de la durée accordée.
    // Depuis le 14 septembre, le paiement se fait sur la page Stripe Checkout,
    // qui affiche exactement `trial_period_days` — posé depuis l'avantage
    // calculé par le serveur, et nulle part ailleurs.
    const params = sansCommentaires(readFileSync('api/lib/checkout-formule.js', 'utf8'))
    expect(params, 'la durée d’essai ne vient plus de l’avantage calculé')
      .toMatch(/trial_period_days = offre\.essaiJours/)
    expect(existsSync('src/components/billing/PaymentModal.jsx'),
      'le formulaire intégré, qui inventait sa propre durée, est revenu').toBe(false)
  })
```

d. Dans le test « l'email de fin d'essai ne promet pas un renouvellement qui n'aura pas lieu », remplacer le dernier paragraphe (depuis `// La prémisse.` jusqu'à `.toMatch(/missing_payment_method:\s*'cancel'/)`) par :

```js
    // La prémisse a changé le 14 septembre : la page Stripe demande toujours
    // la carte, mois offert compris. Les essais sans carte sont ceux créés
    // AVANT par l'ancien formulaire intégré — la branche « ajoutez une carte »
    // les sert.
    const params = sansCommentaires(readFileSync('api/lib/checkout-formule.js', 'utf8'))
    expect(params, 'un essai peut de nouveau démarrer sans carte : revoir l’email')
      .toMatch(/payment_method_collection:\s*'always'/)
```

e. Dans ce même test, remplacer le commentaire d'ouverture

```js
    // Ce que devient l'abonnement à la fin dépend d'UNE chose : la carte.
    // create-subscription.js pose `missing_payment_method: 'cancel'`, donc sans
    // moyen de paiement l'abonnement ne démarre pas — il s'annule.
```

par

```js
    // Ce que devient l'abonnement à la fin dépend d'UNE chose : la carte.
    // L'ancien create-subscription.js (supprimé le 14 septembre 2026) posait
    // `missing_payment_method: 'cancel'` : sans moyen de paiement, les essais
    // qu'il a créés ne démarrent pas — ils s'annulent.
```

- [ ] **Step 6 : commentaires qui citaient l'ancien chemin**

- `api/lib/essai-gratuit.js`, en-tête : remplacer la ligne `*   api/billing/create-subscription  30 jours si parrainage, sinon 7 jours` par :

```js
 *   api/billing/create-subscription  30 jours si parrainage, sinon 7 jours
 *                                    (supprimé le 14 septembre 2026)
```

- `api/lib/stripe-customer.js`, docstring de `resolveCustomerCard` : remplacer les deux lignes `*   - api/billing/create-subscription.js  décide d'échanger le plan ou de` / `*                                         redemander une carte` par :

```js
 *   - api/billing/upgrade.js              décide d'échanger le plan ou de
 *                                         repasser par la page Stripe
```

- `api/lib/facturation-shopify.js` : remplacer `` * `billing/upgrade`, `billing/create-subscription`, `create-checkout-session` — `` par `` * `billing/upgrade`, `create-checkout-session` (et `billing/create-subscription`, supprimé depuis) — ``.

- `api/stripe-webhook.js`, branche `trial_will_end` : remplacer

```js
          // api/billing/create-subscription.js pose
          // `trial_settings.end_behavior.missing_payment_method: 'cancel'`.
```

par

```js
          // L'ancien formulaire intégré (supprimé le 14 septembre 2026) posait
          // `trial_settings.end_behavior.missing_payment_method: 'cancel'`.
          // Les essais qu'il a créés existent encore ; la page Stripe, elle,
          // demande toujours la carte.
```

- [ ] **Step 7 : toute la suite, le lint et le build**

Run : `npx vitest run && npx eslint . && npm run build`
Attendu : tous les tests PASS, 0 erreur ESLint, build OK.

- [ ] **Step 8 : commit**

```bash
git add -A
git commit -m "refactor(facturation): un seul chemin de paiement, la page Stripe Checkout"
```

---

### Task 15 : vérification dans le navigateur

**Files :** aucun.

- [ ] **Step 1 : lancer le serveur de dev**

Outil `preview_start` avec `{ name: "site-web" }` (`.claude/launch.json`, port 5173).

- [ ] **Step 2 : page tarifs**

Ouvrir `/tarifs`. Vérifier :
- le sélecteur Mensuel / Trimestriel / Annuel, badges « −50 % le 1er mois » et « 1 mois offert » ;
- Mensuel : « 99 € /mois », sous-texte « ou 81,68 €/mois à l’année » ; aucun « Essai gratuit 7 jours » sur la page ;
- Trimestriel : Starter « 297 € /3 mois » et « 1er trimestre : 247,50 € » ; Pro « 1 197 € » et « 997,50 € » ;
- Annuel : Starter « 980,10 € /an » et « soit 81,68 € par mois » ; Pro « 3 950,10 € » et « 329,18 € » ;
- FAQ : « Proposez-vous des formules trimestrielles ou annuelles ? » et « Y a-t-il un engagement ? » ;
- aucune erreur dans la console (`read_console_messages`).

- [ ] **Step 3 : la formule suit le visiteur**

Sur `/tarifs`, choisir Annuel puis cliquer le bouton de Pro. Dans la console : `localStorage.getItem('actero_formule_choisie')` contient `"periode":"annuel"`. Ouvrir `/signup/plan` : Annuel est présélectionné. Ouvrir `/signup/plan?formule=trimestriel` : Trimestriel l'est.

- [ ] **Step 4 : capture**

`computer { action: "screenshot" }` de `/tarifs` en Annuel, jointe au compte rendu.

---

## Ce qui reste à Pablo après le déploiement

1. Admin → Configuration Stripe → « Configurer Stripe » (mode live) : six prix, deux coupons, anciens annuels désactivés.
2. Stripe → Portail client : ajouter les nouveaux prix si « changer de formule » est activé, sinon le désactiver.
3. Vercel : retirer `VITE_STRIPE_PUBLISHABLE_KEY` et les quatre `STRIPE_PRICE_*`.
4. Shopify Partner Dashboard : annuel à 980,10 € et 3 950,10 €, et 0 jour d'essai sur les plans.
5. Un paiement de test par formule en mode test Stripe avant d'annoncer les formules.
