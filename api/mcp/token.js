/**
 * MCP OAuth — Token endpoint
 *
 * POST /api/mcp/token
 * Body: { grant_type: 'authorization_code', code, code_verifier?, client_id?, redirect_uri? }
 *
 * Exchanges an authorization code for an access token.
 */
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Parse body — supports both JSON and form-urlencoded
  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch {
      // Try as form-urlencoded
      body = Object.fromEntries(new URLSearchParams(body))
    }
  }
  // If content-type is form-urlencoded, body may already be parsed by Vercel
  const { grant_type, code, code_verifier } = body || {}

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' })
  }

  if (!code) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'code required' })
  }

  // Look up the code
  const { data: authCode } = await supabase
    .from('mcp_auth_codes')
    .select('*')
    .eq('code', code)
    .eq('used', false)
    .maybeSingle()

  if (!authCode) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Code invalid or expired' })
  }

  // Check expiry
  if (new Date(authCode.expires_at) < new Date()) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Code expired' })
  }

  // Verify PKCE code_challenge if present
  if (authCode.code_challenge && authCode.code_challenge_method === 'S256') {
    if (!code_verifier) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'code_verifier required' })
    }
    const expectedChallenge = crypto
      .createHash('sha256')
      .update(code_verifier)
      .digest('base64url')
    if (expectedChallenge !== authCode.code_challenge) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' })
    }
  }

  // Mark code as used
  await supabase.from('mcp_auth_codes').update({ used: true }).eq('code', code)

  // Return the access token
  return res.status(200).json({
    access_token: authCode.access_token,
    token_type: 'Bearer',
    expires_in: 3600,
  })
}
