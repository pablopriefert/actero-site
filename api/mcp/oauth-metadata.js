/**
 * OAuth Authorization Server Metadata (RFC 8414)
 * Tells MCP clients the OAuth endpoints for authorization
 */
export default function handler(req, res) {
  const siteUrl = process.env.PUBLIC_API_URL || 'https://actero.fr'

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') return res.status(200).end()

  return res.status(200).json({
    issuer: siteUrl,
    authorization_endpoint: `${siteUrl}/authorize`,
    token_endpoint: `${siteUrl}/token`,
    registration_endpoint: `${siteUrl}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['actero'],
  })
}
