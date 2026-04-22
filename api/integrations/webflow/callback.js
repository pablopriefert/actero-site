/**
 * Webflow OAuth — Step 2: Exchange code for access token
 *
 * GET /api/integrations/webflow/callback?code=xxx&state=client_id:token
 *
 * Webflow redirects here after the user approves. We exchange the
 * authorization code for an access token, then store it in client_integrations.
 */
import { withSentry } from '../../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { encryptToken } from '../../lib/crypto.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code, state } = req.query
  const siteUrl = process.env.PUBLIC_API_URL || process.env.SITE_URL || 'https://actero.fr'

  if (!code || !state) {
    return res.redirect(302, `${siteUrl}/client/integrations?integration=webflow&status=error&message=missing_code`)
  }

  // Parse state = "client_id:token"
  const colonIdx = state.indexOf(':')
  if (colonIdx === -1) {
    return res.redirect(302, `${siteUrl}/client/integrations?integration=webflow&status=error&message=invalid_state`)
  }
  const clientId = state.slice(0, colonIdx)
  const token = state.slice(colonIdx + 1)

  // Verify auth
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) {
    return res.redirect(302, `${siteUrl}/client/integrations?integration=webflow&status=error&message=auth_failed`)
  }

  // Verify user has access to client
  const { data: link } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .maybeSingle()
  if (!link) {
    return res.redirect(302, `${siteUrl}/client/integrations?integration=webflow&status=error&message=access_denied`)
  }

  try {
    // Exchange code for access token
    const webflowClientId = process.env.WEBFLOW_CLIENT_ID
    const webflowClientSecret = process.env.WEBFLOW_CLIENT_SECRET
    const redirectUri = `${siteUrl}/api/integrations/webflow/callback`

    const tokenRes = await fetch('https://api.webflow.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: webflowClientId,
        client_secret: webflowClientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[webflow/callback] Token exchange failed:', tokenData)
      return res.redirect(302, `${siteUrl}/client/integrations?integration=webflow&status=error&message=token_failed`)
    }

    const accessToken = tokenData.access_token

    // Fetch user/site info to display in the dashboard
    let siteName = null
    try {
      const sitesRes = await fetch('https://api.webflow.com/v2/sites', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const sitesData = await sitesRes.json()
      if (sitesData?.sites?.[0]) {
        siteName = sitesData.sites[0].displayName || sitesData.sites[0].shortName
      }
    } catch { /* non-critical */ }

    // Store the integration
    const { error: upsertErr } = await supabase
      .from('client_integrations')
      .upsert({
        client_id: clientId,
        provider: 'webflow',
        provider_label: 'Webflow',
        auth_type: 'oauth',
        status: 'active',
        api_key: encryptToken(accessToken),
        extra_config: {
          site_name: siteName,
          connected_at: new Date().toISOString(),
          token_type: 'bearer',
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id,provider' })

    if (upsertErr) {
      console.error('[webflow/callback] Upsert error:', upsertErr.message)
      return res.redirect(302, `${siteUrl}/client/integrations?integration=webflow&status=error&message=save_failed`)
    }

    console.log(`[webflow/callback] Webflow connected for client ${clientId} (site: ${siteName})`)

    return res.redirect(302, `${siteUrl}/client/integrations?integration=webflow&status=success`)
  } catch (err) {
    console.error('[webflow/callback] Error:', err.message)
    return res.redirect(302, `${siteUrl}/client/integrations?integration=webflow&status=error&message=internal`)
  }
}

export default withSentry(handler)
