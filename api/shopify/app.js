/**
 * GET /api/shopify/app
 *
 * Landing endpoint for the Shopify Admin "Open app" button. Shopify hits this
 * URL with `?shop=…&host=…&hmac=…&timestamp=…` after the merchant clicks the
 * app tile from inside their Admin.
 *
 * Responsibilities:
 *   1. Validate the HMAC signature of the query string so we know the redirect
 *      really came from Shopify (and not someone forging a deep link).
 *   2. If the shop is already connected (we have a row in
 *      client_shopify_connections), forward the merchant to the Actero
 *      dashboard pre-scoped to that shop.
 *   3. If the shop is not connected yet, kick off the OAuth flow via
 *      /api/shopify/install (which we already ship) so the merchant lands
 *      back on /shopify-success once OAuth completes.
 *
 * This endpoint is intentionally STATELESS — it does not touch the DB beyond a
 * single read to resolve client_id. All write paths stay in callback.js.
 *
 * Set the Partner Dashboard "App URL" to:
 *   https://actero.fr/api/shopify/app
 */

import crypto from 'crypto'
import { withSentry } from '../lib/sentry.js'

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { shop, hmac } = req.query || {}

  // No shop → user landed here directly (e.g. via the App Store before install).
  // Forward them to the marketing landing so they can install from there.
  if (!shop) {
    return res.redirect(302, '/')
  }

  // Basic shape check — Shopify shop domains end in .myshopify.com
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(String(shop))) {
    return res.status(400).json({ error: 'Invalid shop domain' })
  }

  // Verify HMAC if Shopify sent one (it does for Admin → Open app redirects).
  // Skip the check only when no HMAC was supplied (direct link, manual paste).
  const secret = process.env.SHOPIFY_CLIENT_SECRET
  if (hmac && secret) {
    const params = { ...req.query }
    delete params.hmac
    delete params.signature
    const sorted = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&')
    const computed = crypto.createHmac('sha256', secret).update(sorted).digest('hex')
    const a = Buffer.from(computed, 'utf8')
    const b = Buffer.from(String(hmac), 'utf8')
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b)
    if (!ok) {
      return res.status(401).json({ error: 'HMAC validation failed' })
    }
  }

  // Resolve: is this shop already connected to an Actero client?
  let clientId = null
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && supabaseKey) {
      const lookup = await fetch(
        `${supabaseUrl}/rest/v1/client_shopify_connections?shop_domain=eq.${encodeURIComponent(
          shop,
        )}&select=client_id&limit=1`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        },
      )
      if (lookup.ok) {
        const rows = await lookup.json()
        clientId = rows?.[0]?.client_id || null
      }
    }
  } catch (err) {
    console.warn('[shopify-app] connection lookup failed:', err?.message)
    // Fail soft — fall through to install flow.
  }

  // Already connected → forward to the dashboard, carrying the shop context
  // so the SPA can pre-select the right tenant. The dashboard route is
  // `/client` (mounted via DashboardGate) — `/dashboard` does not exist.
  if (clientId) {
    const params = new URLSearchParams({ shop })
    return res.redirect(302, `/client?${params.toString()}`)
  }

  // Not connected → kick the merchant into the OAuth install flow. install.js
  // already handles the rest (nonce, scopes, redirect).
  const installParams = new URLSearchParams({ shop })
  return res.redirect(302, `/api/shopify/install?${installParams.toString()}`)
}

export default withSentry(handler)
