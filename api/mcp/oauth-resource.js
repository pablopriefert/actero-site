/**
 * OAuth Protected Resource Metadata
 * Tells MCP clients where to find the authorization server
 */
import { withSentry } from '../lib/sentry.js'
function handler(req, res) {
  const siteUrl = process.env.PUBLIC_API_URL || 'https://actero.fr'

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') return res.status(200).end()

  return res.status(200).json({
    resource: `${siteUrl}/api/mcp`,
    authorization_servers: [siteUrl],
  })
}

export default withSentry(handler)
