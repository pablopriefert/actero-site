/**
 * Actero — Proactive Detection Engine
 *
 * Surveillance continue des signaux faibles pour déclencher des actions
 * AVANT que le client se plaigne.
 *
 * Architecture :
 *   1. Pour chaque client → list règles actives
 *   2. Pour chaque règle active → appelle le détecteur correspondant
 *   3. Chaque détection renvoie un tableau {detection_key, customer, trigger_data}
 *   4. Insère un `proactive_events` (upsert idempotent via detection_key)
 *   5. Si nouvel event → trigger action (email proactif)
 *
 * Détecteurs MVP :
 *   - shipment_delayed : AfterShip détecte les colis bloqués > seuil
 *   - failed_payment : Shopify orders avec financial_status = 'pending'/'unpaid' depuis > seuil
 *   - silent_vip : VIP client (>500€ total) sans commande depuis > seuil
 */
import { decryptToken } from './crypto.js'

/* -------------------------------------------------------------------------- */
/*  Detector registry                                                         */
/* -------------------------------------------------------------------------- */

export const DETECTORS = {
  shipment_delayed: {
    label: 'Colis retardé',
    description: 'Contacte le client quand son colis est bloqué en transit depuis plus de X heures.',
    defaultConfig: {
      threshold_hours: 72,
      compensation_cents: 0, // optional — voucher amount in cents
    },
    requires: ['aftership'],
  },
  failed_payment: {
    label: 'Paiement échoué',
    description: 'Contacte le client quand une commande reste en attente de paiement depuis plus de X heures.',
    defaultConfig: {
      threshold_hours: 24,
    },
    requires: ['shopify'],
  },
  silent_vip: {
    label: 'Client VIP silencieux',
    description: 'Relance vos meilleurs clients (CLV > X€) qui n\'ont pas commandé depuis plus de Y jours.',
    defaultConfig: {
      min_clv_euros: 500,
      silent_days: 60,
    },
    requires: ['shopify'],
  },
}

/* -------------------------------------------------------------------------- */
/*  Integration lookup helper                                                 */
/* -------------------------------------------------------------------------- */

async function getIntegration(supabase, clientId, provider) {
  const { data } = await supabase
    .from('client_integrations')
    .select('api_key, access_token, extra_config')
    .eq('client_id', clientId)
    .eq('provider', provider)
    .eq('status', 'active')
    .maybeSingle()
  return data
}

/* -------------------------------------------------------------------------- */
/*  Detectors                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * shipment_delayed — AfterShip based.
 * Strategy: for each recent Shopify order (last 30 days), look up tracking via
 * AfterShip by customer email. If status in ['Exception', 'AttemptFail'] OR
 * 'InTransit' without checkpoint update > threshold_hours → flag.
 *
 * MVP shortcut: just list all trackings for the merchant (limit 50) and scan
 * for status issues. Simpler, fewer API calls.
 */
async function detectShipmentDelayed(supabase, clientId, config) {
  const thresholdHours = Number(config?.threshold_hours || 72)
  const aftership = await getIntegration(supabase, clientId, 'aftership')
  if (!aftership) return []

  const apiKey = decryptToken(aftership.api_key) || aftership.api_key
  if (!apiKey) return []

  // AfterShip gives us /trackings list, but paginated. For MVP we fetch page 1.
  const detections = []
  try {
    const resp = await fetch(
      'https://api.aftership.com/tracking/2024-10/trackings?limit=50&sort=-last_updated_at',
      { headers: { 'as-api-key': apiKey, Accept: 'application/json' } },
    )
    if (!resp.ok) return []
    const json = await resp.json()
    const trackings = json.data?.trackings || []

    for (const t of trackings) {
      const email = t.emails?.[0]
      if (!email) continue

      const status = t.tag // 'InTransit' | 'Exception' | 'AttemptFail' | 'Pending' | 'Delivered' | ...
      const lastCheckpoint = t.checkpoints?.[t.checkpoints.length - 1]
      const lastUpdate = lastCheckpoint?.checkpoint_time || t.last_updated_at
      const hoursSinceUpdate = lastUpdate
        ? (Date.now() - new Date(lastUpdate).getTime()) / 3600000
        : Infinity

      const isProblematic = (
        status === 'Exception' ||
        status === 'AttemptFail' ||
        (['InTransit', 'Pending'].includes(status) && hoursSinceUpdate > thresholdHours)
      )

      if (!isProblematic) continue
      if (status === 'Delivered') continue

      detections.push({
        detection_key: `shipment_${t.id}`,
        customer_email: email,
        customer_name: t.customer_name || null,
        trigger_data: {
          tracking_number: t.tracking_number,
          carrier: t.slug,
          status,
          status_label: mapStatusFr(status),
          last_update: lastUpdate,
          hours_since_update: Math.round(hoursSinceUpdate),
          tracking_url: t.tracking_url,
          order_id: t.order_id,
        },
      })
    }
  } catch (err) {
    console.error('[proactive/shipment_delayed]', err.message)
  }
  return detections
}

