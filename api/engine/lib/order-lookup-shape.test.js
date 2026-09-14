import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * ACT-32 — contrat de forme entre connecteurs.
 *
 * shopify-client.js et woocommerce-client.js DOIVENT renvoyer exactement la
 * même forme d'objet commande (mêmes clés) : order-agent.js, executor.js et
 * process.js lisent order.orderName, order.fulfillmentStatus,
 * order.financialStatus, order.trackingInfo, order.totalPrice,
 * order.contextText sans savoir quelle plateforme a répondu. Un champ en
 * plus ou en moins d'un côté ferait parler l'agent de travers.
 *
 * Ce test appelle les deux connecteurs directement (pas via l'aiguillage de
 * shopify-client.js) pour isoler la comparaison de forme de la logique de
 * détection de plateforme, déjà testée dans shopify-client.test.js.
 */
vi.mock('../../lib/crypto.js', () => ({ decryptToken: (v) => v || null }))

const { lookupShopifyOrder } = await import('./shopify-client.js')
const { lookupOrder: lookupWooCommerceOrder } = await import('./woocommerce-client.js')

function chainableSupabase(row) {
  return {
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => Promise.resolve({ data: row }),
      }
      return builder
    },
  }
}

describe('forme de retour commune Shopify / WooCommerce', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('renvoie exactement les mêmes clés pour une commande Shopify et une commande WooCommerce', async () => {
    // --- Shopify ---
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          orders: {
            edges: [{
              node: {
                id: 'gid://shopify/Order/555111',
                name: '#1001',
                email: 'marie@example.com',
                createdAt: '2026-07-01T10:00:00Z',
                displayFinancialStatus: 'PAID',
                displayFulfillmentStatus: 'FULFILLED',
                totalPriceSet: { shopMoney: { amount: '129.00', currencyCode: 'EUR' } },
                lineItems: { edges: [{ node: { title: 'Sac cabas', quantity: 1, variantTitle: 'Camel', originalUnitPriceSet: { shopMoney: { amount: '129.00' } } } }] },
                fulfillments: [{ status: 'SUCCESS', trackingInfo: [{ number: 'TR123', url: 'https://track/TR123', company: 'Colissimo' }] }],
                shippingAddress: { city: 'Paris', country: 'France' },
              },
            }],
          },
        },
      }),
    }))
    const shopifySupabase = chainableSupabase({ shop_domain: 'demo.myshopify.com', access_token: 'enc' })
    const [shopifyOrder] = await lookupShopifyOrder(shopifySupabase, { clientId: 'c1', orderId: '#1001' })

    // --- WooCommerce ---
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 1001,
        number: '1001',
        status: 'completed',
        currency: 'EUR',
        date_created: '2026-07-01T10:00:00',
        total: '129.00',
        billing: { email: 'marie@example.com' },
        line_items: [{ name: 'Sac cabas', quantity: 1, price: '129.00', total: '129.00' }],
        shipping: { city: 'Paris', country: 'FR' },
      }),
    }))
    const wooSupabase = chainableSupabase({
      api_key: 'ck_1', consumer_secret_encrypted: 'cs_1',
      extra_config: { store_url: 'https://boutique.com' }, status: 'active',
    })
    const [wooOrder] = await lookupWooCommerceOrder(wooSupabase, { clientId: 'c2', orderId: '#1001' })

    expect(Object.keys(wooOrder).sort()).toEqual(Object.keys(shopifyOrder).sort())

    // Les deux connecteurs produisent le même type pour chaque champ
    // (booléen contre nombre, etc. tromperait order-agent.js même avec les
    // mêmes clés).
    for (const key of Object.keys(shopifyOrder)) {
      expect(Array.isArray(wooOrder[key])).toBe(Array.isArray(shopifyOrder[key]))
      if (!Array.isArray(shopifyOrder[key])) {
        expect(typeof wooOrder[key]).toBe(typeof shopifyOrder[key])
      }
    }

    // Le controle de cles et de types ci-dessus ne suffit pas : verifie le
    // 10 septembre en renommant volontairement `fulfillment_status` dans
    // mapWooOrder — le test restait VERT, parce que formatOrder remplace une
    // valeur absente par un defaut du meme type. Une garde qui a l'air
    // presente est plus dangereuse qu'une garde absente. On verifie donc
    // aussi les valeurs, sur une commande dont on connait la reponse.
    expect(wooOrder.orderName).toBe('#1001')
    expect(wooOrder.totalPrice).toBe('129.00 EUR')
    expect(wooOrder.financialStatus).toBe('Paye')
    expect(wooOrder.fulfillmentStatus).toBe('Expedie')
  })
})
