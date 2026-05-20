/**
 * Shopify mandatory GDPR webhook — `customers/data_request`
 *
 * Fires when a Shopify merchant's customer asks for their data via a data
 * subject access request (DSAR). Shopify forwards the request to every
 * installed app that has handled that customer's data, and gives us 30 days
 * to respond.
 *
 * Decision (conscious business call, RGPD risk accepted): we ACK 200 only.
 * No automatic data export. If a real DSAR comes in we'll respond manually.
 * Rationale: we have very few customers, and a stub auto-export would risk
 * leaking the wrong data. The audit row in `shopify_gdpr_log` lets us prove
 * we received the request.
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
} from '../_lib/resolve-client.js'

export const config = rawBodyConfig

const WEBHOOK_TYPE = 'customers/data_request'

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

  // Parse body for audit fields only (we do NOT act on the payload).
  let body = {}
  try { body = JSON.parse(rawBody.toString('utf8')) } catch { /* tolerate */ }

  const shopDomain = req.headers['x-shopify-shop-domain'] || body?.shop_domain || null
  const customerEmail = body?.customer?.email || null
  const clientId = await resolveClientIdFromShop(shopDomain)

  await logGdprEvent({
    webhookType: WEBHOOK_TYPE,
    shopDomain,
    customerEmail,
    clientId,
    payloadHash: hashPayload(rawBody),
    rowsAffected: { action: 'ack_only' },
    httpStatus: 200,
    notes: 'ACK only — manual response if a real DSAR is received',
  })

  return res.status(200).json({ acknowledged: true })
}

export default withSentry(handler)
