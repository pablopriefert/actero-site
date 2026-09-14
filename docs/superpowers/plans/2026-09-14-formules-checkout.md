# Formules trimestrielle et annuelle 13 mois, Checkout Stripe hébergé — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** vendre Starter et Pro au mois, au trimestre (−50 % sur le premier mois) et à l'année (−10 %, 13 mois à chaque renouvellement), uniquement par la page Stripe Checkout hébergée.

**Architecture :** un catalogue pur (`api/lib/formules.js`) décrit les six formules et leurs clés Stripe (`lookup_key`) ; il est importé par le serveur (route de paiement, webhook, MRR, configuration Stripe) et par le front (affichage des prix). L'offre de bienvenue et les paramètres de la session Checkout sont deux fonctions pures testées sans Stripe. Le formulaire de paiement intégré (Payment Element) est supprimé.

**Tech stack :** Vercel serverless (Node, ESM), Stripe SDK v20, Supabase, React + Vite, Vitest (environnement node ; `// @vitest-environment jsdom` au besoin), ESLint.

**Spec :** `docs/superpowers/specs/2026-09-14-formules-trimestrielle-annuelle-checkout-design.md`

**Règles du dépôt à respecter :**
- Les fichiers de `api/` hors `api/lib/` deviennent des fonctions Vercel : les helpers vont dans `api/lib/`.
- Chemins d'API en ASCII (garde `src/config/routes-integrations.test.js`).
- Les gardes de source retirent les commentaires avant d'analyser (`sansCommentaires`).
- Commentaires et messages en français, qui disent *pourquoi*.
- Commit après chaque tâche, message en français, terminé par `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. **Ne pas pousser** : le push se fait à la fin, sur décision de Pablo.

---

## Carte des fichiers

| Fichier | Rôle | Action |
|---|---|---|
| `api/lib/formules.js` | Catalogue des six formules, conversions de période, mensualité d'un prix Stripe | Créer |
| `api/lib/formules-stripe.js` | Deux lectures Stripe : prix d'une formule, « déjà abonné ? » | Créer |
| `api/lib/checkout-formule.js` | Paramètres purs de la session Checkout | Créer |
| `api/lib/configuration-stripe.js` | Crée ou retrouve prix, clés et coupons (idempotent) | Créer |
| `api/lib/essai-gratuit.js` | + `offreDeBienvenue()` | Modifier |
| `api/lib/subscription-plan.js` | Plan déduit de la clé du prix + carte | Modifier |
| `api/billing/upgrade.js` | Seule route de paiement Stripe self-serve | Réécrire |
| `api/stripe-webhook.js` | Branchement du nouveau `planUpdateFromSubscription`, période écrite | Modifier |
| `api/stripe-billing.js` | MRR normalisé par la durée de la période | Modifier |
| `api/admin/setup-stripe-products.js` | Appelle `configurerFormules` | Réécrire |
| `api/admin/stripe-status.js` | État des six prix et deux coupons | Réécrire |
| `src/lib/affichage-formules.js` | Montants affichés, mémorisation de la formule choisie | Créer |
| `src/components/billing/SelecteurFormule.jsx` | Sélecteur Mensuel / Trimestriel / Annuel | Créer |
| `src/pages/PricingPage.jsx` | Sélecteur, prix, FAQ | Modifier |
| `src/pages/PlanSelectionPage.jsx` | Formule reçue, prix, Checkout seul | Modifier |
| `src/components/client/ClientBillingView.jsx` | Sélecteur, prix, Checkout seul | Modifier |
| `src/components/admin/AdminStripeSetupView.jsx` | Écran de configuration des formules | Réécrire |
| `src/components/admin/AdminBillingView.jsx` | Libellé de période | Modifier |
| `src/components/landing/PricingA.jsx`, `src/pages/FaqPage.jsx` | Textes « −20 % » | Modifier |
| `src/components/billing/PaymentModal.jsx`, `src/lib/stripe-client.js`, `api/billing/create-subscription.js`, `api/billing/create-subscription.test.js` | Paiement intégré | Supprimer |
| `api/lib/essai-gratuit.test.js`, `api/lib/conformite-app-store.test.js`, `api/lib/subscription-plan.test.js` | Tests existants qui citent l'ancien chemin | Modifier |
| `api/billing/paiement-heberge.test.js` | Gardes de source du chantier | Créer |

---

### Task 1 : le catalogue des formules

**Files :**
- Create : `api/lib/formules.js`
- Test : `api/lib/formules.test.js`

- [ ] **Step 1 : écrire le test qui échoue**

`api/lib/formules.test.js` :

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  FORMULES, PERIODES, PERIODE_API, PERIODE_DEPUIS_API,
  formulePour, formuleDuPrix, mensualiteCentimes, premierPaiementCentimes, libellePeriodeStripe,
} from './formules.js'
import { PLANS } from '../../src/lib/plans.js'

/**
 * Le catalogue est la seule définition des formules payantes.
 *
 * Il remplace quatre variables d'environnement STRIPE_PRICE_* qu'il fallait
 * copier à la main dans Vercel, et plusieurs lectures de `recurring.interval`
 * qui confondaient « facturé au mois » et « un mois de service » : un prix
 * « tous les 13 mois » a lui aussi `interval: 'month'`.
 */
describe('le catalogue des formules', () => {
  it('six formules payantes : deux plans, trois périodes', () => {
    expect(FORMULES).toHaveLength(6)
    for (const plan of ['starter', 'pro']) {
      for (const periode of PERIODES) {
        expect(formulePour(plan, periode), `${plan} ${periode}`).not.toBeNull()
      }
    }
    expect(formulePour('enterprise', 'mensuel')).toBeNull()
  })

  it('le mensuel est le prix affiché des plans', () => {
    expect(formulePour('starter', 'mensuel').montantCentimes).toBe(PLANS.starter.price.monthly * 100)
    expect(formulePour('pro', 'mensuel').montantCentimes).toBe(PLANS.pro.price.monthly * 100)
  })

  it('le trimestriel vaut trois mensualités, et son coupon la moitié d’une', () => {
    for (const plan of ['starter', 'pro']) {
      const mensuel = formulePour(plan, 'mensuel').montantCentimes
      const trimestriel = formulePour(plan, 'trimestriel')
      expect(trimestriel.montantCentimes).toBe(3 * mensuel)
      expect(trimestriel.recurring).toEqual({ interval: 'month', interval_count: 3 })
      expect(trimestriel.coupon.montantCentimes).toBe(mensuel / 2)
    }
  })

  it('l’annuel vaut douze mensualités moins 10 %, facturées tous les 13 mois', () => {
    for (const plan of ['starter', 'pro']) {
      const mensuel = formulePour(plan, 'mensuel').montantCentimes
      const annuel = formulePour(plan, 'annuel')
      expect(annuel.montantCentimes).toBe(Math.round(12 * mensuel * 0.9))
      expect(annuel.recurring).toEqual({ interval: 'month', interval_count: 13 })
      expect(annuel.mois).toBe(13)
      expect(annuel.coupon).toBeUndefined()
    }
  })

  it('les montants validés par Pablo le 14 septembre', () => {
    expect(premierPaiementCentimes(formulePour('starter', 'trimestriel'))).toBe(24750)
    expect(premierPaiementCentimes(formulePour('pro', 'trimestriel'))).toBe(99750)
    expect(formulePour('starter', 'annuel').montantCentimes).toBe(106920)
    expect(formulePour('pro', 'annuel').montantCentimes).toBe(430920)
    expect(premierPaiementCentimes(formulePour('pro', 'mensuel'))).toBe(39900)
  })

  it('clés de recherche et identifiants de coupon sont uniques', () => {
    const cles = FORMULES.map((f) => f.lookupKey)
    expect(new Set(cles).size).toBe(cles.length)
    const coupons = FORMULES.filter((f) => f.coupon).map((f) => f.coupon.id)
    expect(new Set(coupons).size).toBe(2)
  })

  it('un prix Stripe retrouve sa formule par sa clé, et seulement par elle', () => {
    expect(formuleDuPrix({ id: 'price_x', lookup_key: 'actero_pro_trimestriel' }))
      .toMatchObject({ plan: 'pro', periode: 'trimestriel' })
    expect(formuleDuPrix({ id: 'price_sur_mesure', lookup_key: null })).toBeNull()
    expect(formuleDuPrix({ lookup_key: 'autre_chose' })).toBeNull()
    expect(formuleDuPrix(null)).toBeNull()
  })

  it('la mensualité d’un prix Stripe tient compte du nombre de mois', () => {
    expect(mensualiteCentimes({ unit_amount: 9900, recurring: { interval: 'month', interval_count: 1 } })).toBe(9900)
    expect(mensualiteCentimes({ unit_amount: 29700, recurring: { interval: 'month', interval_count: 3 } })).toBe(9900)
    expect(mensualiteCentimes({ unit_amount: 106920, recurring: { interval: 'month', interval_count: 13 } })).toBe(8225)
    expect(mensualiteCentimes({ unit_amount: 94800, recurring: { interval: 'year', interval_count: 1 } })).toBe(7900)
    expect(mensualiteCentimes({ unit_amount: 500, recurring: { interval: 'week', interval_count: 1 } })).toBe(0)
    expect(mensualiteCentimes({ unit_amount: null, recurring: { interval: 'month' } })).toBe(0)
  })

  it('un libellé de période lisible', () => {
    expect(libellePeriodeStripe({ interval: 'month', interval_count: 1 })).toBe('mois')
    expect(libellePeriodeStripe({ interval: 'month', interval_count: 3 })).toBe('3 mois')
    expect(libellePeriodeStripe({ interval: 'month', interval_count: 13 })).toBe('13 mois')
    expect(libellePeriodeStripe({ interval: 'year', interval_count: 1 })).toBe('an')
  })

  it('périodes de l’API (anglais, historique) ↔ périodes du catalogue', () => {
    expect(PERIODE_API).toEqual({ mensuel: 'monthly', trimestriel: 'quarterly', annuel: 'annual' })
    expect(PERIODE_DEPUIS_API).toEqual({ monthly: 'mensuel', quarterly: 'trimestriel', annual: 'annuel' })
  })

  it('le catalogue reste importable par le navigateur', () => {
    // La page tarifs et la facturation l'importent : aucune dépendance Node.
    const src = readFileSync('api/lib/formules.js', 'utf8')
    expect(src).not.toMatch(/from ['"](node:|stripe|@supabase)/)
  })
})
```

