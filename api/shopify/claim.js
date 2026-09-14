/**
 * POST /api/shopify/claim
 *
 * Attaches a Shopify shop that was installed from the App Store — before the
 * merchant had an Actero account — to the account they just created.
 *
 * Flow: api/shopify/callback.js creates the client for an App-Store-first
 * install and mints a signed `claim` token (AES-GCM, server key only). The
 * merchant signs up, the front-end posts that token here with its Supabase
 * bearer token, and we link the authenticated user to the client as owner.
 *
 * Body: { token }  ·  Header: Authorization: Bearer <supabase access token>
 * Returns: { client_id, shop_domain }
 *
 * Safety: the token is authenticated encryption (unforgeable without the server
 * key) and carries an expiry. A client that already has an owner cannot be
 * hijacked — we only attach when it is still unclaimed.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { decryptToken } from '../lib/crypto.js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const bearer = req.headers.authorization?.replace(/^Bearer\s+/, '')
  if (!bearer) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(bearer)
  if (authError || !user) return res.status(401).json({ error: 'unauthorized' })

  const { token } = req.body || {}
  if (!token) return res.status(400).json({ error: 'missing_token' })

  // --- Verify the claim token ---
  let payload
  try {
    payload = JSON.parse(decryptToken(token) || '{}')
  } catch {
    return res.status(400).json({ error: 'invalid_token' })
  }
  const { cid, shop, exp } = payload || {}
  if (!cid || !shop) return res.status(400).json({ error: 'invalid_token' })
  if (!exp || Date.now() > exp) return res.status(410).json({ error: 'token_expired' })

  // --- The client must exist and still be unclaimed ---
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('id, owner_user_id')
    .eq('id', cid)
    .maybeSingle()
  if (!client) return res.status(404).json({ error: 'client_not_found' })

  // Already claimed: succeed only if it's the same user (idempotent retry),
  // never let a second user take over the shop.
  if (client.owner_user_id && client.owner_user_id !== user.id) {
    return res.status(409).json({ error: 'already_claimed' })
  }

  // --- Confirm the token really matches this client's connected shop ---
  const { data: connection } = await supabaseAdmin
    .from('client_shopify_connections')
    .select('shop_domain')
    .eq('client_id', cid)
    .maybeSingle()
  if (connection?.shop_domain && connection.shop_domain !== shop) {
    return res.status(400).json({ error: 'shop_mismatch' })
  }

  // --- Attach ---
  if (!client.owner_user_id) {
    await supabaseAdmin.from('clients').update({ owner_user_id: user.id }).eq('id', cid)
  }

  const { data: existingLink } = await supabaseAdmin
    .from('client_users')
    .select('id')
    .eq('client_id', cid)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existingLink) {
    const { error: linkError } = await supabaseAdmin.from('client_users').insert({
      client_id: cid,
      user_id: user.id,
      role: 'owner',
      email: user.email,
    })
    if (linkError) {
      console.error('[shopify/claim] link insert failed:', linkError.message)
      return res.status(500).json({ error: 'link_failed' })
    }
  }

  // Default settings row so the dashboard has somewhere to write preferences.
  try {
    const { data: settings } = await supabaseAdmin
      .from('client_settings').select('client_id').eq('client_id', cid).maybeSingle()
    if (!settings) await supabaseAdmin.from('client_settings').insert({ client_id: cid })
  } catch { /* non-blocking */ }

  return res.status(200).json({ client_id: cid, shop_domain: shop })
}

export default withSentry(handler)
