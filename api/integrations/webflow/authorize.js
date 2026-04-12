/**
 * Webflow OAuth — Step 1: Redirect to Webflow authorize
 *
 * GET /api/integrations/webflow/authorize?client_id=xxx&token=jwt
 *
 * Redirects the user to Webflow's OAuth2 authorize endpoint.
 * After the user approves, Webflow redirects back to /callback with a code.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const webflowClientId = process.env.WEBFLOW_CLIENT_ID
  if (!webflowClientId) {
    return res.status(503).json({
      error: 'WEBFLOW_CLIENT_ID not configured',
      hint: 'Add WEBFLOW_CLIENT_ID to your Vercel environment variables.',
    })
  }

  const { client_id, token } = req.query
  if (!client_id || !token) {
    return res.status(400).json({ error: 'client_id and token required' })
  }

  const siteUrl = process.env.PUBLIC_API_URL || process.env.SITE_URL || 'https://actero.fr'
  const redirectUri = `${siteUrl}/api/integrations/webflow/callback`

  // State param = client_id:token (so callback knows which client + can verify auth)
  const state = `${client_id}:${token}`

  const params = new URLSearchParams({
    client_id: webflowClientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
    scope: 'sites:read ecommerce:read',
  })

  const authorizeUrl = `https://webflow.com/oauth/authorize?${params.toString()}`

  return res.redirect(302, authorizeUrl)
}
