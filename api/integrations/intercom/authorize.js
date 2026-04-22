/**
 * Intercom OAuth — Authorize step.
 *
 * GET /api/integrations/intercom/authorize?client_id=xxx&token=xxx
 * Requires env: INTERCOM_OAUTH_CLIENT_ID, INTERCOM_OAUTH_CLIENT_SECRET
 */
import { withSentry } from '../../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SITE_URL = process.env.PUBLIC_API_URL || 'https://actero.fr'
const REDIRECT_URI = `${SITE_URL}/api/integrations/intercom/callback`

async function handler(req, res) {
  const { client_id: clientId, token } = req.query
  if (!clientId || !token) return res.status(400).send('Missing client_id or token')
  if (!process.env.INTERCOM_OAUTH_CLIENT_ID) return res.status(500).send('INTERCOM_OAUTH_CLIENT_ID manquant')

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).send('Non autorisé')

  const { data: link } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .maybeSingle()
  if (!link) return res.status(403).send('Accès refusé')

  const state = Buffer.from(`${clientId}|${user.id}|${Date.now()}`).toString('base64url')

  const params = new URLSearchParams({
    client_id: process.env.INTERCOM_OAUTH_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    state,
    response_type: 'code',
  })

  res.setHeader('Location', `https://app.intercom.com/oauth?${params}`)
  return res.status(302).end()
}

export default withSentry(handler)