- [ ] **Step 2 : lancer le test, vérifier qu'il échoue**

Run : `npx vitest run api/lib/formules.test.js`
Attendu : FAIL — `Failed to resolve import "./formules.js"`.

- [ ] **Step 3 : écrire le catalogue**

`api/lib/formules.js` :

```js
// @ts-check
/**
 * Les formules payantes d'Actero — une seule définition.
 *
 * Décision du 14 septembre 2026 (spec 2026-09-14-formules-trimestrielle-
 * annuelle-checkout-design.md) :
 *
 *   mensuel      99 / 399 € par mois
 *   trimestriel  3 mensualités tous les 3 mois, −50 % sur le premier mois
 *                (un coupon Stripe au montant exact, appliqué une fois)
 *   annuel       12 mensualités −10 %, facturées TOUS LES 13 MOIS : 13 mois
 *                d'accès à chaque renouvellement
 *
 * Chaque prix Stripe porte une `lookup_key` : c'est par elle que le serveur
 * retrouve un prix, et que le webhook retrouve le plan d'un abonnement. Plus de
 * variables STRIPE_PRICE_* à copier dans Vercel — une étape manuelle est une
 * étape qu'on finit par rater.
 *
 * Ce fichier est importé par le navigateur (affichage des prix) : aucune
 * dépendance Node ici.
 */

/**
 * @typedef {'mensuel'|'trimestriel'|'annuel'} Periode
 * @typedef {{
 *   plan: 'starter'|'pro',
 *   periode: Periode,
 *   lookupKey: string,
 *   montantCentimes: number,
 *   recurring: { interval: 'month', interval_count: number },
 *   mois: number,
 *   coupon?: { id: string, montantCentimes: number },
 * }} Formule
 */

/** @type {Periode[]} */
export const PERIODES = ['mensuel', 'trimestriel', 'annuel']

/** `billing_period` de l'API et de la base garde ses valeurs anglaises historiques. */
export const PERIODE_API = { mensuel: 'monthly', trimestriel: 'quarterly', annuel: 'annual' }

export const PERIODE_DEPUIS_API = { monthly: 'mensuel', quarterly: 'trimestriel', annual: 'annuel' }

/** @type {Formule[]} */
export const FORMULES = [
  { plan: 'starter', periode: 'mensuel', lookupKey: 'actero_starter_mensuel', montantCentimes: 9900, recurring: { interval: 'month', interval_count: 1 }, mois: 1 },
  { plan: 'starter', periode: 'trimestriel', lookupKey: 'actero_starter_trimestriel', montantCentimes: 29700, recurring: { interval: 'month', interval_count: 3 }, mois: 3, coupon: { id: 'actero-trimestriel-starter', montantCentimes: 4950 } },
  { plan: 'starter', periode: 'annuel', lookupKey: 'actero_starter_annuel', montantCentimes: 106920, recurring: { interval: 'month', interval_count: 13 }, mois: 13 },
  { plan: 'pro', periode: 'mensuel', lookupKey: 'actero_pro_mensuel', montantCentimes: 39900, recurring: { interval: 'month', interval_count: 1 }, mois: 1 },
  { plan: 'pro', periode: 'trimestriel', lookupKey: 'actero_pro_trimestriel', montantCentimes: 119700, recurring: { interval: 'month', interval_count: 3 }, mois: 3, coupon: { id: 'actero-trimestriel-pro', montantCentimes: 19950 } },
  { plan: 'pro', periode: 'annuel', lookupKey: 'actero_pro_annuel', montantCentimes: 430920, recurring: { interval: 'month', interval_count: 13 }, mois: 13 },
]

/**
 * @param {string} plan
 * @param {string} periode
 * @returns {Formule|null}
 */
export function formulePour(plan, periode) {
  return FORMULES.find((f) => f.plan === plan && f.periode === periode) || null
}

/**
 * La formule d'un prix Stripe, par sa `lookup_key`. Un prix sans clé connue
 * (tarif sur mesure, ancien prix) n'est rattaché à aucune formule.
 *
 * @param {any} price — objet Price de Stripe
 * @returns {Formule|null}
 */
export function formuleDuPrix(price) {
  const cle = price?.lookup_key
  if (!cle) return null
  return FORMULES.find((f) => f.lookupKey === cle) || null
}

/**
 * Combien de mois couvre une période Stripe. `null` pour ce qu'Actero ne vend
 * pas (jour, semaine).
 *
 * @param {any} recurring
 * @returns {number|null}
 */
function moisDeLaPeriode(recurring) {
  if (!recurring) return null
  const n = recurring.interval_count || 1
  if (recurring.interval === 'month') return n
  if (recurring.interval === 'year') return 12 * n
  return null
}

/**
 * Le montant mensuel d'un prix Stripe, en centimes — pour le MRR.
 *
 * `interval === 'month'` ne veut PAS dire « un mois » : le trimestriel et
 * l'annuel 13 mois sont eux aussi facturés « au mois ». Lire l'intervalle seul
 * comptait 1 069,20 € de MRR pour un client qui en rapporte 82,25.
 *
 * @param {any} price
 * @returns {number}
 */
export function mensualiteCentimes(price) {
  const mois = moisDeLaPeriode(price?.recurring)
  if (!mois || typeof price?.unit_amount !== 'number') return 0
  return Math.round(price.unit_amount / mois)
}

/**
 * Ce que le client paie au premier passage en caisse, coupon déduit.
 *
 * @param {Formule} formule
 * @returns {number}
 */
export function premierPaiementCentimes(formule) {
  return formule.montantCentimes - (formule.coupon?.montantCentimes || 0)
}

/**
 * « mois », « 3 mois », « 13 mois », « an » — pour l'admin.
 *
 * @param {any} recurring
 * @returns {string}
 */
export function libellePeriodeStripe(recurring) {
  const n = recurring?.interval_count || 1
  if (recurring?.interval === 'year') return n === 1 ? 'an' : `${n} ans`
  if (recurring?.interval === 'month') return n === 1 ? 'mois' : `${n} mois`
  return recurring?.interval || 'période inconnue'
}
```

