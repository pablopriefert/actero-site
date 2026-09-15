import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * La seule route de paiement Stripe self-serve — 14 septembre 2026.
 * Voir docs/superpowers/specs/2026-09-14-formules-trimestrielle-annuelle-checkout-design.md
 *
 * Le mock Supabase FILTRE : chaque `eq` enregistre son filtre, et une lecture
 * ne renvoie que les lignes qui les passent tous, réduites aux colonnes du
 * `.select()`. L'ancien renvoyait la même ligne quelle que soit la requête :
 * un lien vers un autre client, ou un code de parrainage lu sur la mauvaise
 * fiche, passaient sans qu'aucun test ne rougisse.
 */

const h = vi.hoisted(() => ({
  user: { id: 'u1', email: 'u@ex.com' },
  admin: false,
  refusShopify: false,
  // Les lignes de la base, par table.
  base: {},
  clientRow: null,
  // Chez Stripe.
  existingSub: null,
  customerCards: [],
  abonnementsDuClient: [],
  sessionsOuvertes: [],
  codesPromo: {},
  changement: null,
  intentions: {},
  stripe: null,
  ecrituresClients: [],
  selectsClients: [],
}))

vi.mock('../lib/sentry.js', () => ({ withSentry: (fn) => fn, captureError: () => {} }))
vi.mock('../lib/admin-auth.js', () => ({ isActeroAdmin: async () => h.admin }))
// La vraie garde lit client_shopify_connections. Ici ne compte que ce que la
// route fait de sa réponse : `true` veut dire « réponse déjà envoyée ».
vi.mock('../lib/facturation-shopify.js', () => ({
  refuserFacturationStripe: async (_supabase, _clientId, res) => {
    if (!h.refusShopify) return false
    res.status(409).json({ error: 'shopify_billing_required' })
    return true
  },
}))

