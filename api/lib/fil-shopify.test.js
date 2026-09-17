import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'node:crypto'
import { creerFauxSupabase, fausseReponse, appeler } from './faux-supabase.js'

/**
 * Le fil d'activité des closers, côté Shopify : l'ouverture du paiement
 * (api/billing/shopify-billing.js), le statut de l'abonnement et la
 * désinstallation (webhooks app/*).
 *
 * Ce qui est protégé : la bonne étape, une seule fois, pour un client rattaché
 * à un closer — et jamais une réponse changée par le fil.
 */

const h = vi.hoisted(() => ({ supabase: null }))

vi.mock('./sentry.js', () => ({ withSentry: (fn) => fn, captureError: () => {} }))
vi.mock('./admin-auth.js', () => ({ isActeroAdmin: async () => false }))
vi.mock('@supabase/supabase-js', () => ({
  // Les routes gardent leur client : il délègue au faux du test en cours.
  createClient: () => new Proxy({}, { get: (_, cle) => h.supabase[cle] }),
}))

const { default: shopifyBilling } = await import('../billing/shopify-billing.js')
const { default: abonnementShopify } = await import('../shopify/webhooks/app/subscriptions-update.js')
const { default: desinstallation } = await import('../shopify/webhooks/app/uninstalled.js')

const SECRET = 'secret-shopify-test'
const BOUTIQUE = 'boutique-test.myshopify.com'
const ABONNEMENT = 'gid://shopify/AppSubscription/4242'
const MAINTENANT = new Date('2026-09-17T14:05:30.000Z')

/** Un client sans closer, puis un fil en panne : chaque monde est créé au moment où il sert. */
const MONDES_SANS_ECRITURE = [
  () => monde({ closer: null }),
  () => monde({ erreurs: { closer_evenements: { message: 'panne' } } }),
]

function monde({ closer = 'k1', erreurs } = {}) {
  h.supabase = creerFauxSupabase({
    tables: {
      clients: [{ id: 'c1', closer_id: closer, plan: 'free', status: 'active' }],
      client_users: [{ client_id: 'c1', user_id: 'u1', role: 'owner' }],
      client_shopify_connections: [{ client_id: 'c1', shop_domain: BOUTIQUE }],
      client_settings: [{ client_id: 'c1', widget_enabled: true }],
      closer_evenements: [],
      shopify_gdpr_log: [],
    },
    uniques: { closer_evenements: ['source_key'] },
    comptes: { 'jeton-marchand': { id: 'u1', email: 'marchand@ex.com' } },
    erreurs,
  })
  return h.supabase
}

/** Un webhook Shopify signé, tel que Shopify l'envoie. */
async function livrer(route, corps, { boutique = BOUTIQUE } = {}) {
  const brut = Buffer.from(JSON.stringify(corps))
  const res = fausseReponse()
  await route({
    method: 'POST',
    headers: {
      'x-shopify-hmac-sha256': crypto.createHmac('sha256', SECRET).update(brut).digest('base64'),
      'x-shopify-shop-domain': boutique,
    },
    async *[Symbol.asyncIterator]() { yield brut },
  }, res)
  return res
}

const abonnement = (status, extra = {}) => ({
  app_subscription: { admin_graphql_api_id: ABONNEMENT, name: 'Actero Pro (annual)', status, ...extra },
})

const ouvrirPaiement = (corps = {}) => appeler(shopifyBilling, {
  methode: 'POST', jeton: 'jeton-marchand', corps: { client_id: 'c1', target_plan: 'pro', billing_period: 'annual', ...corps },
})

