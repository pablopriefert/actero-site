/**
 * Resolve a *usable* Stripe customer id for a client, healing orphaned ids.
 *
 * A stored clients.stripe_customer_id can become invalid when the Stripe secret
 * key / mode changes (test ↔ live) or the customer is deleted. Stripe then
 * throws "No such customer" on any call that references it (checkout, billing
 * portal, subscription). This helper validates the stored id and transparently
 * recreates + re-persists the customer when it's gone.
 *
 * @param {import('stripe').Stripe} stripe
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase — service-role
 * @param {{ clientId: string, currentId?: string|null, email?: string, name?: string }} opts
 * @returns {Promise<string>} a customer id that exists under the current key
 */
export async function getOrCreateStripeCustomer(stripe, supabase, { clientId, currentId, email, name }) {
  if (currentId) {
    try {
      const existing = await stripe.customers.retrieve(currentId)
      if (existing && !existing.deleted) return currentId
      // deleted:true → fall through and recreate
    } catch (err) {
      // Only "resource_missing" (unknown id / wrong mode) is recoverable by
      // recreating; anything else (auth, network) must bubble up.
      if (err?.code !== 'resource_missing' && err?.statusCode !== 404) throw err
    }
  }

  const customer = await stripe.customers.create({
    email: email || undefined,
    name: name || undefined,
    metadata: { client_id: clientId, actero_client_id: clientId },
  })
  await supabase.from('clients').update({ stripe_customer_id: customer.id }).eq('id', clientId)
  return customer.id
}
