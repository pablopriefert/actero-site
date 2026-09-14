/**
 * Actero Engine — Format de commande partagé (ACT-32)
 *
 * `formatOrder` transforme un objet "commande" dans une forme REST-like
 * commune (id, name, created_at, total_price, currency, financial_status,
 * fulfillment_status, email, line_items, fulfillments, shipping_address,
 * refunds) en la forme finale consommée par order-agent.js, executor.js et
 * process.js (orderName, fulfillmentStatus, financialStatus, items,
 * trackingInfo, shippingAddress, email, contextText).
 *
 * Extrait de shopify-client.js pour que le connecteur WooCommerce
 * (woocommerce-client.js) produise EXACTEMENT la même forme sans dupliquer
 * la logique de mise en forme — un seul endroit pour ce contrat.
 */

/**
 * Formate une commande (forme REST-like commune) en contexte pour l'IA.
 */
export function formatOrder(order) {
  // Un statut d'expedition absent n'est PAS un statut « non expedie » : c'est
  // un statut inconnu. La difference se paie chez le client final — avec
  // l'ancien defaut, un statut de commande WooCommerce non reconnu (les
  // marchands en ajoutent : « Shipped », « Delivered »…) faisait annoncer
  // « Non expedie » a quelqu'un qui a deja recu son colis. Affirmer a partir
  // d'une absence de donnee est exactement le defaut n°1 de ce produit.
  const fulfillmentStatus = order.fulfillment_status || 'inconnu'
  const financialStatus = order.financial_status || 'inconnu'

  // Info de suivi
  const fulfillments = order.fulfillments || []
  const trackingInfo = fulfillments.map(f => ({
    status: f.status,
    trackingNumber: f.tracking_number,
    trackingUrl: f.tracking_url,
    carrier: f.tracking_company,
  })).filter(f => f.trackingNumber)

  // Articles
  const items = (order.line_items || []).map(item => ({
    name: item.title,
    variant: item.variant_title,
    quantity: item.quantity,
    price: item.price,
  }))

  // Adresse de livraison
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
    // Texte formatté pour injection dans le prompt de l'IA
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

  // Info remboursement
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
    // Volontairement distinct de « Non expedie » : voir formatOrder.
    inconnu: "Statut d'expedition inconnu",
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
