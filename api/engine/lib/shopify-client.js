/**
 * Actero Engine — Shopify Client
 * Looks up order data from Shopify to enrich AI responses with real order info.
 */
import { decryptToken } from '../../lib/crypto.js'

/**
 * Look up a Shopify order by order name (#1234) or customer email.
 * Returns order details the AI can use to answer customer questions accurately.
 */
export async function lookupOrder(supabase, { clientId, orderId, customerEmail }) {
  // Load Shopify credentials
  const { data: shopify } = await supabase
    .from('client_shopify_connections')
    .select('shop_domain, access_token')
    .eq('client_id', clientId)
    .maybeSingle()

  const shopifyToken = decryptToken(shopify?.access_token)
  if (!shopifyToken || !shopify?.shop_domain) {
    return null // No Shopify connection
  }

  // GraphQL Admin API — the REST Admin API is legacy and not allowed for new
  // public apps (App Store requirement 2.2.4). We keep formatOrder's output
  // shape identical by mapping the GraphQL node back to the REST-like object.
  const endpoint = `https://${shopify.shop_domain}/admin/api/2025-01/graphql.json`
  const headers = {
    'X-Shopify-Access-Token': shopifyToken,
    'Content-Type': 'application/json',
  }

  // Order name search first (e.g. "#4521" → name:4521), else customer email.
  const searchQuery = orderId
    ? `name:${String(orderId).replace(/^#/, '')}`
    : (customerEmail ? `email:${customerEmail}` : null)
  if (!searchQuery) return null

  const gql = `query LookupOrders($q: String!, $n: Int!) {
    orders(first: $n, query: $q, sortKey: CREATED_AT, reverse: true) {
      edges { node {
        id name email createdAt
        displayFinancialStatus displayFulfillmentStatus
        totalPriceSet { shopMoney { amount currencyCode } }
        lineItems(first: 20) { edges { node { title quantity variantTitle originalUnitPriceSet { shopMoney { amount } } } } }
        fulfillments(first: 5) { status trackingInfo { number url company } }
        shippingAddress { city country }
      } }
    }
  }`

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: gql, variables: { q: searchQuery, n: orderId ? 1 : 3 } }),
    })
    if (!res.ok) return null
    const json = await res.json()
    const edges = json?.data?.orders?.edges || []
    if (edges.length === 0) return null
    return edges.map((e) => formatOrder(mapGraphQLOrder(e.node)))
  } catch (err) {
    console.error('[shopify-client] Lookup error:', err.message)
    return null
  }
}

// Map a GraphQL order node into the REST-shaped object formatOrder consumes,
// so formatOrder / buildOrderContextText / translate* stay unchanged.
function mapGraphQLOrder(node) {
  const fulfillmentMap = {
    FULFILLED: 'fulfilled',
    PARTIALLY_FULFILLED: 'partial',
    IN_PROGRESS: 'partial',
    UNFULFILLED: 'unfulfilled',
    ON_HOLD: 'unfulfilled',
    SCHEDULED: 'unfulfilled',
    PENDING_FULFILLMENT: 'unfulfilled',
    OPEN: 'unfulfilled',
    RESTOCKED: 'restocked',
  }
  const money = node?.totalPriceSet?.shopMoney || {}
  return {
    id: node?.id ? String(node.id).split('/').pop() : null,
    name: node?.name,
    created_at: node?.createdAt,
    total_price: money.amount,
    currency: money.currencyCode,
    financial_status: (node?.displayFinancialStatus || '').toLowerCase() || 'inconnu',
    fulfillment_status:
      fulfillmentMap[node?.displayFulfillmentStatus] || (node?.displayFulfillmentStatus || '').toLowerCase() || null,
    email: node?.email,
    line_items: (node?.lineItems?.edges || []).map(({ node: li }) => ({
      title: li.title,
      variant_title: li.variantTitle,
      quantity: li.quantity,
      price: li?.originalUnitPriceSet?.shopMoney?.amount,
    })),
    fulfillments: (node?.fulfillments || []).map((f) => {
      const ti = (f.trackingInfo || [])[0] || {}
      return { status: f.status, tracking_number: ti.number, tracking_url: ti.url, tracking_company: ti.company }
    }),
    shipping_address: node?.shippingAddress
      ? { city: node.shippingAddress.city, country: node.shippingAddress.country }
      : null,
    refunds: [],
  }
}

