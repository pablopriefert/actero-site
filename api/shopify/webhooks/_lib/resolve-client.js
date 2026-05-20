/**
 * Lookup helpers for Shopify GDPR / lifecycle webhooks.
 *
 * Shopify sends us the `shop_domain` (and sometimes a `customer.email`).
 * We map it to our internal `client_id` via `client_shopify_connections`
 * — the same table populated by api/shopify/callback.js on install.
 *
 * If no connection is found we ACK 200 anyway (the merchant may already be
 * fully deleted, or be a Shopify test ping). Logging the miss into
 * shopify_gdpr_log gives us a paper trail.
 */

import { createClient } from '@supabase/supabase-js'

let _supabase = null
function getSupabase() {
  if (_supabase) return _supabase
  _supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
  return _supabase
}

/**
 * Map a Shopify shop_domain to our internal client_id.
 * @returns {Promise<string|null>}
 */
export async function resolveClientIdFromShop(shopDomain) {
  if (!shopDomain) return null
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('client_shopify_connections')
    .select('client_id')
    .eq('shop_domain', shopDomain)
    .maybeSingle()
  if (error) {
    console.warn('[shopify-webhooks] resolveClientIdFromShop error:', error.message)
    return null
  }
  return data?.client_id || null
}

/**
 * Insert an audit row into shopify_gdpr_log. Never throws — observability
 * must not break GDPR webhook processing.
 */
export async function logGdprEvent({
  webhookType,
  shopDomain,
  customerEmail,
  clientId,
  payloadHash,
  rowsAffected,
  httpStatus,
  notes,
}) {
  try {
    const supabase = getSupabase()
    await supabase.from('shopify_gdpr_log').insert({
      webhook_type: webhookType,
      shop_domain: shopDomain || null,
      customer_email: customerEmail || null,
      client_id: clientId || null,
      payload_hash: payloadHash || null,
      rows_affected: rowsAffected || {},
      http_status: httpStatus,
      notes: notes || null,
    })
  } catch (err) {
    console.warn('[shopify-webhooks] logGdprEvent failed:', err.message)
  }
}

export { getSupabase }
