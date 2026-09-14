/**
 * Actero Engine — Client Webflow Ecommerce
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Webflow était proposé au marchand dans le catalogue depuis toujours. La
 * connexion OAuth fonctionnait, le badge « Connecté » s'affichait — et
 * l'aiguilleur de `shopify-client.js` ne connaissait que deux plateformes :
 *
 *     if (platform === 'shopify')     return lookupShopifyOrder(...)
 *     if (platform === 'woocommerce') return lookupWooCommerceOrder(...)
 *     return null  // Aucune plateforme e-commerce connectée
 *
 * Un marchand Webflow obtenait donc `null` à chaque recherche de commande,
 * c'est-à-dire à la question la plus fréquente d'un SAV e-commerce. Aucune
 * erreur : le commentaire affirmait même « aucune plateforme connectée »,
 * alors qu'il y en avait une. Même famille qu'ACT-40 (Intercom se connectait
 * et ne recevait jamais rien), un cran plus grave — sans commandes, l'agent
 * n'a plus de produit.
 *
 * Contrat de forme : `lookupOrder` renvoie EXACTEMENT la même forme que ses
 * homologues Shopify et WooCommerce (voir order-format.js). Les appelants ne
 * savent pas quelle plateforme a répondu.
 *
 * CE QUE WEBFLOW FOURNIT, ET QUE WOOCOMMERCE NE FOURNIT PAS
 *
 * Le suivi de colis. `shippingProvider`, `shippingTracking` et
 * `shippingTrackingURL` sont des champs de premier niveau de l'API Ecommerce.
 * On peut donc répondre « votre colis est chez Colissimo, numéro X » sans
 * plugin tiers — ce que le connecteur WooCommerce ne peut pas faire.
 *
 * CE QUE WEBFLOW NE FOURNIT PAS
 *
 * Une recherche de commande par email. L'API liste les commandes d'un site,
 * sans filtre sur le client. On récupère donc une page récente et on filtre
 * nous-mêmes : une commande plus ancienne que cette fenêtre ne sera pas
 * trouvée par email. C'est une limite réelle, assumée ici plutôt que masquée
 * — la recherche par numéro de commande, elle, est exacte et sans limite.
 *
 * ÉTAT DE VÉRIFICATION — à lire avant de s'y fier
 *
 * Écrit le 11 septembre 2026 contre la documentation de l'API v2, sans
 * boutique Webflow pour l'exécuter : aucun appel réel n'a été fait. La
 * correspondance des noms de champs (`customerInfo.email`, `purchasedItems`,
 * `customerPaid`…) reste donc à confirmer par une première connexion.
 *
 * Le code est écrit pour que cette incertitude coûte le moins possible : tout
 * champ absent devient `null`, jamais une valeur inventée, et `lookupOrder`
 * ne lève jamais. Une dérive de nom se traduit par « je ne sais pas » — pas
 * par une affirmation fausse envoyée au client final.
 */
import { decryptToken } from '../../lib/crypto.js'
import { formatOrder } from './order-format.js'

const API = 'https://api.webflow.com/v2'

/** Combien de commandes récentes on parcourt pour une recherche par email. */
const FENETRE_EMAIL = 100

/**
 * Webflow n'a qu'un seul `status`, qui mêle paiement et expédition — comme
 * WooCommerce, et contrairement à Shopify qui sépare les deux axes. On le
 * projette sur le vocabulaire d'order-format.js.
 *
 * `null` = on ne sait pas, et order-format.js le rendra « inconnu ». C'est
 * volontaire pour `disputed` et `refunded` : un litige en cours n'est ni
 * « payé » ni « en attente », et une commande remboursée n'a pas de statut
 * d'expédition déductible. Affirmer à partir d'une absence de donnée est le
 * défaut n°1 de ce produit.
 */
const STATUT_PAIEMENT = {
  pending: 'pending',
  unfulfilled: 'paid',
  fulfilled: 'paid',
  refunded: 'refunded',
  disputed: null,
  'dispute-lost': null,
}

const STATUT_EXPEDITION = {
  pending: 'unfulfilled',
  unfulfilled: 'unfulfilled',
  fulfilled: 'fulfilled',
  refunded: null,
  disputed: null,
  'dispute-lost': null,
}

/**
 * Recherche une commande Webflow par identifiant ou par email client.
 *
 * Ne lève jamais : cette fonction tourne en plein traitement d'un message
 * client, une exception ferait échouer toute la réponse.
 */