/**
 * Format a Shopify order into a concise context string for the AI.
 */
function formatOrder(order) {
  const fulfillmentStatus = order.fulfillment_status || 'non expedie'
  const financialStatus = order.financial_status || 'inconnu'

  // Get tracking info
  const fulfillments = order.fulfillments || []
  const trackingInfo = fulfillments.map(f => ({
    status: f.status,
    trackingNumber: f.tracking_number,
    trackingUrl: f.tracking_url,
    carrier: f.tracking_company,
  })).filter(f => f.trackingNumber)

  // Get line items
  const items = (order.line_items || []).map(item => ({
    name: item.title,
    variant: item.variant_title,
    quantity: item.quantity,
    price: item.price,
  }))

  // Get shipping address
  const shipping = order.shipping_address
  const shippingStr = shipping
    ? `${shipping.city}, ${shipping.country}`
    : 'Non renseignee'

  return {
    id: order.id || null,
    orderName: order.name || `#${order.order_number}`,
    orderDate: new Date(order.created_at).toLocaleDateString('fr-FR'),
    totalPrice: `${order.total_price} ${order.currency}`,
    financialStatus: translateFinancialStatus(financialStatus),
    fulfillmentStatus: translateFulfillmentStatus(fulfillmentStatus),
    items,
    trackingInfo,
    shippingAddress: shippingStr,
    email: order.email,
    // Formatted text for AI injection
    contextText: buildOrderContextText(order, items, trackingInfo, fulfillmentStatus, financialStatus),
  }
}

function buildOrderContextText(order, items, trackingInfo, fulfillmentStatus, financialStatus) {
  let text = `COMMANDE ${order.name || '#' + order.order_number}:\n`
  text += `- Date: ${new Date(order.created_at).toLocaleDateString('fr-FR')}\n`
  text += `- Montant: ${order.total_price} ${order.currency}\n`
  text += `- Paiement: ${translateFinancialStatus(financialStatus)}\n`
  text += `- Expedition: ${translateFulfillmentStatus(fulfillmentStatus)}\n`

  if (items.length > 0) {
    text += `- Articles: ${items.map(i => `${i.quantity}x ${i.name}${i.variant ? ' (' + i.variant + ')' : ''}`).join(', ')}\n`
  }

  if (trackingInfo.length > 0) {
    const t = trackingInfo[0]
    text += `- Transporteur: ${t.carrier || 'Non precise'}\n`
    text += `- Numero de suivi: ${t.trackingNumber}\n`
    if (t.trackingUrl) text += `- Lien de suivi: ${t.trackingUrl}\n`
  }

  // Refund info
  if (order.refunds && order.refunds.length > 0) {
    const totalRefunded = order.refunds.reduce((sum, r) =>
      sum + r.refund_line_items.reduce((s, li) => s + parseFloat(li.subtotal || 0), 0), 0
    )
    if (totalRefunded > 0) {
      text += `- Remboursement: ${totalRefunded.toFixed(2)} ${order.currency}\n`
    }
  }

  return text
}

function translateFulfillmentStatus(status) {
  const map = {
    fulfilled: 'Expedie',
    partial: 'Partiellement expedie',
    unfulfilled: 'Non expedie',
    null: 'Non expedie',
    restocked: 'Restitue',
  }
  return map[status] || status
}

function translateFinancialStatus(status) {
  const map = {
    paid: 'Paye',
    pending: 'En attente',
    refunded: 'Rembourse',
    partially_refunded: 'Partiellement rembourse',
    voided: 'Annule',
    authorized: 'Autorise',
  }
  return map[status] || status
}
