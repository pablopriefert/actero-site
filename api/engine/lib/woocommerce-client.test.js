import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * ACT-32 — connecteur WooCommerce.
 *
 * decryptToken est stubbé en passe-plat (identité) : ces tests ne vérifient
 * pas le chiffrement lui-même (couvert par api/lib/crypto.test.js, ACT-7),
 * seulement que woocommerce-client.js déchiffre bien api_key et
 * extra_config.consumer_secret avant de les utiliser.
 */
vi.mock('../../lib/crypto.js', () => ({ decryptToken: (v) => v || null }))

const { lookupOrder } = await import('./woocommerce-client.js')

// Stub Supabase chaînable : .from(table) renvoie une réponse fixe pour ce
// nom de table, quel que soit le nombre de .select()/.eq() enchaînés.
function makeSupabaseStub(byTable) {
  return {
    from: (table) => {
      const entry = byTable[table]
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => Promise.resolve(entry ?? { data: null }),
      }
      return builder
    },
  }
}

const ACTIVE_INTEGRATION_ROW = {
  data: {
    api_key: 'ck_test_123',
    extra_config: { store_url: 'https://boutique-demo.com', consumer_secret: 'cs_test_456' },
    status: 'active',
  },
}

function wooOrderPayload(overrides = {}) {
  return {
    id: 1234,
    number: '1234',
    status: 'completed',
    currency: 'EUR',
    date_created: '2026-07-01T10:00:00',
    total: '89.90',
    billing: { email: 'marie@example.com' },
    line_items: [
      { name: 'Tote bag', quantity: 2, price: '44.95', total: '89.90' },
    ],
    shipping: { city: 'Lyon', country: 'FR' },
    ...overrides,
  }
}

describe('lookupOrder WooCommerce — connexion absente ou mal configurée', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it("renvoie null quand le client n'a pas d'intégration WooCommerce", async () => {
    const supabase = makeSupabaseStub({ client_integrations: { data: null } })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await lookupOrder(supabase, { clientId: 'c1', orderId: '#1234' })

    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled() // Pas de credentials → pas d'appel réseau
  })

  it("renvoie null quand l'intégration existe mais n'est pas active (pending/revoked)", async () => {
    const supabase = makeSupabaseStub({
      client_integrations: { data: { ...ACTIVE_INTEGRATION_ROW.data, status: 'revoked' } },
    })
    const result = await lookupOrder(supabase, { clientId: 'c1', orderId: '#1234' })
    expect(result).toBeNull()
  })

  it('renvoie null quand le consumer_secret est absent (intégration incomplète), sans lever', async () => {
    const supabase = makeSupabaseStub({
      client_integrations: {
        data: { api_key: 'ck_test_123', extra_config: { store_url: 'https://boutique-demo.com' }, status: 'active' },
      },
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(lookupOrder(supabase, { clientId: 'c1', orderId: '#1234' })).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("renvoie null quand l'URL de la boutique est absente, sans lever", async () => {
    const supabase = makeSupabaseStub({
      client_integrations: {
        data: { api_key: 'ck_test_123', extra_config: { consumer_secret: 'cs_test_456' }, status: 'active' },
      },
    })
    await expect(lookupOrder(supabase, { clientId: 'c1', orderId: '#1234' })).resolves.toBeNull()
  })

  it('renvoie null si la lecture Supabase des identifiants échoue, plutôt que de lever', async () => {
    const supabase = {
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.reject(new Error('DB down')) }) }) }) }),
    }
    await expect(lookupOrder(supabase, { clientId: 'c1', orderId: '#1234' })).resolves.toBeNull()
  })
})

