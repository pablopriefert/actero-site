/**
 * MCP OAuth — Token endpoint
 *
 * POST /api/mcp/token
 * Body (JSON or form-urlencoded):
 *   grant_type=authorization_code&code=xxx&code_verifier=xxx
 *
 * Exchanges an authorization code for a LONG-LIVED access token.
 * Instead of returning the short-lived Supabase JWT, we auto-create
 * a client API key that never expires.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  // Parse body — supports JSON, form-urlencoded, and raw string
  let params = {}
  try {
    if (req.body && typeof req.body === 'object') {
      params = req.body
    } else if (typeof req.body === 'string') {
      try { params = JSON.parse(req.body) } catch {
        params = Object.fromEntries(new URLSearchParams(req.body))
      }
    }
  } catch {
    console.error('[mcp/token] Body parse error')
  }

  const grant_type = params.grant_type
  const code = params.code
  const code_verifier = params.code_verifier
  const refresh_token = params.refresh_token

  // Verbose log — one console.log per field so Vercel's log table view
  // doesn't truncate them. Strip secrets.
  console.log('[mcp/token] field grant_type:', grant_type)
  console.log('[mcp/token] field client_id:', params.client_id)
  console.log('[mcp/token] field redirect_uri:', params.redirect_uri)
  console.log('[mcp/token] field scope:', params.scope)
  console.log('[mcp/token] field resource:', params.resource)
  console.log('[mcp/token] field audience:', params.audience)
  console.log('[mcp/token] field has_code:', !!code)
  console.log('[mcp/token] field has_verifier:', !!code_verifier)
  console.log('[mcp/token] field has_refresh:', !!refresh_token)
  console.log('[mcp/token] field all_keys:', Object.keys(params).join(','))
  console.log('[mcp/token] header user-agent:', req.headers['user-agent'])
  console.log('[mcp/token] header origin:', req.headers.origin)
  console.log('[mcp/token] header referer:', req.headers.referer)
  console.log('[mcp/token] header content-type:', req.headers['content-type'])
  console.log('[mcp/token] header accept:', req.headers.accept)
  console.log('[mcp/token] header authorization:', req.headers.authorization ? 'present' : 'absent')

  // Handle refresh_token grant — return the same token (our API keys don't expire)
  if (grant_type === 'refresh_token') {
    if (!refresh_token) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'refresh_token required' })
    }
    // Look up the API key that matches this refresh token (we use the same value)
    const { data: keyRow } = await supabase
      .from('client_api_keys')
      .select('key_value, client_id')
      .eq('key_value', refresh_token)
      .eq('is_active', true)
      .maybeSingle()

    if (!keyRow) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid refresh token' })
    }

    console.log('[mcp/token] Refresh success for client:', keyRow.client_id)
    return res.status(200).json({
      access_token: keyRow.key_value,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: keyRow.key_value,
      scope: 'actero',
    })
  }

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type', error_description: `Expected authorization_code, got ${grant_type}` })
  }

  if (!code) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'code required' })
  }

  // Look up the code
  const { data: authCode, error: lookupErr } = await supabase
    .from('mcp_auth_codes')
    .select('*')
    .eq('code', code)
    .eq('used', false)
    .maybeSingle()

  if (lookupErr) {
    console.error('[mcp/token] DB lookup error:', lookupErr.message)
    return res.status(500).json({ error: 'server_error', error_description: 'Database error' })
  }

  if (!authCode) {
    console.error('[mcp/token] Code not found or already used:', code.slice(0, 8))
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Code invalid or already used' })
  }

  // Check expiry
  if (new Date(authCode.expires_at) < new Date()) {
    console.error('[mcp/token] Code expired:', authCode.expires_at)
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Code expired' })
  }

  // Verify PKCE if code_challenge was set
  if (authCode.code_challenge && authCode.code_challenge_method === 'S256') {
    if (!code_verifier) {
      console.error('[mcp/token] PKCE required but no code_verifier')
      return res.status(400).json({ error: 'invalid_request', error_description: 'code_verifier required for PKCE' })
    }
    const expectedChallenge = crypto
      .createHash('sha256')
      .update(code_verifier)
      .digest('base64url')
    if (expectedChallenge !== authCode.code_challenge) {
      console.error('[mcp/token] PKCE mismatch:', { expected: authCode.code_challenge, got: expectedChallenge })
      return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' })
    }
  }

  // Mark code as used
  await supabase.from('mcp_auth_codes').update({ used: true }).eq('code', code)

  // Find the client for this user
  const { data: link } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', authCode.user_id)
    .limit(1)
    .maybeSingle()

  if (!link) {
    console.error('[mcp/token] No client found for user:', authCode.user_id)
    return res.status(400).json({ error: 'invalid_grant', error_description: 'No client associated with this account' })
  }

  // Create a LONG-LIVED API key for MCP (instead of returning the short-lived JWT)
  const apiKeyValue = 'mcp_' + crypto.randomBytes(24).toString('hex')

  const { error: insertErr } = await supabase.from('client_api_keys').insert({
    client_id: link.client_id,
    key_value: apiKeyValue,
    label: 'Claude Desktop (MCP)',
    is_active: true,
  })

  if (insertErr) {
    console.error('[mcp/token] Failed to create API key:', insertErr.message)
    // Fallback: return the Supabase JWT (short-lived but works)
    return res.status(200).json({
      access_token: authCode.access_token,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: authCode.access_token,
      scope: 'actero',
    })
  }

  console.log('[mcp/token] Success: API key created for client', link.client_id)

  // Return the long-lived API key. We return the SAME value as
  // `refresh_token` so Claude's refresh flow keeps working (we accept
  // it back at the refresh_token grant above). The `scope` echo is
  // important — Claude's audience binding compares the granted scope
  // to what it requested and rejects mismatches.
  return res.status(200).json({
    access_token: apiKeyValue,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: apiKeyValue,
    scope: 'actero',
  })
}

export default withSentry(handler)
