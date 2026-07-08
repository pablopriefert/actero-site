/**
 * Decide the clients-row update for a Stripe subscription event.
 *
 * MRR-critical: a `trialing` subscription with NO payment method must never
 * unlock a paid plan — otherwise "start free trial" without entering a card
 * grants Pro forever (0 € MRR). We therefore only GRANT a plan when a payment
 * method is on file AND the subscription is active/trialing. Terminal states
 * downgrade to free.
 *
 * @param {object} subscription — Stripe Subscription object
 * @param {Record<string,string>} priceMap — Stripe price_id → plan name
 * @returns {{ plan?: string, status?: string, trial_ends_at?: string }}
 */
export function planUpdateFromSubscription(subscription, priceMap) {
  const update = {}
  if (!subscription) return update

  const priceId = subscription.items?.data?.[0]?.price?.id
  const mappedPlan = priceId ? priceMap[priceId] : null
  const hasPaymentMethod = !!subscription.default_payment_method
  const status = subscription.status

  if (mappedPlan && ['active', 'trialing'].includes(status) && hasPaymentMethod) {
    update.plan = mappedPlan
    update.status = 'active'
  } else if (['canceled', 'unpaid', 'incomplete_expired'].includes(status)) {
    update.plan = 'free'
    update.status = 'inactive'
  }

  if (subscription.trial_end) {
    update.trial_ends_at = new Date(subscription.trial_end * 1000).toISOString()
  }

  return update
}
