/**
 * POST /api/billing/shopify-billing
 *
 * Shopify-native billing for merchants who installed Actero via the Shopify
 * App Store. App Store policy 1.2.1 mandates that public apps charge
 * exclusively through the Shopify Billing API — Stripe / off-platform
 * billing leads to automatic listing rejection.
 *
 * Flow:
 *   1. Caller (the dashboard, after the merchant picks a plan) hits this
 *      endpoint with { client_id, target_plan, billing_period }.
 *   2. We verify the caller owns the client AND that the client has an
 *      active Shopify connection (otherwise → fall back to Stripe via
 *      api/billing/upgrade.js).
 *   3. We call the `appSubscriptionCreate` GraphQL mutation on the merchant
 *      shop, generating a Shopify-hosted confirmation URL.
 *   4. We return the confirmation URL; the front-end redirects the
 *      merchant there. After they accept inside Shopify Admin, Shopify
 *      sends them back to /api/billing/shopify-callback?charge_id=… which
 *      finalises the upgrade.
 *
 * Pricing mirrors src/lib/plans.js (single source of truth on the JS side).
 * USD is required by Shopify Billing — we map EUR plan prices 1:1.
 */

import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { decryptToken } from '../lib/crypto.js'
import { isActeroAdmin } from '../lib/admin-auth.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SHOPIFY_API_VERSION = '2025-01'

// Public-facing plan catalogue. Keep in lock-step with src/lib/plans.js.
const PLAN_PRICING = {
  starter: { monthly: 99, annual: 948 },   // 79 € × 12 with 20% effective discount
  pro:     { monthly: 399, annual: 3828 }, // 319 € × 12
}

const APP_SUBSCRIPTION_CREATE = `
  mutation AppSubscriptionCreate(
    $name: String!
    $returnUrl: URL!
    $test: Boolean
    $trialDays: Int
    $lineItems: [AppSubscriptionLineItemInput!]!
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      test: $test
      trialDays: $trialDays
      lineItems: $lineItems
    ) {
      userErrors { field message }
      confirmationUrl
      appSubscription { id status }
    }
  }
`

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
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'unauthorized' })

  const {
    client_id,
    target_plan,
    billing_period = 'monthly',
    return_path = '/dashboard/billing',
  } = req.body || {}

  if (!client_id || !target_plan) {
    return res.status(400).json({ error: 'missing_client_or_plan' })
  }
  if (!PLAN_PRICING[target_plan]) {
    return res.status(400).json({ error: 'invalid_plan' })
  }
  if (!['monthly', 'annual'].includes(billing_period)) {
    return res.status(400).json({ error: 'invalid_billing_period' })
  }

  // --- Verify user owns this client ---
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

  // --- Look up the Shopify connection — required to use Shopify Billing ---
  const { data: connection } = await supabase
    .from('client_shopify_connections')
    .select('shop_domain, access_token')
    .eq('client_id', client_id)
    .maybeSingle()

  if (!connection?.shop_domain || !connection?.access_token) {
    // Caller should fall back to Stripe in this case. Surface a clear code.
    return res.status(409).json({ error: 'no_shopify_connection' })
  }

  const accessToken = decryptToken(connection.access_token) || connection.access_token

  // --- Build the subscription line items ---
  const pricing = PLAN_PRICING[target_plan]
  const interval = billing_period === 'annual' ? 'ANNUAL' : 'EVERY_30_DAYS'
  const amount = billing_period === 'annual' ? pricing.annual : pricing.monthly

  const baseReturnUrl = process.env.PUBLIC_API_URL || 'https://actero.fr'
  const returnUrl =
    `${baseReturnUrl}/api/billing/shopify-callback` +
    `?client_id=${encodeURIComponent(client_id)}` +
    `&plan=${encodeURIComponent(target_plan)}` +
    `&period=${encodeURIComponent(billing_period)}` +
    `&next=${encodeURIComponent(return_path)}`

  const variables = {
    name: `Actero ${target_plan[0].toUpperCase()}${target_plan.slice(1)} (${billing_period})`,
    returnUrl,
    // Test mode auto-enabled on Shopify development stores. Shopify ignores
    // `test: true` against live stores when the merchant is a paid plan.
    test: process.env.NODE_ENV !== 'production',
    trialDays: 7,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: { amount, currencyCode: 'USD' },
            interval,
          },
        },
      },
    ],
  }

  // --- Fire the GraphQL mutation ---
  let json
  try {
    const resp = await fetch(
      `https://${connection.shop_domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query: APP_SUBSCRIPTION_CREATE, variables }),
      },
    )
    json = await resp.json()
  } catch (err) {
    console.error('[shopify-billing] mutation failed:', err.message)
    return res.status(502).json({ error: 'shopify_unreachable' })
  }

  const userErrors = json?.data?.appSubscriptionCreate?.userErrors || []
  if (userErrors.length) {
    console.warn('[shopify-billing] userErrors:', JSON.stringify(userErrors))
    return res
      .status(400)
      .json({ error: 'shopify_user_errors', details: userErrors })
  }
  if (json?.errors?.length) {
    console.error('[shopify-billing] GraphQL errors:', JSON.stringify(json.errors))
    return res.status(502).json({ error: 'shopify_graphql_error' })
  }

  const confirmationUrl = json?.data?.appSubscriptionCreate?.confirmationUrl
  const subscriptionId = json?.data?.appSubscriptionCreate?.appSubscription?.id
  if (!confirmationUrl) {
    return res.status(502).json({ error: 'no_confirmation_url' })
  }

  // Record the pending charge so we can reconcile on the callback even if
  // the merchant closes the tab before clicking Accept inside Shopify.
  await supabase.from('clients').update({
    pending_shopify_subscription_id: subscriptionId || null,
  }).eq('id', client_id)

  return res.status(200).json({
    confirmation_url: confirmationUrl,
    subscription_id: subscriptionId,
  })
}

export default withSentry(handler)
