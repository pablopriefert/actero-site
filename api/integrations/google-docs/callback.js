/**
 * Google Docs OAuth — Callback.
 * Exchanges the code for tokens and stores them in client_integrations.
 */
import { withSentry } from '../../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { encryptToken } from '../../lib/crypto.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SITE_URL = process.env.PUBLIC_API_URL || 'https://actero.fr'
const REDIRECT_URI = `${SITE_URL}/api/integrations/google-docs/callback`

async function handler(req, res) {
  const { code, state, error: oauthError } = req.query

  const redirectBack = (query) => {
    const params = new URLSearchParams(query)
    res.setHeader('Location', `${SITE_URL}/client/integrations?${params}`)
    res.status(302).end()
  }

  if (oauthError) return redirectBack({ integration: 'google_docs', status: 'error', message: oauthError })
  if (!code || !state) return redirectBack({ integration: 'google_docs', status: 'error', message: 'missing_code' })

  let clientId, userId
  try {
    const decoded = Buffer.from(state, 'base64url').toString()
    const [cid, uid, ts] = decoded.split('|')
    if (Date.now() - parseInt(ts, 10) > 10 * 60 * 1000) throw new Error('state_expired')
    clientId = cid
    userId = uid
  } catch {
    return redirectBack({ integration: 'google_docs', status: 'error', message: 'invalid_state' })
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })
    const tokens = await tokenRes.json()
    if (!tokenRes.ok) return redirectBack({ integration: 'google_docs', status: 'error', message: tokens.error || 'token_exchange' })

    // Fetch user profile for display
    let email = null
    try {
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (profileRes.ok) {
        const profile = await profileRes.json()
        email = profile.email
      }
    } catch { /* silent */ }

    // Upsert integration
    const { error: upsertErr } = await supabase.from('client_integrations').upsert({
      client_id: clientId,
      provider: 'google_docs',
      provider_label: 'Google Docs',
      auth_type: 'oauth',
      status: 'active',
      access_token: encryptToken(tokens.access_token),
      refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      extra_config: { email, scopes: tokens.scope },
      connected_at: new Date().toISOString(),
    }, { onConflict: 'client_id,provider' })

    if (upsertErr) {
      console.error('[google-docs/callback] DB upsert error:', upsertErr.message)
      return redirectBack({ integration: 'google_docs', status: 'error', message: upsertErr.message })
    }

    return redirectBack({ integration: 'google_docs', status: 'success' })
  } catch (err) {
    console.error('[google-docs/callback]', err.message)
    return redirectBack({ integration: 'google_docs', status: 'error', message: err.message })
  }
}

export default withSentry(handler)
