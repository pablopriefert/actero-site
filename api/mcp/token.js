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

  // One-line summary — keeps signal in Vercel logs without leaking referers/origins
  // (which often carry private dashboard URLs). Set MCP_DEBUG=1 to re-enable
  // the full per-field dump while debugging an OAuth client integration.
  console.log(
    '[mcp/token]',
    JSON.stringify({
      grant_type,
      client_id: params.client_id,
      has_code: !!code,
      has_verifier: !!code_verifier,
      has_refresh: !!refresh_token,
      scope_requested: params.scope || null,
    })
  )
  if (process.env.MCP_DEBUG === '1') {
    console.log('[mcp/token][debug]', JSON.stringify({
      redirect_uri: params.redirect_uri,
      resource: params.resource,
      audience: params.audience,
      all_keys: Object.keys(params),
      ua: req.headers['user-agent'],
      origin: req.headers.origin,
      referer: req.headers.referer,
      ct: req.headers['content-type'],
      accept: req.headers.accept,
      has_authz: !!req.headers.authorization,
    }))
  }

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
    // Strict OAuth clients (Claude uses python-httpx/authlib-style validation)
    // reject responses that include `scope` or `refresh_token` they didn't
    // explicitly ask for in THIS request — treated as scope upgrade. We only
    // include them when the client actually sent `scope` in the request.
    const resp = {
      access_token: keyRow.key_value,
      token_type: 'Bearer',
      expires_in: 3600,
    }
    if (params.scope) resp.scope = params.scope
    return res.status(200).json(resp)
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
    const fallback = {
      access_token: authCode.access_token,
      token_type: 'Bearer',
      expires_in: 3600,
    }
    if (params.scope) fallback.scope = params.scope
    return res.status(200).json(fallback)
  }

  console.log('[mcp/token] Success: API key created for client', link.client_id)

  // Minimum RFC 6749 §5.1 response: access_token, token_type, expires_in.
  // We deliberately DO NOT include `refresh_token` (Claude/authlib rejects
  // a refresh_token whose value matches access_token — flagged as a server
  // misconfiguration) nor `scope` when the client didn't ask for it (treated
  // as scope upgrade). Refresh works via the refresh_token grant above with
  // the access_token value because our API keys never expire — clients that
  // try to refresh by sending the access_token will succeed.
  const resp = {
    access_token: apiKeyValue,
    token_type: 'Bearer',
    expires_in: 3600,
  }
  if (params.scope) resp.scope = params.scope
  return res.status(200).json(resp)
}

export default withSentry(handler)
