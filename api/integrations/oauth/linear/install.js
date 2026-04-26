/**
 * GET /api/integrations/oauth/linear/install?token=<supabase_access_token>
 *
 * Redirects the merchant to Linear's OAuth screen. After approval Linear
 * sends them back to /api/integrations/oauth/linear/callback with the code.
 *
 * State is "<nonce>:<userToken>" — same pattern as Slack so the callback can
 * verify the user without holding session cookies across third parties.
 *
 * Required env: LINEAR_CLIENT_ID, LINEAR_REDIRECT_URI
 */
import crypto from 'crypto'
import { withSentry } from '../../../lib/sentry.js'

async function handler(req, res) {
  const { token } = req.query
  if (!token) return res.status(400).send('Missing user token')

  const clientId = process.env.LINEAR_CLIENT_ID
  if (!clientId) return res.status(500).send('LINEAR_CLIENT_ID env missing')

  const redirectUri = process.env.LINEAR_REDIRECT_URI
    || 'https://actero.fr/api/integrations/oauth/linear/callback'

  const nonce = crypto.randomBytes(16).toString('hex')
  const state = `${nonce}:${token}`

  // Scopes: read = list teams + viewer; issues:create = file new issues.
  // We don't need write (which gives full edit rights) — least privilege.
  const scope = 'read,issues:create'
  // actor=user → issues are attributed to the merchant's Linear user (clearer
  // audit trail than actor=app, which would attribute to the OAuth bot user).
  const url = `https://linear.app/oauth/authorize?client_id=${clientId}`
    + `&redirect_uri=${encodeURIComponent(redirectUri)}`
    + `&response_type=code`
    + `&scope=${encodeURIComponent(scope)}`
    + `&state=${encodeURIComponent(state)}`
    + `&actor=user`

  res.redirect(302, url)
}

export default withSentry(handler)
