// @ts-check
/**
 * Les questions que la route de paiement pose à Stripe.
 */
import { prixConforme } from './formules.js'

/**
 * Les statuts d'un abonnement Stripe encore vivant : il facture, relance un
 * paiement en retard, attend en pause, ou court en essai. Ouvrir Checkout à
 * côté d'un seul d'entre eux fait payer deux abonnements — un `past_due`
 * continue ses relances pendant que le nouveau facture.
 *
 * `incomplete` n'y figure pas : son premier paiement n'a pas abouti, et Stripe
 * l'expire seul au bout de 23 heures s'il n'aboutit pas.
 */
export const STATUTS_VIVANTS = Object.freeze(['active', 'past_due', 'unpaid', 'paused', 'trialing'])

/**
 * Le prix Stripe actif d'une formule, retrouvé par sa `lookup_key` — et seulement
 * s'il facture exactement le montant du catalogue.
 *
 * @param {import('stripe').Stripe} stripe
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
 * Ce client Stripe a-t-il déjà eu un abonnement, quel qu'en soit le statut
 * actuel — pas seulement un abonnement qui a réellement facturé : un essai
 * annulé sans qu'aucune facture n'ait été émise compte, tout comme un
 * abonnement `incomplete` pas encore expiré. Seuls les `incomplete_expired`
 * sont ignorés (voir plus bas). Une erreur Stripe remonte : elle ne doit
 * jamais valoir « jamais abonné », sinon une panne accorderait un avantage de
 * bienvenue.
 *
 * `customerId` doit être une chaîne non vide : un « je ne sais pas » ne doit
 * jamais glisser vers « jamais abonné » sans même interroger Stripe — ça
 * contredirait la promesse ci-dessus.
 *
 * `incomplete_expired` est exclu du calcul : Stripe crée cet abonnement dès
 * l'ouverture du formulaire de paiement, avant toute carte enregistrée. Un
 * marchand qui ouvre cet écran puis l'abandonne n'a jamais rien payé, et ne
 * doit pas perdre son avantage de bienvenue pour autant.
 *
 * `has_more: true` (plus d'une page de résultats) compte prudemment comme
 * « déjà abonné » : au-delà de la première page, on ne sait plus ce que
 * contiennent les abonnements suivants, et un faux « jamais abonné » coûterait
 * plus cher qu'un faux positif.
 *
 * @param {import('stripe').Stripe} stripe
 * @param {string} customerId
 * @returns {Promise<boolean>}
 */
export async function aDejaEuUnAbonnement(stripe, customerId) {
  if (typeof customerId !== 'string' || !customerId) {
    throw new TypeError('aDejaEuUnAbonnement : customerId doit être une chaîne non vide')
  }
  const { data, has_more } = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  return data.some((s) => s.status !== 'incomplete_expired') || has_more === true
}

/**
 * Les abonnements encore vivants de ce client Stripe (voir `STATUTS_VIVANTS`)
 * — ceux qu'un second abonnement viendrait doubler.
 *
 * Même prudence que `aDejaEuUnAbonnement` : ce que la route en déduit, c'est
 * « on peut ouvrir Checkout ». Aucun « je ne sais pas » ne doit donc valoir
 * « aucun abonnement » :
 *   - `customerId` doit être une chaîne non vide, sinon on lève sans même
 *     interroger Stripe ;
 *   - une erreur Stripe remonte ;
 *   - `has_more: true` lève aussi : un abonnement vivant peut se trouver sur
 *     la page qu'on n'a pas lue.
 *
 * @param {import('stripe').Stripe} stripe
 * @param {string} customerId
 * @returns {Promise<import('stripe').Stripe.Subscription[]>}
 */
export async function abonnementsVivants(stripe, customerId) {
  if (typeof customerId !== 'string' || !customerId) {
    throw new TypeError('abonnementsVivants : customerId doit être une chaîne non vide')
  }
  const { data, has_more } = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  if (has_more === true) {
    throw new Error(`abonnementsVivants : plus d'une page d'abonnements pour ${customerId}, impossible de tous les vérifier`)
  }
  return data.filter((s) => STATUTS_VIVANTS.includes(s.status))
}
