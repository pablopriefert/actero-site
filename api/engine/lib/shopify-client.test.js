import { describe, it, expect, vi, beforeEach } from 'vitest'

// decryptToken is imported by shopify-client (et par woocommerce-client, importé
// par le dispatcher) ; stub-le en un token exploitable.
vi.mock('../../lib/crypto.js', () => ({ decryptToken: () => 'shpat_test_token' }))

// ACT-32 — le dispatcher `lookupOrder` importe woocommerce-client.js. On le
// mock ici pour isoler les tests du dispatcher de la logique interne du
// connecteur WooCommerce (testée séparément dans woocommerce-client.test.js).
const wooLookupOrderMock = vi.fn()
vi.mock('./woocommerce-client.js', () => ({ lookupOrder: (...args) => wooLookupOrderMock(...args) }))

const { lookupOrder, lookupShopifyOrder } = await import('./shopify-client.js')

// Supabase stub returning an active Shopify connection (un seul niveau de
// .eq() — suffisant pour lookupShopifyOrder appelé directement).
const supabase = {
  from: () => ({
    select: () => ({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: { shop_domain: 'demo.myshopify.com', access_token: 'enc' } }) }),
    }),
  }),
}

// Stub chaînable supportant plusieurs .eq() et une réponse différente par
// table — nécessaire pour tester la détection de plateforme du dispatcher,
// qui interroge client_shopify_connections PUIS client_integrations.
function makeSupabaseStub(byTable) {
  return {
    from: (table) => {
      const entry = byTable[table]
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => {
          if (entry instanceof Error) return Promise.reject(entry)
          return Promise.resolve(entry ?? { data: null })
        },
      }
      return builder
    },
  }
}

function graphqlOrdersResponse() {
  return {
    ok: true,
    json: async () => ({
      data: {
        orders: {
          edges: [
            {
              node: {
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
            },
          ],
        },
      },
    }),
  }
}

describe('lookupShopifyOrder (GraphQL)', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('queries the GraphQL endpoint (not REST) and maps the order', async () => {
    const fetchMock = vi.fn().mockResolvedValue(graphqlOrdersResponse())
    vi.stubGlobal('fetch', fetchMock)

    const orders = await lookupShopifyOrder(supabase, { clientId: 'c1', orderId: '#1001' })

    // Hit the GraphQL endpoint, not the legacy REST orders.json.
    const calledUrl = fetchMock.mock.calls[0][0]
    expect(calledUrl).toContain('/admin/api/2025-01/graphql.json')
    expect(calledUrl).not.toContain('orders.json')

    expect(orders).toHaveLength(1)
    const o = orders[0]
    expect(o.orderName).toBe('#1001')
    expect(o.fulfillmentStatus).toBe('Expedie')
    expect(o.financialStatus).toBe('Paye')
    expect(o.items[0]).toMatchObject({ name: 'Sac cabas', quantity: 1, variant: 'Camel' })
    expect(o.trackingInfo[0]).toMatchObject({ trackingNumber: 'TR123', carrier: 'Colissimo' })
    expect(o.contextText).toContain('#1001')
  })

  it('returns null when no orders match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { orders: { edges: [] } } }) }))
    const orders = await lookupShopifyOrder(supabase, { clientId: 'c1', customerEmail: 'none@example.com' })
    expect(orders).toBeNull()
  })
})

/**
 * ACT-32 — lookupOrder est maintenant l'aiguillage multi-plateforme utilisé
 * par executor.js, process.js et order-agent.js (qui n'ont pas changé). Ces
 * tests vérifient la détection de plateforme et la délégation, pas la
 * logique interne de chaque connecteur (déjà couverte ailleurs).
 */
describe('lookupOrder (aiguillage multi-plateforme)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    wooLookupOrderMock.mockReset()
  })

  it("renvoie null quand le client n'a aucune connexion e-commerce", async () => {
    const supa = makeSupabaseStub({
      client_shopify_connections: { data: null },
      client_integrations: { data: null },
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await lookupOrder(supa, { clientId: 'c-sans-connexion', orderId: '#42' })

    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(wooLookupOrderMock).not.toHaveBeenCalled()
  })

  it('délègue à Shopify et garde exactement le comportement Shopify actuel quand la connexion existe', async () => {
    const supa = makeSupabaseStub({
      client_shopify_connections: { data: { id: 'conn-1', shop_domain: 'demo.myshopify.com', access_token: 'enc' } },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(graphqlOrdersResponse()))

    const result = await lookupOrder(supa, { clientId: 'c-shopify', orderId: '#1001' })

    expect(wooLookupOrderMock).not.toHaveBeenCalled()
    expect(result).toHaveLength(1)
    expect(result[0].orderName).toBe('#1001')
  })

  it('délègue à WooCommerce quand seule une connexion WooCommerce active existe', async () => {
    const supa = makeSupabaseStub({
      client_shopify_connections: { data: null },
      client_integrations: { data: { id: 'int-1', status: 'active' } },
    })
    const fakeOrders = [{ orderName: '#7', contextText: 'COMMANDE #7' }]
    wooLookupOrderMock.mockResolvedValue(fakeOrders)

    const result = await lookupOrder(supa, { clientId: 'c-woo', orderId: '#7' })

    expect(wooLookupOrderMock).toHaveBeenCalledWith(supa, { clientId: 'c-woo', orderId: '#7' })
    expect(result).toBe(fakeOrders)
  })

  it("ignore une intégration WooCommerce non active (pending/revoked) — ce n'est pas une connexion", async () => {
    const supa = makeSupabaseStub({
      client_shopify_connections: { data: null },
      client_integrations: { data: { id: 'int-1', status: 'pending' } },
    })

    const result = await lookupOrder(supa, { clientId: 'c-woo-pending', orderId: '#7' })

    expect(result).toBeNull()
    expect(wooLookupOrderMock).not.toHaveBeenCalled()
  })

  it('renvoie null (ne lève jamais) si la détection de plateforme échoue', async () => {
    const supa = makeSupabaseStub({
      client_shopify_connections: new Error('connexion Supabase perdue'),
    })

    await expect(lookupOrder(supa, { clientId: 'c-erreur', orderId: '#1' })).resolves.toBeNull()
  })
})
