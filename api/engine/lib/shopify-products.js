/**
 * Actero Engine — Shopify Product Search
 *
 * Searches products in a client's Shopify store by query for in-chat
 * AI product recommendations.
 */

/**
 * Search products in a client's Shopify store by query.
 *
 * @param {object} supabase - Supabase client (service role)
 * @param {object} opts
 * @param {string} opts.clientId - Actero client UUID
 * @param {string} opts.query - Free-text product search query
 * @param {number} [opts.limit=3] - Max products returned
 * @returns {Promise<Array>} - Array of product objects (empty if none / no store)
 */
import { decryptToken } from '../../lib/crypto.js'

export async function searchShopifyProducts(supabase, { clientId, query, limit = 3 }) {
  if (!clientId || !query) return []

  const { data: shopify } = await supabase
    .from('client_shopify_connections')
    .select('shop_domain, access_token')
    .eq('client_id', clientId)
    .maybeSingle()

  const shopifyToken = decryptToken(shopify?.access_token)
  if (!shopifyToken || !shopify?.shop_domain) return []

  try {
    const url = `https://${shopify.shop_domain}/admin/api/2025-01/products.json?title=${encodeURIComponent(query)}&limit=${limit}`
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': shopifyToken },
    })
    if (!res.ok) {
      console.error('[shopify-products] HTTP error:', res.status)
      return []
    }
    const data = await res.json()
    return (data.products || []).slice(0, limit).map(p => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      price: p.variants?.[0]?.price,
      currency: 'EUR',
      image: p.image?.src || p.images?.[0]?.src || null,
      url: `https://${shopify.shop_domain}/products/${p.handle}`,
      variant_id: p.variants?.[0]?.id,
    }))
  } catch (err) {
    console.error('[shopify-products] Search error:', err.message)
    return []
  }
}
