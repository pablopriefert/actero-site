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
