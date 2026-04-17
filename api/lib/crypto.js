/**
 * Shared AES-256-GCM token encryption.
 *
 * Use for OAuth access/refresh tokens, API keys, credentials at rest.
 * Pattern: enc:v1:<base64(iv|tag|ciphertext)>.
 * Legacy plain values pass through decryptToken untouched so that rows
 * written before encryption was introduced keep working.
 *
 * Key resolution (in order):
 *   1. ENCRYPTION_KEY   (preferred)
 *   2. WHATSAPP_TOKEN_ENCRYPTION_KEY (legacy compat)
 *
 * No insecure fallback: if neither is set, encrypt/decrypt fail loud.
 * This avoids the previous pitfall where missing env silently fell back
 * to SUPABASE_SERVICE_ROLE_KEY or a hardcoded literal.
 */
import crypto from 'crypto'

function getEncryptionKey() {
  const raw =
    process.env.ENCRYPTION_KEY ||
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      '[lib/crypto] ENCRYPTION_KEY is not set. Refusing to encrypt/decrypt with an insecure fallback. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" ' +
      'and set it in your Vercel/env config.'
    )
  }
  return crypto.createHash('sha256').update(String(raw)).digest()
}

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

export function decryptToken(cipher) {
  if (!cipher) return null
  if (typeof cipher !== 'string') return String(cipher)
  if (!cipher.startsWith('enc:v1:')) return cipher
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
    console.error('[lib/crypto] decryptToken error:', err.message)
    return null
  }
}

/**
 * Hash a secret with SHA-256 + a server pepper. One-way; suitable for
 * verification of bearer/API tokens without storing them in clear.
 */
export function hashToken(plain) {
  if (!plain) return null
  const pepper = process.env.ENCRYPTION_KEY || process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY
  if (!pepper) {
    throw new Error('[lib/crypto] ENCRYPTION_KEY is required for hashToken.')
  }
  return crypto.createHash('sha256').update(`${pepper}:${plain}`).digest('hex')
}
