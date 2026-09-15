import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * La seule route de paiement Stripe self-serve — 14 septembre 2026.
 * Voir docs/superpowers/specs/2026-09-14-formules-trimestrielle-annuelle-checkout-design.md
 */

const h = vi.hoisted(() => ({
  user: { id: 'u1', email: 'u@ex.com' },
  clientRow: null,
  existingSub: null,
  customerCards: [],
  previousSubs: [],
  stripe: null,
  ecrituresClients: [],
  selectsClients: [],
}))

vi.mock('../lib/sentry.js', () => ({ withSentry: (fn) => fn, captureError: () => {} }))
vi.mock('../lib/admin-auth.js', () => ({ isActeroAdmin: () => Promise.resolve(false) }))
vi.mock('../lib/facturation-shopify.js', () => ({ refuserFacturationStripe: async () => false }))

vi.mock('@supabase/supabase-js', () => {
  function builder(table) {
    const b = {
      select: (colonnes) => { if (table === 'clients') h.selectsClients.push(colonnes); return b },
      eq: () => b, not: () => b, limit: () => b,
      update: (valeur) => { if (table === 'clients') h.ecrituresClients.push(valeur); return b },
      maybeSingle: async () => {
        if (table === 'client_users') return { data: { client_id: 'c1' }, error: null }
        if (table === 'funnel_clients') return { data: null, error: null }
        if (table === 'clients') return { data: h.clientRow, error: null }
        return { data: null, error: null }
      },
      single: async () => ({ data: h.clientRow, error: null }),
    }
    return b
  }
  return {
    createClient: () => ({
      auth: { getUser: async () => ({ data: { user: h.user }, error: null }) },
      from: (t) => builder(t),
    }),
  }
})

vi.mock('stripe', () => ({ default: function Stripe() { return h.stripe } }))

import handler from './upgrade.js'
import { FORMULES } from '../lib/formules.js'

function makeRes() {
  return {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this },
    json(b) { this.body = b; return this },
  }
}

