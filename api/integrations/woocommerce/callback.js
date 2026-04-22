/**
 * WooCommerce OAuth — Step 2: Receive keys callback
 *
 * After the merchant approves the app on their WordPress, WooCommerce
 * sends a POST request to this endpoint with the generated API keys.
 *
 * POST /api/integrations/woocommerce/callback
 * Body (JSON): { key_id, user_id (=client_id), consumer_key, consumer_secret, key_permissions }
 *
 * This endpoint is called by WooCommerce's server, NOT by the user's browser.
 * No JWT auth — we verify via the client_id (user_id param) and update the integration.
 */
import { withSentry } from '../../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { encryptToken } from '../../lib/crypto.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body

    const {
      key_id,
      user_id: clientId, // We set user_id = client_id in the authorize step
      consumer_key,
      consumer_secret,
      key_permissions,
    } = body || {}

    if (!clientId || !consumer_key || !consumer_secret) {
      console.error('[woo/callback] Missing required fields:', { clientId: !!clientId, ck: !!consumer_key, cs: !!consumer_secret })
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Verify client exists
    const { data: client } = await supabase
      .from('clients')
      .select('id, brand_name')
      .eq('id', clientId)
      .maybeSingle()

    if (!client) {
      console.error('[woo/callback] Client not found:', clientId)
      return res.status(404).json({ error: 'Client not found' })
    }

    // Get the pending integration to retrieve the store_url
    const { data: existing } = await supabase
      .from('client_integrations')
      .select('id, extra_config')
      .eq('client_id', clientId)
      .eq('provider', 'woocommerce')
      .maybeSingle()

    const storeUrl = existing?.extra_config?.store_url || null

    // Upsert the integration with the received keys
    const { error: upsertErr } = await supabase
      .from('client_integrations')
      .upsert({
        client_id: clientId,
        provider: 'woocommerce',
        status: 'active',
        api_key: encryptToken(consumer_key),
        extra_config: {
          store_url: storeUrl,
          consumer_secret: encryptToken(consumer_secret),
          key_id: key_id,
          key_permissions: key_permissions,
          connected_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id,provider' })

    if (upsertErr) {
      console.error('[woo/callback] Upsert error:', upsertErr.message)
      return res.status(500).json({ error: 'Failed to save integration' })
    }

    console.log(`[woo/callback] WooCommerce connected for client ${client.brand_name} (${clientId})`)

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[woo/callback] Error:', err.message)
    return res.status(500).json({ error: 'Internal error' })
  }
}

export default withSentry(handler)
