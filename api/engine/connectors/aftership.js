/**
 * AfterShip Connector — package tracking for customer SAV.
 *
 * Used by the engine's SAV playbook to answer "où est ma commande ?" questions
 * instantly with real-time tracking data (900+ carriers supported).
 */

const API_BASE = 'https://api.aftership.com/tracking/2024-10'

/**
 * Fetch a tracking by tracking number (and optional slug for carrier).
 */
export async function getTracking(apiKey, trackingNumber, slug = null) {
  if (!apiKey || !trackingNumber) return { error: 'apiKey et trackingNumber requis' }

  const url = slug
    ? `${API_BASE}/trackings/${slug}/${encodeURIComponent(trackingNumber)}`
    : `${API_BASE}/trackings/${encodeURIComponent(trackingNumber)}`

  try {
    const res = await fetch(url, {
      headers: { 'as-api-key': apiKey, Accept: 'application/json' },
    })
    const json = await res.json()
    if (!res.ok) return { error: json.meta?.message || `AfterShip ${res.status}`, status: res.status }
    return { tracking: normalizeTracking(json.data?.tracking), raw: json.data }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Fetch tracking by order ID (Shopify, WooCommerce, etc.)
 */
export async function getTrackingsByOrderId(apiKey, orderId) {
  if (!apiKey || !orderId) return { error: 'apiKey et orderId requis' }
  try {
    const res = await fetch(`${API_BASE}/trackings?order_id=${encodeURIComponent(orderId)}`, {
      headers: { 'as-api-key': apiKey, Accept: 'application/json' },
    })
    const json = await res.json()
    if (!res.ok) return { error: json.meta?.message || `AfterShip ${res.status}` }
    const trackings = (json.data?.trackings || []).map(normalizeTracking)
    return { trackings }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Fetch tracking by customer email (returns all active trackings).
 */
export async function getTrackingsByEmail(apiKey, email) {
  if (!apiKey || !email) return { error: 'apiKey et email requis' }
  try {
    const res = await fetch(`${API_BASE}/trackings?emails=${encodeURIComponent(email)}&limit=10`, {
      headers: { 'as-api-key': apiKey, Accept: 'application/json' },
    })
    const json = await res.json()
    if (!res.ok) return { error: json.meta?.message || `AfterShip ${res.status}` }
    const trackings = (json.data?.trackings || []).map(normalizeTracking)
    return { trackings }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Test the API key is valid.
 */
export async function testApiKey(apiKey) {
  try {
    const res = await fetch(`${API_BASE}/couriers`, {
      headers: { 'as-api-key': apiKey, Accept: 'application/json' },
    })
    return { ok: res.ok, status: res.status }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

function normalizeTracking(t) {
  if (!t) return null
  return {
    id: t.id,
    tracking_number: t.tracking_number,
    slug: t.slug,
    carrier_name: t.courier_name || t.slug,
    status: t.tag,              // 'Pending' | 'InTransit' | 'OutForDelivery' | 'AttemptFail' | 'Delivered' | 'Exception' | 'Expired'
    status_label: mapStatusFr(t.tag),
    expected_delivery: t.expected_delivery,
    delivery_time_ms: t.transit_time,
    last_event: t.checkpoints?.[t.checkpoints.length - 1] ? {
      message: t.checkpoints.at(-1).message,
      location: t.checkpoints.at(-1).location,
      time: t.checkpoints.at(-1).checkpoint_time,
    } : null,
    tracking_url: t.tracking_url,
    order_id: t.order_id,
    customer_email: t.emails?.[0],
    checkpoints_count: t.checkpoints?.length || 0,
  }
}

function mapStatusFr(tag) {
  const map = {
    Pending: 'En attente de prise en charge',
    InfoReceived: 'Informations reçues',
    InTransit: 'En transit',
    OutForDelivery: 'En cours de livraison',
    AttemptFail: 'Tentative de livraison échouée',
    Delivered: 'Livré',
    AvailableForPickup: 'Disponible en point relais',
    Exception: 'Problème de livraison',
    Expired: 'Expiré',
  }
  return map[tag] || tag
}