- [ ] **Step 4 : lancer le test, vérifier qu'il passe**

Run : `npx vitest run api/lib/formules.test.js`
Attendu : PASS (11 tests).

- [ ] **Step 5 : commit**

```bash
git add api/lib/formules.js api/lib/formules.test.js
git commit -m "feat(facturation): un catalogue unique des six formules payantes

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2 : l'offre de bienvenue

**Files :**
- Modify : `api/lib/essai-gratuit.js` (ajout en fin de fichier)
- Test : `api/lib/essai-gratuit.test.js` (nouveau `describe` en fin de fichier)

- [ ] **Step 1 : écrire le test qui échoue**

Dans `api/lib/essai-gratuit.test.js`, remplacer la ligne d'import 3 par :

```js
import { joursEssaiPour, offreDeBienvenue, ESSAI_STANDARD_JOURS, ESSAI_PARRAINAGE_JOURS, ESSAI_CAMPAGNE_JOURS } from './essai-gratuit.js'
```

et ajouter en fin de fichier :

```js
describe('offre de bienvenue — une seule par client, selon la formule', () => {
  // Décision du 14 septembre : l'essai (mensuel) et le −50 % (trimestriel) ne
  // s'obtiennent qu'une fois. Sans ça, résilier puis se réabonner redonne −50 %
  // à chaque trimestre — la fuite du mois gratuit, sous une autre forme.

  it('mensuel : l’essai, selon les règles actuelles', () => {
    expect(offreDeBienvenue({ client: {}, periode: 'mensuel', dejaAbonne: false }))
      .toEqual({ essaiJours: ESSAI_STANDARD_JOURS })
    expect(offreDeBienvenue({ client: { campaign_first_month_free: true }, periode: 'mensuel', dejaAbonne: false }))
      .toEqual({ essaiJours: ESSAI_CAMPAGNE_JOURS })
    expect(offreDeBienvenue({ client: { referral_first_month_free: true }, periode: 'mensuel', dejaAbonne: false }))
      .toEqual({ essaiJours: ESSAI_PARRAINAGE_JOURS })
  })

  it('trimestriel : le coupon du premier mois, jamais d’essai', () => {
    expect(offreDeBienvenue({ client: {}, periode: 'trimestriel', dejaAbonne: false })).toEqual({ coupon: true })
  })

  it('annuel : rien, le 13e mois est dans le prix', () => {
    expect(offreDeBienvenue({ client: { campaign_first_month_free: true }, periode: 'annuel', dejaAbonne: false })).toEqual({})
  })

  it('le mois offert (campagne, parrainage) ne concerne que le mensuel', () => {
    expect(offreDeBienvenue({ client: { referral_first_month_free: true }, periode: 'trimestriel', dejaAbonne: false }))
      .toEqual({ coupon: true })
  })

  it('un client déjà abonné, même sans jamais avoir eu d’essai, n’a plus d’offre', () => {
    for (const periode of ['mensuel', 'trimestriel', 'annuel']) {
      expect(offreDeBienvenue({ client: {}, periode, dejaAbonne: true }), periode).toEqual({})
    }
  })

  it('un essai déjà pris ferme aussi le coupon', () => {
    expect(offreDeBienvenue({ client: { trial_ends_at: '2026-01-01T00:00:00Z' }, periode: 'trimestriel', dejaAbonne: false }))
      .toEqual({})
  })

  it('« déjà abonné ? » inconnu ne vaut jamais « jamais abonné »', () => {
    // Une erreur Stripe ne doit pas ouvrir une offre : la route répond une
    // erreur et le marchand réessaie.
    expect(() => offreDeBienvenue({ client: {}, periode: 'mensuel', dejaAbonne: undefined })).toThrow()
  })
})
```

- [ ] **Step 2 : lancer le test, vérifier qu'il échoue**

Run : `npx vitest run api/lib/essai-gratuit.test.js`
Attendu : FAIL — `offreDeBienvenue is not a function`.

- [ ] **Step 3 : implémenter**

Ajouter en fin de `api/lib/essai-gratuit.js` :

```js
/**
 * L'offre de bienvenue de ce client pour cette formule — une seule, à vie.
 *
 * Décision du 14 septembre 2026 :
 *   mensuel      l'essai (7 jours, 30 si parrainage ou campagne) — règles de
 *                `joursEssaiPour`, inchangées
 *   trimestriel  −50 % sur le premier mois (coupon de la formule)
 *   annuel       rien : le 13e mois est dans le prix, à chaque renouvellement
 *
 * Un client qui a déjà eu un abonnement Stripe, quel qu'il soit, n'en retrouve
 * aucune. `dejaAbonne` est lu chez Stripe par la route ; s'il est inconnu, on
 * lève plutôt que d'accorder une offre sur un « je ne sais pas ».
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

- [ ] **Step 4 : lancer le test, vérifier qu'il passe**

Run : `npx vitest run api/lib/essai-gratuit.test.js`
Attendu : PASS (les tests existants restent verts).

- [ ] **Step 5 : commit**

```bash
git add api/lib/essai-gratuit.js api/lib/essai-gratuit.test.js
git commit -m "feat(facturation): une seule offre de bienvenue par client, selon la formule

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3 : le plan d'un abonnement se lit dans le catalogue

**Files :**
- Modify : `api/lib/subscription-plan.js` (réécriture)
- Modify : `api/stripe-webhook.js` (imports ; branche `checkout.session.completed` upgrade ; `customer.subscription.updated`)
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

  it('un prix trimestriel et un prix 13 mois donnent leur plan, sans variable d’environnement', () => {
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
})
```

- [ ] **Step 2 : lancer le test, vérifier qu'il échoue**

Run : `npx vitest run api/lib/subscription-plan.test.js`
Attendu : FAIL (plan `undefined` pour les prix trimestriel/13 mois, `STRIPE_PRICE_` encore présent dans le webhook).

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
 *   variables STRIPE_PRICE_* : un prix trimestriel ou 13 mois n'y figurait
 *   pas, et le client payait sans jamais obtenir son plan.
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
```

- [ ] **Step 5 : lancer les tests**

Run : `npx vitest run api/lib/subscription-plan.test.js api/lib/statut-client.test.js`
Attendu : PASS.

- [ ] **Step 6 : commit**

```bash
git add api/lib/subscription-plan.js api/lib/subscription-plan.test.js api/stripe-webhook.js
git commit -m "fix(facturation): le webhook retrouve le plan de toutes les formules, et la carte où qu'elle soit

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

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
  clientId: 'c1', customerId: 'cus_1', priceId: 'price_1', planActuel: 'free',
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

  it('mensuel éligible : l’essai, pas de remise, le champ code promo ouvert', () => {
    const p = params('starter', 'mensuel', { offre: { essaiJours: 7 } })
    expect(p.subscription_data.trial_period_days).toBe(7)
    expect(p.discounts).toBeUndefined()
    expect(p.allow_promotion_codes).toBe(true)
  })

  it('trimestriel éligible : le coupon du plan, aucun essai', () => {
    const p = params('pro', 'trimestriel', { offre: { coupon: true } })
    expect(p.discounts).toEqual([{ coupon: 'actero-trimestriel-pro' }])
    expect(p.subscription_data.trial_period_days).toBeUndefined()
    expect(p.allow_promotion_codes).toBeUndefined()
  })

  it('annuel : ni essai ni remise', () => {
    const p = params('starter', 'annuel')
    expect(p.subscription_data.trial_period_days).toBeUndefined()
    expect(p.discounts).toBeUndefined()
  })

  it('un code promo remplace le coupon du trimestriel', () => {
    const p = params('starter', 'trimestriel', { offre: { coupon: true }, promotionCodeId: 'promo_1' })
    expect(p.discounts).toEqual([{ promotion_code: 'promo_1' }])
  })

  it('discounts et allow_promotion_codes ne coexistent jamais', () => {
    for (const periode of ['mensuel', 'trimestriel', 'annuel']) {
      for (const offre of [{}, { essaiJours: 7 }, { coupon: true }]) {
        for (const promotionCodeId of [null, 'promo_1']) {
          const p = params('pro', periode, { offre, promotionCodeId })
          expect(!!p.discounts && !!p.allow_promotion_codes, `${periode} ${JSON.stringify(offre)} ${promotionCodeId}`).toBe(false)
        }
      }
    }
  })

  it('la carte est demandée, même pendant l’essai', () => {
    expect(params('pro', 'mensuel', { offre: { essaiJours: 7 } }).payment_method_collection).toBe('always')
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
    const list = vi.fn(async () => ({ data: [{ id: 'price_pa', lookup_key: 'actero_pro_annuel' }] }))
    const prix = await prixDeLaFormule({ prices: { list } }, formulePour('pro', 'annuel'))
    expect(prix.id).toBe('price_pa')
    expect(list).toHaveBeenCalledWith({ lookup_keys: ['actero_pro_annuel'], active: true, limit: 1 })
  })

  it('renvoie null quand le prix n’existe pas', async () => {
    const stripe = { prices: { list: async () => ({ data: [] }) } }
    expect(await prixDeLaFormule(stripe, formulePour('starter', 'mensuel'))).toBeNull()
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

- [ ] **Step 2 : lancer les tests, vérifier qu'ils échouent**

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
 *   customerId: string,
 *   priceId: string,
 *   formule: import('./formules.js').Formule,
 *   offre: { essaiJours?: number, coupon?: boolean },
 *   promotionCodeId?: string|null,
 *   planActuel: string,
 *   parrainage?: { parrainId: string, code?: string|null } | null,
 *   promoCode?: string|null,
 *   siteUrl: string,
 * }} p
 */
