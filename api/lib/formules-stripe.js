// @ts-check
/**
 * Les deux questions que la route de paiement pose à Stripe.
 */
import { prixConforme } from './formules.js'

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
 * Ce client Stripe a-t-il déjà eu un abonnement qui a réellement facturé
 * quelque chose, quel qu'en soit le statut actuel ? Une erreur Stripe remonte :
 * elle ne doit jamais valoir « jamais abonné », sinon une panne accorderait un
 * avantage de bienvenue.
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