export async function lookupOrder(supabase, { clientId, orderId, customerEmail }) {
  let acces
  try {
    acces = await chargerAcces(supabase, clientId)
  } catch (err) {
    console.error('[webflow-client] Erreur de lecture des identifiants:', err.message)
    return null
  }
  if (!acces) return null

  const { token, siteId } = acces
  const entetes = { Authorization: `Bearer ${token}`, 'accept-version': '2.0.0' }

  // Les identifiants de commande Webflow sont alphanumériques courts (pas des
  // entiers comme WooCommerce), et le marchand les écrit souvent avec un #.
  const idNormalise = orderId ? String(orderId).replace(/^#/, '').trim() : null

  try {
    if (idNormalise) {
      const res = await fetch(`${API}/sites/${siteId}/orders/${encodeURIComponent(idNormalise)}`, { headers: entetes })
      if (!res.ok) return null // 404 introuvable, 401 jeton périmé — jamais une exception
      const commande = await res.json()
      return commande ? [formatOrder(versFormeCommune(commande))] : null
    }

    if (customerEmail) {
      const params = new URLSearchParams({ limit: String(FENETRE_EMAIL), offset: '0' })
      const res = await fetch(`${API}/sites/${siteId}/orders?${params}`, { headers: entetes })
      if (!res.ok) return null
      const corps = await res.json()
      const toutes = Array.isArray(corps?.orders) ? corps.orders : []
      const cible = String(customerEmail).trim().toLowerCase()
      const siennes = toutes
        .filter((o) => String(o?.customerInfo?.email || '').trim().toLowerCase() === cible)
        .slice(0, 3)
      if (siennes.length === 0) return null
      return siennes.map((o) => formatOrder(versFormeCommune(o)))
    }

    return null // Ni identifiant, ni email : rien à chercher
  } catch (err) {
    console.error('[webflow-client] Lookup error:', err.message)
    return null
  }
}

/**
 * Jeton déchiffré + identifiant du site.
 *
 * Le callback OAuth n'enregistrait que le NOM du site, pas son identifiant —
 * or c'est l'identifiant que l'API commandes exige. On le résout ici quand il
 * manque, et on le range dans `extra_config` pour ne le faire qu'une fois.
 * Les connexions créées avant ce fichier se réparent donc d'elles-mêmes.
 */
async function chargerAcces(supabase, clientId) {
  if (!clientId) return null

  const { data: integration } = await supabase
    .from('client_integrations')
    .select('id, api_key, extra_config, status')
    .eq('client_id', clientId)
    .eq('provider', 'webflow')
    .maybeSingle()

  if (!integration || integration.status !== 'active') return null

  const token = decryptToken(integration.api_key)
  if (!token) return null

  const connu = integration.extra_config?.site_id
  if (connu) return { token, siteId: connu }

  // Résolution : le premier site du compte. Webflow autorise plusieurs sites
  // par compte ; on ne sait pas lequel est la boutique, et prendre le premier
  // est ce que faisait déjà le callback pour afficher le nom. Cohérent, donc,
  // avec ce que le marchand a vu au moment de connecter.
  const res = await fetch(`${API}/sites`, {
    headers: { Authorization: `Bearer ${token}`, 'accept-version': '2.0.0' },
  })
  if (!res.ok) return null
  const corps = await res.json()
  const siteId = corps?.sites?.[0]?.id
  if (!siteId) return null

  await supabase
    .from('client_integrations')
    .update({ extra_config: { ...(integration.extra_config || {}), site_id: siteId } })
    .eq('id', integration.id)

  return { token, siteId }
}

/**
 * Convertit une commande Webflow (API Ecommerce v2) vers la forme REST-like
 * commune que consomme `formatOrder`.
 *
 * Exporté pour être testé directement : c'est ici que se décide ce qu'on
 * AFFIRME au client final, et la règle « une donnée absente ne devient jamais
 * une affirmation » se vérifie par une table de vérité, pas par relecture.
 */
export function versFormeCommune(o) {
  const statut = o?.status
  const suivi = o?.shippingTracking

  return {
    id: o?.orderId != null ? String(o.orderId) : null,
    name: o?.orderId ? `#${o.orderId}` : null,
    created_at: o?.acceptedOn || o?.createdOn || null,
    // `customerPaid` est un objet { unit, value, string } ; `value` est en
    // centimes. On ne devine pas : si la forme n'est pas celle attendue, le
    // montant reste null et order-format.js n'en parlera pas.
    total_price: typeof o?.customerPaid?.value === 'number'
      ? (o.customerPaid.value / 100).toFixed(2)
      : null,
    currency: o?.customerPaid?.unit || null,
    financial_status: STATUT_PAIEMENT[statut] ?? null,
    fulfillment_status: STATUT_EXPEDITION[statut] ?? null,
    email: o?.customerInfo?.email || null,
    line_items: (o?.purchasedItems || []).map((li) => ({
      title: li?.productName || null,
      variant_title: li?.variantName || null,
      quantity: li?.count ?? null,
      price: typeof li?.rowTotal?.value === 'number' ? (li.rowTotal.value / 100).toFixed(2) : null,
    })),
    // Le vrai apport de Webflow face à WooCommerce. On ne crée l'entrée que
    // si un numéro existe : order-format.js filtre déjà sur `trackingNumber`,
    // mais une entrée vide brouillerait la lecture du contexte envoyé à l'IA.
    fulfillments: suivi
      ? [{
        status: STATUT_EXPEDITION[statut] ?? null,
        tracking_number: suivi,
        tracking_url: o?.shippingTrackingURL || null,
        tracking_company: o?.shippingProvider || null,
      }]
      : [],
    shipping_address: o?.shippingAddress
      ? { city: o.shippingAddress.city || null, country: o.shippingAddress.country || null }
      : null,
    refunds: [],
  }
}