function baseStripe() {
  return {
    customers: {
      create: vi.fn(async () => ({ id: 'cus_1' })),
      retrieve: vi.fn(async () => ({ id: 'cus_1', deleted: false })),
    },
    prices: {
      // Des prix conformes au catalogue : la route refuse un prix dont le montant
      // ne correspond plus (prixConforme).
      list: vi.fn(async ({ lookup_keys }) => {
        const f = FORMULES.find((x) => x.lookupKey === lookup_keys[0])
        return { data: f ? [{ id: `price_${f.lookupKey}`, lookup_key: f.lookupKey, unit_amount: f.montantCentimes, currency: 'eur', recurring: f.recurring }] : [] }
      }),
    },
    subscriptions: {
      retrieve: vi.fn(async () => h.existingSub),
      update: vi.fn(async () => ({})),
      list: vi.fn(async () => ({ data: h.previousSubs })),
    },
    promotionCodes: { list: vi.fn(async () => ({ data: [] })) },
    paymentMethods: { list: vi.fn(async () => ({ data: h.customerCards })) },
    checkout: { sessions: { create: vi.fn(async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_1' })) } },
  }
}

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_x'
  h.clientRow = {
    id: 'c1', plan: 'free', stripe_customer_id: 'cus_1', stripe_subscription_id: null,
    contact_email: 'u@ex.com', brand_name: 'Shop', trial_ends_at: null, billing_provider: null,
    referral_first_month_free: false, campaign_first_month_free: false, referred_by_client_id: null,
  }
  h.existingSub = null
  h.customerCards = []
  h.previousSubs = []
  h.ecrituresClients = []
  h.selectsClients = []
  h.stripe = baseStripe()
})

const post = (b) => ({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { client_id: 'c1', target_plan: 'starter', billing_period: 'monthly', ...b } })

describe('POST /api/billing/upgrade', () => {
  it('refuse une période inconnue, clés héritées comprises', async () => {
    for (const billing_period of ['weekly', 'toString']) {
      const res = makeRes()
      await handler(post({ billing_period }), res)
      expect(res.statusCode, billing_period).toBe(400)
    }
  })

  it('mensuel pour un nouveau client : page Stripe, sans essai', async () => {
    const res = makeRes()
    await handler(post(), res)
    expect(res.statusCode).toBe(200)
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(params.line_items[0].price).toBe('price_actero_starter_mensuel')
    expect(params.subscription_data.trial_period_days).toBeUndefined()
  })

  it('la route lit tout ce que l’avantage de bienvenue exige', async () => {
    // offreDeBienvenue lève si une colonne manque : sans ce test, un .select()
    // incomplet ferait échouer chaque paiement en production.
    const res = makeRes()
    await handler(post(), res)
    expect(res.statusCode).toBe(200)
    const colonnes = h.selectsClients.join(',')
    for (const c of ['trial_ends_at', 'billing_provider', 'stripe_subscription_id', 'referral_first_month_free', 'campaign_first_month_free']) {
      expect(colonnes, c).toContain(c)
    }
  })

  it('trimestriel pour un nouveau client : page Stripe avec le coupon du plan', async () => {
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'quarterly' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.checkout_url).toContain('checkout.stripe.com')
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(params.line_items[0].price).toBe('price_actero_pro_trimestriel')
    expect(params.discounts).toEqual([{ coupon: 'actero-trimestriel-pro-19950' }])
    expect(params.subscription_data.metadata.client_id).toBe('c1')
    expect(params.subscription_data.trial_period_days).toBeUndefined()
  })

  it('un client déjà abonné par le passé n’a plus de coupon', async () => {
    h.previousSubs = [{ id: 'sub_ancien', status: 'canceled' }]
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'quarterly' }), res)
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(params.discounts).toBeUndefined()
    expect(params.allow_promotion_codes).toBe(true)
  })

  it('le premier abonnement d’un filleul signale son parrain', async () => {
    h.clientRow.referral_first_month_free = true
    h.clientRow.referred_by_client_id = 'c0'
    h.clientRow.referral_code = 'PARRAIN1'
    const res = makeRes()
    await handler(post(), res)
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(params.metadata.referral_code).toBe('PARRAIN1')
    expect(params.subscription_data.trial_period_days).toBe(30)
  })

  it('un filleul qui revient après avoir été abonné ne récompense pas une seconde fois son parrain', async () => {
    h.clientRow.referral_first_month_free = true
    h.clientRow.referred_by_client_id = 'c0'
    h.clientRow.referral_code = 'PARRAIN1'
    h.previousSubs = [{ id: 'sub_ancien', status: 'canceled' }]
    const res = makeRes()
    await handler(post(), res)
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(params.metadata.referral_code).toBeUndefined()
    expect(params.subscription_data.metadata.referred_by_client_id).toBeUndefined()
  })

  it('Stripe indisponible pour « déjà abonné ? » : erreur, rien d’accordé', async () => {
    h.stripe.subscriptions.list = vi.fn(async () => { throw new Error('panne') })
    const res = makeRes()
    await handler(post(), res)
    expect(res.statusCode).toBe(503)
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('prix absent de Stripe : « Stripe not configured »', async () => {
    h.stripe.prices.list = vi.fn(async () => ({ data: [] }))
    const res = makeRes()
    await handler(post({ billing_period: 'annual' }), res)
    expect(res.statusCode).toBe(503)
    expect(res.body.error).toBe('Stripe not configured')
  })

  it('abonné avec carte, même période : changement immédiat, SANS écrire le plan en base', async () => {
    h.clientRow.plan = 'starter'
    h.clientRow.stripe_subscription_id = 'sub_1'
    h.existingSub = { id: 'sub_1', status: 'active', default_payment_method: 'pm_1', items: { data: [{ id: 'si_1', price: { lookup_key: 'actero_starter_mensuel' } }] } }
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'monthly' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.instant).toBe(true)
    const [, maj] = h.stripe.subscriptions.update.mock.calls[0]
    expect(maj.items).toEqual([{ id: 'si_1', price: 'price_actero_pro_mensuel' }])
    expect(maj.default_payment_method).toBe('pm_1')
    expect(maj.metadata.client_id).toBe('c1')
    // Le webhook accorde le plan une fois Stripe à jour — pas la route.
    expect(h.ecrituresClients.filter((v) => 'plan' in v)).toEqual([])
  })

  it('abonné avec une autre période : 409, rien ne change chez Stripe', async () => {
    h.clientRow.plan = 'starter'
    h.clientRow.stripe_subscription_id = 'sub_1'
    h.existingSub = { id: 'sub_1', status: 'active', default_payment_method: 'pm_1', items: { data: [{ id: 'si_1', price: { lookup_key: 'actero_starter_mensuel' } }] } }
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'annual' }), res)
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('changement_de_formule')
    expect(h.stripe.subscriptions.update).not.toHaveBeenCalled()
  })

  it('carte d’un abonné illisible (panne Stripe) : 503, ni échange ni nouvelle page Stripe', async () => {
    // Une panne ne vaut pas « pas de carte » : repasser par Checkout créerait un
    // second abonnement pendant que le premier continue de facturer.
    h.clientRow.plan = 'starter'
    h.clientRow.stripe_subscription_id = 'sub_1'
    h.existingSub = { id: 'sub_1', status: 'active', items: { data: [{ id: 'si_1', price: { lookup_key: 'actero_starter_mensuel' } }] } }
    h.stripe.paymentMethods.list = vi.fn(async () => { throw new Error('panne') })
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'monthly' }), res)
    expect(res.statusCode).toBe(503)
    expect(h.stripe.subscriptions.update).not.toHaveBeenCalled()
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('abonnement d’essai sans carte : nouvelle page Stripe, aucun échange de prix', async () => {
    h.clientRow.plan = 'starter'
    h.clientRow.stripe_subscription_id = 'sub_1'
    h.existingSub = { id: 'sub_1', status: 'trialing', items: { data: [{ id: 'si_1', price: { lookup_key: 'actero_starter_mensuel' } }] } }
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'monthly' }), res)
    expect(h.stripe.subscriptions.update).not.toHaveBeenCalled()
    expect(res.body.checkout_url).toBeTruthy()
  })

  it('déjà sur ce plan : 409 explicite', async () => {
    h.clientRow.plan = 'pro'
    const res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('deja_sur_ce_plan')
  })
})
