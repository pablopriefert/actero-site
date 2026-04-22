/**
 * Google Docs OAuth — Authorize step.
 *
 * GET /api/integrations/google-docs/authorize?client_id=xxx&token=xxx
 *
 * Redirects the user to Google OAuth consent with scopes to read Docs & Drive metadata.
 * Requires env: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET
 */
import { withSentry } from '../../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SITE_URL = process.env.PUBLIC_API_URL || 'https://actero.fr'
const REDIRECT_URI = `${SITE_URL}/api/integrations/google-docs/callback`

const SCOPES = [
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ')

async function handler(req, res) {
  const { client_id: clientId, token } = req.query
  if (!clientId || !token) return res.status(400).send('Missing client_id or token')
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID) return res.status(500).send('GOOGLE_OAUTH_CLIENT_ID manquant')

  // Verify the token belongs to this client
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).send('Non autorisé')

  const { data: link } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .maybeSingle()
  if (!link) return res.status(403).send('Accès refusé')

  // State = base64(clientId|userId) — short-lived, verified on callback
  const state = Buffer.from(`${clientId}|${user.id}|${Date.now()}`).toString('base64url')

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  res.setHeader('Location', `https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  return res.status(302).end()
}

export default withSentry(handler)
