/**
 * Shopify mandatory GDPR webhook — `customers/redact`
 *
 * Fires ~10 days after a merchant's customer has been deleted from Shopify.
 * We must purge any personal data we hold on that customer.
 *
 * Decision: HARD DELETE everywhere we may hold the customer's email.
 * Scope (additive — only rows scoped to the merchant's client_id):
 *   - engine_messages       (chat / email / voice conversation rows)
 *   - engine_events         (cart events, automation triggers, …)
 *   - voice_calls           (ElevenLabs call logs)
 *   - automation_events     (proactive / playbook events)
 *
 * Strategy:
 *   1. Resolve client_id from shop_domain (skip silently if unknown — the
 *      merchant probably already uninstalled & redacted).
 *   2. For each table, DELETE rows where (client_id = X AND customer_email = Y).
 *      Some tables (engine_events / automation_events) keep the email inside
 *      a JSONB payload column instead of a dedicated column — we also delete
 *      those via a payload->>'email' filter.
 *   3. Log the row counts into shopify_gdpr_log for compliance trail.
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

const WEBHOOK_TYPE = 'customers/redact'

async function deleteCount(supabase, table, filterFn) {
  // Two-step: count first (head:true), then delete. Avoids returning rows in
  // the delete payload (which RLS could mask) and gives us an honest tally.
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
  const customerEmail =
    body?.customer?.email || body?.email || null
  const clientId = await resolveClientIdFromShop(shopDomain)

  // If we can't tie the request to a known shop, ACK and move on. The audit
  // row records the miss — Shopify will not retry a 200.
  if (!clientId || !customerEmail) {
    await logGdprEvent({
      webhookType: WEBHOOK_TYPE,
      shopDomain,
      customerEmail,
      clientId,
      payloadHash: hashPayload(rawBody),
      rowsAffected: { skipped: true, reason: !clientId ? 'unknown_shop' : 'no_email' },
      httpStatus: 200,
      notes: 'Nothing to delete — ACKed for Shopify retry budget',
    })
    return res.status(200).json({ acknowledged: true, skipped: true })
  }

  const supabase = getSupabase()
  const rowsAffected = {}

  rowsAffected.engine_messages = await deleteCount(
    supabase, 'engine_messages',
    (q) => q.eq('client_id', clientId).eq('customer_email', customerEmail),
  )

  rowsAffected.engine_events = await deleteCount(
    supabase, 'engine_events',
    (q) => q.eq('client_id', clientId).eq('payload->>email', customerEmail),
  )

  rowsAffected.voice_calls = await deleteCount(
    supabase, 'voice_calls',
    (q) => q.eq('client_id', clientId).eq('customer_email', customerEmail),
  )

  rowsAffected.automation_events = await deleteCount(
    supabase, 'automation_events',
    (q) => q.eq('client_id', clientId).eq('payload->>email', customerEmail),
  )

  await logGdprEvent({
    webhookType: WEBHOOK_TYPE,
    shopDomain,
    customerEmail,
    clientId,
    payloadHash: hashPayload(rawBody),
    rowsAffected,
    httpStatus: 200,
    notes: 'Hard delete of customer PII across engine tables',
  })

  return res.status(200).json({ acknowledged: true, deleted: rowsAffected })
}

export default withSentry(handler)
