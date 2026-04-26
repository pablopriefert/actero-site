/**
 * GET /api/integrations/oauth/linear/callback?code=…&state=…
 *
 * Handles the redirect from Linear's OAuth screen:
 *   1. Verify state and the original Supabase user token
 *   2. Exchange code → access_token (Linear personal-app tokens last ~10y)
 *   3. Fetch the merchant's teams via GraphQL — store the full list in
 *      extra_config so the UI can offer a switcher; pre-select the first
 *      team in client_settings as the default issue destination
 *   4. Upsert into client_integrations + client_settings, redirect back
 *      to the dashboard
 *
 * No new env beyond LINEAR_CLIENT_ID / LINEAR_CLIENT_SECRET / LINEAR_REDIRECT_URI.
 */
import { createClient } from '@supabase/supabase-js'
import { encryptToken } from '../../../lib/crypto.js'
import { withSentry } from '../../../lib/sentry.js'

const TOKEN_ENDPOINT = 'https://api.linear.app/oauth/token'
const GRAPHQL_ENDPOINT = 'https://api.linear.app/graphql'

async function handler(req, res) {
  const { code, state, error: oauthError } = req.query
  if (oauthError) return res.redirect(302, '/client/integrations?error=linear_denied')
  if (!code || !state) return res.redirect(302, '/client/integrations?error=linear_missing_params')

  const [, userToken] = String(state).split(':')
  if (!userToken) return res.redirect(302, '/client/integrations?error=linear_invalid_state')

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(userToken)
  if (authError || !user) return res.redirect(302, '/client/integrations?error=linear_auth_failed')

  const redirectUri = process.env.LINEAR_REDIRECT_URI
    || 'https://actero.fr/api/integrations/oauth/linear/callback'

  // 1) Token exchange
  let tokenJson
  try {
    const resp = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.LINEAR_CLIENT_ID || '',
        client_secret: process.env.LINEAR_CLIENT_SECRET || '',
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    tokenJson = await resp.json()
    if (!resp.ok || !tokenJson.access_token) {
      return res.redirect(302, `/client/integrations?error=linear_token_failed&detail=${encodeURIComponent(tokenJson.error || resp.status)}`)
    }
  } catch {
    return res.redirect(302, '/client/integrations?error=linear_token_exception')
  }

  const accessToken = tokenJson.access_token

  // 2) Resolve client_id for this user
  const [{ data: link }, { data: ownedClient }] = await Promise.all([
    supabase.from('client_users').select('client_id').eq('user_id', user.id).maybeSingle(),
    supabase.from('clients').select('id').eq('owner_user_id', user.id).maybeSingle(),
  ])
  const clientId = link?.client_id || ownedClient?.id
  if (!clientId) return res.redirect(302, '/client/integrations?error=linear_no_client')

  // 3) Fetch viewer + teams via GraphQL — same call we already use in lib/linear.js
  let teams = []
  let viewer = null
  try {
    const gqlResp = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query { viewer { id name email } teams(first: 50) { nodes { id key name } } }`,
      }),
    })
    const gqlData = await gqlResp.json().catch(() => ({}))
    teams = gqlData?.data?.teams?.nodes || []
    viewer = gqlData?.data?.viewer || null
  } catch {
    // Non-fatal — we still persist the token; UI prompts to pick a team later.
  }

  const defaultTeam = teams[0] || null

  // 4) Persist token in client_integrations (mirrors Slack pattern)
  const { error: integErr } = await supabase
    .from('client_integrations')
    .upsert({
      client_id: clientId,
      provider: 'linear',
      provider_label: 'Linear',
      auth_type: 'oauth',
      access_token: encryptToken(accessToken),
      extra_config: {
        viewer_id: viewer?.id,
        viewer_name: viewer?.name,
        viewer_email: viewer?.email,
        teams_available: teams.map((t) => ({ id: t.id, key: t.key, name: t.name })),
      },
      scopes: (tokenJson.scope || '').split(/[\s,]+/).filter(Boolean),
      status: 'active',
      connected_at: new Date().toISOString(),
      last_checked_at: new Date().toISOString(),
    }, { onConflict: 'client_id,provider' })

  if (integErr) {
    return res.redirect(302, `/client/integrations?error=linear_db_error`)
  }

  // 5) Store the default team on client_settings so handleEscalation has it
  if (defaultTeam) {
    await supabase
      .from('client_settings')
      .upsert({
        client_id: clientId,
        linear_team_id: defaultTeam.id,
        linear_team_name: defaultTeam.name,
      }, { onConflict: 'client_id' })
  }

  return res.redirect(302, '/client/integrations?success=linear')
}

export default withSentry(handler)