beforeEach(() => {
  process.env.SHOPIFY_CLIENT_SECRET = SECRET
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(MAINTENANT)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('POST /api/billing/shopify-billing', () => {
  it('URL Shopify rendue : paiement_ouvert, plateforme Shopify, clé à la minute', async () => {
    const sb = monde()
    const res = await ouvrirPaiement()
    expect(res.statusCode).toBe(200)
    expect(res.body.confirmation_url).toContain('/store/boutique-test/charges/')
    expect(sb.base.closer_evenements).toHaveLength(1)
    expect(sb.base.closer_evenements[0]).toMatchObject({
      closer_id: 'k1',
      client_id: 'c1',
      type: 'paiement_ouvert',
      details: { plan: 'pro', formule: 'annuel', plateforme: 'shopify' },
      source_key: 'paiement_ouvert:shopify:c1:2026-09-17T14:05',
    })
  })

  it('un double clic dans la minute n’écrit qu’une étape ; la minute suivante, une autre', async () => {
    const sb = monde()
    await ouvrirPaiement()
    vi.setSystemTime(new Date('2026-09-17T14:05:59.000Z'))
    expect((await ouvrirPaiement()).statusCode).toBe(200)
    expect(sb.base.closer_evenements).toHaveLength(1)
    vi.setSystemTime(new Date('2026-09-17T14:06:01.000Z'))
    await ouvrirPaiement()
    expect(sb.base.closer_evenements.map((e) => e.source_key)).toEqual([
      'paiement_ouvert:shopify:c1:2026-09-17T14:05',
      'paiement_ouvert:shopify:c1:2026-09-17T14:06',
    ])
  })

  it('formule inconnue : le plan seul', async () => {
    const sb = monde()
    await ouvrirPaiement({ billing_period: 'hebdo' })
    vi.setSystemTime(new Date('2026-09-17T14:07:00.000Z'))
    await ouvrirPaiement({ billing_period: undefined, target_plan: 'starter' })
    expect(sb.base.closer_evenements.map((e) => e.details)).toEqual([
      { plan: 'pro', plateforme: 'shopify' },
      { plan: 'starter', plateforme: 'shopify' },
    ])
  })

  it('pas d’URL rendue : aucune étape', async () => {
    let sb = monde()
    sb.base.client_shopify_connections = []
    expect((await ouvrirPaiement()).statusCode).toBe(409)
    expect((await ouvrirPaiement({ target_plan: 'enterprise' })).statusCode).toBe(400)
    expect((await appeler(shopifyBilling, { methode: 'POST', jeton: 'jeton-marchand', corps: { client_id: 'c2', target_plan: 'pro' } })).statusCode).toBe(403)
    expect(sb.base.closer_evenements).toEqual([])

    sb = monde({ erreurs: { client_shopify_connections: { message: 'panne' } } })
    expect((await ouvrirPaiement()).statusCode).toBe(503)
    expect(sb.base.closer_evenements).toEqual([])
  })

  it('client sans closer, ou fil en panne : la même réponse, rien d’écrit', async () => {
    monde()
    const attendue = await ouvrirPaiement()
    for (const creer of MONDES_SANS_ECRITURE) {
      const sb = creer()
      const res = await ouvrirPaiement()
      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual(attendue.body)
      expect(sb.base.closer_evenements).toEqual([])
    }
  })
})

describe('webhook app_subscriptions/update', () => {
  it.each([
    ['ACTIVE', 'abonnement_demarre'],
    ['FROZEN', 'paiement_echoue'],
    ['CANCELLED', 'abonnement_termine'],
    ['DECLINED', 'abonnement_termine'],
    ['EXPIRED', 'abonnement_termine'],
  ])('%s → %s', async (status, type) => {
    const sb = monde()
    const res = await livrer(abonnementShopify, abonnement(status))
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ acknowledged: true, status, plan: 'pro' })
    expect(sb.base.closer_evenements).toHaveLength(1)
    expect(sb.base.closer_evenements[0]).toMatchObject({
      closer_id: 'k1',
      client_id: 'c1',
      type,
      details: { plateforme: 'shopify', plan: 'pro', formule: 'annuel' },
      source_key: `shopify:${ABONNEMENT}:${status}`,
    })
  })

  it('le traitement métier est inchangé : ACTIVE promeut toujours le client', async () => {
    const sb = monde()
    await livrer(abonnementShopify, abonnement('ACTIVE'))
    expect(sb.base.clients[0]).toMatchObject({ plan: 'pro', billing_provider: 'shopify', shopify_subscription_id: ABONNEMENT })
  })

  it('la formule se lit dans l’intervalle quand le payload le porte', async () => {
    const sb = monde()
    await livrer(abonnementShopify, abonnement('ACTIVE', { name: 'Actero Starter', interval: 'EVERY_30_DAYS' }))
    expect(sb.base.closer_evenements[0].details).toEqual({ plateforme: 'shopify', plan: 'starter', formule: 'mensuel' })
  })

  it('un statut rejoué n’écrit qu’une étape', async () => {
    const sb = monde()
    await livrer(abonnementShopify, abonnement('FROZEN'))
    await livrer(abonnementShopify, abonnement('FROZEN'))
    expect(sb.base.closer_evenements).toHaveLength(1)
  })

  it('PENDING, plan inconnu, abonnement sans identifiant, boutique inconnue : aucune étape', async () => {
    const sb = monde()
    await livrer(abonnementShopify, abonnement('PENDING'))
    await livrer(abonnementShopify, abonnement('ACTIVE', { name: 'Plan gratuit' }))
    await livrer(abonnementShopify, abonnement('CANCELLED', { admin_graphql_api_id: null }))
    const res = await livrer(abonnementShopify, abonnement('CANCELLED'), { boutique: 'inconnue.myshopify.com' })
    expect(res.body).toEqual({ acknowledged: true, skipped: true })
    expect(sb.base.closer_evenements).toEqual([])
  })

  it('client sans closer, ou fil en panne : toujours 200, même corps', async () => {
    for (const creer of MONDES_SANS_ECRITURE) {
      const sb = creer()
      const res = await livrer(abonnementShopify, abonnement('CANCELLED'))
      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({ acknowledged: true, status: 'CANCELLED', plan: 'pro' })
      expect(sb.base.closer_evenements).toEqual([])
      expect(sb.base.clients[0].plan).toBe('free')
    }
  })
})

