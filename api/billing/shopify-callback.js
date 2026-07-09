/**
 * GET /api/billing/shopify-callback
 *
 * Shopify redirects the merchant here after they accept (or decline) the
 * subscription confirmation page returned by appSubscriptionCreate. This
 * endpoint verifies the resulting charge status and updates our clients
 * row accordingly, then bounces the merchant to the dashboard with a
 * friendly success/failure banner.
 *
 * Shopify appends:
 *   ?charge_id={subscription_id_numeric}
 *
 * We also carry forward the params we set on returnUrl (client_id, plan,
 * period, next) so we know what was being upgraded.
 */

import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { decryptToken } from '../lib/crypto.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SHOPIFY_API_VERSION = '2025-01'

const APP_SUBSCRIPTION_QUERY = `
  query AppSubscription($id: ID!) {
    node(id: $id) {
      ... on AppSubscription {
        id
        name
        status
        trialDays
        currentPeriodEnd
        test
      }
    }
  }
`

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  })
}

function buildRedirect(nextPath, params) {
  const u = new URL(nextPath || '/dashboard/billing', 'https://actero.fr')
  for (const [k, v] of Object.entries(params)) {
    if (v != null) u.searchParams.set(k, String(v))
  }
  // Vercel respects relative path + query when we 302 — strip the host.
  return `${u.pathname}${u.search}`
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'supabase_not_configured' })
  }

  const {
    charge_id: chargeId,
    client_id: clientId,
    plan,
    period,
    next,
  } = req.query || {}

  if (!clientId || !plan) {
    return res.status(400).json({ error: 'missing_params' })
  }

  const supabase = getSupabase()

  // Resolve the merchant's shop access token so we can verify the charge.
  const { data: connection } = await supabase
    .from('client_shopify_connections')
    .select('shop_domain, access_token')
    .eq('client_id', clientId)
    .maybeSingle()

  if (!connection?.shop_domain || !connection?.access_token) {
    return res.redirect(
      302,
      buildRedirect(next, { billing_error: 'no_shopify_connection' }),
    )
  }

  const accessToken =
    decryptToken(connection.access_token) || connection.access_token

  // Reconstruct the AppSubscription GID from the numeric charge_id. If Shopify
  // didn't pass one (merchant clicked Decline), fall back to the pending id we
  // saved in clients.pending_shopify_subscription_id.
  let subscriptionGid = null
  if (chargeId) {
    subscriptionGid = `gid://shopify/AppSubscription/${chargeId}`
  } else {
    const { data: pending } = await supabase
      .from('clients')
      .select('pending_shopify_subscription_id')
      .eq('id', clientId)
      .maybeSingle()
    subscriptionGid = pending?.pending_shopify_subscription_id || null
  }

  if (!subscriptionGid) {
    return res.redirect(
      302,
      buildRedirect(next, { billing_error: 'no_subscription_id' }),
    )
  }

  // Query Shopify for the actual status AND name.
  let status = null
  let subscriptionNode = null
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
        body: JSON.stringify({
          query: APP_SUBSCRIPTION_QUERY,
          variables: { id: subscriptionGid },
        }),
      },
    )
    const json = await resp.json()
    subscriptionNode = json?.data?.node || null
    status = subscriptionNode?.status || null
  } catch (err) {
    console.error('[shopify-callback] verify failed:', err.message)
    return res.redirect(
      302,
      buildRedirect(next, { billing_error: 'verify_failed' }),
    )
  }

  // SECURITY: derive the plan from the VERIFIED subscription name
  // ("Actero Pro (monthly)") — never trust the `plan` query param, which the
  // merchant controls and could set to a higher tier than they pay for.
  const KNOWN_PLANS = ['starter', 'pro']
  const nameMatch = /^Actero\s+([A-Za-z]+)\s*\((monthly|annual)\)/i.exec(
    subscriptionNode?.name || '',
  )
  const verifiedPlan = nameMatch ? nameMatch[1].toLowerCase() : null
  const verifiedPeriod = nameMatch ? nameMatch[2].toLowerCase() : period || 'monthly'

  if (status === 'PENDING') {
    // Charge created but not yet accepted/paid — do NOT grant. The
    // app_subscriptions/update webhook flips the plan once it turns ACTIVE.
    return res.redirect(302, buildRedirect(next, { billing_status: 'pending' }))
  }

  if (status !== 'ACTIVE' || !verifiedPlan || !KNOWN_PLANS.includes(verifiedPlan)) {
    // Declined, expired, or an unrecognised subscription — clear pending, no grant.
    await supabase
      .from('clients')
      .update({ pending_shopify_subscription_id: null })
      .eq('id', clientId)
    return res.redirect(
      302,
      buildRedirect(next, { billing_status: status || 'declined' }),
    )
  }

  // Charge is ACTIVE and the plan is derived from the verified subscription.
  await supabase
    .from('clients')
    .update({
      plan: verifiedPlan,
      billing_period: verifiedPeriod,
      billing_provider: 'shopify',
      shopify_subscription_id: subscriptionGid,
      pending_shopify_subscription_id: null,
    })
    .eq('id', clientId)

  return res.redirect(
    302,
    buildRedirect(next, {
      billing_status: 'active',
      plan: verifiedPlan,
      provider: 'shopify',
    }),
  )
}

export default withSentry(handler)
