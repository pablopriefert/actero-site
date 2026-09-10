/**
 * Actero Engine — Client WooCommerce (ACT-32)
 * Recherche une commande via l'API REST WooCommerce pour enrichir les
 * réponses de l'IA avec de vraies données de commande.
 *
 * Contrat de forme : `lookupOrder` renvoie EXACTEMENT la même forme que
 * `lookupShopifyOrder` de shopify-client.js (voir order-format.js pour le
 * détail des champs). Les trois appelants (executor.js, process.js,
 * order-agent.js) ne savent pas quelle plateforme a répondu.
 *
 * Ce que WooCommerce ne fournit PAS nativement, contrairement à Shopify :
 * le suivi de colis (numéro de suivi, transporteur, lien). L'API WooCommerce
 * core n'a pas de notion de "fulfillment" — il faut un plugin (Advanced
 * Shipment Tracking, AfterShip…) pour ça, et son schéma n'est pas standardisé.
 * On renvoie donc `fulfillments: []` plutôt que d'inventer une valeur — voir
 * la règle ACT-32 "un agent qui invente un numéro de suivi est le défaut n°1
 * de ce produit".
 */
import { decryptToken } from '../../lib/crypto.js'
import { formatOrder } from './order-format.js'

// WooCommerce n'a qu'un seul champ `status` qui mélange paiement et
// expédition (Shopify a deux axes séparés : financial_status /
// fulfillment_status). On le projette de façon best-effort sur le
// vocabulaire déjà utilisé par order-format.js — aucune donnée n'est
// inventée, on ne fait que recatégoriser un statut réel.
const FINANCIAL_STATUS_MAP = {
  pending: 'pending',
  'on-hold': 'pending',
  processing: 'paid',
  completed: 'paid',
  cancelled: 'voided',
  refunded: 'refunded',
  failed: 'pending',
  trash: 'voided',
}

const FULFILLMENT_STATUS_MAP = {
  pending: 'unfulfilled',
  'on-hold': 'unfulfilled',
  processing: 'unfulfilled',
  completed: 'fulfilled',
  cancelled: 'unfulfilled',
  refunded: 'unfulfilled',
  failed: 'unfulfilled',
  trash: 'unfulfilled',
}

/**
 * Recherche une commande WooCommerce par identifiant (#1234) ou par email
 * client. Ne lève jamais : une plateforme non connectée, mal configurée,
 * ou une boutique injoignable renvoient `null` — lookupOrder est appelée en
 * plein traitement d'un message client, une exception ferait échouer toute
 * la réponse.
 */
export async function lookupOrder(supabase, { clientId, orderId, customerEmail }) {
  let credentials
  try {
    credentials = await loadCredentials(supabase, clientId)
  } catch (err) {
    console.error('[woocommerce-client] Erreur de lecture des identifiants:', err.message)
    return null
  }
  if (!credentials) return null // Pas de connexion WooCommerce, ou mal configurée

  const { siteUrl, consumerKey, consumerSecret } = credentials
  const headers = {
    Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`,
    'Content-Type': 'application/json',
  }

  // Recherche par identifiant de commande d'abord (lookup direct, fiable),
  // sinon par email (recherche, comme Shopify).
  const normalizedOrderId = orderId ? String(orderId).replace(/^#/, '').trim() : null
  const isNumericId = normalizedOrderId && /^\d+$/.test(normalizedOrderId)

  let url
  if (isNumericId) {
    url = `${siteUrl}/wp-json/wc/v3/orders/${normalizedOrderId}`
  } else if (customerEmail) {
    const params = new URLSearchParams({ search: customerEmail, per_page: '3', orderby: 'date', order: 'desc' })
    url = `${siteUrl}/wp-json/wc/v3/orders?${params.toString()}`
  } else {
    return null // Ni identifiant numérique exploitable, ni email
  }

  try {
    const res = await fetch(url, { method: 'GET', headers })
    if (!res.ok) return null // 404 (introuvable), 401 (creds invalides), etc. — jamais une exception
    const body = await res.json()
    const rawOrders = Array.isArray(body) ? body : [body]
    if (rawOrders.length === 0 || !rawOrders[0]) return null
    return rawOrders.map((o) => formatOrder(mapWooOrder(o)))
  } catch (err) {
    console.error('[woocommerce-client] Lookup error:', err.message)
    return null
  }
}

/**
 * Charge et déchiffre les identifiants WooCommerce du client.
 * Renvoie `null` si le client n'a pas de connexion WooCommerce active, ou si
 * la connexion est incomplète (clé/secret/URL manquants) — jamais une
 * exception.
 */
async function loadCredentials(supabase, clientId) {
  if (!clientId) return null

  const { data: integration } = await supabase
    .from('client_integrations')
    // `consumer_secret_encrypted` DOIT figurer ici. Le piège rencontré sur
    // gorgias.js : le code lisait `integ.webhook_secret_encrypted` alors que
    // le .select() ne le ramenait pas — la valeur valait donc toujours
    // undefined, et le repli s'activait sans bruit. Rien n'échouait.
    .select('api_key, consumer_secret_encrypted, extra_config, status')
    .eq('client_id', clientId)
    .eq('provider', 'woocommerce')
    .maybeSingle()

  if (!integration || integration.status !== 'active') return null

  const consumerKey = decryptToken(integration.api_key)
  // Le secret vit dans sa colonne dédiée, fermée au navigateur (ACT-34).
  // Aucun repli sur extra_config : vérifié le 10 septembre, il n'existait
  // zéro intégration WooCommerce en base — donc rien à rattraper. Un repli
  // écrit « au cas où » est précisément ce qui a masqué le défaut de Gorgias
  // pendant des semaines.
  const consumerSecret = decryptToken(integration.consumer_secret_encrypted)
  const siteUrl = normalizeSiteUrl(integration.extra_config?.store_url || integration.extra_config?.site_url)

  if (!consumerKey || !consumerSecret || !siteUrl) return null

  return { siteUrl, consumerKey, consumerSecret }
}

function normalizeSiteUrl(rawUrl) {
  if (!rawUrl) return null
  return String(rawUrl).trim().replace(/\/+$/, '')
}

// Convertit une commande WooCommerce (API REST v3) dans la forme REST-like
// commune que consomme formatOrder (voir order-format.js) — le même
// contrat que mapGraphQLOrder produit pour Shopify dans shopify-client.js.
function mapWooOrder(o) {
  return {
    id: o?.id != null ? String(o.id) : null,
    name: o?.number ? `#${o.number}` : (o?.id != null ? `#${o.id}` : null),
    created_at: o?.date_created,
    total_price: o?.total,
    currency: o?.currency,
    financial_status: FINANCIAL_STATUS_MAP[o?.status] || o?.status || 'inconnu',
    // Statut non reconnu (les plugins WooCommerce en ajoutent : « shipped »,
    // « delivered »…) → null, que order-format.js traduit en statut inconnu.
    // Surtout pas « non expedie » : ce serait une affirmation fausse.
    fulfillment_status: FULFILLMENT_STATUS_MAP[o?.status] || null,
    email: o?.billing?.email,
    line_items: (o?.line_items || []).map((li) => ({
      title: li.name,
      variant_title: null, // WooCommerce encode les variations dans `meta_data`, pas de champ dédié fiable
      quantity: li.quantity,
      price: li.price,
    })),
    // WooCommerce core n'a pas de notion de suivi de colis — voir le
    // commentaire en tête de fichier. On ne fabrique rien : liste vide.
    fulfillments: [],
    shipping_address: o?.shipping
      ? { city: o.shipping.city, country: o.shipping.country }
      : null,
    refunds: [],
  }
}
