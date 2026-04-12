/**
 * MCP OAuth — Dynamic Client Registration (RFC 7591)
 *
 * POST /register (or /api/mcp/register via rewrite)
 *
 * MCP clients register themselves automatically before starting the OAuth flow.
 * We accept any registration and return a client_id.
 */
import crypto from 'crypto'

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, MCP-Protocol-Version')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})

  const clientId = 'actero_' + crypto.randomBytes(16).toString('hex')

  console.log('[mcp/register] New client registered:', {
    client_name: body.client_name,
    redirect_uris: body.redirect_uris,
    client_id: clientId,
  })

  return res.status(201).json({
    client_id: clientId,
    client_name: body.client_name || 'MCP Client',
    redirect_uris: body.redirect_uris || [],
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  })
}
