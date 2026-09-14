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
