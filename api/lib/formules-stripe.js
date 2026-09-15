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
 * `incomplete` n'y figure pas, alors qu'un tel abonnement peut encore aboutir
 * pendant 23 heures (son premier paiement attend, par exemple, un 3-D Secure).
 * Il est ignoré pour deux raisons : expirer une session Checkout — ce que la
 * route de paiement fait avant d'en ouvrir une autre — annule l'abonnement
 * qu'elle portait ; et l'ancien formulaire intégré (create-subscription +
 * PaymentModal), qui en laissait derrière lui, est supprimé avant la mise en
 * production.
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
 * L'historique Stripe des abonnements d'un compte Actero, relevé en une fois
 * chez les clients Stripe qu'on lui passe — la route de paiement en passe deux
 * au plus.
 *
 * Un compte peut en avoir plusieurs : celui de la session de paiement, et
 * celui qui porte l'abonnement enregistré quand l'identifiant a été remplacé
 * (changement de clé, client venu du tunnel). Ne lire que le premier laissait
 * passer un abonnement vivant chez le second — et Checkout s'ouvrait par-dessus.
 * La route posait aussi deux fois la même question à Stripe, une pour
 * l'avantage de bienvenue, une pour les abonnements en cours.
 *
 * Ce qu'on en déduit engage de l'argent : un avantage de bienvenue accordé, un
 * second abonnement ouvert. Aucun « je ne sais pas » ne doit donc valoir « rien
 * trouvé » :
 *   - les identifiants vides (`null`, `undefined`, `''`) et les doublons sont
 *     retirés ; s'il n'en reste aucun, on lève sans interroger Stripe ;
 *   - un identifiant qui n'est pas une chaîne lève aussi : l'écarter en silence
 *     ferait sauter la lecture d'un client ;
 *   - une erreur Stripe remonte ;
 *   - `has_more` chez un seul client lève : l'abonnement qui compte peut se
 *     trouver sur la page qu'on n'a pas lue.
 *
 * Renvoie :
 *   - `dejaAbonne` : au moins un abonnement, quel qu'en soit le statut, sauf
 *     `incomplete_expired`. Un essai annulé sans facture compte. Pas un
 *     `incomplete_expired` : Stripe le crée dès l'ouverture d'un formulaire de
 *     paiement, avant toute carte, et un marchand qui referme cet écran n'a
 *     rien payé — il garde son avantage de bienvenue.
 *   - `vivants` : les abonnements dont le statut est dans `STATUTS_VIVANTS`
 *     (voir pourquoi `incomplete` n'y est pas), chacun une seule fois.
 *
 * @param {import('stripe').Stripe} stripe
 * @param {Array<string|null|undefined>} customerIds
 * @returns {Promise<{ dejaAbonne: boolean, vivants: import('stripe').Stripe.Subscription[] }>}
 */
export async function lireHistoriqueAbonnements(stripe, customerIds) {
  if (!Array.isArray(customerIds)) {
    throw new TypeError('lireHistoriqueAbonnements : customerIds doit être un tableau d’identifiants de clients Stripe')
  }
  /** @type {string[]} */
  const clients = []
  for (const id of customerIds) {
    if (id === null || id === undefined || id === '') continue
    if (typeof id !== 'string') {
      throw new TypeError('lireHistoriqueAbonnements : un identifiant de client Stripe n’est pas une chaîne')
    }
    if (!clients.includes(id)) clients.push(id)
  }
  if (clients.length === 0) {
    throw new TypeError('lireHistoriqueAbonnements : aucun identifiant de client Stripe exploitable')
  }

  const pages = await Promise.all(clients.map(async (customer) => {
    const { data, has_more } = await stripe.subscriptions.list({ customer, status: 'all', limit: 100 })
    if (has_more === true) {
      throw new Error(`lireHistoriqueAbonnements : plus d'une page d'abonnements pour ${customer}, impossible de conclure`)
    }
    return data
  }))
  const abonnements = pages.flat()

  const vus = new Set()
  /** @type {import('stripe').Stripe.Subscription[]} */
  const vivants = []
  for (const abonnement of abonnements) {
    if (!STATUTS_VIVANTS.includes(abonnement.status) || vus.has(abonnement.id)) continue
    vus.add(abonnement.id)
    vivants.push(abonnement)
  }

  return {
    dejaAbonne: abonnements.some((s) => s.status !== 'incomplete_expired'),
    vivants,
  }
}
