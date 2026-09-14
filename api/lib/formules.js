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
 *   annuel       12 mois pour le prix de 11, à −10 %, facturés chaque année
 *                (révisé le même jour : la première version donnait 13 mois
 *                pour le prix de 12, avec un prix « tous les 13 mois »)
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
 *   recurring: { interval: 'month'|'year', interval_count: number },
 *   mois: number,
 *   coupon?: { id: string, montantCentimes: number },
 * }} Formule
 */

/**
 * Gèle un objet et tout ce qu'il contient. Le catalogue est partagé par toutes
 * les requêtes d'une instance Vercel et par toute la session du navigateur :
 * une modification doit lever une erreur, pas le corrompre pour tout le monde.
 *
 * @template {object} T
 * @param {T} o
 * @returns {T}
 */
function figer(o) {
  for (const v of Object.values(o)) if (v && typeof v === 'object') figer(v)
  return Object.freeze(o)
}

/** @type {readonly Periode[]} */
export const PERIODES = figer(/** @type {Periode[]} */ (['mensuel', 'trimestriel', 'annuel']))

/** `billing_period` de l'API et de la base garde ses valeurs anglaises historiques. */
export const PERIODE_API = /** @type {Readonly<Record<Periode, 'monthly'|'quarterly'|'annual'>>} */ (
  figer({ mensuel: 'monthly', trimestriel: 'quarterly', annuel: 'annual' })
)

/** @type {Readonly<Record<'monthly'|'quarterly'|'annual', Periode>>} */
export const PERIODE_DEPUIS_API = figer({ monthly: 'mensuel', quarterly: 'trimestriel', annual: 'annuel' })

/**
 * La période du catalogue pour un `billing_period` reçu du navigateur ou lu en
 * base — ou null. `Object.hasOwn` : `PERIODE_DEPUIS_API['toString']` renverrait
 * une fonction héritée, et une garde `if (!periode)` la laisserait passer.
 *
 * @param {unknown} valeur
 * @returns {Periode|null}
 */
export function periodeDepuisApi(valeur) {
  return typeof valeur === 'string' && Object.hasOwn(PERIODE_DEPUIS_API, valeur)
    ? PERIODE_DEPUIS_API[/** @type {'monthly'|'quarterly'|'annual'} */ (valeur)]
    : null
}

/** @type {readonly Formule[]} */
export const FORMULES = figer([
  { plan: 'starter', periode: 'mensuel', lookupKey: 'actero_starter_mensuel', montantCentimes: 9900, recurring: { interval: 'month', interval_count: 1 }, mois: 1 },
  { plan: 'starter', periode: 'trimestriel', lookupKey: 'actero_starter_trimestriel', montantCentimes: 29700, recurring: { interval: 'month', interval_count: 3 }, mois: 3, coupon: { id: 'actero-trimestriel-starter-4950', montantCentimes: 4950 } },
  { plan: 'starter', periode: 'annuel', lookupKey: 'actero_starter_annuel', montantCentimes: 98010, recurring: { interval: 'year', interval_count: 1 }, mois: 12 },
  { plan: 'pro', periode: 'mensuel', lookupKey: 'actero_pro_mensuel', montantCentimes: 39900, recurring: { interval: 'month', interval_count: 1 }, mois: 1 },
  { plan: 'pro', periode: 'trimestriel', lookupKey: 'actero_pro_trimestriel', montantCentimes: 119700, recurring: { interval: 'month', interval_count: 3 }, mois: 3, coupon: { id: 'actero-trimestriel-pro-19950', montantCentimes: 19950 } },
  { plan: 'pro', periode: 'annuel', lookupKey: 'actero_pro_annuel', montantCentimes: 395010, recurring: { interval: 'year', interval_count: 1 }, mois: 12 },
])

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
 * Ce prix Stripe facture-t-il exactement cette formule ?
 *
 * Un prix Stripe ne change plus de montant une fois créé. Si le catalogue
 * évolue alors que Stripe garde l'ancien prix sous la même clé, le site
 * afficherait le nouveau montant et Checkout facturerait l'ancien.
 *
 * @param {Formule} formule
 * @param {any} price — objet Price de Stripe
 * @returns {boolean}
 */
export function prixConforme(formule, price) {
  return !!price
    && price.unit_amount === formule.montantCentimes
    && price.currency === 'eur'
    && price.recurring?.interval === formule.recurring.interval
    && (price.recurring?.interval_count || 1) === formule.recurring.interval_count
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
 * `interval === 'month'` ne veut PAS dire « un mois » : le trimestriel est lui
 * aussi facturé « au mois », tous les 3 mois. Lire l'intervalle seul comptait
 * 297 € de MRR pour un client trimestriel qui en rapporte 99.
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
 * Le premier paiement d'un client qui a droit à l'offre de bienvenue, coupon
 * déduit. Un client déjà abonné paie le montant plein.
 *
 * @param {Formule} formule
 * @returns {number}
 */
export function premierPaiementCentimes(formule) {
  return formule.montantCentimes - (formule.coupon?.montantCentimes || 0)
}

/**
 * « mois », « 3 mois », « an » — pour l'admin.
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
