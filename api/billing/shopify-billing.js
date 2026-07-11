/**
 * POST /api/billing/shopify-billing
 *
 * Shopify **Managed Pricing** (a.k.a. Shopify App Pricing) for merchants who
 * installed Actero via the Shopify App Store. App Store policy 1.2.1 mandates
 * that public apps charge exclusively through Shopify — any off-platform
 * (Stripe) billing leads to rejection.
 *
 * With Managed Pricing the plans are configured in the Partner Dashboard and
 * Shopify hosts the whole plan-selection + checkout UI. This endpoint therefore
 * does NOT create a charge itself: it verifies the caller owns a Shopify-
 * connected client and returns the Shopify-hosted plan-selection URL. The
 * front-end redirects the merchant there; after they pick + accept a plan,
 * Shopify fires `app_subscriptions/update`, which api/shopify/webhooks/app/
 * subscriptions-update.js maps back to clients.plan.
 *
 * Response:
 *   200 { confirmation_url }        → redirect the merchant to Shopify
 *   409 { error: no_shopify_connection } → caller falls back to Stripe (direct,
 *                                          non-Shopify signups only)
 */

import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { isActeroAdmin } from '../lib/admin-auth.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// The app handle as configured in the Partner Dashboard (used to build the
// Managed Pricing deep link). Overridable via env in case the handle differs.
const APP_HANDLE = process.env.SHOPIFY_APP_HANDLE || 'actero'

const PAID_PLANS = new Set(['starter', 'pro'])

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  })
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'supabase_not_configured' })
  }

  // --- Auth ---
  const token = req.headers.authorization?.replace(/^Bearer\s+/, '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const supabase = getSupabase()
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'unauthorized' })

  const { client_id, target_plan } = req.body || {}
  if (!client_id || !target_plan) {
    return res.status(400).json({ error: 'missing_client_or_plan' })
  }
  if (!PAID_PLANS.has(target_plan)) {
    return res.status(400).json({ error: 'invalid_plan' })
  }

  // --- Verify the caller owns this client ---
  const isAdmin = await isActeroAdmin(user, supabase)
  if (!isAdmin) {
    const { data: link } = await supabase
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('client_id', client_id)
      .maybeSingle()
    if (!link) {
      const { data: owned } = await supabase
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .eq('owner_user_id', user.id)
        .maybeSingle()
      if (!owned) return res.status(403).json({ error: 'forbidden' })
    }
  }

  // --- Require a Shopify connection to use Managed Pricing ---
  const { data: connection } = await supabase
    .from('client_shopify_connections')
    .select('shop_domain')
    .eq('client_id', client_id)
    .maybeSingle()

  if (!connection?.shop_domain) {
    // No connected Shopify store → direct signup → caller falls back to Stripe.
    return res.status(409).json({ error: 'no_shopify_connection' })
  }

  // --- Build the Shopify-hosted Managed Pricing plan-selection URL ---
  const storeHandle = String(connection.shop_domain).replace(/\.myshopify\.com$/, '')
  const confirmationUrl =
    `https://admin.shopify.com/store/${encodeURIComponent(storeHandle)}` +
    `/charges/${encodeURIComponent(APP_HANDLE)}/pricing_plans`

  return res.status(200).json({ confirmation_url: confirmationUrl })
}

export default withSentry(handler)