describe('webhook app/uninstalled', () => {
  it('app_desinstallee, une fois par jour, et le client reste marqué désinstallé', async () => {
    const sb = monde()
    const res = await livrer(desinstallation, {})
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ acknowledged: true })
    expect(sb.base.clients[0].status).toBe('uninstalled')
    expect(sb.base.closer_evenements).toHaveLength(1)
    expect(sb.base.closer_evenements[0]).toMatchObject({
      closer_id: 'k1',
      client_id: 'c1',
      type: 'app_desinstallee',
      details: {},
      source_key: `shopify:${BOUTIQUE}:desinstallee:2026-09-17`,
    })

    await livrer(desinstallation, {})
    vi.setSystemTime(new Date('2026-09-18T08:00:00.000Z'))
    await livrer(desinstallation, {})
    expect(sb.base.closer_evenements.map((e) => e.source_key)).toEqual([
      `shopify:${BOUTIQUE}:desinstallee:2026-09-17`,
      `shopify:${BOUTIQUE}:desinstallee:2026-09-18`,
    ])
  })

  it('boutique inconnue, client sans closer, fil en panne : toujours 200, rien d’écrit', async () => {
    const inconnue = monde()
    expect((await livrer(desinstallation, {}, { boutique: 'inconnue.myshopify.com' })).body).toEqual({ acknowledged: true })
    expect(inconnue.base.closer_evenements).toEqual([])
    for (const creer of MONDES_SANS_ECRITURE) {
      const sb = creer()
      const res = await livrer(desinstallation, {})
      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({ acknowledged: true })
      expect(sb.base.closer_evenements).toEqual([])
      expect(sb.base.clients[0].status).toBe('uninstalled')
    }
  })
})
