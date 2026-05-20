/**
 * Shopify webhook HMAC verification — shared across all GDPR / lifecycle
 * endpoints under api/shopify/webhooks/*.
 *
 * Shopify signs the RAW request body with HMAC-SHA256 using the app's client
 * secret and sends the result as a base64 string in `x-shopify-hmac-sha256`.
 * We MUST therefore read the body as raw bytes (no JSON parser) and compare
 * with a constant-time check.
 *
 * Pattern lifted, untouched, from api/engine/webhooks/shopify-cart.js so the
 * two implementations stay byte-for-byte compatible. shopify-cart.js itself
 * is NOT modified by this change (non-regression contract).
 */

import crypto from 'crypto'

export const rawBodyConfig = {
  api: { bodyParser: false },
}

export async function getRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

/**
 * Constant-time HMAC check.
 * @param {Buffer} rawBody    Raw request body bytes.
 * @param {string} hmacHeader Value of x-shopify-hmac-sha256.
 * @param {string} secret     Shopify app client secret.
 * @returns {boolean}
 */
export function verifyShopifyHmac(rawBody, hmacHeader, secret) {
  if (!rawBody || !hmacHeader || !secret) return false
  const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
  try {
    const a = Buffer.from(computed)
    const b = Buffer.from(String(hmacHeader))
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * SHA-256 hex hash of the raw body — stored in shopify_gdpr_log for forensics
 * without persisting any PII.
 */
export function hashPayload(rawBody) {
  if (!rawBody) return null
  return crypto.createHash('sha256').update(rawBody).digest('hex')
}
