/**
 * Actero Engine — Shopify Product Search
 *
 * Searches products in a client's Shopify store by query for in-chat
 * AI product recommendations.
 *
 * Uses the GraphQL Admin API (App Store requirement 2.2.4 — as of
 * April 2025 all new public apps must be built exclusively with the
 * GraphQL Admin API, with REST allowed only for Theme/Asset endpoints).
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

const GRAPHQL_API_VERSION = '2025-01'

const PRODUCTS_SEARCH_QUERY = `
  query ProductsSearch($query: String!, $first: Int!) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          title
          handle
          featuredImage { url }
          images(first: 1) { edges { node { url } } }
          variants(first: 1) {
            edges {
              node {
                id
                price
              }
            }
          }
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
    // Shopify product search syntax: "title:*<query>*" matches partial titles.
    // We sanitise the query to avoid injection into the search DSL.
    const safeQuery = String(query).replace(/[()"\\]/g, ' ').trim()
    const searchTerm = `title:*${safeQuery}*`

    const res = await fetch(
      `https://${shopify.shop_domain}/admin/api/${GRAPHQL_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: PRODUCTS_SEARCH_QUERY,
          variables: { query: searchTerm, first: limit },
        }),
      },
    )
    if (!res.ok) {
      console.error('[shopify-products] HTTP error:', res.status)
      return []
    }
    const json = await res.json()
    if (json?.errors?.length) {
      console.error('[shopify-products] GraphQL errors:', JSON.stringify(json.errors))
      return []
    }

    const edges = json?.data?.products?.edges || []
    return edges.slice(0, limit).map(({ node }) => {
      const firstVariant = node?.variants?.edges?.[0]?.node
      const imageUrl =
        node?.featuredImage?.url ||
        node?.images?.edges?.[0]?.node?.url ||
        null
      return {
        id: gidToNumericId(node.id),
        title: node.title,
        handle: node.handle,
        price: firstVariant?.price,
        currency: 'EUR',
        image: imageUrl,
        url: `https://${shopify.shop_domain}/products/${node.handle}`,
        variant_id: gidToNumericId(firstVariant?.id),
      }
    })
  } catch (err) {
    console.error('[shopify-products] Search error:', err.message)
    return []
  }
}