vi.mock('@supabase/supabase-js', () => {
  // La ligne réduite aux colonnes demandées : une colonne absente du
  // `.select()` reste `undefined`, comme en vrai.
  function projeter(ligne, colonnes) {
    if (!ligne) return null
    if (!colonnes || colonnes.trim() === '*') return { ...ligne }
    return Object.fromEntries(colonnes.split(',').map((c) => c.trim()).filter(Boolean)
      .map((c) => [c, c in ligne ? ligne[c] : null]))
  }

  function builder(table) {
    let colonnes = null
    const filtres = []
    const lignes = () => (h.base[table] || []).filter((ligne) => filtres.every(({ colonne, op, valeur }) => (
      op === 'eq' ? ligne[colonne] === valeur : (ligne[colonne] ?? null) !== valeur
    )))
    const b = {
      select: (c) => { colonnes = c; if (table === 'clients') h.selectsClients.push(c); return b },
      eq: (colonne, valeur) => { filtres.push({ colonne, op: 'eq', valeur }); return b },
      // Seul usage de la route : .not(colonne, 'is', null).
      not: (colonne, _op, valeur) => { filtres.push({ colonne, op: 'not_is', valeur }); return b },
      limit: () => b,
      update: (valeur) => { if (table === 'clients') h.ecrituresClients.push(valeur); return b },
      maybeSingle: async () => ({ data: projeter(lignes()[0], colonnes), error: null }),
      single: async () => {
        const [ligne] = lignes()
        return ligne ? { data: projeter(ligne, colonnes), error: null } : { data: null, error: { message: 'aucune ligne' } }
      },
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
      retrieve: vi.fn(async (id) => ({ id, deleted: false })),
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
      // Un changement immédiat fait deux appels : la carte, puis le prix. Seul
      // le second porte `payment_behavior`, et reçoit la réponse de Stripe au
      // paiement de la différence.
      update: vi.fn(async (id, params) => (params.payment_behavior ? h.changement : { id })),
      list: vi.fn(async () => ({ data: h.abonnementsDuClient, has_more: false })),
    },
    paymentIntents: { retrieve: vi.fn(async (id) => h.intentions[id]) },
    promotionCodes: {
      list: vi.fn(async ({ code }) => ({ data: h.codesPromo[code] ? [{ id: h.codesPromo[code], code }] : [] })),
    },
    paymentMethods: { list: vi.fn(async () => ({ data: h.customerCards })) },
    checkout: {
      sessions: {
        list: vi.fn(async () => ({ data: h.sessionsOuvertes, has_more: false })),
        expire: vi.fn(async (id) => ({ id, status: 'expired' })),
        create: vi.fn(async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_1' })),
      },
    },
  }
}

/** Nombre total d'appels reçus par le faux Stripe. */
function appelsStripe(o = h.stripe) {
  return Object.values(o).reduce((n, v) => n + (vi.isMockFunction(v)
    ? v.mock.calls.length
    : (v && typeof v === 'object' ? appelsStripe(v) : 0)), 0)
}

/** Un abonné Starter mensuel, carte posée sur l'abonnement, chez le client Stripe du compte. */
function abonneStarterMensuel(surcharge = {}) {
  h.clientRow.plan = 'starter'
  h.clientRow.stripe_subscription_id = 'sub_1'
  h.existingSub = {
    id: 'sub_1', status: 'active', customer: 'cus_1', default_payment_method: 'pm_1',
    items: { data: [{ id: 'si_1', price: { id: 'price_actero_starter_mensuel', lookup_key: 'actero_starter_mensuel', recurring: { interval: 'month', interval_count: 1 } } }] },
    ...surcharge,
  }
  h.abonnementsDuClient = [h.existingSub]
}

/** Le changement de prix n'est pas passé : une facture de la différence reste ouverte. */
function changementEnAttente(intention) {
  h.changement = {
    id: 'sub_1', status: 'active',
    pending_update: { expires_at: 1_900_000_000, subscription_items: [] },
    latest_invoice: {
      id: 'in_2', status: 'open', hosted_invoice_url: 'https://invoice.stripe.com/i/in_2',
      payments: { data: [{ is_default: true, payment: { type: 'payment_intent', payment_intent: 'pi_2' } }] },
    },
  }
  h.intentions = { pi_2: { id: 'pi_2', ...intention } }
}

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_x'
  h.user = { id: 'u1', email: 'u@ex.com' }
  h.admin = false
  h.refusShopify = false
  h.clientRow = {
    id: 'c1', plan: 'free', stripe_customer_id: 'cus_1', stripe_subscription_id: null,
    contact_email: 'u@ex.com', brand_name: 'Shop', trial_ends_at: null, billing_provider: null,
    referral_first_month_free: false, campaign_first_month_free: false, referred_by_client_id: null,
  }
  h.base = {
    client_users: [{ user_id: 'u1', client_id: 'c1', role: 'owner' }],
    clients: [h.clientRow],
    funnel_clients: [],
  }
  h.existingSub = null
  h.customerCards = []
  h.abonnementsDuClient = []
  h.sessionsOuvertes = []
  h.codesPromo = {}
  h.changement = {
    id: 'sub_1', status: 'active', pending_update: null,
    latest_invoice: { id: 'in_1', status: 'paid', hosted_invoice_url: 'https://invoice.stripe.com/i/in_1', payments: { data: [] } },
  }
  h.intentions = {}
  h.ecrituresClients = []
  h.selectsClients = []
  h.stripe = baseStripe()
})

const post = (b) => ({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { client_id: 'c1', target_plan: 'starter', billing_period: 'monthly', ...b } })

describe('POST /api/billing/upgrade — qui peut payer', () => {
  it('401 sans jeton', async () => {
    const res = makeRes()
    await handler({ method: 'POST', headers: {}, body: { client_id: 'c1', target_plan: 'pro' } }, res)
    expect(res.statusCode).toBe(401)
    expect(appelsStripe()).toBe(0)
  })

  it('403 quand l’utilisateur n’est pas lié à CE client', async () => {
    // Lié à un autre compte, et un autre utilisateur lié à celui-ci : le lien
    // doit correspondre aux deux filtres à la fois.
    h.base.client_users = [
      { user_id: 'u1', client_id: 'c2', role: 'owner' },
      { user_id: 'u2', client_id: 'c1', role: 'owner' },
    ]
    const res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(403)
    expect(appelsStripe()).toBe(0)
  })

  it('403 pour le rôle support : la carte de l’entreprise n’est pas la sienne', async () => {
    h.base.client_users = [{ user_id: 'u1', client_id: 'c1', role: 'support' }]
    const res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(403)
    expect(res.body.error).toBe('Seuls le propriétaire du compte ou un manager peuvent modifier l’abonnement.')
    expect(appelsStripe()).toBe(0)
  })

  it('un manager peut payer', async () => {
    h.base.client_users = [{ user_id: 'u1', client_id: 'c1', role: 'manager' }]
    const res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.checkout_url).toContain('checkout.stripe.com')
  })

  it('refus Shopify : la garde répond elle-même, aucun appel Stripe', async () => {
    h.refusShopify = true
    const res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('shopify_billing_required')
    expect(appelsStripe()).toBe(0)
  })
})

