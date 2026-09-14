/**
 * Actero Engine — Shopify Client
 * Looks up order data from Shopify to enrich AI responses with real order info.
 *
 * ACT-32 — ce fichier expose aussi `lookupOrder`, l'aiguillage multi-plateforme
 * appelé par executor.js, process.js et order-agent.js : il regarde quelle
 * plateforme e-commerce le client a connectée (Shopify via
 * `client_shopify_connections`, WooCommerce et Webflow via `client_integrations`) et
 * délègue à `lookupShopifyOrder` (ci-dessous, comportement Shopify inchangé)
 * ou à `lookupOrder` de woocommerce-client.js. Les trois appelants n'ont pas
 * besoin de changer : ils continuent d'importer `lookupOrder` d'ici.
 */
import { decryptToken } from '../../lib/crypto.js'
import { formatOrder } from './order-format.js'
import { lookupOrder as lookupWooCommerceOrder } from './woocommerce-client.js'
import { lookupOrder as lookupWebflowOrder } from './webflow-client.js'
import { SHOPIFY_API_VERSION } from '../../lib/shopify-api-version.js'

/**
 * Aiguillage : regarde quelle plateforme e-commerce le client a connectée et
 * délègue au connecteur correspondant. Ne lève jamais — un client sans
 * connexion, ou avec une connexion mal configurée, reçoit `null` comme avant.
 */
export async function lookupOrder(supabase, params) {
  let platform
  try {
    platform = await detectConnectedPlatform(supabase, params?.clientId)
  } catch (err) {
    console.error('[shopify-client] Erreur de détection de plateforme:', err.message)
    return null
  }

  let commandes = null
  if (platform === 'shopify') commandes = await lookupShopifyOrder(supabase, params)
  else if (platform === 'woocommerce') commandes = await lookupWooCommerceOrder(supabase, params)
  else if (platform === 'webflow') commandes = await lookupWebflowOrder(supabase, params)
  else return null // Aucune plateforme e-commerce connectée

  return filtrerParAppartenance(commandes, params)
}

/**
 * Ne rend une commande qu'à qui peut prouver qu'elle est la sienne.
 *
 * LE DÉFAUT QUE CETTE FONCTION ARRÊTE — 11 septembre 2026
 *
 * La recherche se faisait par numéro SEUL : `name:4521`. L'email du demandeur
 * n'entrait jamais dans la requête dès qu'un numéro était présent. Or les
 * numéros de commande Shopify sont séquentiels.
 *
 * N'importe qui ouvrant la bulle de chat d'une boutique et tapant « où en est
 * ma commande #1042 » recevait la commande de quelqu'un d'autre : montant,
 * articles, transporteur, numéro de suivi et lien de suivi. Sans compte, sans
 * email, sans rien. Il suffisait d'énumérer.
 *
 * Le contrôle vit ICI, dans l'aiguilleur, et pas chez les cinq appelants
 * (executor, process, order-agent, return-agent, widget) : une règle de
 * confidentialité répétée cinq fois est une règle oubliée une fois.
 *
 * TROIS CAS
 *
 *   recherche par email      la plateforme a déjà filtré sur cet email.
 *   numéro + email connu     on ne garde que les commandes de cet email. Une
 *                            commande sans email ne prouve rien : écartée.
 *   numéro, email inconnu    on ne peut RIEN prouver. On ne rend rien.
 *
 * Le troisième cas est celui du visiteur anonyme, et c'est le seul qui
 * dégrade l'usage : il faut désormais qu'il donne son email. C'est le prix, et
 * il est juste — order-agent.js le lui demande explicitement.
 */
function filtrerParAppartenance(commandes, { orderId, customerEmail }) {
  if (!Array.isArray(commandes) || commandes.length === 0) return null
  if (!orderId) return commandes
  if (!customerEmail) return null

  const attendu = String(customerEmail).trim().toLowerCase()
  const siennes = commandes.filter(
    (c) => c?.email && String(c.email).trim().toLowerCase() === attendu,
  )
  return siennes.length > 0 ? siennes : null
}

/**
 * Détermine la plateforme e-commerce connectée pour ce client.
 * Shopify a sa propre table dédiée (présence de ligne = connecté, comme le
 * faisait déjà lookupShopifyOrder ci-dessous). WooCommerce vit dans
 * client_integrations, où plusieurs providers coexistent : on exige
 * status = 'active' pour ignorer les connexions pending/revoked/error.
 */
async function detectConnectedPlatform(supabase, clientId) {
  if (!clientId) return null

  const { data: shopifyConn } = await supabase
    .from('client_shopify_connections')
    .select('id')
    .eq('client_id', clientId)
    .maybeSingle()
  if (shopifyConn) return 'shopify'

  const { data: wooConn } = await supabase
    .from('client_integrations')
    .select('id, status')
    .eq('client_id', clientId)
    .eq('provider', 'woocommerce')
    .maybeSingle()
  if (wooConn?.status === 'active') return 'woocommerce'

  // Webflow vit au même endroit que WooCommerce. Il était proposé au
  // marchand SANS être détecté ici ni aiguillé ci-dessus : la connexion
  // s'affichait « active » et toute recherche de commande renvoyait `null`,
  // sans une erreur pour le dire. Garde : api/engine/plateformes-commerce.test.js
  const { data: webflowConn } = await supabase
    .from('client_integrations')
    .select('id, status')
    .eq('client_id', clientId)
    .eq('provider', 'webflow')
    .maybeSingle()
  if (webflowConn?.status === 'active') return 'webflow'

  return null
}

/**
 * Look up a Shopify order by order name (#1234) or customer email.
 * Returns order details the AI can use to answer customer questions accurately.
 */
export async function lookupShopifyOrder(supabase, { clientId, orderId, customerEmail }) {
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
  const endpoint = `https://${shopify.shop_domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`
  const headers = {
    'X-Shopify-Access-Token': shopifyToken,
    'Content-Type': 'application/json',
  }

  // Quand on connaît l'email du demandeur, il CONTRAINT la requête : on ne
  // rapatrie même pas la commande d'un autre. `filtrerParAppartenance` reste
  // le garde-fou qui décide, mais ne rien faire descendre est plus sûr que
  // faire descendre puis jeter.
  const numero = orderId ? String(orderId).replace(/^#/, '') : null
  const searchQuery = numero
    ? (customerEmail ? `name:${numero} AND email:${customerEmail}` : `name:${numero}`)
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
