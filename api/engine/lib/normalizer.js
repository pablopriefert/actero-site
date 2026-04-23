/**
 * Actero Engine V2 — Event Normalizer
 * Normalizes incoming events from any source into a standard format.
 */

export function normalizeEvent(source, payload) {
  const normalizers = {
    email_inbound: normalizeEmail,
    shopify_webhook: normalizeShopify,
    shopify_abandoned_cart: normalizeShopifyCart,
    ticket_gorgias: normalizeGorgias,
    ticket_zendesk: normalizeZendesk,
    widget_message: normalizeWidget,
    api_direct: normalizeDirect,
  }

  const normalizer = normalizers[source] || normalizeDirect
  const normalized = normalizer(payload)

  return {
    customer_email: normalized.customer_email || payload.customer_email || '',
    customer_name: normalized.customer_name || payload.customer_name || '',
    message: normalized.message || payload.message || '',
    subject: normalized.subject || payload.subject || '',
    order_id: normalized.order_id || payload.order_id || null,
    ticket_id: normalized.ticket_id || payload.ticket_id || null,
    session_id: payload.session_id || normalized.metadata?.session_id || null,
    channel: source,
    images: payload.images || normalized.images || [],
    metadata: normalized.metadata || {},
  }
}

function normalizeEmail(payload) {
  return {
    customer_email: payload.from || payload.customer_email,
    customer_name: payload.from_name || payload.customer_name,
    message: payload.body || payload.text || payload.message,
    subject: payload.subject,
    order_id: extractOrderId(payload.body || payload.message || ''),
    images: payload.images || [],
    metadata: { original_subject: payload.subject },
  }
}

function normalizeShopify(payload) {
  return {
    customer_email: payload.email || payload.customer?.email,
    customer_name: payload.customer?.first_name ? `${payload.customer.first_name} ${payload.customer.last_name || ''}`.trim() : '',
    message: payload.note || `Commande ${payload.name || payload.order_number}`,
    subject: `Commande ${payload.name || '#' + payload.order_number}`,
    order_id: payload.name || String(payload.order_number),
    images: payload.images || [],
    metadata: { shopify_id: payload.id, total_price: payload.total_price, currency: payload.currency },
  }
}

function normalizeShopifyCart(payload) {
  return {
    customer_email: payload.email || payload.customer?.email,
    customer_name: payload.customer?.first_name || '',
    message: 'Panier abandonne',
    subject: 'Panier abandonne',
    order_id: null,
    images: payload.images || [],
    metadata: {
      cart_token: payload.token,
      total_price: payload.total_price,
      line_items: (payload.line_items || []).map(i => ({ title: i.title, quantity: i.quantity, price: i.price })),
    },
  }
}

function normalizeGorgias(payload) {
  const ticket = payload.ticket || payload
  const lastMsg = ticket.messages?.filter(m => !m.from_agent)?.pop()
  const body = lastMsg?.body_text || lastMsg?.stripped_text || ticket.messages?.[0]?.body_text || ''
  return {
    customer_email: ticket.customer?.email || lastMsg?.sender?.email,
    customer_name: ticket.customer?.name || lastMsg?.sender?.name,
    message: stripHtml(body),
    subject: ticket.subject,
    ticket_id: String(ticket.id),
    images: payload.images || [],
    metadata: { gorgias_ticket_id: ticket.id },
  }
}

function normalizeZendesk(payload) {
  const ticket = payload.ticket || payload
  return {
    customer_email: ticket.requester?.email || ticket.via?.source?.from?.address,
    customer_name: ticket.requester?.name,
    message: ticket.latest_comment?.body || ticket.description || payload.comment || payload.message,
    subject: ticket.subject || ticket.title,
    ticket_id: String(ticket.id),
    images: payload.images || [],
    metadata: { zendesk_ticket_id: ticket.id },
  }
}

function normalizeWidget(payload) {
  return {
    customer_email: payload.email || `widget-${payload.session_id || Date.now()}@anonymous.actero.fr`,
    customer_name: payload.name,
    message: payload.message,
    subject: null,
    images: payload.images || [],
    metadata: { session_id: payload.session_id },
  }
}

function normalizeDirect(payload) {
  return {
    customer_email: payload.customer_email,
    customer_name: payload.customer_name,
    message: payload.message,
    subject: payload.subject,
    order_id: payload.order_id,
    ticket_id: payload.ticket_id,
    images: payload.images || [],
    metadata: payload.metadata || {},
  }
}

function extractOrderId(text) {
  const match = text.match(/#?\b(\d{3,8})\b/)
  return match ? match[1] : null
}

function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}
