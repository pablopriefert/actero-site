/**
 * Customer.io Track API helper — EU region (track-eu.customer.io)
 *
 * All functions are fire-and-forget: they never throw, never block the caller.
 * If CIO env vars are missing → silent no-op.
 * Errors are captured in Sentry.
 *
 * userId convention: Actero client.id (UUID) — same identifier across all calls.
 */
import { captureError } from './sentry.js'

const SITE_ID = process.env.CUSTOMERIO_SITE_ID
const API_KEY = process.env.CUSTOMERIO_TRACK_API_KEY  // Track API (basic auth siteId:apiKey)
const BASE_URL = 'https://track-eu.customer.io/api/v1'

const enabled = () => Boolean(SITE_ID && API_KEY)

function authHeader() {
  const token = Buffer.from(`${SITE_ID}:${API_KEY}`).toString('base64')
  return `Basic ${token}`
}

/**
 * Identify or update a customer profile in CIO.
 * userId (required) = client.id Actero UUID.
 * attrs: any object — maps to CIO person attributes.
 */
export async function identify(userId, attrs = {}) {
  if (!enabled() || !userId) return
  try {
    const res = await fetch(`${BASE_URL}/customers/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify(attrs),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      // 401/403 = our SITE_ID/API_KEY are revoked or wrong. Not actionable
      // by retrying — only by a human rotating the key. Don't spam Sentry.
      if (res.status === 401 || res.status === 403) {
        console.warn(`[cio.identify] ${res.status} (auth) — check CUSTOMERIO_TRACK_API_KEY`)
      } else {
        captureError(new Error(`CIO identify ${res.status}: ${t.slice(0, 200)}`), { userId, attrs })
      }
    }
  } catch (err) {
    captureError(err, { context: 'cio.identify', userId })
  }
}

/**
 * Track a named event for an identified customer.
 * userId = client.id Actero UUID.
 */
export async function track(userId, name, data = {}) {
  if (!enabled() || !userId || !name) return
  try {
    const res = await fetch(`${BASE_URL}/customers/${encodeURIComponent(userId)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({ name, data }),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      if (res.status === 401 || res.status === 403) {
        console.warn(`[cio.track] ${res.status} (auth) — check CUSTOMERIO_TRACK_API_KEY`)
      } else {
        captureError(new Error(`CIO track ${res.status}: ${t.slice(0, 200)}`), { userId, name, data })
      }
    }
  } catch (err) {
    captureError(err, { context: 'cio.track', userId, name })
  }
}

/**
 * Track an anonymous event (before signup / before identify).
 * anonymousId: any stable browser/session identifier.
 */
export async function trackAnonymous(anonymousId, name, data = {}) {
  if (!enabled() || !anonymousId || !name) return
  try {
    const res = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({ anonymous_id: anonymousId, name, data }),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      if (res.status === 401 || res.status === 403) {
        console.warn(`[cio.trackAnonymous] ${res.status} (auth) — check CUSTOMERIO_TRACK_API_KEY`)
      } else {
        captureError(new Error(`CIO anon track ${res.status}: ${t.slice(0, 200)}`), { anonymousId, name })
      }
    }
  } catch (err) {
    captureError(err, { context: 'cio.trackAnonymous', anonymousId, name })
  }
}

/**
 * Delete a profile — RGPD right to erasure.
 * Silently succeeds even if the profile didn't exist.
 */
export async function deleteProfile(userId) {
  if (!enabled() || !userId) return
  try {
    await fetch(`${BASE_URL}/customers/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader() },
    })
  } catch (err) {
    captureError(err, { context: 'cio.delete', userId })
  }
}
