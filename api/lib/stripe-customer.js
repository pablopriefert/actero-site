// @ts-check
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
 * Options passées PAR REQUÊTE aux appels Stripe faits en mode strict.
 *
 * Pire cas : 2 tentatives (1 essai + 1 réessai, `maxNetworkRetries: 1`) de
 * 5 s chacune (`timeout: 5000`) par appel — nettement sous les 60 s de
 * `maxDuration` d'une fonction Vercel. Sans ce plafond, le SDK Stripe
 * attend par défaut jusqu'à 80 s par tentative : Vercel tue alors la
 * fonction avant que son `catch` ne s'exécute, la réservation dans
 * `webhook_events_processed` reste posée, et le réessai suivant de Stripe
 * reçoit un 200 « duplicate » — l'événement est perdu sans bruit.
 */
export const OPTIONS_REQUETE_COURTE = { timeout: 5000, maxNetworkRetries: 1 }

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
 *                                         d'essai, et, en mode strict, si un
 *                                         abonnement obtient son plan payant
 *
 * En mode strict (options.strict), une erreur Stripe est relancée au lieu de
 * valoir « aucune carte » : une panne veut dire « impossible de savoir », pas
 * « carte absente ». Sans l'option, le comportement historique (avaler
 * l'erreur, renvoyer null) ne change pas.
 *
 * @param {import('stripe').Stripe} stripe
 * @param {any} subscription — objet Subscription de Stripe
 * @param {string} customerId
 * @param {{ strict?: boolean }} [options]
 * @returns {Promise<string|null>} l'identifiant du moyen de paiement, ou null
 */
export async function resolveCustomerCard(stripe, subscription, customerId, { strict = false } = {}) {
  const subDefault = subscription?.default_payment_method
  if (subDefault) return typeof subDefault === 'string' ? subDefault : subDefault.id

  try {
    // Le budget temps serré (OPTIONS_REQUETE_COURTE) n'a de sens qu'en mode
    // strict : c'est lui dont une panne doit remonter jusqu'au webhook. En
    // mode non strict l'erreur est de toute façon avalée juste en dessous —
    // l'appel reste donc identique à avant, pour ne rien changer à son
    // comportement historique.
    const customer = strict
      ? await stripe.customers.retrieve(customerId, {}, OPTIONS_REQUETE_COURTE)
      : await stripe.customers.retrieve(customerId)
    if (customer && !customer.deleted) {
      const invoiceDefault = customer.invoice_settings?.default_payment_method
      if (invoiceDefault) return typeof invoiceDefault === 'string' ? invoiceDefault : invoiceDefault.id
    }
  } catch (err) {
    if (strict) throw err
    // sinon, on tente la liste ci-dessous
  }

  try {
    const list = strict
      ? await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 }, OPTIONS_REQUETE_COURTE)
      : await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 })
    return list?.data?.[0]?.id || null
  } catch (err) {
    if (strict) throw err
    return null
  }
}
