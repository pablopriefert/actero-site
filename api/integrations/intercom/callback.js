/**
 * Intercom OAuth — Callback.
 */
import { createClient } from '@supabase/supabase-js'
import { encryptToken } from '../../lib/crypto.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SITE_URL = process.env.PUBLIC_API_URL || 'https://actero.fr'
const REDIRECT_URI = `${SITE_URL}/api/integrations/intercom/callback`

export default async function handler(req, res) {
  const { code, state, error: oauthError } = req.query

  const redirectBack = (query) => {
    const params = new URLSearchParams(query)
    res.setHeader('Location', `${SITE_URL}/client/integrations?${params}`)
    res.status(302).end()
  }

  if (oauthError) return redirectBack({ integration: 'intercom', status: 'error', message: oauthError })
  if (!code || !state) return redirectBack({ integration: 'intercom', status: 'error', message: 'missing_code' })

  let clientId
  try {
    const decoded = Buffer.from(state, 'base64url').toString()
    const [cid, , ts] = decoded.split('|')
    if (Date.now() - parseInt(ts, 10) > 10 * 60 * 1000) throw new Error('state_expired')
    clientId = cid
  } catch {
    return redirectBack({ integration: 'intercom', status: 'error', message: 'invalid_state' })
  }

  try {
    const tokenRes = await fetch('https://api.intercom.io/auth/eagle/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.INTERCOM_OAUTH_CLIENT_ID,
        client_secret: process.env.INTERCOM_OAUTH_CLIENT_SECRET,
      }),
    })
    const tokens = await tokenRes.json()
    if (!tokenRes.ok || !tokens.access_token) {
      return redirectBack({ integration: 'intercom', status: 'error', message: tokens.error || 'token_exchange' })
    }

    // Fetch workspace info
    let workspaceName = null
    let adminEmail = null
    try {
      const meRes = await fetch('https://api.intercom.io/me', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: 'application/json',
        },
      })
      if (meRes.ok) {
        const me = await meRes.json()
        workspaceName = me.app?.name
        adminEmail = me.email
      }
    } catch { /* silent */ }

    const { error: upsertErr } = await supabase.from('client_integrations').upsert({
      client_id: clientId,
      provider: 'intercom',
      provider_label: 'Intercom',
      auth_type: 'oauth',
      status: 'active',
      access_token: encryptToken(tokens.access_token),
      extra_config: {
        token_type: tokens.token_type,
        workspace_name: workspaceName,
        admin_email: adminEmail,
      },
      connected_at: new Date().toISOString(),
    }, { onConflict: 'client_id,provider' })

    if (upsertErr) {
      console.error('[intercom/callback] DB upsert error:', upsertErr.message)
      return redirectBack({ integration: 'intercom', status: 'error', message: upsertErr.message })
    }

    return redirectBack({ integration: 'intercom', status: 'success' })
  } catch (err) {
    console.error('[intercom/callback]', err.message)
    return redirectBack({ integration: 'intercom', status: 'error', message: err.message })
  }
}