describe('POST /api/billing/upgrade — nouvelle page Stripe', () => {
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
    expect(params.customer).toBe('cus_1')
    expect(params.line_items[0].price).toBe('price_actero_starter_mensuel')
    expect(params.subscription_data.trial_period_days).toBeUndefined()
  })

  it('la route lit tout ce que l’avantage de bienvenue exige', async () => {
    // offreDeBienvenue lève si une colonne manque : sans ce test, un .select()
    // incomplet ferait échouer chaque paiement en production. Le mock ne rend
    // que les colonnes lues, donc un oubli ferait aussi échouer la réponse.
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
    h.abonnementsDuClient = [{ id: 'sub_ancien', status: 'canceled' }]
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'quarterly' }), res)
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(params.discounts).toBeUndefined()
    expect(params.allow_promotion_codes).toBe(true)
  })

  it('le code du parrain est lu sur la fiche du PARRAIN, pas sur celle du filleul', async () => {
    h.clientRow.referral_first_month_free = true
    h.clientRow.referred_by_client_id = 'c0'
    // Le filleul a son propre code : c'est celui qu'une lecture sur la mauvaise
    // fiche renverrait.
    h.clientRow.referral_code = 'FILLEUL1'
    h.base.clients.push({ id: 'c0', referral_code: 'PARRAIN1' })
    const res = makeRes()
    await handler(post(), res)
    expect(res.statusCode).toBe(200)
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(params.metadata.referral_code).toBe('PARRAIN1')
    expect(params.subscription_data.metadata.referred_by_client_id).toBe('c0')
    expect(params.subscription_data.trial_period_days).toBe(30)
  })

  it('un filleul qui revient après avoir été abonné ne récompense pas une seconde fois son parrain', async () => {
    h.clientRow.referral_first_month_free = true
    h.clientRow.referred_by_client_id = 'c0'
    h.base.clients.push({ id: 'c0', referral_code: 'PARRAIN1' })
    h.abonnementsDuClient = [{ id: 'sub_ancien', status: 'canceled' }]
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

  it('abonnements en cours illisibles : 503, pas de page Stripe', async () => {
    // « Déjà abonné ? » répond, la liste des abonnements vivants non : une
    // panne ne vaut pas « aucun abonnement en cours ».
    h.stripe.subscriptions.list = vi.fn()
      .mockResolvedValueOnce({ data: [], has_more: false })
      .mockRejectedValueOnce(new Error('panne'))
    const res = makeRes()
    await handler(post(), res)
    expect(h.stripe.subscriptions.list).toHaveBeenCalledTimes(2)
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

  it('déjà sur ce plan : 409 explicite', async () => {
    h.clientRow.plan = 'pro'
    const res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('deja_sur_ce_plan')
  })
})

describe('POST /api/billing/upgrade — jamais deux abonnements', () => {
  it('abonnement en retard de paiement : 409 paiement_en_attente, pas de page Stripe', async () => {
    for (const status of ['past_due', 'unpaid']) {
      h.stripe = baseStripe()
      abonneStarterMensuel({ status })
      const res = makeRes()
      await handler(post({ target_plan: 'pro' }), res)
      expect(res.statusCode, status).toBe(409)
      expect(res.body.error, status).toBe('paiement_en_attente')
      expect(res.body.message).toBe('Un paiement est en attente sur votre abonnement actuel : mettez à jour votre carte depuis « Gérer mon abonnement », puis réessayez.')
      expect(h.stripe.checkout.sessions.create, status).not.toHaveBeenCalled()
      expect(h.stripe.subscriptions.update, status).not.toHaveBeenCalled()
    }
  })

  it('l’essai sans carte est ignoré, mais un autre abonnement vivant bloque : 409 abonnement_en_cours', async () => {
    abonneStarterMensuel({ status: 'trialing', default_payment_method: null })
    h.abonnementsDuClient = [h.existingSub, { id: 'sub_2', status: 'active' }]
    const res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('abonnement_en_cours')
    expect(res.body.message).toBe('Un abonnement est déjà en cours sur ce compte. Écrivez-nous à support@actero.fr : on s’en occupe.')
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('seul l’ESSAI sans carte est ignoré : un abonnement actif sans carte bloque', async () => {
    abonneStarterMensuel({ status: 'active', default_payment_method: null })
    const res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('abonnement_en_cours')
    expect(h.stripe.subscriptions.update).not.toHaveBeenCalled()
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('un nouveau clic avant le webhook : l’abonnement que Checkout vient de créer bloque', async () => {
    // Le webhook n'a encore rien écrit : ni plan, ni stripe_subscription_id.
    h.abonnementsDuClient = [{ id: 'sub_2', status: 'active' }]
    const res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('abonnement_en_cours')
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('abonnement enregistré chez un autre client Stripe, en retard : il bloque aussi', async () => {
    // La liste du client Stripe de la session ne le voit pas.
    abonneStarterMensuel({ status: 'past_due', customer: 'cus_ancien' })
    h.abonnementsDuClient = []
    const res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('paiement_en_attente')
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('abonnement d’essai sans carte : nouvelle page Stripe, aucun échange de prix', async () => {
    abonneStarterMensuel({ status: 'trialing', default_payment_method: null })
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'monthly' }), res)
    expect(h.stripe.subscriptions.update).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
    expect(res.body.checkout_url).toBeTruthy()
  })

  it('les pages Stripe d’abonnement encore ouvertes sont expirées avant la création', async () => {
    h.sessionsOuvertes = [
      { id: 'cs_ancienne', mode: 'subscription' },
      // Un achat de crédits en cours dans un autre onglet : pas un abonnement.
      { id: 'cs_credits', mode: 'payment' },
    ]
    const res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(200)
    const { list, expire, create } = h.stripe.checkout.sessions
    expect(list).toHaveBeenCalledWith({ customer: 'cus_1', status: 'open', limit: 10 })
    expect(expire).toHaveBeenCalledWith('cs_ancienne')
    expect(expire).not.toHaveBeenCalledWith('cs_credits')
    expect(expire.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0])
  })

  it('ne pas pouvoir fermer les anciennes pages n’empêche pas de payer', async () => {
    h.sessionsOuvertes = [{ id: 'cs_ancienne', mode: 'subscription' }]
    h.stripe.checkout.sessions.expire = vi.fn(async () => { throw new Error('panne') })
    let res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.checkout_url).toBeTruthy()

    h.stripe = baseStripe()
    h.stripe.checkout.sessions.list = vi.fn(async () => { throw new Error('panne') })
    res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.checkout_url).toBeTruthy()
  })
})

describe('POST /api/billing/upgrade — abonné existant', () => {
  it('changement immédiat : la carte d’abord, puis le prix facturé tout de suite — SANS écrire le plan', async () => {
    abonneStarterMensuel()
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'monthly' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.instant).toBe(true)
    expect(res.body.plan_attendu).toBe('pro')
    expect(res.body.message).toContain('prélevée')

    expect(h.stripe.subscriptions.update).toHaveBeenCalledTimes(2)
    const [[idCarte, carte], [idPrix, prix]] = h.stripe.subscriptions.update.mock.calls
    // 1. Rien que la carte et les métadonnées : `pending_if_incomplete` n'accepte
    //    pas `default_payment_method`.
    expect(idCarte).toBe('sub_1')
    expect(Object.keys(carte).sort()).toEqual(['default_payment_method', 'metadata'])
    expect(carte.default_payment_method).toBe('pm_1')
    expect(carte.metadata.client_id).toBe('c1')
    // 2. Le prix, la différence facturée et payée avant d'être appliquée.
    expect(idPrix).toBe('sub_1')
    expect(Object.keys(prix).sort()).toEqual(['expand', 'items', 'payment_behavior', 'proration_behavior'])
    expect(prix.items).toEqual([{ id: 'si_1', price: 'price_actero_pro_mensuel' }])
    expect(prix.proration_behavior).toBe('always_invoice')
    expect(prix.payment_behavior).toBe('pending_if_incomplete')
    // API 2026-02-25.clover : la facture ne porte plus `payment_intent`.
    expect(prix.expand).toEqual(['latest_invoice.payments'])

    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
    // Le webhook accorde le plan une fois Stripe à jour — pas la route.
    expect(h.ecrituresClients.filter((v) => 'plan' in v)).toEqual([])
  })

  it('paiement de la différence à authentifier : la page Stripe de la facture', async () => {
    abonneStarterMensuel()
    changementEnAttente({ status: 'requires_action', last_payment_error: null })
    const res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.facture_url).toBe('https://invoice.stripe.com/i/in_2')
    expect(res.body.instant).toBeUndefined()
    expect(res.body.success).toBeUndefined()
    expect(h.stripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_2')
    expect(h.ecrituresClients.filter((v) => 'plan' in v)).toEqual([])
  })

  it('paiement de la différence refusé : 402', async () => {
    abonneStarterMensuel()
    changementEnAttente({ status: 'requires_payment_method', last_payment_error: { code: 'card_declined' } })
    const res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(402)
    expect(res.body.error).toBe('paiement_refuse')
    expect(res.body.message).toBe('Le paiement de la différence a été refusé : mettez à jour votre carte depuis « Gérer mon abonnement ».')
    expect(res.body.facture_url).toBeUndefined()
    expect(res.body.instant).toBeUndefined()
  })

  it('changement en attente mais paiement illisible : jamais annoncé comme payé', async () => {
    // PaymentIntent illisible, facture ouverte : le client va sur la page de la
    // facture, qui dit ce qui manque.
    abonneStarterMensuel()
    changementEnAttente({ status: 'requires_action' })
    h.stripe.paymentIntents.retrieve = vi.fn(async () => { throw new Error('panne') })
    let res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.facture_url).toBe('https://invoice.stripe.com/i/in_2')
    expect(res.body.instant).toBeUndefined()

    // Rien de lisible du tout : refus plutôt qu'un succès.
    h.stripe = baseStripe()
    h.changement = { id: 'sub_1', status: 'active', pending_update: { expires_at: 1_900_000_000 }, latest_invoice: 'in_3' }
    res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(402)
    expect(res.body.error).toBe('paiement_refuse')
  })

  it('abonné avec une autre période : 409, rien ne change chez Stripe', async () => {
    abonneStarterMensuel()
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'annual' }), res)
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('changement_de_formule')
    expect(h.stripe.subscriptions.update).not.toHaveBeenCalled()
  })

  it('ancien prix sans lookup_key, à une autre périodicité : 409 changement_de_formule', async () => {
    // formuleDuPrix ne rattache ces prix à aucune formule : c'est la périodicité
    // réelle qui doit trancher, sinon un annuel bascule en mensuel.
    const anciensPrix = [
      { id: 'price_ancien_annuel', lookup_key: null, recurring: { interval: 'year', interval_count: 1 } },
      { id: 'price_ancien_trimestriel', recurring: { interval: 'month', interval_count: 3 } },
    ]
    for (const price of anciensPrix) {
      h.stripe = baseStripe()
      abonneStarterMensuel({ items: { data: [{ id: 'si_1', price }] } })
      const res = makeRes()
      await handler(post({ target_plan: 'pro', billing_period: 'monthly' }), res)
      expect(res.statusCode, price.id).toBe(409)
      expect(res.body.error, price.id).toBe('changement_de_formule')
      expect(h.stripe.subscriptions.update, price.id).not.toHaveBeenCalled()
      expect(h.stripe.checkout.sessions.create, price.id).not.toHaveBeenCalled()
    }
  })

  it('subscriptions.retrieve en erreur 500 : ni échange ni nouvelle page Stripe', async () => {
    h.clientRow.plan = 'starter'
    h.clientRow.stripe_subscription_id = 'sub_1'
    h.stripe.subscriptions.retrieve = vi.fn(async () => {
      throw Object.assign(new Error('Stripe indisponible'), { type: 'StripeAPIError', statusCode: 500 })
    })
    const res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(500)
    expect(h.stripe.subscriptions.update).not.toHaveBeenCalled()
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('carte d’un abonné illisible (panne Stripe) : 503, ni échange ni nouvelle page Stripe', async () => {
    // Une panne ne vaut pas « pas de carte » : repasser par Checkout créerait un
    // second abonnement pendant que le premier continue de facturer.
    abonneStarterMensuel({ default_payment_method: null })
    h.stripe.paymentMethods.list = vi.fn(async () => { throw new Error('panne') })
    const res = makeRes()
    await handler(post({ target_plan: 'pro', billing_period: 'monthly' }), res)
    expect(res.statusCode).toBe(503)
    expect(h.stripe.subscriptions.update).not.toHaveBeenCalled()
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('la carte se cherche chez le client Stripe qui porte l’abonnement', async () => {
    // stripe_customer_id désigne un autre client Stripe que celui de l'abonnement.
    abonneStarterMensuel({ customer: 'cus_abo', default_payment_method: null })
    h.customerCards = [{ id: 'pm_abo' }]
    const res = makeRes()
    await handler(post({ target_plan: 'pro' }), res)
    expect(res.statusCode).toBe(200)
    const clientsInterroges = h.stripe.paymentMethods.list.mock.calls.map(([p]) => p.customer)
    expect(clientsInterroges).toEqual(['cus_abo'])
    expect(h.stripe.subscriptions.update.mock.calls[0][1].default_payment_method).toBe('pm_abo')
  })
})

describe('POST /api/billing/upgrade — code promo', () => {
  it('code promo résolu : la session porte le code, et metadata.promo_code est posé', async () => {
    h.codesPromo = { BIENVENUE: 'promo_1' }
    const res = makeRes()
    await handler(post({ target_plan: 'pro', promo_code: 'BIENVENUE' }), res)
    expect(res.statusCode).toBe(200)
    expect(h.stripe.promotionCodes.list).toHaveBeenCalledWith({ code: 'BIENVENUE', active: true, limit: 1 })
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(params.discounts).toEqual([{ promotion_code: 'promo_1' }])
    expect(params.metadata.promo_code).toBe('BIENVENUE')
  })

  it('un code promo qui n’est pas une chaîne de 64 caractères au plus est ignoré', async () => {
    for (const promo_code of ['X'.repeat(65), 42, { code: 'BIENVENUE' }]) {
      h.stripe = baseStripe()
      const res = makeRes()
      await handler(post({ target_plan: 'pro', promo_code }), res)
      expect(res.statusCode).toBe(200)
      expect(h.stripe.promotionCodes.list).not.toHaveBeenCalled()
      const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
      expect(params.metadata.promo_code).toBeUndefined()
      expect(params.allow_promotion_codes).toBe(true)
    }
    // 64 caractères : encore un code.
    h.stripe = baseStripe()
    await handler(post({ target_plan: 'pro', promo_code: 'X'.repeat(64) }), makeRes())
    expect(h.stripe.promotionCodes.list).toHaveBeenCalledTimes(1)
  })

  it('Stripe refuse la session à cause du code promo : 400 code_promo_refuse, pas 500', async () => {
    h.codesPromo = { BIENVENUE: 'promo_1' }
    const refus = () => Object.assign(new Error('This promotion code cannot be redeemed'), { type: 'StripeInvalidRequestError', statusCode: 400 })
    h.stripe.checkout.sessions.create = vi.fn(async () => { throw refus() })
    let res = makeRes()
    await handler(post({ target_plan: 'pro', promo_code: 'BIENVENUE' }), res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('code_promo_refuse')
    expect(res.body.message).toBe('Ce code promo ne peut pas être appliqué à cet abonnement.')

    // Une panne de Stripe n'est pas un refus du code : le marchand ne doit pas
    // l'abandonner à tort.
    h.stripe = baseStripe()
    h.stripe.checkout.sessions.create = vi.fn(async () => {
      throw Object.assign(new Error('Stripe indisponible'), { type: 'StripeAPIError', statusCode: 500 })
    })
    res = makeRes()
    await handler(post({ target_plan: 'pro', promo_code: 'BIENVENUE' }), res)
    expect(res.statusCode).toBe(500)
  })
})
