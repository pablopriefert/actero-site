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

  const baseUrl = `https://${shopify.shop_domain}/admin/api/2024-01`
  const headers = {
    'X-Shopify-Access-Token': shopifyToken,
    'Content-Type': 'application/json',
  }

  try {
    let orders = []

    // Search by order name (e.g., #4521)
    if (orderId) {
      const cleanId = orderId.replace(/^#/, '')
      const res = await fetch(`${baseUrl}/orders.json?name=${cleanId}&status=any&limit=1`, { headers })
      if (res.ok) {
        const data = await res.json()
        orders = data.orders || []
      }
    }

    // Fallback: search by customer email
    if (orders.length === 0 && customerEmail) {
      const res = await fetch(`${baseUrl}/orders.json?email=${encodeURIComponent(customerEmail)}&status=any&limit=3`, { headers })
      if (res.ok) {
        const data = await res.json()
        orders = data.orders || []
      }
    }

    if (orders.length === 0) return null

    // Format order data for AI context
    return orders.map(order => formatOrder(order))
  } catch (err) {
    console.error('[shopify-client] Lookup error:', err.message)
    return null
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