/**
 * failed_payment — Shopify order with financial_status = pending/unpaid
 * older than threshold_hours.
 */
async function detectFailedPayment(supabase, clientId, config) {
  const thresholdHours = Number(config?.threshold_hours || 24)
  const shopify = await getIntegration(supabase, clientId, 'shopify')
  if (!shopify) {
    // Try owned_shopify_connections fallback
    const { data: conn } = await supabase
      .from('client_shopify_connections')
      .select('shop_domain, access_token')
      .eq('client_id', clientId)
      .maybeSingle()
    if (!conn) return []
    return fetchUnpaidOrders(conn, thresholdHours)
  }
  return fetchUnpaidOrders({
    shop_domain: shopify.extra_config?.shop_domain,
    access_token: decryptToken(shopify.access_token) || shopify.access_token,
  }, thresholdHours)
}

// Shopify GraphQL Admin API — required by App Store policy 2.2.4 for all
// non-Theme/Asset endpoints in new public apps.
const GRAPHQL_API_VERSION = '2025-01'

const UNPAID_ORDERS_QUERY = `
  query UnpaidOrders($query: String!, $first: Int!) {
    orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          createdAt
          displayFinancialStatus
          currentTotalPriceSet { shopMoney { amount currencyCode } }
          customer { email firstName lastName }
          statusPageUrl
        }
      }
    }
  }
`

function gidToNumericId(gid) {
  if (!gid) return null
  const parts = String(gid).split('/')
  return parts[parts.length - 1] || null
}

