/**
 * Shopify lifecycle webhook — `app/uninstalled`
 *
 * Fires immediately when a merchant removes the app from their store.
 * This is NOT a GDPR-deletion event — Shopify will send `shop/redact` 48h
 * later for the data wipe. Here we just:
 *   1. Mark `clients.status='uninstalled'` + `uninstalled_at=now()`.
 *   2. Disable the storefront widget so we stop serving a bot for a
 *      merchant who no longer owns the relationship.
 *   3. Slack alert internally — uninstall is the canonical churn signal.
 *
 * We do NOT delete data here. That waits for shop/redact (or, in practice,
 * forever, since Shopify only fires shop/redact if the merchant doesn't
 * reinstall within 48h).
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

const WEBHOOK_TYPE = 'app/uninstalled'

async function notifyUninstall({ shopDomain, clientId }) {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) return { sent: false, reason: 'not_configured' }
  const text =
    `🚨 *Shopify app uninstalled* — churn signal\n` +
    `🏪 *${shopDomain || 'unknown shop'}* — client \`${clientId || 'n/a'}\`\n` +
    `_Data still present pending shop/redact (~48h). React fast if this is a key account._`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) return { sent: false, status: res.status }
    return { sent: true }
  } catch (err) {
    console.warn(`[${WEBHOOK_TYPE}] Slack exception:`, err.message)
    return { sent: false, error: err.message }
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

  const shopDomain = req.headers['x-shopify-shop-domain'] || null
  const clientId = await resolveClientIdFromShop(shopDomain)
  const rowsAffected = {}

  if (clientId) {
    const supabase = getSupabase()

    // 1. Mark client as uninstalled (additive — uses new columns).
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          status: 'uninstalled',
          uninstalled_at: new Date().toISOString(),
        })
        .eq('id', clientId)
      if (!error) rowsAffected.client_marked = 1
      else console.warn(`[${WEBHOOK_TYPE}] mark client:`, error.message)
    } catch (err) {
      console.warn(`[${WEBHOOK_TYPE}] mark client unexpected:`, err.message)
    }

    // 2. Disable the widget. Best-effort — column may not exist for older
    //    client_settings rows; tolerate silently.
    try {
      const { error } = await supabase
        .from('client_settings')
        .update({ widget_enabled: false })
        .eq('client_id', clientId)
      if (!error) rowsAffected.widget_disabled = 1
    } catch (err) {
      console.warn(`[${WEBHOOK_TYPE}] disable widget:`, err.message)
    }
  } else {
    rowsAffected.skipped = 'unknown_shop'
  }

  // 3. Slack alert (fire-and-forget; never blocks the 200).
  notifyUninstall({ shopDomain, clientId }).catch(() => {})

  await logGdprEvent({
    webhookType: WEBHOOK_TYPE,
    shopDomain,
    clientId,
    payloadHash: hashPayload(rawBody),
    rowsAffected,
    httpStatus: 200,
    notes: 'App uninstalled — data preserved pending shop/redact',
  })

  return res.status(200).json({ acknowledged: true })
}

export default withSentry(handler)
