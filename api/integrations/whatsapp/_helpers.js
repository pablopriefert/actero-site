/**
 * Actero WhatsApp Integration — shared helpers
 *
 * Small utilities shared by every /api/integrations/whatsapp/* endpoint:
 *   - service-role Supabase client
 *   - JWT auth + client access check (multi-tenant strict)
 *   - Meta Graph API fetch wrapper
 *   - token encrypt / decrypt (base64 + HMAC integrity, keyed on
 *     WHATSAPP_TOKEN_ENCRYPTION_KEY or derived from SUPABASE_SERVICE_ROLE_KEY)
 *   - env guard that returns a clean 503 with a user-friendly hint when
 *     META_APP_ID / META_APP_SECRET are missing.
 */
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0'
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/* -------------------------------------------------------------------------- */
/*  Env guards                                                                */
/* -------------------------------------------------------------------------- */

export function hasMetaCredentials() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET)
}

export function requireMetaCredentials(res) {
  if (!hasMetaCredentials()) {
    res.status(503).json({
      error: 'META_APP_ID or META_APP_SECRET missing in env',
      hint: 'WhatsApp Business integration n\'est pas encore configuree cote serveur. Contactez l\'equipe Actero pour activer cette fonctionnalite.',
    })
    return false
  }
  return true
}

/* -------------------------------------------------------------------------- */
/*  Auth                                                                      */
/* -------------------------------------------------------------------------- */

export async function authenticateClientAccess(req, res, clientIdFromBody) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization header' })
    return null
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    res.status(401).json({ error: 'Invalid token' })
    return null
  }

  const clientId = clientIdFromBody || req.body?.client_id || req.query?.client_id
  if (!clientId) {
    res.status(400).json({ error: 'client_id required' })
    return null
  }

  const { data: membership } = await supabaseAdmin
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .maybeSingle()

  if (!membership) {
    res.status(403).json({ error: 'Forbidden: no access to this client' })
    return null
  }

  return { user, clientId }
}

/* -------------------------------------------------------------------------- */
/*  JSON body reader                                                          */
/* -------------------------------------------------------------------------- */

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  const chunks = []
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c)
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return {} }
}

/* -------------------------------------------------------------------------- */
/*  Meta Graph API fetch wrapper                                              */
/* -------------------------------------------------------------------------- */

/**
 * Wraps fetch() to Meta Graph API. Defaults to v21.0 via META_GRAPH_VERSION.
 *   metaFetch('/me/businesses', { accessToken, query: { fields: 'id,name' } })
 *   metaFetch(`/${phoneNumberId}/messages`, { method: 'POST', accessToken, body: { ... } })
 */
export async function metaFetch(path, { method = 'GET', accessToken, body, query } = {}) {
  const url = new URL(META_GRAPH_BASE + (path.startsWith('/') ? path : `/${path}`))
  if (query && typeof query === 'object') {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    }
  }

  const headers = {}
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
  let payload
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = typeof body === 'string' ? body : JSON.stringify(body)
  }

  const resp = await fetch(url.toString(), { method, headers, body: payload })
  const text = await resp.text()
  let data = null
  if (text) {
    try { data = JSON.parse(text) } catch { data = { raw: text } }
  }
  return { ok: resp.ok, status: resp.status, data }
}

/* -------------------------------------------------------------------------- */
/*  Token encryption (simple: AES-256-GCM with derived key)                   */
/* -------------------------------------------------------------------------- */

function getEncryptionKey() {
  const raw =
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'actero-fallback-insecure-key-please-set-WHATSAPP_TOKEN_ENCRYPTION_KEY'
  // Derive a 32-byte key via SHA-256 so any length/format input works.
  return crypto.createHash('sha256').update(String(raw)).digest()
}

/**
 * Encrypt a string with AES-256-GCM. Returns a self-contained base64 blob:
 *   base64( iv(12) || tag(16) || ciphertext )
 * Prefixed with "enc:v1:" so we can tell encrypted values from legacy plain.
 */
export function encryptToken(plain) {
  if (plain == null) return null
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const blob = Buffer.concat([iv, tag, enc]).toString('base64')
  return `enc:v1:${blob}`
}

/**
 * Decrypt a value produced by encryptToken(). Accepts legacy plain strings
 * (returns them as-is) so we don't break rows written before encryption was
 * enabled.
 */
export function decryptToken(cipher) {
  if (!cipher) return null
  if (typeof cipher !== 'string') return String(cipher)
  if (!cipher.startsWith('enc:v1:')) return cipher // legacy plain — return as-is
  try {
    const blob = Buffer.from(cipher.slice('enc:v1:'.length), 'base64')
    const iv = blob.subarray(0, 12)
    const tag = blob.subarray(12, 28)
    const enc = blob.subarray(28)
    const key = getEncryptionKey()
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const dec = Buffer.concat([decipher.update(enc), decipher.final()])
    return dec.toString('utf8')
  } catch (err) {
    console.error('[whatsapp/_helpers] decryptToken error:', err.message)
    return null
  }
}

/**
 * Fetch the WhatsApp account row for a client and decrypt the access token.
 * Returns null if not connected.
 */
export async function loadWhatsAppAccount(supabase, clientId) {
  const { data, error } = await supabase
    .from('whatsapp_accounts')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error || !data) return null
  return {
    ...data,
    access_token_decrypted: decryptToken(data.access_token),
  }
}
