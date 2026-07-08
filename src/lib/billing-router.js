/**
 * Upgrade routing (front-end).
 *
 * Shopify App Store policy 1.2 forbids off-platform (Stripe) billing for
 * merchants who installed via Shopify. So on every upgrade we try the Shopify
 * Billing API first; we only fall back to Stripe when the client has NO Shopify
 * connection (the endpoint replies 409). A real Shopify billing error must NOT
 * silently fall back to Stripe — that would re-introduce the violation.
 *
 * Returns one of:
 *   { channel: 'shopify', url }   → redirect the merchant to Shopify to accept
 *   { channel: 'stripe' }         → caller runs its existing Stripe flow
 *   { channel: 'error', message } → surface the message, do NOT bill via Stripe
 */
export async function resolveUpgrade({ token, clientId, targetPlan, billingPeriod = 'monthly' }) {
  // Free/enterprise never go through Shopify Billing (enterprise = contact).
  if (!targetPlan || targetPlan === 'free' || targetPlan === 'enterprise') {
    return { channel: 'stripe' }
  }

  let res
  try {
    res = await fetch('/api/billing/shopify-billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ client_id: clientId, target_plan: targetPlan, billing_period: billingPeriod }),
    })
  } catch {
    return { channel: 'error', message: 'Paiement indisponible pour le moment, réessayez.' }
  }

  // No connected Shopify store → this is a direct signup → Stripe.
  if (res.status === 409) return { channel: 'stripe' }

  let data = {}
  try { data = await res.json() } catch { /* tolerate */ }

  if (res.ok && data.confirmation_url) {
    return { channel: 'shopify', url: data.confirmation_url }
  }
  // Shopify-sourced merchant but the charge could not be created — surface it,
  // never fall back to Stripe (compliance).
  return { channel: 'error', message: 'Paiement Shopify indisponible, réessayez ou contactez le support.' }
}
