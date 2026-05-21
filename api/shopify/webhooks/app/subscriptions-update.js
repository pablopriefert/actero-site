/**
 * Shopify webhook — `app_subscriptions/update`
 *
 * Fires whenever the status of an AppSubscription changes on the merchant's
 * shop: trial ending, charge expiring, merchant cancelling, charge failing,
 * etc. We use the payload to keep `clients.plan` and the *_subscription_id
 * columns in sync with what Shopify says is true.
 *
 * Status transitions we care about (Shopify enum):
 *   ACTIVE     → flip plan, clear pending_shopify_subscription_id
 *   PENDING    → trial / awaiting acceptance — keep as-is
 *   CANCELLED  → demote to Free
 *   DECLINED   → demote to Free
 *   EXPIRED    → demote to Free
 *   FROZEN     → keep plan but flag (merchant payment issue)
 *
 * App Store policy 1.2.2 requires apps to "handle acceptance, decline, and
 * resubscription approval requests". This handler is the listener that
 * makes that work end-to-end.
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

const WEBHOOK_TYPE = 'app_subscriptions/update'

function planFromSubscriptionName(name) {
  // We name subscriptions in shopify-billing.js as `Actero Starter (monthly)`,
  // `Actero Pro (annual)`, etc. Parse the tier out so we always know which
  // plan the merchant is currently entitled to — even if Shopify changes
  // mid-cycle.
  if (!name) return null
  const lower = String(name).toLowerCase()
  if (lower.includes('starter')) return 'starter'
  if (lower.includes('pro')) return 'pro'
  if (lower.includes('enterprise')) return 'enterprise'
  return null
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

  const sub = body?.app_subscription || {}
  const shopDomain =
    req.headers['x-shopify-shop-domain'] || body?.shop_domain || null
  const clientId = await resolveClientIdFromShop(shopDomain)
  const subscriptionGid = sub?.admin_graphql_api_id || null
  const status = String(sub?.status || '').toUpperCase()
  const planTier = planFromSubscriptionName(sub?.name)
  const rowsAffected = { status }

  // Idempotent — Shopify retries this webhook, we tolerate duplicates.
  if (!clientId) {
    await logGdprEvent({
      webhookType: WEBHOOK_TYPE,
      shopDomain,
      clientId: null,
      payloadHash: hashPayload(rawBody),
      rowsAffected: { skipped: true, reason: 'unknown_shop' },
      httpStatus: 200,
      notes: 'No matching client_id for shop_domain',
    })
    return res.status(200).json({ acknowledged: true, skipped: true })
  }

  const supabase = getSupabase()

  try {
    if (status === 'ACTIVE' && planTier) {
      // Charge approved (post-trial or fresh) — promote the merchant.
      await supabase
        .from('clients')
        .update({
          plan: planTier,
          billing_provider: 'shopify',
          shopify_subscription_id: subscriptionGid,
          pending_shopify_subscription_id: null,
        })
        .eq('id', clientId)
      rowsAffected.action = 'promoted'
      rowsAffected.plan = planTier
    } else if (
      status === 'CANCELLED' ||
      status === 'DECLINED' ||
      status === 'EXPIRED'
    ) {
      // Charge gone — demote to Free without deleting any data.
      await supabase
        .from('clients')
        .update({
          plan: 'free',
          shopify_subscription_id: null,
          pending_shopify_subscription_id: null,
        })
        .eq('id', clientId)
      rowsAffected.action = 'demoted_to_free'
    } else if (status === 'FROZEN') {
      // Payment issue — keep plan but record state for ops to follow up.
      await supabase
        .from('clients')
        .update({ billing_provider: 'shopify' })
        .eq('id', clientId)
      rowsAffected.action = 'frozen_flagged'
    } else if (status === 'PENDING') {
      // Trial or awaiting acceptance — no DB change yet.
      rowsAffected.action = 'pending_no_op'
    } else {
      rowsAffected.action = 'unhandled_status'
    }
  } catch (err) {
    console.error(`[${WEBHOOK_TYPE}] update failed:`, err.message)
    rowsAffected.error = err.message
  }

  await logGdprEvent({
    webhookType: WEBHOOK_TYPE,
    shopDomain,
    clientId,
    payloadHash: hashPayload(rawBody),
    rowsAffected,
    httpStatus: 200,
    notes: `Subscription ${status} for plan ${planTier || 'unknown'}`,
  })

  return res.status(200).json({ acknowledged: true, status, plan: planTier })
}

export default withSentry(handler)
