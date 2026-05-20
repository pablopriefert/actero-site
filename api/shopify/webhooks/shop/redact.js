/**
 * Shopify mandatory GDPR webhook — `shop/redact`
 *
 * Fires 48h after a merchant uninstalls the app (assuming they didn't
 * reinstall). We must purge ALL data we hold about the shop.
 *
 * Decision: HARD DELETE everything tied to the merchant's client_id.
 *
 * Scope (additive — only deletes rows belonging to this client_id, never
 * touches global / cross-tenant tables):
 *   - engine_messages
 *   - engine_events
 *   - voice_calls
 *   - automation_events
 *   - client_shopify_connections   (severs the OAuth link)
 *
 * We deliberately KEEP the `clients` row but mark it `redacted`. Rationale:
 * billing history (Stripe), invoices, and audit logs reference clients.id —
 * a cascade delete would break our books. The row itself contains no
 * customer PII (only the merchant's own contact info, which the merchant
 * can request separately).
 *
 * See: https://shopify.dev/docs/apps/build/privacy-law-compliance
 */

import { withSentry } from '../../../lib/sentry.js'
import {
  rawBodyConfig,
  getRawBody,
  verifyShopifyHmac,
  hashPayload,
} from '../_lib/verify-hmac.js'
import {
  resolveClientIdFromShop,
  logGdprEvent,
  getSupabase,
} from '../_lib/resolve-client.js'

export const config = rawBodyConfig

const WEBHOOK_TYPE = 'shop/redact'

async function deleteCount(supabase, table, filterFn) {
  try {
    const { count, error: countErr } = await filterFn(
      supabase.from(table).select('*', { count: 'exact', head: true }),
    )
    if (countErr) {
      console.warn(`[${WEBHOOK_TYPE}] count ${table}:`, countErr.message)
      return 0
    }
    if (!count) return 0
    const { error: delErr } = await filterFn(supabase.from(table).delete())
    if (delErr) {
      console.warn(`[${WEBHOOK_TYPE}] delete ${table}:`, delErr.message)
      return 0
    }
    return count
  } catch (err) {
    console.warn(`[${WEBHOOK_TYPE}] ${table} unexpected:`, err.message)
    return 0
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.SHOPIFY_CLIENT_SECRET
  if (!secret) {
    console.error(`[${WEBHOOK_TYPE}] SHOPIFY_CLIENT_SECRET not set`)
    return res.status(500).json({ error: 'Webhook secret not configured' })
  }

  const hmac = req.headers['x-shopify-hmac-sha256']
  if (!hmac) return res.status(401).json({ error: 'Missing HMAC header' })

  let rawBody
  try {
    rawBody = await getRawBody(req)
  } catch (err) {
    console.error(`[${WEBHOOK_TYPE}] getRawBody error:`, err.message)
    return res.status(400).json({ error: 'Unable to read request body' })
  }

  if (!verifyShopifyHmac(rawBody, hmac, secret)) {
    return res.status(401).json({ error: 'Invalid HMAC' })
  }

  let body = {}
  try { body = JSON.parse(rawBody.toString('utf8')) } catch { /* tolerate */ }

  const shopDomain =
    req.headers['x-shopify-shop-domain'] || body?.shop_domain || null
  const clientId = await resolveClientIdFromShop(shopDomain)

  if (!clientId) {
    // Already gone (or never linked). ACK so Shopify stops retrying.
    await logGdprEvent({
      webhookType: WEBHOOK_TYPE,
      shopDomain,
      clientId: null,
      payloadHash: hashPayload(rawBody),
      rowsAffected: { skipped: true, reason: 'unknown_shop' },
      httpStatus: 200,
      notes: 'No matching client — possibly already redacted',
    })
    return res.status(200).json({ acknowledged: true, skipped: true })
  }

  const supabase = getSupabase()
  const rowsAffected = {}

  rowsAffected.engine_messages = await deleteCount(
    supabase, 'engine_messages', (q) => q.eq('client_id', clientId),
  )
  rowsAffected.engine_events = await deleteCount(
    supabase, 'engine_events', (q) => q.eq('client_id', clientId),
  )
  rowsAffected.voice_calls = await deleteCount(
    supabase, 'voice_calls', (q) => q.eq('client_id', clientId),
  )
  rowsAffected.automation_events = await deleteCount(
    supabase, 'automation_events', (q) => q.eq('client_id', clientId),
  )
  rowsAffected.client_shopify_connections = await deleteCount(
    supabase, 'client_shopify_connections', (q) => q.eq('client_id', clientId),
  )

  // Mark the client itself as redacted (don't delete — preserves Stripe / audit FK).
  try {
    const { error: markErr } = await supabase
      .from('clients')
      .update({
        status: 'redacted',
        uninstalled_at: new Date().toISOString(),
      })
      .eq('id', clientId)
    if (markErr) {
      console.warn(`[${WEBHOOK_TYPE}] mark client redacted:`, markErr.message)
    } else {
      rowsAffected.clients_marked = 1
    }
  } catch (err) {
    console.warn(`[${WEBHOOK_TYPE}] mark client unexpected:`, err.message)
  }

  await logGdprEvent({
    webhookType: WEBHOOK_TYPE,
    shopDomain,
    clientId,
    payloadHash: hashPayload(rawBody),
    rowsAffected,
    httpStatus: 200,
    notes: 'Hard delete of all merchant data; clients row marked redacted',
  })

  return res.status(200).json({ acknowledged: true, deleted: rowsAffected })
}

export default withSentry(handler)
