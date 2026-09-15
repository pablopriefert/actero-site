// @ts-check
import { formuleDuPrix, PERIODE_API } from './formules.js'

/**
 * @typedef {{
 *   plan?: 'free'|'starter'|'pro',
 *   status?: 'active'|'inactive',
 *   trial_ends_at?: string,
 *   billing_period?: 'monthly'|'quarterly'|'annual',
 *   billing_provider?: 'stripe',
 * }} MiseAJourPlan
 */

/**
 * Statuts Stripe d'un abonnement qui n'ouvre plus aucun droit : résilié, non
 * payé, ou jamais abouti. `planUpdateFromSubscription` rétrograde en `free`
 * sur ces statuts, et la branche upgrade du webhook (stripe-webhook.js) doit
 * sortir avant d'écrire un plan payant si l'abonnement relu s'y trouve —
 * sinon un événement Stripe rejoué (jusqu'à 3 jours plus tard) accorderait
 * un plan payant sur un abonnement déjà résilié. Un seul tableau, gelé, pour
 * que les deux fichiers ne puissent pas diverger silencieusement.
 */
export const STATUTS_TERMINES = Object.freeze(['canceled', 'unpaid', 'incomplete_expired'])

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
 * @param {import('stripe').Stripe.Subscription} subscription — objet Subscription de Stripe
 * @param {{ aUneCarte?: boolean }} [options]
 * @returns {MiseAJourPlan}
 */
export function planUpdateFromSubscription(subscription, { aUneCarte = false } = {}) {
  /** @type {MiseAJourPlan} */
  const update = {}
  if (!subscription) return update

  const formule = formuleDeLAbonnement(subscription)
  const status = subscription.status

  if (formule && ['active', 'trialing'].includes(status) && aUneCarte) {
    update.plan = formule.plan
    update.status = 'active'
    update.billing_period = PERIODE_API[formule.periode]
    update.billing_provider = 'stripe'
  } else if (STATUTS_TERMINES.includes(status)) {
    update.plan = 'free'
    update.status = 'inactive'
  }

  if (subscription.trial_end) {
    update.trial_ends_at = new Date(subscription.trial_end * 1000).toISOString()
  }

  return update
}

/**
 * La formule Stripe de cet abonnement, lue dans le catalogue — `null` si le
 * prix n'y figure pas (offre sur mesure, ou clé de prix absente/inconnue).
 *
 * @param {any} subscription — objet Subscription de Stripe
 * @returns {import('./formules.js').Formule|null}
 */
export function formuleDeLAbonnement(subscription) {
  return formuleDuPrix(subscription?.items?.data?.[0]?.price)
}

/**
 * Faut-il demander à Stripe le moyen de paiement de ce client ?
 *
 * La carte ne sert qu'à accorder un plan (voir planUpdateFromSubscription) :
 * un abonnement dans un statut terminal, ou sur un prix hors catalogue, ne
 * pourra de toute façon rien accorder. Inutile alors d'appeler Stripe, avec
 * son risque de panne (429, 5xx, délai dépassé) — surtout en mode strict, où
 * cette panne remonterait jusqu'à faire échouer le webhook.
 *
 * @param {any} subscription — objet Subscription de Stripe
 * @returns {boolean}
 */
export function doitResoudreLaCarte(subscription) {
  return ['active', 'trialing'].includes(subscription?.status) && !!formuleDeLAbonnement(subscription)
}

/**
 * La mise à jour à écrire pour ce client, ou `null` si rien ne doit l'être.
 *
 * Le webhook retrouve le client par `metadata.client_id`, pas par
 * l'abonnement : un même client peut donc avoir plusieurs abonnements Stripe
 * au fil du temps — un ancien jamais résilié, et celui qu'il paie vraiment,
 * seul enregistré dans `client.stripe_subscription_id`.
 *
 * Trois cas :
 *   - rien à écrire (`miseAJour` vide) → `null` ;
 *   - abonnement COURANT (`stripe_subscription_id` vide, ou égal à celui de
 *     l'événement) : tout s'écrit tel quel, et un accord de plan payant pose
 *     `stripe_subscription_id` s'il était vide — sinon
 *     `customer.subscription.deleted` ne retrouvera jamais ce client le jour
 *     où cet abonnement-là est résilié ;
 *   - abonnement NON courant (un autre `stripe_subscription_id` est déjà
 *     enregistré) : seul un accord de plan payant peut s'écrire, tel quel et
 *     sans toucher `stripe_subscription_id` — et seulement si le client n'a
 *     pas déjà un plan payant (`client.plan` vide, `undefined`/`null`, ou
 *     `'free'`). Sans cette dernière condition : un ancien essai Starter sans
 *     carte (`sub_1`, encore `trialing`) peut se voir accorder la carte
 *     qu'un Checkout Pro (`sub_2`) vient d'attacher au MÊME client Stripe —
 *     `resolveCustomerCard` la trouve pour n'importe quel abonnement de ce
 *     client — et le premier `updated` de `sub_1` écraserait alors le plan
 *     Pro par Starter. Le cas légitime (`customer.subscription.updated` d'un
 *     NOUVEL abonnement qui arrive avant `checkout.session.completed`, qui
 *     posera `stripe_subscription_id` ensuite) ne concerne justement qu'un
 *     client encore SANS plan payant : c'est exactement ce que la condition
 *     laisse passer. Tout le reste — une rétrogradation, un simple
 *     `trial_ends_at`, ou un accord payant sur un client déjà payant — donne
 *     `null` : laisser rétrograder couperait un marchand qui paie par
 *     ailleurs, une date d'essai à elle seule ouvrirait tout le produit sans
 *     qu'aucun plan n'ait été accordé, et laisser écraser reviendrait à
 *     perdre le plan payant d'un client pour celui d'un abonnement fantôme.
 *
 * @param {MiseAJourPlan} miseAJour
 * @param {{ plan?: string|null, stripe_subscription_id?: string|null }} client — ligne `clients` lue en base
 * @param {any} subscription — objet Subscription de Stripe (l'événement en cours)
 * @returns {(MiseAJourPlan & { stripe_subscription_id?: string })|null} — porte
 *   aussi `stripe_subscription_id` quand un plan payant vient d'être accordé
 *   à un client qui n'en avait pas encore un d'enregistré
 */
export function ecritureAutorisee(miseAJour, client, subscription) {
  if (!miseAJour || Object.keys(miseAJour).length === 0) return null

  const abonnementEnregistre = client?.stripe_subscription_id
  const estLAbonnementCourant = !abonnementEnregistre || abonnementEnregistre === subscription?.id

  if (!estLAbonnementCourant) {
    // Non courant : seul un accord payant traverse, et tel quel — jamais de
    // rétrogradation, jamais un trial_ends_at qui s'écrirait seul. Et même un
    // accord payant ne traverse que si le client n'a pas déjà un plan payant
    // — voir la docstring plus haut pour le scénario de la carte partagée.
    if (!miseAJour.plan || miseAJour.plan === 'free') return null
    return (!client?.plan || client.plan === 'free') ? miseAJour : null
  }

  if (miseAJour.plan && miseAJour.plan !== 'free' && !abonnementEnregistre) {
    return { ...miseAJour, stripe_subscription_id: subscription.id }
  }

  return miseAJour
}
