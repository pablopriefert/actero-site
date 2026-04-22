/**
 * WooCommerce OAuth — Step 1: Generate authorization URL
 *
 * The client provides their WooCommerce store URL. We redirect them
 * to their own WordPress with the wc-auth endpoint, which shows an
 * "Authorize Actero?" screen. On approval, WooCommerce POSTs the
 * consumer_key + consumer_secret to our callback endpoint.
 *
 * GET /api/integrations/woocommerce/authorize?store_url=https://boutique.com&client_id=xxx&token=jwt
 */
import { withSentry } from '../../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { store_url, client_id, token } = req.query

  // Auth
  if (!token) return res.status(401).json({ error: 'Missing token' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  // Validate inputs
  if (!store_url || !client_id) {
    return res.status(400).json({ error: 'store_url and client_id required' })
  }

  // Normalize store URL (remove trailing slash, ensure https)
  let normalizedUrl = store_url.trim().replace(/\/+$/, '')
  if (!normalizedUrl.startsWith('http')) {
    normalizedUrl = 'https://' + normalizedUrl
  }

  // Verify user has access to this client
  const { data: link } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .eq('client_id', client_id)
    .maybeSingle()
  if (!link) return res.status(403).json({ error: 'Access denied' })

  // Build the WooCommerce authorization URL
  // Docs: https://woocommerce.github.io/woocommerce-rest-api-docs/#authentication
  const siteUrl = process.env.PUBLIC_API_URL || process.env.SITE_URL || 'https://actero.fr'
  const callbackUrl = `${siteUrl}/api/integrations/woocommerce/callback`
  const returnUrl = `${siteUrl}/client/integrations?integration=woocommerce&status=success`

  const params = new URLSearchParams({
    app_name: 'Actero',
    scope: 'read_write',
    user_id: client_id, // We use client_id as user_id so the callback knows which client
    return_url: returnUrl,
    callback_url: callbackUrl,
  })

  const authUrl = `${normalizedUrl}/wc-auth/v1/authorize?${params.toString()}`

  // Store the pending connection attempt
  try {
    await supabase.from('client_integrations').upsert({
      client_id,
      provider: 'woocommerce',
      status: 'pending',
      extra_config: { store_url: normalizedUrl },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id,provider' })
  } catch (err) {
    console.warn('[woo/authorize] Failed to store pending state:', err.message)
  }

  // Redirect the user to their WooCommerce store
  return res.redirect(302, authUrl)
}

export default withSentry(handler)
