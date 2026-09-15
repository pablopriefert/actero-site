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