describe('lookupOrder WooCommerce — boutique correctement connectée', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('recherche une commande par identifiant en lookup direct, authentifié en Basic Auth', async () => {
    const supabase = makeSupabaseStub({ client_integrations: ACTIVE_INTEGRATION_ROW })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => wooOrderPayload() })
    vi.stubGlobal('fetch', fetchMock)

    const orders = await lookupOrder(supabase, { clientId: 'c1', orderId: '#1234' })

    const [calledUrl, calledOptions] = fetchMock.mock.calls[0]
    expect(calledUrl).toBe('https://boutique-demo.com/wp-json/wc/v3/orders/1234')
    expect(calledOptions.headers.Authorization).toMatch(/^Basic /)
    // consumer_key:consumer_secret encodé en base64, comme documenté par WooCommerce REST v3.
    expect(Buffer.from(calledOptions.headers.Authorization.replace('Basic ', ''), 'base64').toString()).toBe('ck_test_123:cs_test_456')

    expect(orders).toHaveLength(1)
    expect(orders[0].orderName).toBe('#1234')
  })

  it('recherche par email quand aucun identifiant numérique n\'est fourni', async () => {
    const supabase = makeSupabaseStub({ client_integrations: ACTIVE_INTEGRATION_ROW })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [wooOrderPayload()] })
    vi.stubGlobal('fetch', fetchMock)

    const orders = await lookupOrder(supabase, { clientId: 'c1', customerEmail: 'marie@example.com' })

    const calledUrl = fetchMock.mock.calls[0][0]
    expect(calledUrl).toContain('/wp-json/wc/v3/orders?')
    expect(calledUrl).toContain('search=marie%40example.com')
    expect(orders).toHaveLength(1)
    expect(orders[0].email).toBe('marie@example.com')
  })

  it('renvoie null (pas une exception) quand la boutique répond 404 — commande introuvable', async () => {
    const supabase = makeSupabaseStub({ client_integrations: ACTIVE_INTEGRATION_ROW })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    const orders = await lookupOrder(supabase, { clientId: 'c1', orderId: '#9999' })
    expect(orders).toBeNull()
  })

  it('renvoie null (pas une exception) quand la boutique répond 401 — clés invalides', async () => {
    const supabase = makeSupabaseStub({ client_integrations: ACTIVE_INTEGRATION_ROW })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))

    const orders = await lookupOrder(supabase, { clientId: 'c1', orderId: '#1234' })
    expect(orders).toBeNull()
  })

  it('renvoie null (pas une exception) quand la boutique est injoignable (fetch lève)', async () => {
    const supabase = makeSupabaseStub({ client_integrations: ACTIVE_INTEGRATION_ROW })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ENOTFOUND boutique-demo.com')))

    await expect(lookupOrder(supabase, { clientId: 'c1', orderId: '#1234' })).resolves.toBeNull()
  })

  it("ne fabrique jamais de suivi : trackingInfo est vide (WooCommerce core n'a pas de fulfillment)", async () => {
    const supabase = makeSupabaseStub({ client_integrations: ACTIVE_INTEGRATION_ROW })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => wooOrderPayload() }))

    const orders = await lookupOrder(supabase, { clientId: 'c1', orderId: '#1234' })
    expect(orders[0].trackingInfo).toEqual([])
  })

  it('mappe le statut WooCommerce vers financialStatus / fulfillmentStatus sans inventer de donnée', async () => {
    const supabase = makeSupabaseStub({ client_integrations: ACTIVE_INTEGRATION_ROW })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => wooOrderPayload({ status: 'processing' }) }))

    const orders = await lookupOrder(supabase, { clientId: 'c1', orderId: '#1234' })
    expect(orders[0].financialStatus).toBe('Paye')
    expect(orders[0].fulfillmentStatus).toBe('Non expedie')
  })

  it("un statut personnalise ne fait jamais dire « Non expedie » a un client qui a recu son colis", async () => {
    // Les marchands WooCommerce ajoutent couramment leurs propres statuts via
    // des plugins (« shipped », « delivered », « awaiting-shipment »). Ce sont
    // precisement les marchands qui tiennent au suivi. Un statut non reconnu
    // doit donner « inconnu », jamais une affirmation que le colis n'est pas
    // parti : le client, lui, l'a entre les mains.
    const supabase = makeSupabaseStub({ client_integrations: ACTIVE_INTEGRATION_ROW })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => wooOrderPayload({ status: 'delivered' }) }))

    const orders = await lookupOrder(supabase, { clientId: 'c1', orderId: '#1234' })
    expect(orders[0].fulfillmentStatus).not.toBe('Non expedie')
    expect(orders[0].contextText).not.toContain('Expedition: Non expedie')
  })
})