async function shopifyGraphql(conn, query, variables) {
  const resp = await fetch(
    `https://${conn.shop_domain}/admin/api/${GRAPHQL_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': conn.access_token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    },
  )
  if (!resp.ok) {
    console.warn('[proactive] shopifyGraphql HTTP', resp.status)
    return null
  }
  const json = await resp.json()
  if (json?.errors?.length) {
    console.warn('[proactive] shopifyGraphql errors:', JSON.stringify(json.errors))
    return null
  }
  return json?.data || null
}

async function fetchUnpaidOrders(conn, thresholdHours) {
  if (!conn.shop_domain || !conn.access_token) return []
  const sinceIso = new Date(Date.now() - thresholdHours * 3600000 - 7 * 86400000).toISOString() // last 7d window
  const upperIso = new Date(Date.now() - thresholdHours * 3600000).toISOString()

  try {
    // Shopify search DSL: status:open AND financial_status:pending AND a date window.
    const searchQuery = [
      'status:open',
      'financial_status:pending',
      `created_at:>=${sinceIso}`,
      `created_at:<=${upperIso}`,
    ].join(' ')

    const data = await shopifyGraphql(conn, UNPAID_ORDERS_QUERY, {
      query: searchQuery,
      first: 50,
    })
    if (!data) return []
    const edges = data?.orders?.edges || []
    return edges
      .map((e) => e.node)
      .filter((o) => o.customer?.email)
      .map((o) => {
        const numericId = gidToNumericId(o.id)
        return {
          detection_key: `payment_${numericId}`,
          customer_email: o.customer.email,
          customer_name:
            `${o.customer.firstName || ''} ${o.customer.lastName || ''}`.trim() || null,
          trigger_data: {
            // `name` is the customer-facing order number (e.g. "#1042"),
            // which is what the merchant uses in their admin too.
            order_number: o.name,
            order_id: numericId,
            total: o.currentTotalPriceSet?.shopMoney?.amount,
            currency: o.currentTotalPriceSet?.shopMoney?.currencyCode,
            financial_status: o.displayFinancialStatus?.toLowerCase() || null,
            created_at: o.createdAt,
            checkout_url: o.statusPageUrl || null,
          },
        }
      })
  } catch (err) {
    console.error('[proactive/failed_payment]', err.message)
    return []
  }
}

/**
 * silent_vip — customers with total_spent > threshold who haven't ordered in N days.
 * Uses Shopify customers endpoint.
 */
async function detectSilentVip(supabase, clientId, config) {
  const minClvEuros = Number(config?.min_clv_euros || 500)
  const silentDays = Number(config?.silent_days || 60)
  const shopify = await getIntegration(supabase, clientId, 'shopify')
  let conn = shopify
    ? {
        shop_domain: shopify.extra_config?.shop_domain,
        access_token: decryptToken(shopify.access_token) || shopify.access_token,
      }
    : null
  if (!conn) {
    const { data: alt } = await supabase
      .from('client_shopify_connections')
      .select('shop_domain, access_token')
      .eq('client_id', clientId)
      .maybeSingle()
    if (!alt) return []
    conn = { ...alt }
  }

  if (!conn?.shop_domain || !conn?.access_token) return []

  try {
    // GraphQL customers query, sorted by total amount spent (desc) so we get
    // top spenders first. We fetch a page of 50 and filter client-side by the
    // configured CLV threshold + silence window.
    const SILENT_VIP_QUERY = `
      query SilentVip($first: Int!) {
        customers(first: $first, sortKey: AMOUNT_SPENT, reverse: true) {
          edges {
            node {
              id
              email
              firstName
              lastName
              numberOfOrders
              amountSpent { amount currencyCode }
              lastOrder { id processedAt }
              updatedAt
            }
          }
        }
      }
    `

    const data = await shopifyGraphql(conn, SILENT_VIP_QUERY, { first: 50 })
    if (!data) return []
    const cutoff = Date.now() - silentDays * 86400000

    return (data?.customers?.edges || [])
      .map((e) => e.node)
      .filter((c) => c.email && Number(c.amountSpent?.amount || 0) >= minClvEuros)
      .filter((c) => {
        const lastOrderAt = c.lastOrder?.processedAt || c.updatedAt
        return lastOrderAt && new Date(lastOrderAt).getTime() < cutoff
      })
      .map((c) => {
        const customerNumericId = gidToNumericId(c.id)
        return {
          detection_key: `silent_${customerNumericId}_${Math.floor(
            Date.now() / (30 * 86400000),
          )}`,
          customer_email: c.email,
          customer_name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || null,
          trigger_data: {
            customer_id: customerNumericId,
            total_spent: c.amountSpent?.amount,
            orders_count: c.numberOfOrders,
            last_order_date: c.lastOrder?.processedAt || null,
            days_silent: c.lastOrder?.processedAt
              ? Math.floor(
                  (Date.now() - new Date(c.lastOrder.processedAt).getTime()) / 86400000,
                )
              : null,
          },
        }
      })
  } catch (err) {
    console.error('[proactive/silent_vip]', err.message)
    return []
  }
}

/* -------------------------------------------------------------------------- */
/*  Main entry — run all active rules for a client                            */
/* -------------------------------------------------------------------------- */

export async function runProactiveChecks(supabase, clientId) {
  const { data: rules } = await supabase
    .from('proactive_rules')
    .select('rule_name, config')
    .eq('client_id', clientId)
    .eq('is_active', true)

  if (!rules?.length) return { newDetections: [], total: 0 }

  const newDetections = []
  for (const rule of rules) {
    let detections = []
    try {
      switch (rule.rule_name) {
        case 'shipment_delayed':
          detections = await detectShipmentDelayed(supabase, clientId, rule.config)
          break
        case 'failed_payment':
          detections = await detectFailedPayment(supabase, clientId, rule.config)
          break
        case 'silent_vip':
          detections = await detectSilentVip(supabase, clientId, rule.config)
          break
        default:
          continue
      }
    } catch (err) {
      console.error(`[proactive] detector ${rule.rule_name} failed:`, err.message)
      continue
    }

    for (const d of detections) {
      // Skip if we already fired this detection (idempotence)
      const { data: existing } = await supabase
        .from('proactive_events')
        .select('id')
        .eq('client_id', clientId)
        .eq('rule_name', rule.rule_name)
        .eq('detection_key', d.detection_key)
        .maybeSingle()
      if (existing) continue

      // Insert new event (action will be taken in next step)
      const { data: inserted } = await supabase
        .from('proactive_events')
        .insert({
          client_id: clientId,
          rule_name: rule.rule_name,
          detection_key: d.detection_key,
          trigger_data: d.trigger_data,
          customer_email: d.customer_email,
          customer_name: d.customer_name,
          action_type: 'email_sent',
          action_status: 'pending',
        })
        .select('id, customer_email, customer_name, trigger_data, rule_name, created_at')
        .single()

      if (inserted) newDetections.push(inserted)
    }
  }
  return { newDetections, total: newDetections.length }
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function mapStatusFr(tag) {
  return {
    Pending: 'En attente de prise en charge',
    InfoReceived: 'Informations reçues',
    InTransit: 'En transit',
    OutForDelivery: 'En cours de livraison',
    AttemptFail: 'Tentative de livraison échouée',
    Delivered: 'Livré',
    AvailableForPickup: 'Disponible en point relais',
    Exception: 'Problème de livraison',
    Expired: 'Expiré',
  }[tag] || tag
}