export function parametresCheckout(p) {
  const { clientId, customerId, priceId, formule, offre, promotionCodeId, planActuel, parrainage, promoCode, siteUrl } = p
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
    : (offre.coupon && formule.coupon ? { coupon: formule.coupon.id } : null)

  return {
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: subscriptionData,
    ...(remise ? { discounts: [remise] } : { allow_promotion_codes: true }),
    // La carte est demandée même pendant l'essai : plus d'abonnement d'essai
    // sans moyen de paiement.
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

/**
 * Le prix Stripe actif d'une formule, retrouvé par sa `lookup_key`.
 *
 * @param {any} stripe
 * @param {import('./formules.js').Formule} formule
 * @returns {Promise<any|null>}
 */
export async function prixDeLaFormule(stripe, formule) {
  const { data } = await stripe.prices.list({ lookup_keys: [formule.lookupKey], active: true, limit: 1 })
  return data?.[0] || null
}

/**
 * Ce client Stripe a-t-il déjà eu un abonnement, quel qu'en soit le statut ?
 * Une erreur Stripe remonte : elle ne doit jamais valoir « jamais abonné »,
 * sinon une panne accorderait une offre de bienvenue.
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

- [ ] **Step 4 : lancer les tests, vérifier qu'ils passent**

Run : `npx vitest run api/lib/checkout-formule.test.js api/lib/formules-stripe.test.js`
Attendu : PASS.

- [ ] **Step 5 : commit**

```bash
git add api/lib/checkout-formule.js api/lib/checkout-formule.test.js api/lib/formules-stripe.js api/lib/formules-stripe.test.js
git commit -m "feat(facturation): les paramètres de la page Stripe Checkout, en une fonction pure

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
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
}))

vi.mock('../lib/sentry.js', () => ({ withSentry: (fn) => fn, captureError: () => {} }))
vi.mock('../lib/admin-auth.js', () => ({ isActeroAdmin: () => Promise.resolve(false) }))
vi.mock('../lib/facturation-shopify.js', () => ({ refuserFacturationStripe: async () => false }))

vi.mock('@supabase/supabase-js', () => {
  function builder(table) {
    const b = {
      select: () => b, eq: () => b, not: () => b, limit: () => b,
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
      list: vi.fn(async ({ lookup_keys }) => ({ data: [{ id: `price_${lookup_keys[0]}`, lookup_key: lookup_keys[0] }] })),
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
    contact_email: 'u@ex.com', brand_name: 'Shop', trial_ends_at: null,
    referral_first_month_free: false, campaign_first_month_free: false, referred_by_client_id: null,
  }
  h.existingSub = null
  h.customerCards = []
  h.previousSubs = []
  h.ecrituresClients = []
  h.stripe = baseStripe()
})

const post = (b) => ({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { client_id: 'c1', target_plan: 'starter', billing_period: 'monthly', ...b } })

describe('POST /api/billing/upgrade', () => {
  it('refuse une période inconnue', async () => {
    const res = makeRes()
    await handler(post({ billing_period: 'weekly' }), res)
    expect(res.statusCode).toBe(400)
  })

  it('trimestriel pour un nouveau client : page Stripe avec le coupon du plan', async () => {
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'quarterly' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.checkout_url).toContain('checkout.stripe.com')
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(params.line_items[0].price).toBe('price_actero_pro_trimestriel')
    expect(params.discounts).toEqual([{ coupon: 'actero-trimestriel-pro' }])
    expect(params.subscription_data.metadata.client_id).toBe('c1')
    expect(params.subscription_data.trial_period_days).toBeUndefined()
  })

  it('un client déjà abonné par le passé n’a plus d’offre', async () => {
    h.previousSubs = [{ id: 'sub_ancien', status: 'canceled' }]
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'quarterly' }), res)
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(params.discounts).toBeUndefined()
    expect(params.allow_promotion_codes).toBe(true)
  })

  it('Stripe indisponible pour « déjà abonné ? » : erreur, jamais d’offre', async () => {
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

- [ ] **Step 2 : lancer le test, vérifier qu'il échoue**

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
import { formulePour, formuleDuPrix, PERIODE_DEPUIS_API } from '../lib/formules.js';
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

  const periode = PERIODE_DEPUIS_API[billing_period];
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
      .select('id, plan, stripe_customer_id, stripe_subscription_id, contact_email, brand_name, trial_ends_at, referral_first_month_free, campaign_first_month_free, referred_by_client_id')
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

        const carte = await resolveCustomerCard(stripe, subscription, stripeCustomerId);
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

    // --- Offre de bienvenue : une seule par client ---
    let dejaAbonne;
    try {
      dejaAbonne = await aDejaEuUnAbonnement(stripe, stripeCustomerId);
    } catch (err) {
      console.error('[billing/upgrade] lecture des abonnements passés impossible :', err.message);
      return res.status(503).json({ error: 'Paiement indisponible pour le moment, réessayez dans un instant.' });
    }
    const offre = offreDeBienvenue({ client, periode, dejaAbonne });

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

    const session = await stripe.checkout.sessions.create(parametresCheckout({
      clientId: client_id,
      customerId: stripeCustomerId,
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
    // 10 septembre). Ce qui empêche un second essai est ailleurs : l'offre de
    // bienvenue refuse tout client déjà abonné ou ayant eu un essai.

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

- [ ] **Step 5 : lancer les tests**

Run : `npx vitest run api/billing/upgrade.test.js api/lib/essai-gratuit.test.js api/lib/conformite-app-store.test.js`
Attendu : PASS.

- [ ] **Step 6 : commit**

```bash
git add api/billing/upgrade.js api/billing/upgrade.test.js api/lib/essai-gratuit.test.js
git commit -m "feat(facturation): la route de paiement vend les trois formules et laisse le webhook accorder le plan

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6 : un MRR juste dans l'admin

**Files :**
- Modify : `api/stripe-billing.js`
- Modify : `src/components/admin/AdminBillingView.jsx:136`
- Test : `api/lib/formules.test.js` (couvre `mensualiteCentimes`) + garde dans `api/billing/paiement-heberge.test.js`

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
    // `interval === 'month'` comptait un annuel 13 mois comme 1 069,20 € de MRR.
    const src = sansCommentaires(readFileSync('api/stripe-billing.js', 'utf8'))
    expect(src).not.toMatch(/interval === 'month'\) return/)
    expect(src).toMatch(/mensualiteCentimes\(/)
  })
})
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run : `npx vitest run api/billing/paiement-heberge.test.js`
Attendu : FAIL.

- [ ] **Step 3 : implémenter**

Dans `api/stripe-billing.js` :

1. Après `import { requireAdmin } from './lib/admin-auth.js';`, ajouter :

```js
import { mensualiteCentimes, libellePeriodeStripe } from './lib/formules.js';
```

2. Remplacer le calcul du MRR :

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
    // Mensualité = montant ÷ mois de la période : un trimestriel et un annuel
    // 13 mois sont eux aussi « au mois » pour Stripe.
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

- [ ] **Step 4 : lancer les tests**

Run : `npx vitest run api/billing/paiement-heberge.test.js api/lib/formules.test.js`
Attendu : PASS.

- [ ] **Step 5 : commit**

```bash
git add api/stripe-billing.js src/components/admin/AdminBillingView.jsx api/billing/paiement-heberge.test.js
git commit -m "fix(admin): le MRR divise par la vraie durée de la période

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7 : configurer Stripe depuis l'admin

**Files :**
- Create : `api/lib/configuration-stripe.js`
- Test : `api/lib/configuration-stripe.test.js`
- Modify : `api/admin/setup-stripe-products.js`, `api/admin/stripe-status.js` (réécritures)
- Modify : `src/components/admin/AdminStripeSetupView.jsx` (réécriture)

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
      create: async (d) => { const p = { id: id('price'), active: true, currency: 'eur', ...d, unit_amount: d.unit_amount }; etat.prix.push(p); etat.appels.push(['prices.create', d]); return p },
      update: async (pid, d) => { const p = etat.prix.find((x) => x.id === pid); Object.assign(p, d); etat.appels.push(['prices.update', pid, d]); return p },
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
    expect(e.coupons.map((c) => c.id).sort()).toEqual(['actero-trimestriel-pro', 'actero-trimestriel-starter'])
    const coupon = e.coupons.find((c) => c.id === 'actero-trimestriel-pro')
    expect(coupon).toMatchObject({ amount_off: 19950, currency: 'eur', duration: 'once' })
    expect(r.formules.every((x) => x.action === 'cree')).toBe(true)
  })

  it('reprend les anciens prix mensuels sans en créer de doublons, et désactive les anciens annuels', async () => {
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

  it('deuxième passage : rien n’est créé', async () => {
    const e = faux()
    await configurerFormules(e.stripe)
    const avant = e.appels.length
    const r = await configurerFormules(e.stripe)
    expect(e.appels.slice(avant).filter(([nom]) => nom.endsWith('.create'))).toEqual([])
    expect(r.formules.every((x) => x.action === 'existant')).toBe(true)
  })
})
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run : `npx vitest run api/lib/configuration-stripe.test.js`
Attendu : FAIL — import introuvable.

- [ ] **Step 3 : implémenter `api/lib/configuration-stripe.js`**

```js
// @ts-check
import { FORMULES } from './formules.js'

/**
 * Crée ou retrouve, dans le compte Stripe, tout ce que les formules exigent.
 * Idempotent : on peut le relancer autant de fois qu'on veut.
 *
 *   - les produits Starter et Pro (metadata.actero_plan), réutilisés s'ils
 *     existent : les fonctionnalités Stripe Entitlements vivent sur le produit ;
 *   - les six prix, retrouvés par leur clé, sinon par leurs caractéristiques
 *     (produit, montant, périodicité) — ils reçoivent alors leur clé —, sinon
 *     créés ;
 *   - les deux coupons du trimestriel, à identifiant fixe ;
 *   - les anciens prix annuels (`interval: 'year'`) désactivés : ils ne sont
 *     plus vendus, et restent réactivables.
 *
 * L'ancien script reconnaissait « le mensuel » à `interval === 'month'`, ce que
 * les prix trimestriels et 13 mois vérifient aussi.
 *
 * @param {any} stripe
 */
export async function configurerFormules(stripe) {
  const rapport = {
    /** @type {{ lookupKey: string, prixId: string, action: 'existant'|'cle_posee'|'cree' }[]} */
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
    if (parCle) {
      rapport.formules.push({ lookupKey: f.lookupKey, prixId: parCle.id, action: 'existant' })
      continue
    }
    const semblable = prixActifs.find((p) =>
      p.product === produits[f.plan]
      && p.unit_amount === f.montantCentimes
      && p.currency === 'eur'
      && p.recurring?.interval === f.recurring.interval
      && (p.recurring?.interval_count || 1) === f.recurring.interval_count)
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
      metadata,
    })
    rapport.formules.push({ lookupKey: f.lookupKey, prixId: cree.id, action: 'cree' })
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

  const produitsActero = new Set(Object.values(produits))
  for (const p of prixActifs) {
    if (p.recurring?.interval === 'year' && produitsActero.has(p.product)) {
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
 * (par lookup_key) et les deux coupons du trimestriel.
 * Auth : admin (Bearer).
 */
import { withSentry } from '../lib/sentry.js'
import Stripe from 'stripe'
import { authenticateAdmin } from './_helpers.js'
import { FORMULES } from '../lib/formules.js'

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
      const cles = new Set(data.map((p) => p.lookup_key))
      status.formules = FORMULES.map((f) => ({ lookupKey: f.lookupKey, plan: f.plan, periode: f.periode, configuree: cles.has(f.lookupKey) }))
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

const ACTIONS = { existant: 'déjà en place', cle_posee: 'clé posée sur un prix existant', cree: 'créé' }

export function AdminStripeSetupView() {
  const [status, setStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const getToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token
  }

  const chargerStatut = async () => {
    setStatusLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/stripe-status', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setStatus(await res.json())
    } catch {
      // statut indisponible : l'écran le dit plus bas
    } finally {
      setStatusLoading(false)
    }
  }

  useEffect(() => { chargerStatut() }, [])

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
      await chargerStatut()
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
                  {f.configuree ? <StatusPill variant="success" icon={Check}>Prix en place</StatusPill> : <StatusPill variant="danger" icon={X}>Absent</StatusPill>}
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
                  <th className="px-4 py-2.5 text-[11px] font-bold text-[#71717a] uppercase tracking-wider">Offre</th>
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

> Cet écran importe `src/lib/affichage-formules.js`, créé à la Task 8. Faire les Tasks 7 et 8 dans la même session, ou déplacer ce step après la Task 8.

- [ ] **Step 6 : lancer les tests**

Run : `npx vitest run api/lib/configuration-stripe.test.js`
Attendu : PASS.

- [ ] **Step 7 : commit** (après la Task 8 si l'écran importe déjà l'affichage)

```bash
git add api/lib/configuration-stripe.js api/lib/configuration-stripe.test.js api/admin/setup-stripe-products.js api/admin/stripe-status.js src/components/admin/AdminStripeSetupView.jsx
git commit -m "feat(admin): configurer les formules dans Stripe en un clic, sans rien copier dans Vercel

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8 : l'affichage des formules et le sélecteur

**Files :**
- Create : `src/lib/affichage-formules.js`, `src/components/billing/SelecteurFormule.jsx`
- Test : `src/lib/affichage-formules.test.js`

- [ ] **Step 1 : écrire le test qui échoue**

`src/lib/affichage-formules.test.js` :

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { affichagePrix, equivalentMensuel, memoriserFormuleChoisie, lireFormuleChoisie, PERIODES_AFFICHEES } from './affichage-formules.js'

const norme = (s) => s.replace(/[  ]/g, ' ')

describe('affichage des formules', () => {
  beforeEach(() => localStorage.clear())

  it('mensuel', () => {
    const a = affichagePrix('starter', 'mensuel')
    expect(norme(a.principal)).toBe('99 €')
    expect(a.suffixe).toBe('/mois')
    expect(a.detail).toBeNull()
  })

  it('trimestriel : prix du trimestre et premier paiement', () => {
    const a = affichagePrix('pro', 'trimestriel')
    expect(norme(a.principal)).toBe('1 197 €')
    expect(a.suffixe).toBe('/3 mois')
    expect(norme(a.detail)).toBe('1er trimestre : 997,50 €')
  })

  it('annuel : prix des 13 mois et équivalent mensuel', () => {
    const a = affichagePrix('starter', 'annuel')
    expect(norme(a.principal)).toBe('1 069,20 €')
    expect(a.suffixe).toBe('/13 mois')
    expect(norme(a.detail)).toBe('soit 82,25 € par mois')
    expect(norme(equivalentMensuel('pro', 'annuel'))).toBe('331,48 €')
  })

  it('pas de formule pour Free et Enterprise', () => {
    expect(affichagePrix('free', 'mensuel')).toBeNull()
    expect(affichagePrix('enterprise', 'annuel')).toBeNull()
  })

  it('trois périodes proposées, dans l’ordre', () => {
    expect(PERIODES_AFFICHEES.map((p) => p.id)).toEqual(['mensuel', 'trimestriel', 'annuel'])
  })

  it('la formule de l’URL l’emporte', () => {
    const url = new URLSearchParams('?plan=pro&formule=annuel')
    expect(lireFormuleChoisie(url)).toEqual({ plan: 'pro', periode: 'annuel' })
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

Run : `npx vitest run src/lib/affichage-formules.test.js`
Attendu : FAIL — import introuvable.

- [ ] **Step 3 : implémenter**

`src/lib/affichage-formules.js` :

```js
import { formulePour, premierPaiementCentimes, PERIODES } from '../../api/lib/formules.js'

/**
 * Ce que le navigateur affiche des formules — dérivé du catalogue serveur,
 * jamais recopié. La page tarifs, la page de choix du plan et la facturation
 * l'utilisent toutes les trois.
 */

export const PERIODES_AFFICHEES = [
  { id: 'mensuel', libelle: 'Mensuel', badge: null },
  { id: 'trimestriel', libelle: 'Trimestriel', badge: '−50 % le 1er mois' },
  { id: 'annuel', libelle: 'Annuel', badge: '13 mois pour 12' },
]

/** « 99 € », « 247,50 € », « 1 069,20 € ». */
export function euros(centimes) {
  const valeur = centimes / 100
  const decimales = Number.isInteger(valeur) ? 0 : 2
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: 2 }).format(valeur)} €`
}

/** L'équivalent mensuel d'une formule : « 82,25 € » pour Starter annuel. */
export function equivalentMensuel(plan, periode) {
  const f = formulePour(plan, periode)
  return f ? euros(Math.round(f.montantCentimes / f.mois)) : null
}

/**
 * @returns {{ principal: string, suffixe: string, detail: string|null, offre: string } | null}
 */
export function affichagePrix(plan, periode) {
  const f = formulePour(plan, periode)
  if (!f) return null
  if (periode === 'trimestriel') {
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
      suffixe: '/13 mois',
      detail: `soit ${equivalentMensuel(plan, periode)} par mois`,
      offre: '13 mois pour le prix de 12',
    }
  }
  return { principal: euros(f.montantCentimes), suffixe: '/mois', detail: null, offre: 'Essai gratuit' }
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
 * annoncer trois offres différentes.
 */
export function SelecteurFormule({ periode, onChange, taille = 'normale' }) {
  const petit = taille === 'petite'
  return (
    <div role="group" aria-label="Formule de paiement" className="inline-flex flex-wrap items-center justify-center gap-1 p-1 rounded-full bg-surface border border-border-cream">
      {PERIODES_AFFICHEES.map((p) => {
        const actif = periode === p.id
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={actif}
            onClick={() => onChange(p.id)}
            className={`${petit ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-[13px]'} rounded-full font-semibold transition-colors flex items-center gap-1.5 ${actif ? 'bg-cta text-white' : 'text-ink-3 hover:text-ink'}`}
          >
            {p.libelle}
            {p.badge && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${actif ? 'bg-white/20 text-white' : 'bg-primary-tint text-primary'}`}>
                {p.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4 : lancer les tests**

Run : `npx vitest run src/lib/affichage-formules.test.js src/lib/couleurs.test.js src/lib/typographie.test.js`
Attendu : PASS.

- [ ] **Step 5 : commit**

```bash
git add src/lib/affichage-formules.js src/lib/affichage-formules.test.js src/components/billing/SelecteurFormule.jsx
git commit -m "feat(tarifs): un affichage des formules dérivé du catalogue, et un sélecteur partagé

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

(Si la Task 7 attendait l'affichage, faire maintenant son commit.)

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

1. Imports — après `import { ComparisonTable } from "../components/landing/pricing/ComparisonTable";`, ajouter :

```js
import { SelecteurFormule } from "../components/billing/SelecteurFormule";
import { affichagePrix, equivalentMensuel, memoriserFormuleChoisie } from "../lib/affichage-formules";
```

2. Supprimer entièrement la fonction `computeAnnualSavingsPct` et la constante `ANNUAL_SAVINGS_PCT` (le bloc qui commence par `/**\n * Derive the real annual savings % from plans.js.` et se termine par `const ANNUAL_SAVINGS_PCT = computeAnnualSavingsPct();`).

3. Dans `const plans = PLAN_ORDER.map(...)`, supprimer la ligne `annualPrice: p.price.annual,`.

4. Remplacer l'entrée FAQ :

```js
  {
    q: "Proposez-vous un discount annuel ?",
    a: `Oui, la facturation annuelle vous fait économiser 20% par rapport au tarif mensuel. Par exemple, le plan Pro passe de ${PLANS.pro.price.monthly}€/mois à ${PLANS.pro.price.annual}€/mois (facturé annuellement).`,
  },
```

par :

```js
  {
    q: "Proposez-vous des formules trimestrielles ou annuelles ?",
    a: `Oui. Au trimestre, le premier mois est à -50 %. À l'année, le prix baisse de 10 % et vous avez 13 mois d'accès pour le prix de 12, à chaque renouvellement : ${affichagePrix("starter", "annuel").principal} pour Starter, ${affichagePrix("pro", "annuel").principal} pour Pro.`,
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
    if (plan.monthlyPrice === 0) return "0€";
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

7. Dans `handleCTA`, remplacer la première ligne :

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

8. Remplacer tout le bloc du toggle — de `<div\n                  role="group"\n                  aria-label="Facturation"` jusqu'à sa balise `</div>` fermante (juste avant `</motion.div>`) — par :

```jsx
                <SelecteurFormule periode={periode} onChange={setPeriode} />
```

9. Dans le rendu du prix des cartes, supprimer le bloc barré :

```jsx
                      {isAnnual && plan.monthlyPrice > 0 && (
                        <span className={`line-through text-2xl font-bold ${plan.highlighted ? 'text-[#F4F5F7]/35' : 'text-[#9ca3af]'}`}>
                          {plan.monthlyPrice}€
                        </span>
                      )}
```

et remplacer `key={`${plan.id}-${isAnnual}`}` par `key={`${plan.id}-${periode}`}`.

10. Vérifier qu'aucune occurrence ne reste : `grep -n "isAnnual\|ANNUAL_SAVINGS_PCT\|annualPrice" src/pages/PricingPage.jsx` → aucune ligne.

- [ ] **Step 3 : lancer tests et lint**

Run : `npx vitest run api/billing/paiement-heberge.test.js api/lib/promesses-tenues.test.js && npx eslint src/pages/PricingPage.jsx`
Attendu : PASS, aucune erreur ESLint.

- [ ] **Step 4 : commit**

```bash
git add src/pages/PricingPage.jsx api/billing/paiement-heberge.test.js
git commit -m "feat(tarifs): trois formules sur la page tarifs, et le choix suit le visiteur

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
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

1. Remplacer les imports lignes 5-8 :

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
  // Une boutique Shopify s'abonne chez Shopify (App Store 1.2.1), qui ne connaît
  // ni le trimestriel ni le 13e mois : on ne les lui propose pas.
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

puis remplacer `billing_period: "monthly",` (dans le `JSON.stringify`) par `billing_period: PERIODE_API[periodeEffective],`, et remplacer :

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

6. Remplacer `titre` et `sousTitre` :

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
        ? "À l’année, -10 % et 13 mois d’accès pour le prix de 12, à chaque renouvellement."
        : moisOffert
          ? "Choisissez la formule qui vous ressemble. Vous ne serez pas débité avant le " + dateFacturation + ", et vous pouvez annuler en un clic."
          : "Commencez gratuitement, ou essayez une formule payante pendant sept jours.";
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
                    : (moisOffert ? "30 jours gratuits" : "Essai gratuit 7 jours");
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
              [CreditCard, periodeEffective === "mensuel"
                ? "Aucun débit avant le " + dateFacturation
                : periodeEffective === "trimestriel" ? "Premier trimestre payé à l’inscription" : "Année payée d’avance, 13 mois d’accès"],
```

10. Supprimer le bloc `<PaymentModal … />` en fin de composant (de `<PaymentModal` à `/>` inclus).

- [ ] **Step 3 : lancer tests et lint**

Run : `npx vitest run api/billing/paiement-heberge.test.js api/lib/essai-gratuit.test.js src/lib/campagne.test.js && npx eslint src/pages/PlanSelectionPage.jsx`
Attendu : PASS (le test « la page de plans annonce le mois » trouve toujours `moisOffert ? "30 jours gratuits"` et `urlParams.get("offre")`), aucune erreur ESLint.

- [ ] **Step 4 : commit**

```bash
git add src/pages/PlanSelectionPage.jsx api/billing/paiement-heberge.test.js
git commit -m "feat(tarifs): la page de choix du plan reprend la formule choisie et paie par Stripe Checkout

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
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
import { PERIODE_API, PERIODE_DEPUIS_API } from '../../../api/lib/formules.js'
```

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
  // propose ni trimestriel ni 13e mois.
  const { data: boutiqueShopify } = useQuery({
    queryKey: ['billing-shopify', client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('client_shopify_connections')
        .select('shop_domain')
        .eq('client_id', client.id)
        .maybeSingle()
      return !!data?.shop_domain
    },
  })
  const periodeEffective = boutiqueShopify ? 'mensuel' : periode
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
  const periodeActuelle = PERIODE_DEPUIS_API[client?.billing_period] || 'mensuel'
  const affichageActuel = ['starter', 'pro'].includes(plan.planId) ? affichagePrix(plan.planId, periodeActuelle) : null
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

7. Remplacer tout le bloc `{/* Billing period toggle */}` — de ce commentaire jusqu'au `</div>` qui ferme le groupe des deux boutons Mensuel/Annuel — par :

```jsx
          {!boutiqueShopify && (
            <SelecteurFormule periode={periode} onChange={setPeriode} taille="petite" />
          )}
```

8. Dans la boucle des cartes, remplacer `const price = p.price?.[billingPeriod]` par :

```js
            const affichage = isEnterprise ? null : affichagePrix(planKey, periodeEffective)
```

remplacer :

```js
              const jours = joursEssaiPour(client)
```

par :

```js
              const jours = periodeEffective === 'mensuel' ? joursEssaiPour(client) : undefined
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

9. Supprimer le bloc `<PaymentModal … />` en fin de composant.

10. Vérifier : `grep -n "billingPeriod\|payModal\|getPlanHighlights\|hasStripeElements" src/components/client/ClientBillingView.jsx` → aucune ligne.

- [ ] **Step 3 : lancer tests et lint**

Run : `npx vitest run api/billing/paiement-heberge.test.js && npx eslint src/components/client/ClientBillingView.jsx`
Attendu : PASS, aucune erreur.

- [ ] **Step 4 : commit**

```bash
git add src/components/client/ClientBillingView.jsx api/billing/paiement-heberge.test.js
git commit -m "feat(facturation): trois formules dans le tableau de bord, et le plan accordé par le webhook

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
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

`src/components/landing/PricingA.jsx` — ajouter en tête des imports :

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
          a: "Oui. Au trimestre, le premier mois est à -50 %. À l'année, le prix baisse de 10 % et vous avez 13 mois d'accès pour le prix de 12, à chaque renouvellement : 1 069,20 € pour Starter, 4 309,20 € pour Pro. Le plan Enterprise se négocie au cas par cas.",
```

- [ ] **Step 3 : lancer**

Run : `npx vitest run api/billing/paiement-heberge.test.js && npx eslint src/components/landing/PricingA.jsx src/pages/FaqPage.jsx`
Attendu : PASS.

- [ ] **Step 4 : commit**

```bash
git add src/components/landing/PricingA.jsx src/pages/FaqPage.jsx api/billing/paiement-heberge.test.js
git commit -m "fix(tarifs): plus aucune page n'annonce l'ancien annuel à -20 %

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13 : supprimer le paiement intégré

**Files :**
- Delete : `src/components/billing/PaymentModal.jsx`, `src/lib/stripe-client.js`, `api/billing/create-subscription.js`, `api/billing/create-subscription.test.js`
- Modify : `package.json`, `package-lock.json`, `.env.example`, `api/lib/essai-gratuit.test.js`, `api/lib/conformite-app-store.test.js`, commentaires de `api/lib/essai-gratuit.js`, `api/lib/stripe-customer.js`, `api/lib/facturation-shopify.js`, `api/stripe-webhook.js`

- [ ] **Step 1 : ajouter la garde qui échoue**

Ajouter à `api/billing/paiement-heberge.test.js` :

```js
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function fichiers(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) fichiers(p, acc)
    else if (/\.(jsx?|mjs)$/.test(e) && !e.includes('.test.')) acc.push(p)
  }
  return acc
}

describe('un seul chemin de paiement Stripe', () => {
  it('le formulaire intégré a disparu', () => {
    for (const f of ['src/components/billing/PaymentModal.jsx', 'src/lib/stripe-client.js', 'api/billing/create-subscription.js']) {
      expect(existsSync(f), `${f} existe encore`).toBe(false)
    }
  })

  it('plus personne ne l’importe ni ne l’appelle', () => {
    const fautifs = []
    for (const f of [...fichiers('src'), ...fichiers('api')]) {
      const src = sansCommentaires(readFileSync(f, 'utf8'))
      if (/PaymentModal|stripe-client|create-subscription|@stripe\/(react-)?stripe-js/.test(src)) fautifs.push(f)
    }
    expect(fautifs).toEqual([])
  })
})
```

(Déplacer les deux imports `existsSync…`/`join` en tête de fichier avec les imports existants.)

Run → FAIL.

- [ ] **Step 2 : supprimer et désinstaller**

```bash
git rm src/components/billing/PaymentModal.jsx src/lib/stripe-client.js api/billing/create-subscription.js api/billing/create-subscription.test.js
npm uninstall @stripe/react-stripe-js @stripe/stripe-js
```

- [ ] **Step 3 : `.env.example`**

Remplacer :

```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

par rien (supprimer la ligne), puis remplacer les lignes des prix — le commentaire qui les précède et :

```
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_ANNUAL=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
```

par :

```
# Les prix Stripe ne se configurent plus ici : chaque formule est retrouvée par
# sa lookup_key (api/lib/formules.js). Admin → « Configurer Stripe » les crée.
```

- [ ] **Step 4 : mettre à jour les tests qui citaient l'ancien chemin**

`api/lib/conformite-app-store.test.js` : remplacer

```js
const ROUTES_STRIPE = [
  'api/billing/upgrade.js',
  'api/billing/create-subscription.js',
  'api/create-checkout-session.js',
]
```

par

```js
const ROUTES_STRIPE = [
  'api/billing/upgrade.js',
  'api/create-checkout-session.js',
]
```

et renommer le test `'les trois routes Stripe refusent un client ayant une boutique Shopify'` en `'les routes Stripe refusent un client ayant une boutique Shopify'`.

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
    // qui affiche exactement `trial_period_days` — posé depuis l'offre calculée
    // par le serveur, et nulle part ailleurs.
    const params = sansCommentaires(readFileSync('api/lib/checkout-formule.js', 'utf8'))
    expect(params, 'la durée d’essai ne vient plus de l’offre calculée')
      .toMatch(/trial_period_days = offre\.essaiJours/)
    expect(existsSync('src/components/billing/PaymentModal.jsx'),
      'le formulaire intégré, qui inventait sa propre durée, est revenu').toBe(false)
  })
```

d. Dans le test « l'email de fin d'essai ne promet pas un renouvellement qui n'aura pas lieu », remplacer le dernier paragraphe (depuis `// La prémisse.` jusqu'au `.toMatch(/missing_payment_method:\s*'cancel'/)`) par :

```js
    // La prémisse a changé le 14 septembre : la page Stripe demande la carte
    // même pendant l'essai. Les essais sans carte sont ceux créés AVANT par
    // l'ancien formulaire intégré — la branche « ajoutez une carte » les sert.
    const params = sansCommentaires(readFileSync('api/lib/checkout-formule.js', 'utf8'))
    expect(params, 'un essai peut de nouveau démarrer sans carte : revoir l’email')
      .toMatch(/payment_method_collection:\s*'always'/)
```

- [ ] **Step 4 bis : retirer les anciens prix annuels de `src/lib/plans.js`**

Plus aucun écran ne lit `price.annual` (79 et 319 €, l'ancien annuel à −20 %) : les montants des formules viennent du catalogue. Les laisser inviterait à les réutiliser.

Remplacer `price: { monthly: 0, annual: 0 },` par `price: { monthly: 0 },`, `price: { monthly: 99, annual: 79 },` par `price: { monthly: 99 },`, `price: { monthly: 399, annual: 319 },` par `price: { monthly: 399 },` et `price: { monthly: null, annual: null }, // sur devis` par `price: { monthly: null }, // sur devis`.

Vérifier : `grep -rn "price\??\.annual\|annual: 79\|annual: 319" src api --include=*.js --include=*.jsx` → aucune ligne.

- [ ] **Step 5 : commentaires qui citaient l'ancien chemin**

- `api/lib/essai-gratuit.js`, en-tête : remplacer les trois lignes de chemins par :

```js
 *   api/create-checkout-session.js   30 jours si parrainage, sinon AUCUN essai
 *   api/billing/create-subscription  30 jours si parrainage, sinon 7 jours
 *                                    (supprimé le 14 septembre 2026)
 *   api/billing/upgrade              30 jours si parrainage, sinon 7 jours
```

- `api/lib/stripe-customer.js`, docstring de `resolveCustomerCard` : remplacer la ligne `*   - api/billing/create-subscription.js  décide d'échanger le plan ou de` et la suivante par :

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

- [ ] **Step 6 : lancer toute la suite, le lint et le build**

Run : `npx vitest run && npx eslint . && npm run build`
Attendu : tous les tests PASS, 0 erreur ESLint, build OK.

- [ ] **Step 7 : commit**

```bash
git add -A
git commit -m "refactor(facturation): un seul chemin de paiement, la page Stripe Checkout

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 14 : vérification dans le navigateur

**Files :** aucun.

- [ ] **Step 1 : lancer le serveur de dev**

Outil `preview_start` avec `{ name: "site-web" }` (défini dans `.claude/launch.json`, port 5173).

- [ ] **Step 2 : page tarifs**

Ouvrir `/tarifs`. Vérifier :
- le sélecteur Mensuel / Trimestriel / Annuel, badges « −50 % le 1er mois » et « 13 mois pour 12 » ;
- Trimestriel : Starter « 297 € /3 mois » et « 1er trimestre : 247,50 € » ; Pro « 1 197 € » et « 997,50 € » ;
- Annuel : Starter « 1 069,20 € /13 mois » et « soit 82,25 € par mois » ; Pro « 4 309,20 € » et « 331,48 € » ;
- FAQ : « Proposez-vous des formules trimestrielles ou annuelles ? » ;
- aucune erreur dans la console (`read_console_messages`).

- [ ] **Step 3 : la formule suit le visiteur**

Sur `/tarifs`, choisir Annuel puis cliquer le bouton de Pro. Vérifier dans la console du navigateur : `localStorage.getItem('actero_formule_choisie')` contient `"periode":"annuel"`. Ouvrir `/signup/plan` : Annuel est présélectionné. Ouvrir `/signup/plan?formule=trimestriel` : Trimestriel est présélectionné.

- [ ] **Step 4 : capture**

`computer { action: "screenshot" }` de `/tarifs` en Annuel, à joindre au compte rendu.

---

## Ce qui reste à Pablo après le déploiement

1. Admin → Configuration Stripe → « Configurer Stripe » (mode live) : six prix, deux coupons, anciens annuels désactivés.
2. Stripe → Portail client : ajouter les nouveaux prix si « changer de formule » est activé, sinon le désactiver.
3. Vercel : retirer `VITE_STRIPE_PUBLISHABLE_KEY` et les quatre `STRIPE_PRICE_*`.
4. Shopify Partner Dashboard : aligner les prix de l'abonnement Shopify (mensuel, annuel) sur la grille.
5. Un paiement de test par formule en mode test Stripe avant d'annoncer les formules.
