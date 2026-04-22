/**
 * Notion OAuth — Callback.
 */
import { withSentry } from '../../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { encryptToken } from '../../lib/crypto.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SITE_URL = process.env.PUBLIC_API_URL || 'https://actero.fr'
const REDIRECT_URI = `${SITE_URL}/api/integrations/notion/callback`

async function handler(req, res) {
  const { code, state, error: oauthError } = req.query

  const redirectBack = (query) => {
    const params = new URLSearchParams(query)
    res.setHeader('Location', `${SITE_URL}/client/integrations?${params}`)
    res.status(302).end()
  }

  if (oauthError) return redirectBack({ integration: 'notion', status: 'error', message: oauthError })
  if (!code || !state) return redirectBack({ integration: 'notion', status: 'error', message: 'missing_code' })

  let clientId
  try {
    const decoded = Buffer.from(state, 'base64url').toString()
    const [cid, , ts] = decoded.split('|')
    if (Date.now() - parseInt(ts, 10) > 10 * 60 * 1000) throw new Error('state_expired')
    clientId = cid
  } catch {
    return redirectBack({ integration: 'notion', status: 'error', message: 'invalid_state' })
  }

  try {
    const basicAuth = Buffer.from(`${process.env.NOTION_OAUTH_CLIENT_ID}:${process.env.NOTION_OAUTH_CLIENT_SECRET}`).toString('base64')
    const tokenRes = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    })
    const tokens = await tokenRes.json()
    if (!tokenRes.ok) return redirectBack({ integration: 'notion', status: 'error', message: tokens.error || 'token_exchange' })

    const { error: upsertErr } = await supabase.from('client_integrations').upsert({
      client_id: clientId,
      provider: 'notion',
      provider_label: 'Notion',
      auth_type: 'oauth',
      status: 'active',
      access_token: encryptToken(tokens.access_token),
      extra_config: {
        workspace_name: tokens.workspace_name,
        workspace_icon: tokens.workspace_icon,
        workspace_id: tokens.workspace_id,
        bot_id: tokens.bot_id,
        owner: tokens.owner,
      },
      connected_at: new Date().toISOString(),
    }, { onConflict: 'client_id,provider' })

    if (upsertErr) {
      console.error('[notion/callback] DB upsert error:', upsertErr.message)
      return redirectBack({ integration: 'notion', status: 'error', message: upsertErr.message })
    }

    return redirectBack({ integration: 'notion', status: 'success' })
  } catch (err) {
    console.error('[notion/callback]', err.message)
    return redirectBack({ integration: 'notion', status: 'error', message: err.message })
  }
}

export default withSentry(handler)
