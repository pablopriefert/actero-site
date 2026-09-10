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
  // Pourquoi on recrée, quand on recrée. Renseigné juste avant la création.
  //
  // ACT-39 : le 10 septembre, un client Stripe a été remplacé sur une ligne
  // `clients` vivante, entre deux clics du même marchand. Aucune des trois
  // conditions ci-dessous n'aurait dû s'appliquer, et il a été impossible de
  // savoir laquelle avait fermé — parce que cette fonction ne dit rien.
  //
  // Un remplacement silencieux, c'est deux clients Stripe pour un compte
  // Actero : deux historiques de facturation, et des abonnements orphelins
  // que le produit ne voit plus. Ça ne se découvre qu'au premier litige.
  let raison = 'aucun identifiant stocké'

  if (currentId) {
    try {
      const existing = await stripe.customers.retrieve(currentId)
      if (existing && !existing.deleted) return currentId
      raison = 'le client Stripe est marqué supprimé'
      // deleted:true → fall through and recreate
    } catch (err) {
      // Only "resource_missing" (unknown id / wrong mode) is recoverable by
      // recreating; anything else (auth, network) must bubble up.
      if (err?.code !== 'resource_missing' && err?.statusCode !== 404) throw err
      raison = `introuvable (${err?.code || err?.statusCode || 'inconnu'}) — mauvaise clé, ou client effacé`
    }
    console.warn(
      `[stripe-customer] ${clientId} : remplacement de ${currentId} — ${raison}`,
    )
  }

  const customer = await stripe.customers.create({
    email: email || undefined,
    name: name || undefined,
    metadata: { client_id: clientId, actero_client_id: clientId },
  })
  await supabase.from('clients').update({ stripe_customer_id: customer.id }).eq('id', clientId)
  if (currentId) {
    console.warn(`[stripe-customer] ${clientId} : ${currentId} → ${customer.id}`)
  }
  return customer.id
}

/**
 * Le moyen de paiement utilisable de ce client, ou `null` s'il n'y en a aucun.
 *
 * Trois endroits peuvent le porter, et il faut les trois : l'abonnement, les
 * préférences de facturation du client, puis la liste de ses cartes. En
 * regarder un seul répond « aucune carte » à quelqu'un qui en a une.
 *
 * Vit ici et non dans une route parce que DEUX choses en dépendent, et qu'elles
 * doivent répondre pareil :
 *   - api/billing/create-subscription.js  décide d'échanger le plan ou de
 *                                         redemander une carte
 *   - api/stripe-webhook.js               décide de ce que dit l'email de fin
 *                                         d'essai, qui n'est pas le même selon
 *                                         qu'une carte existe ou non
 *
 * @returns {Promise<string|null>} l'identifiant du moyen de paiement, ou null
 */
export async function resolveCustomerCard(stripe, subscription, customerId) {
  const subDefault = subscription?.default_payment_method
  if (subDefault) return typeof subDefault === 'string' ? subDefault : subDefault.id

  try {
    const customer = await stripe.customers.retrieve(customerId)
    const invoiceDefault = customer?.invoice_settings?.default_payment_method
    if (invoiceDefault) return typeof invoiceDefault === 'string' ? invoiceDefault : invoiceDefault.id
  } catch { /* on tente la liste ci-dessous */ }

  try {
    const list = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 })
    return list?.data?.[0]?.id || null
  } catch {
    return null
  }
}
