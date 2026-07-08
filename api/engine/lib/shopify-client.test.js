import { describe, it, expect, vi, beforeEach } from 'vitest'

// decryptToken is imported by shopify-client; stub it to a usable token.
vi.mock('../../lib/crypto.js', () => ({ decryptToken: () => 'shpat_test_token' }))

const { lookupOrder } = await import('./shopify-client.js')

// Supabase stub returning an active Shopify connection.
const supabase = {
  from: () => ({
    select: () => ({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: { shop_domain: 'demo.myshopify.com', access_token: 'enc' } }) }),
    }),
  }),
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

describe('lookupOrder (GraphQL)', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('queries the GraphQL endpoint (not REST) and maps the order', async () => {
    const fetchMock = vi.fn().mockResolvedValue(graphqlOrdersResponse())
    vi.stubGlobal('fetch', fetchMock)

    const orders = await lookupOrder(supabase, { clientId: 'c1', orderId: '#1001' })

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
    const orders = await lookupOrder(supabase, { clientId: 'c1', customerEmail: 'none@example.com' })
    expect(orders).toBeNull()
  })
})
