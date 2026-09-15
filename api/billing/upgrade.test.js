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
 *
 * Le faux Stripe est INDEXÉ, pour la même raison : `subscriptions.list` et
 * `checkout.sessions.list` ne rendent que les objets du `customer` demandé,
 * et `subscriptions.retrieve` l'abonnement de cet identifiant — ou lève comme
 * Stripe. L'ancien rendait la même liste pour n'importe quel client : lire
 * l'historique du mauvais client Stripe restait vert.
 */

const h = vi.hoisted(() => ({
  user: { id: 'u1', email: 'u@ex.com' },
  admin: false,
  refusShopify: false,
  // Les lignes de la base, par table, et les tables dont la lecture échoue.
  base: {},
  erreursBase: {},
  clientRow: null,
  // Chez Stripe : TOUS les abonnements, chacun rattaché à son `customer`.
  abonnements: [],
  customerCards: [],
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
    // `h.erreursBase[table]` : une erreur pour toute lecture de la table, ou une
    // fonction des filtres, pour ne faire échouer qu'une lecture précise.
    const erreurLue = () => {
      const erreur = h.erreursBase[table]
      return typeof erreur === 'function' ? erreur(filtres) : erreur
    }
    const b = {
      select: (c) => { colonnes = c; if (table === 'clients') h.selectsClients.push(c); return b },
      eq: (colonne, valeur) => { filtres.push({ colonne, op: 'eq', valeur }); return b },
      // Seul usage de la route : .not(colonne, 'is', null).
      not: (colonne, _op, valeur) => { filtres.push({ colonne, op: 'not_is', valeur }); return b },
      limit: () => b,
      update: (valeur) => { if (table === 'clients') h.ecrituresClients.push(valeur); return b },
      // Supabase ne lève pas : une lecture en échec rend `{ data: null, error }`.
      maybeSingle: async () => (erreurLue()
        ? { data: null, error: erreurLue() }
        : { data: projeter(lignes()[0], colonnes), error: null }),
      single: async () => {
        if (erreurLue()) return { data: null, error: erreurLue() }
        const [ligne] = lignes()
        return ligne ? { data: projeter(ligne, colonnes), error: null } : { data: null, error: { message: 'aucune ligne' } }
      },
    }
    return b
  }

  return {
    createClient: () => ({
      auth: { getUser: async () => ({ data: { user: h.user }, error: h.user ? null : { message: 'jeton invalide' } }) },
      from: (t) => builder(t),
    }),
  }
})

vi.mock('stripe', () => ({ default: function Stripe() { return h.stripe } }))

import handler from './upgrade.js'
import { FORMULES } from '../lib/formules.js'
import { OPTIONS_REQUETE_COURTE } from '../lib/stripe-customer.js'

function makeRes() {
  return {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this },
    json(b) { this.body = b; return this },
  }
}

async function envoyer(requete) {
  const res = makeRes()
  await handler(requete, res)
  return res
}

/** L'erreur que Stripe lève pour un identifiant qu'il ne connaît pas. */
function introuvable(id) {
  return Object.assign(new Error(`No such subscription: '${id}'`), { code: 'resource_missing', statusCode: 404, type: 'StripeInvalidRequestError' })
}

function abonnementIndexe(id) {
  const abonnement = h.abonnements.find((s) => s.id === id)
  if (!abonnement) throw introuvable(id)
  return abonnement
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
      retrieve: vi.fn(async (id) => abonnementIndexe(id)),
      // Un changement immédiat fait jusqu'à trois appels : la carte, le prix,
      // puis la formule. Seul le prix porte `payment_behavior`, et reçoit la
      // réponse de Stripe au paiement de la différence. Une neutralisation,
      // elle, reste sur l'abonnement : le clic suivant la relit.
      update: vi.fn(async (id, params) => {
        const abonnement = abonnementIndexe(id)
        if (params.payment_behavior) return h.changement
        if ('cancel_at_period_end' in params) abonnement.cancel_at_period_end = params.cancel_at_period_end
        return { ...abonnement, ...params }
      }),
      list: vi.fn(async ({ customer }) => ({ data: h.abonnements.filter((s) => s.customer === customer), has_more: false })),
    },
    paymentIntents: { retrieve: vi.fn(async (id) => h.intentions[id]) },
    promotionCodes: {
      list: vi.fn(async ({ code }) => ({ data: h.codesPromo[code] ? [{ id: h.codesPromo[code], code }] : [] })),
    },
    paymentMethods: { list: vi.fn(async () => ({ data: h.customerCards })) },
    checkout: {
      sessions: {
        list: vi.fn(async ({ customer }) => ({ data: h.sessionsOuvertes.filter((s) => s.customer === customer), has_more: false })),
        expire: vi.fn(async (id) => ({ id, status: 'expired' })),
        create: vi.fn(async () => ({ id: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' })),
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

/** Les clients Stripe dont la route a lu l'historique, triés. */
const clientsLus = () => h.stripe.subscriptions.list.mock.calls.map(([p]) => p.customer).sort()

const PRIX_STARTER_MENSUEL = { id: 'price_actero_starter_mensuel', lookup_key: 'actero_starter_mensuel', recurring: { interval: 'month', interval_count: 1 } }

const PRIX_PRO_MENSUEL = { id: 'price_actero_pro_mensuel', lookup_key: 'actero_pro_mensuel', recurring: { interval: 'month', interval_count: 1 } }

/**
 * Un abonné Starter mensuel, carte posée sur l'abonnement, chez le client Stripe du compte.
 * `latest_invoice` : la facture du dernier renouvellement, telle que `retrieve`
 * la rend (un identifiant) — le changement de prix en crée une autre (`in_1`).
 */
function abonneStarterMensuel(surcharge = {}) {
  h.clientRow.plan = 'starter'
  h.clientRow.stripe_subscription_id = 'sub_1'
  const abonnement = {
    id: 'sub_1', status: 'active', customer: 'cus_1', default_payment_method: 'pm_1',
    cancel_at_period_end: false, cancel_at: null, latest_invoice: 'in_0',
    items: { data: [{ id: 'si_1', price: PRIX_STARTER_MENSUEL }] },
    ...surcharge,
  }
  h.abonnements.push(abonnement)
  return abonnement
}

/** Le changement de prix n'est pas passé : une facture de la différence reste ouverte. */
function changementEnAttente(intention, facture = {}) {
  h.changement = {
    id: 'sub_1', status: 'active',
    pending_update: { expires_at: 1_900_000_000, subscription_items: [] },
    latest_invoice: {
      id: 'in_2', status: 'open', amount_paid: 0, hosted_invoice_url: 'https://invoice.stripe.com/i/in_2',
      payments: { data: [{ is_default: true, payment: { type: 'payment_intent', payment_intent: 'pi_2' } }] },
      ...facture,
    },
  }
  h.intentions = { pi_2: { id: 'pi_2', last_payment_error: null, ...intention } }
}

function reinitialiser() {
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
  h.erreursBase = {}
  h.abonnements = []
  h.customerCards = []
  h.sessionsOuvertes = []
  h.codesPromo = {}
  h.changement = {
    id: 'sub_1', status: 'active', pending_update: null,
    latest_invoice: { id: 'in_1', status: 'paid', amount_paid: 30000, hosted_invoice_url: 'https://invoice.stripe.com/i/in_1', payments: { data: [] } },
  }
  h.intentions = {}
  h.ecrituresClients = []
  h.selectsClients = []
  h.stripe = baseStripe()
}

beforeEach(reinitialiser)

const post = (b) => ({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { client_id: 'c1', target_plan: 'starter', billing_period: 'monthly', ...b } })

const INDISPONIBLE = 'Paiement indisponible pour le moment, réessayez dans un instant.'
const PAS_ENCORE_DISPONIBLE = 'Le paiement n’est pas encore disponible. Écrivez-nous à support@actero.fr.'

describe('POST /api/billing/upgrade — qui peut payer', () => {
  it('405 pour une autre méthode que POST', async () => {
    const res = await envoyer({ method: 'GET', headers: { authorization: 'Bearer t' }, body: {} })
    expect(res.statusCode).toBe(405)
    expect(res.body.error).toBe('methode_non_autorisee')
    expect(appelsStripe()).toBe(0)
  })

  it('401 sans jeton, ou jeton refusé', async () => {
    let res = await envoyer({ method: 'POST', headers: {}, body: { client_id: 'c1', target_plan: 'pro' } })
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toBe('non_authentifie')

    h.user = null
    res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toBe('non_authentifie')
    expect(appelsStripe()).toBe(0)
  })

  it('403 quand l’utilisateur n’est pas lié à CE client', async () => {
    // Lié à un autre compte, et un autre utilisateur lié à celui-ci : le lien
    // doit correspondre aux deux filtres à la fois.
    h.base.client_users = [
      { user_id: 'u1', client_id: 'c2', role: 'owner' },
      { user_id: 'u2', client_id: 'c1', role: 'owner' },
    ]
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(403)
    expect(res.body.error).toBe('acces_refuse')
    expect(appelsStripe()).toBe(0)
  })

  it('403 pour le rôle support : la carte de l’entreprise n’est pas la sienne', async () => {
    h.base.client_users = [{ user_id: 'u1', client_id: 'c1', role: 'support' }]
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({
      error: 'role_non_autorise',
      message: 'Seuls le propriétaire du compte ou un manager peuvent modifier l’abonnement.',
    })
    expect(appelsStripe()).toBe(0)
  })

  it('un manager peut payer', async () => {
    h.base.client_users = [{ user_id: 'u1', client_id: 'c1', role: 'manager' }]
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    expect(res.body.statut).toBe('checkout')
    expect(res.body.checkout_url).toContain('checkout.stripe.com')
  })

  it('un admin Actero paie pour un compte auquel il n’est pas rattaché', async () => {
    h.admin = true
    h.base.client_users = []
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    expect(res.body.statut).toBe('checkout')
  })

  it('client_users illisible : 503 indisponible, pas 403', async () => {
    // Une panne de la base ne dit pas que l'utilisateur n'a pas accès.
    h.erreursBase.client_users = { message: 'connexion perdue' }
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ error: 'indisponible', message: INDISPONIBLE })
    expect(appelsStripe()).toBe(0)
  })

  it('fiche client illisible : 503 ; fiche absente : 404', async () => {
    h.erreursBase.clients = { message: 'connexion perdue' }
    let res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(503)
    expect(res.body.error).toBe('indisponible')

    reinitialiser()
    h.base.clients = []
    res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(404)
    expect(res.body.error).toBe('client_introuvable')
    expect(appelsStripe()).toBe(0)
  })

  it('refus Shopify : la garde répond elle-même, aucun appel Stripe', async () => {
    h.refusShopify = true
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('shopify_billing_required')
    expect(appelsStripe()).toBe(0)
  })
})

describe('POST /api/billing/upgrade — requête et catalogue', () => {
  it('refuse une période inconnue, clés héritées comprises', async () => {
    for (const billing_period of ['weekly', 'toString']) {
      const res = await envoyer(post({ billing_period }))
      expect(res.statusCode, billing_period).toBe(400)
      expect(res.body.error, billing_period).toBe('requete_invalide')
    }
  })

  it('champs manquants ou plan inconnu : 400 requete_invalide, un message précis pour chaque cas', async () => {
    const manquant = await envoyer(post({ target_plan: undefined }))
    const inconnu = await envoyer(post({ target_plan: 'gold' }))
    const periode = await envoyer(post({ billing_period: 'weekly' }))
    for (const res of [manquant, inconnu, periode]) {
      expect(res.statusCode).toBe(400)
      expect(res.body.error).toBe('requete_invalide')
    }
    expect(new Set([manquant.body.message, inconnu.body.message, periode.body.message]).size).toBe(3)
    expect(appelsStripe()).toBe(0)
  })

  it('plan inférieur au plan actuel : 400 downgrade_non_self_serve', async () => {
    h.clientRow.plan = 'pro'
    const res = await envoyer(post({ target_plan: 'starter' }))
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('downgrade_non_self_serve')
    expect(appelsStripe()).toBe(0)
  })

  it('Enterprise : 400 enterprise_contact, avec le lien Calendly', async () => {
    const res = await envoyer(post({ target_plan: 'enterprise' }))
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('enterprise_contact')
    expect(res.body.calendly_url).toBe('https://calendly.com/actero-fr/30min')
    expect(typeof res.body.message).toBe('string')
  })

  it('déjà sur ce plan : 409 explicite', async () => {
    h.clientRow.plan = 'pro'
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('deja_sur_ce_plan')
  })

  it('prix absent de Stripe : « Stripe not configured », message neutre, la consigne d’admin dans les journaux', async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      h.stripe.prices.list = vi.fn(async () => ({ data: [] }))
      const res = await envoyer(post({ billing_period: 'annual' }))
      expect(res.statusCode).toBe(503)
      // La chaîne exacte : le front la compare.
      expect(res.body).toEqual({ error: 'Stripe not configured', message: PAS_ENCORE_DISPONIBLE })
      expect(journal.mock.calls.flat().join(' ')).toMatch(/Configurer Stripe/)
    } finally {
      journal.mockRestore()
    }
  })

  it('clé Stripe absente : « Stripe not configured », sans appel Stripe', async () => {
    delete process.env.STRIPE_SECRET_KEY
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ error: 'Stripe not configured', message: PAS_ENCORE_DISPONIBLE })
    expect(appelsStripe()).toBe(0)
  })
})

describe('POST /api/billing/upgrade — nouvelle page Stripe', () => {
  it('mensuel pour un nouveau client : page Stripe, sans essai', async () => {
    const res = await envoyer(post())
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ statut: 'checkout', checkout_url: 'https://checkout.stripe.com/c/pay/cs_1' })
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(params.customer).toBe('cus_1')
    expect(params.line_items[0].price).toBe('price_actero_starter_mensuel')
    expect(params.subscription_data.trial_period_days).toBeUndefined()
  })

  it('la route lit tout ce que l’avantage de bienvenue exige', async () => {
    // offreDeBienvenue lève si une colonne manque : sans ce test, un .select()
    // incomplet ferait échouer chaque paiement en production. Le mock ne rend
    // que les colonnes lues, donc un oubli ferait aussi échouer la réponse.
    const res = await envoyer(post())
    expect(res.statusCode).toBe(200)
    const colonnes = h.selectsClients.join(',')
    for (const c of ['trial_ends_at', 'billing_provider', 'stripe_subscription_id', 'referral_first_month_free', 'campaign_first_month_free']) {
      expect(colonnes, c).toContain(c)
    }
  })

  it('trimestriel pour un nouveau client : page Stripe avec le coupon du plan', async () => {
    const res = await envoyer(post({ target_plan: 'pro', billing_period: 'quarterly' }))
    expect(res.statusCode).toBe(200)
    expect(res.body.checkout_url).toContain('checkout.stripe.com')
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(params.line_items[0].price).toBe('price_actero_pro_trimestriel')
    expect(params.discounts).toEqual([{ coupon: 'actero-trimestriel-pro-19950' }])
    expect(params.subscription_data.metadata.client_id).toBe('c1')
    expect(params.subscription_data.trial_period_days).toBeUndefined()
  })

  it('un client déjà abonné par le passé n’a plus de coupon', async () => {
    h.abonnements = [{ id: 'sub_ancien', status: 'canceled', customer: 'cus_1' }]
    await envoyer(post({ target_plan: 'pro', billing_period: 'quarterly' }))
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
    const res = await envoyer(post())
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
    h.abonnements = [{ id: 'sub_ancien', status: 'canceled', customer: 'cus_1' }]
    await envoyer(post())
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(params.metadata.referral_code).toBeUndefined()
    expect(params.subscription_data.metadata.referred_by_client_id).toBeUndefined()
  })

  it('fiche du parrain illisible : 503, la session ne part pas sans le code du parrain', async () => {
    // Une panne ne vaut pas « parrain sans code » : le parrain ne serait
    // jamais récompensé, et rien ne le signalerait.
    h.clientRow.referral_first_month_free = true
    h.clientRow.referred_by_client_id = 'c0'
    h.base.clients.push({ id: 'c0', referral_code: 'PARRAIN1' })
    h.erreursBase.clients = (filtres) => (filtres.some((f) => f.valeur === 'c0') ? { message: 'connexion perdue' } : null)
    const res = await envoyer(post())
    expect(res.statusCode).toBe(503)
    expect(res.body.error).toBe('indisponible')
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('historique Stripe illisible : 503, rien d’accordé, pas de page Stripe', async () => {
    h.stripe.subscriptions.list = vi.fn(async () => { throw new Error('panne') })
    const res = await envoyer(post())
    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ error: 'indisponible', message: INDISPONIBLE })
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('un seul relevé Stripe : une lecture par client, pas deux', async () => {
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    expect(h.stripe.subscriptions.list).toHaveBeenCalledTimes(1)
    expect(h.stripe.subscriptions.list).toHaveBeenCalledWith({ customer: 'cus_1', status: 'all', limit: 100 })
  })

  it('client Stripe retrouvé par le tunnel : c’est son historique qui compte', async () => {
    h.clientRow.stripe_customer_id = null
    h.base.funnel_clients = [{ onboarded_client_id: 'c1', stripe_customer_id: 'cus_tunnel' }]
    h.abonnements = [{ id: 'sub_ancien', status: 'canceled', customer: 'cus_tunnel' }]
    const res = await envoyer(post({ target_plan: 'pro', billing_period: 'quarterly' }))
    expect(res.statusCode).toBe(200)
    expect(clientsLus()).toEqual(['cus_tunnel'])
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(params.customer).toBe('cus_tunnel')
    expect(params.discounts).toBeUndefined()
  })

  it('tunnel illisible : 503, et aucun client Stripe créé en double', async () => {
    // Une panne ne vaut pas « aucun client Stripe connu » : on en créerait un
    // second pour le même compte (ACT-39).
    h.clientRow.stripe_customer_id = null
    h.erreursBase.funnel_clients = { message: 'connexion perdue' }
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(503)
    expect(res.body.error).toBe('indisponible')
    expect(h.stripe.customers.create).not.toHaveBeenCalled()
  })
})

describe('POST /api/billing/upgrade — jamais deux abonnements', () => {
  it('abonnement en retard de paiement : 409 paiement_en_attente, pas de page Stripe', async () => {
    abonneStarterMensuel({ status: 'past_due' })
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({
      error: 'paiement_en_attente',
      message: 'Un paiement est en attente sur votre abonnement actuel : mettez à jour votre carte depuis « Gérer mon abonnement », puis réessayez.',
    })
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
    expect(h.stripe.subscriptions.update).not.toHaveBeenCalled()
  })

  it('abonnement suspendu (unpaid, paused) : 409 abonnement_en_cours — changer de carte ne le débloque pas', async () => {
    for (const status of ['unpaid', 'paused']) {
      reinitialiser()
      abonneStarterMensuel({ status })
      const res = await envoyer(post({ target_plan: 'pro' }))
      expect(res.statusCode, status).toBe(409)
      expect(res.body, status).toEqual({
        error: 'abonnement_en_cours',
        message: 'Votre abonnement actuel est suspendu faute de paiement : écrivez-nous à support@actero.fr, on s’en occupe.',
      })
      expect(h.stripe.checkout.sessions.create, status).not.toHaveBeenCalled()
      expect(h.stripe.subscriptions.update, status).not.toHaveBeenCalled()
    }
  })

  it('l’essai sans carte est ignoré, mais un autre abonnement vivant bloque — un second essai compris : 409 abonnement_en_cours', async () => {
    // Seul l'essai ENREGISTRÉ est remplacé. Un second essai vivant chez le même
    // client continuerait à côté du nouvel abonnement.
    for (const status of ['active', 'trialing']) {
      reinitialiser()
      abonneStarterMensuel({ status: 'trialing', default_payment_method: null })
      h.abonnements.push({ id: 'sub_2', status, customer: 'cus_1' })
      const res = await envoyer(post({ target_plan: 'pro' }))
      expect(res.statusCode, status).toBe(409)
      expect(res.body, status).toEqual({
        error: 'abonnement_en_cours',
        message: 'Un abonnement est déjà en cours sur ce compte. Écrivez-nous à support@actero.fr : on s’en occupe.',
      })
      expect(h.stripe.checkout.sessions.create, status).not.toHaveBeenCalled()
      // Refusé avant d'y toucher : l'essai n'est pas neutralisé pour rien.
      expect(h.stripe.subscriptions.update, status).not.toHaveBeenCalled()
    }
  })

  it('seul l’ESSAI sans carte est ignoré : un abonnement actif sans carte bloque, même déjà sur le prix demandé', async () => {
    // Sans carte, « déjà sur ce plan » ne vaut rien : aucun plan n'a été accordé.
    for (const price of [PRIX_STARTER_MENSUEL, PRIX_PRO_MENSUEL]) {
      reinitialiser()
      abonneStarterMensuel({ status: 'active', default_payment_method: null, items: { data: [{ id: 'si_1', price }] } })
      const res = await envoyer(post({ target_plan: 'pro' }))
      expect(res.statusCode, price.id).toBe(409)
      expect(res.body.error, price.id).toBe('abonnement_en_cours')
      expect(h.stripe.subscriptions.update, price.id).not.toHaveBeenCalled()
      expect(h.stripe.checkout.sessions.create, price.id).not.toHaveBeenCalled()
    }
  })

  it('un nouveau clic avant le webhook : l’abonnement que Checkout vient de créer bloque', async () => {
    // Le webhook n'a encore rien écrit : ni plan, ni stripe_subscription_id.
    h.abonnements = [{ id: 'sub_2', status: 'active', customer: 'cus_1' }]
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('abonnement_en_cours')
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('abonnement enregistré chez un autre client Stripe, en retard : il bloque aussi', async () => {
    abonneStarterMensuel({ status: 'past_due', customer: 'cus_ancien' })
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('paiement_en_attente')
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('abonnement enregistré résilié chez l’ancien client Stripe, un autre actif chez lui : 409 abonnement_en_cours', async () => {
    // L'abonnement enregistré ne vit plus, mais son client Stripe en porte un
    // autre qui facture : la liste du client de la session ne le voit pas.
    abonneStarterMensuel({ status: 'canceled', customer: 'cus_ancien' })
    h.abonnements.push({ id: 'sub_autre', status: 'active', customer: 'cus_ancien' })
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('abonnement_en_cours')
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('l’historique se lit chez le client Stripe de la session et chez celui de l’abonnement enregistré — nulle part ailleurs', async () => {
    // L'identifiant en base désigne un client Stripe supprimé : la session
    // part avec celui qui le remplace, et c'est lui qu'on lit, pas l'ancien.
    h.clientRow.stripe_customer_id = 'cus_efface'
    h.stripe.customers.retrieve = vi.fn(async (id) => ({ id, deleted: true }))
    abonneStarterMensuel({ status: 'canceled', customer: 'cus_ancien' })
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    expect(clientsLus()).toEqual(['cus_1', 'cus_ancien'])
  })

  it('abonnement d’essai sans carte : nouvelle page Stripe, aucun échange de prix, essai neutralisé', async () => {
    abonneStarterMensuel({ status: 'trialing', default_payment_method: null })
    const res = await envoyer(post({ target_plan: 'pro', billing_period: 'monthly' }))
    expect(res.statusCode).toBe(200)
    expect(res.body.statut).toBe('checkout')
    expect(h.stripe.subscriptions.update.mock.calls).toEqual([
      ['sub_1', { cancel_at_period_end: true }, OPTIONS_REQUETE_COURTE],
    ])
  })

  it('essai sans carte déjà sur le prix demandé : page Stripe et essai neutralisé, pas deja_sur_ce_plan', async () => {
    // Sans carte, l'essai n'a accordé aucun plan : le marchand est en free et
    // doit pouvoir payer ce prix-là. Lui répondre « déjà sur ce plan » le
    // laissait sans issue.
    abonneStarterMensuel({ status: 'trialing', default_payment_method: null, items: { data: [{ id: 'si_1', price: PRIX_PRO_MENSUEL }] } })
    h.clientRow.plan = 'free'
    const res = await envoyer(post({ target_plan: 'pro', billing_period: 'monthly' }))
    expect(res.statusCode).toBe(200)
    expect(res.body.statut).toBe('checkout')
    expect(h.stripe.subscriptions.update.mock.calls).toEqual([
      ['sub_1', { cancel_at_period_end: true }, OPTIONS_REQUETE_COURTE],
    ])
    expect(h.stripe.checkout.sessions.create.mock.calls[0][0].line_items[0].price).toBe('price_actero_pro_mensuel')
  })

  it('essai sans carte sur un ancien prix sans clé, vers Pro trimestriel : page Stripe, pas changement_de_formule', async () => {
    // La garde de périodicité ne vaut que pour un changement immédiat, qui
    // exige une carte. Sans carte, l'essai est remplacé par Checkout.
    abonneStarterMensuel({
      status: 'trialing', default_payment_method: null,
      items: { data: [{ id: 'si_1', price: { id: 'price_ancien_starter', lookup_key: null, recurring: { interval: 'month', interval_count: 1 } } }] },
    })
    const res = await envoyer(post({ target_plan: 'pro', billing_period: 'quarterly' }))
    expect(res.statusCode).toBe(200)
    expect(res.body.statut).toBe('checkout')
    expect(h.stripe.checkout.sessions.create.mock.calls[0][0].line_items[0].price).toBe('price_actero_pro_trimestriel')
  })

  it('l’essai remplacé est neutralisé AVANT la création de la session', async () => {
    abonneStarterMensuel({ status: 'trialing', default_payment_method: null })
    await envoyer(post({ target_plan: 'pro' }))
    const { update } = h.stripe.subscriptions
    const { create } = h.stripe.checkout.sessions
    expect(update).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(1)
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0])
  })

  it('essai déjà neutralisé : toujours reconnu, page Stripe, et la neutralisation est rejouée', async () => {
    // Sans ça, un marchand qui a refermé Checkout — ou dont la session a
    // échoué — reçoit 409 à chaque nouveau clic : il est coincé.
    abonneStarterMensuel({ status: 'trialing', default_payment_method: null, cancel_at_period_end: true })
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    expect(res.body.statut).toBe('checkout')
    expect(h.stripe.subscriptions.update.mock.calls).toEqual([
      ['sub_1', { cancel_at_period_end: true }, OPTIONS_REQUETE_COURTE],
    ])
  })

  it('session en échec après la neutralisation : le clic suivant rouvre Checkout, pas 409', async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      abonneStarterMensuel({ status: 'trialing', default_payment_method: null })
      h.stripe.checkout.sessions.create = vi.fn(async () => { throw new Error('panne') })
      let res = await envoyer(post({ target_plan: 'pro' }))
      expect(res.statusCode).toBe(500)
      // Stripe a gardé la neutralisation (le faux la retient sur l'abonnement).
      expect(h.abonnements[0].cancel_at_period_end).toBe(true)

      h.stripe.checkout.sessions.create = vi.fn(async () => ({ id: 'cs_2', url: 'https://checkout.stripe.com/c/pay/cs_2' }))
      res = await envoyer(post({ target_plan: 'pro' }))
      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({ statut: 'checkout', checkout_url: 'https://checkout.stripe.com/c/pay/cs_2' })
    } finally {
      journal.mockRestore()
    }
  })

  it('essai neutralisé qui a retrouvé une carte : page Stripe, sans chercher la carte ni changer le prix sur place', async () => {
    // Le marchand a refermé Checkout, puis ajouté une carte depuis le portail.
    // Changer le prix de cet essai lui annoncerait « le nouveau tarif
    // s'appliquera à sa fin » — alors qu'il s'éteint à sa fin, et le marchand
    // avec, repassé en free sans prévenir.
    abonneStarterMensuel({ status: 'trialing', default_payment_method: null, cancel_at_period_end: true })
    h.customerCards = [{ id: 'pm_portail' }]
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    expect(res.body.statut).toBe('checkout')
    expect(h.stripe.subscriptions.update.mock.calls.some(([, params]) => 'items' in params)).toBe(false)
    expect(h.stripe.subscriptions.update.mock.calls).toEqual([
      ['sub_1', { cancel_at_period_end: true }, OPTIONS_REQUETE_COURTE],
    ])
    expect(h.stripe.paymentMethods.list).not.toHaveBeenCalled()
  })

  it('essai neutralisé déjà sur le prix demandé, avec une carte : page Stripe, pas deja_sur_ce_plan', async () => {
    // Sinon chaque clic répondait « déjà sur ce plan » à un marchand en free.
    abonneStarterMensuel({ status: 'trialing', default_payment_method: null, cancel_at_period_end: true, items: { data: [{ id: 'si_1', price: PRIX_PRO_MENSUEL }] } })
    h.clientRow.plan = 'free'
    h.customerCards = [{ id: 'pm_portail' }]
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    expect(res.body.statut).toBe('checkout')
    expect(h.stripe.subscriptions.update.mock.calls.some(([, params]) => 'items' in params)).toBe(false)
  })

  it('paramètres Checkout qui lèvent : 500, et l’essai n’est pas neutralisé pour rien', async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      abonneStarterMensuel({ status: 'trialing', default_payment_method: null })
      // Un prix dont la lookup_key ne correspond plus à la formule :
      // parametresCheckout lève.
      h.stripe.prices.list = vi.fn(async ({ lookup_keys }) => {
        const f = FORMULES.find((x) => x.lookupKey === lookup_keys[0])
        return { data: [{ id: 'price_x', lookup_key: 'autre_cle', unit_amount: f.montantCentimes, currency: 'eur', recurring: f.recurring }] }
      })
      const res = await envoyer(post({ target_plan: 'pro' }))
      expect(res.statusCode).toBe(500)
      expect(res.body.error).toBe('erreur_interne')
      expect(h.stripe.subscriptions.update).not.toHaveBeenCalled()
      expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
    } finally {
      journal.mockRestore()
    }
  })

  it('essai impossible à neutraliser : 503, et aucune page Stripe', async () => {
    // Sans ça, une carte ajoutée plus tard ferait démarrer l'essai Starter en
    // plus du Pro payé par Checkout.
    abonneStarterMensuel({ status: 'trialing', default_payment_method: null })
    h.stripe.subscriptions.update = vi.fn(async () => { throw new Error('panne') })
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ error: 'indisponible', message: INDISPONIBLE })
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('les pages Stripe d’abonnement encore ouvertes sont expirées avant la création', async () => {
    h.sessionsOuvertes = [
      { id: 'cs_ancienne', mode: 'subscription', customer: 'cus_1' },
      // Un achat de crédits en cours dans un autre onglet : pas un abonnement.
      { id: 'cs_credits', mode: 'payment', customer: 'cus_1' },
    ]
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    const { list, expire, create } = h.stripe.checkout.sessions
    expect(list).toHaveBeenCalledWith({ customer: 'cus_1', status: 'open', limit: 10 })
    expect(expire).toHaveBeenCalledWith('cs_ancienne')
    expect(expire).not.toHaveBeenCalledWith('cs_credits')
    expect(expire.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0])
  })

  it('ne pas pouvoir fermer les anciennes pages n’empêche pas de payer', async () => {
    h.sessionsOuvertes = [{ id: 'cs_ancienne', mode: 'subscription', customer: 'cus_1' }]
    h.stripe.checkout.sessions.expire = vi.fn(async () => { throw new Error('panne') })
    let res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    expect(res.body.checkout_url).toBeTruthy()

    h.stripe = baseStripe()
    h.stripe.checkout.sessions.list = vi.fn(async () => { throw new Error('panne') })
    res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    expect(res.body.checkout_url).toBeTruthy()
  })
})

describe('POST /api/billing/upgrade — abonné existant', () => {
  it('changement immédiat : la carte, le prix facturé tout de suite, puis la formule — SANS écrire le plan', async () => {
    abonneStarterMensuel()
    const res = await envoyer(post({ target_plan: 'pro', billing_period: 'monthly' }))
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      statut: 'change_applique',
      success: true,
      instant: true,
      plan_attendu: 'pro',
      message: 'Passage au plan pro confirmé : la différence a été prélevée.',
    })

    const appels = h.stripe.subscriptions.update.mock.calls
    expect(appels).toHaveLength(3)
    // 1. La carte, et rien que l'identité du compte : Stripe refuse
    //    `default_payment_method` dans une mise à jour en attente.
    expect(appels[0]).toEqual(['sub_1', { default_payment_method: 'pm_1', metadata: { client_id: 'c1', actero_client_id: 'c1' } }])
    // 2. Le prix, la différence facturée et payée avant d'être appliquée.
    const [idPrix, prix] = appels[1]
    expect(idPrix).toBe('sub_1')
    expect(Object.keys(prix).sort()).toEqual(['expand', 'items', 'payment_behavior', 'proration_behavior'])
    expect(prix.items).toEqual([{ id: 'si_1', price: 'price_actero_pro_mensuel' }])
    expect(prix.proration_behavior).toBe('always_invoice')
    expect(prix.payment_behavior).toBe('pending_if_incomplete')
    // API 2026-02-25.clover : la facture ne porte plus `payment_intent`.
    expect(prix.expand).toEqual(['latest_invoice.payments'])
    // 3. La formule, une fois le changement appliqué.
    expect(appels[2]).toEqual(['sub_1', { metadata: { formule: 'pro_mensuel', upgrade_from: 'starter', upgrade_to: 'pro' } }, OPTIONS_REQUETE_COURTE])

    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
    // Le webhook accorde le plan une fois Stripe à jour — pas la route.
    expect(h.ecrituresClients.filter((v) => 'plan' in v)).toEqual([])
  })

  it('rien de prélevé : on ne dit pas « la différence a été prélevée »', async () => {
    abonneStarterMensuel()
    h.changement.latest_invoice.amount_paid = 0
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    expect(res.body.statut).toBe('change_applique')
    expect(res.body.message).toBe('Passage au plan pro confirmé : aucun montant à régler aujourd’hui.')
  })

  it('latest_invoice non étendue ou de forme inattendue : « aucun montant », jamais un 500 après un changement payé', async () => {
    // Le changement est déjà fait chez Stripe : une réponse 500 ferait croire
    // au marchand qu'il n'a rien payé, et il recommencerait.
    for (const latest_invoice of ['in_9', null, { amount_paid: 30000 }]) {
      reinitialiser()
      abonneStarterMensuel()
      h.changement.latest_invoice = latest_invoice
      const res = await envoyer(post({ target_plan: 'pro' }))
      expect(res.statusCode, JSON.stringify(latest_invoice)).toBe(200)
      expect(res.body.statut).toBe('change_applique')
      expect(res.body.message, JSON.stringify(latest_invoice)).toBe('Passage au plan pro confirmé : aucun montant à régler aujourd’hui.')
    }
  })

  it('latest_invoice inchangée, même payée : « aucun montant », pas « prélevée »', async () => {
    // Sans proration, Stripe ne crée aucune facture : `latest_invoice` reste
    // celle du dernier renouvellement, payée, et ne prouve rien du changement.
    // L'abonnement lu avant la porte en identifiant, ou en objet s'il est étendu.
    for (const latest_invoice of ['in_1', { id: 'in_1', object: 'invoice' }]) {
      reinitialiser()
      abonneStarterMensuel({ latest_invoice })
      expect(h.changement.latest_invoice).toMatchObject({ id: 'in_1', status: 'paid', amount_paid: 30000 })
      const res = await envoyer(post({ target_plan: 'pro' }))
      expect(res.statusCode, JSON.stringify(latest_invoice)).toBe(200)
      expect(res.body.statut).toBe('change_applique')
      expect(res.body.message, JSON.stringify(latest_invoice)).toBe('Passage au plan pro confirmé : aucun montant à régler aujourd’hui.')
    }
  })

  it('essai avec carte : le message d’essai', async () => {
    abonneStarterMensuel({ status: 'trialing' })
    h.changement.status = 'trialing'
    h.changement.latest_invoice.amount_paid = 0
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    expect(res.body.statut).toBe('change_applique')
    expect(res.body.message).toBe('Passage au plan pro confirmé. Rien à prélever pendant votre essai : le nouveau tarif s’appliquera à sa fin.')
  })

  it('paiement de la différence à authentifier : la page Stripe de la facture', async () => {
    abonneStarterMensuel()
    changementEnAttente({ status: 'requires_action' })
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      statut: 'paiement_a_valider',
      facture_url: 'https://invoice.stripe.com/i/in_2',
      message: 'Le paiement de la différence reste à valider sur la page Stripe : le plan pro s’appliquera dès qu’il sera réglé.',
    })
    expect(h.stripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_2')
    expect(h.ecrituresClients.filter((v) => 'plan' in v)).toEqual([])
  })

  it('à authentifier après un premier échec (requires_action + last_payment_error) : à valider, pas refusé', async () => {
    // Un 3-D Secure raté laisse une erreur ET une nouvelle authentification à
    // faire : le client peut encore payer sur la page de la facture.
    abonneStarterMensuel()
    changementEnAttente({ status: 'requires_action', last_payment_error: { code: 'authentication_required' } })
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    expect(res.body.statut).toBe('paiement_a_valider')
    expect(res.body.facture_url).toBe('https://invoice.stripe.com/i/in_2')
  })

  it('paiement en cours de traitement : 200 paiement_en_cours, avec la facture si elle est ouverte', async () => {
    abonneStarterMensuel()
    changementEnAttente({ status: 'processing' })
    let res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      statut: 'paiement_en_cours',
      message: 'Le paiement de la différence est en cours de traitement : le plan pro s’appliquera dès sa confirmation.',
      facture_url: 'https://invoice.stripe.com/i/in_2',
    })

    reinitialiser()
    abonneStarterMensuel()
    changementEnAttente({ status: 'processing' }, { status: 'paid' })
    res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    expect(res.body.statut).toBe('paiement_en_cours')
    expect(res.body).not.toHaveProperty('facture_url')
  })

  it('en traitement après un premier échec (processing + last_payment_error) : en cours, pas refusé', async () => {
    // Le paiement est reparti : l'annoncer refusé ferait payer une seconde fois.
    abonneStarterMensuel()
    changementEnAttente({ status: 'processing', last_payment_error: { code: 'card_declined' } })
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    expect(res.body.statut).toBe('paiement_en_cours')
  })

  it('paiement de la différence refusé, facture ouverte : 402 avec la page Stripe pour régler', async () => {
    abonneStarterMensuel()
    changementEnAttente({ status: 'requires_payment_method', last_payment_error: { code: 'card_declined' } })
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(402)
    expect(res.body).toEqual({
      error: 'paiement_refuse',
      message: 'Le paiement de la différence a été refusé. Réglez-la avec une autre carte sur la page Stripe, ou mettez à jour votre carte depuis « Gérer mon abonnement ».',
      facture_url: 'https://invoice.stripe.com/i/in_2',
    })
  })

  it('paiement refusé sans facture ouverte : 402, sans page à proposer', async () => {
    abonneStarterMensuel()
    changementEnAttente({ status: 'requires_payment_method', last_payment_error: { code: 'card_declined' } }, { status: 'void' })
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(402)
    expect(res.body).toEqual({
      error: 'paiement_refuse',
      message: 'Le paiement de la différence a été refusé : mettez à jour votre carte depuis « Gérer mon abonnement ».',
    })
  })

  it('changement en attente mais paiement illisible : jamais annoncé comme payé', async () => {
    // PaymentIntent illisible, facture ouverte : le client va sur la page de la
    // facture, qui dit ce qui manque.
    abonneStarterMensuel()
    changementEnAttente({ status: 'requires_action' })
    h.stripe.paymentIntents.retrieve = vi.fn(async () => { throw new Error('panne') })
    let res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    expect(res.body.statut).toBe('paiement_a_valider')
    expect(res.body.facture_url).toBe('https://invoice.stripe.com/i/in_2')
    expect(res.body.instant).toBeUndefined()

    // Rien de lisible du tout : refus plutôt qu'un succès.
    h.stripe = baseStripe()
    h.changement = { id: 'sub_1', status: 'active', pending_update: { expires_at: 1_900_000_000 }, latest_invoice: 'in_3' }
    res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(402)
    expect(res.body.error).toBe('paiement_refuse')
  })

  it('la formule ne s’écrit que si le changement est appliqué', async () => {
    const enAttente = [
      ['à valider', { status: 'requires_action' }],
      ['en cours', { status: 'processing' }],
      ['refusé', { status: 'requires_payment_method', last_payment_error: { code: 'card_declined' } }],
    ]
    for (const [nom, intention] of enAttente) {
      reinitialiser()
      abonneStarterMensuel()
      changementEnAttente(intention)
      await envoyer(post({ target_plan: 'pro' }))
      const appels = h.stripe.subscriptions.update.mock.calls
      expect(appels, nom).toHaveLength(2)
      expect(appels.some(([, p]) => p.metadata && 'formule' in p.metadata), nom).toBe(false)
    }
  })

  it('formule impossible à écrire : le changement reste confirmé, avec une trace', async () => {
    const trace = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      abonneStarterMensuel()
      const update = h.stripe.subscriptions.update
      h.stripe.subscriptions.update = vi.fn(async (id, params, options) => {
        if (params.metadata?.formule) throw new Error('panne')
        return update(id, params, options)
      })
      const res = await envoyer(post({ target_plan: 'pro' }))
      expect(res.statusCode).toBe(200)
      expect(res.body.statut).toBe('change_applique')
      expect(h.stripe.subscriptions.update).toHaveBeenCalledTimes(3)
      expect(trace).toHaveBeenCalled()
    } finally {
      trace.mockRestore()
    }
  })

  it('abonnement actif dont la résiliation est programmée : 409 abonnement_en_resiliation, rien ne change chez Stripe', async () => {
    // Avec une carte, la route prélevait la différence sur un abonnement qui
    // s'éteint à la fin de la période.
    for (const resiliation of [{ cancel_at_period_end: true }, { cancel_at: 1_900_000_000 }]) {
      reinitialiser()
      abonneStarterMensuel(resiliation)
      const res = await envoyer(post({ target_plan: 'pro' }))
      expect(res.statusCode, JSON.stringify(resiliation)).toBe(409)
      expect(res.body, JSON.stringify(resiliation)).toEqual({
        error: 'abonnement_en_resiliation',
        message: 'Votre abonnement actuel s’arrête à la fin de la période : réactivez-le depuis « Gérer mon abonnement », puis changez de plan.',
      })
      expect(h.stripe.subscriptions.update).not.toHaveBeenCalled()
      expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
    }
  })

  it('abonné avec une autre période : 409, rien ne change chez Stripe', async () => {
    abonneStarterMensuel()
    const res = await envoyer(post({ target_plan: 'pro', billing_period: 'annual' }))
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
      reinitialiser()
      abonneStarterMensuel({ items: { data: [{ id: 'si_1', price }] } })
      const res = await envoyer(post({ target_plan: 'pro', billing_period: 'monthly' }))
      expect(res.statusCode, price.id).toBe(409)
      expect(res.body.error, price.id).toBe('changement_de_formule')
      expect(h.stripe.subscriptions.update, price.id).not.toHaveBeenCalled()
      expect(h.stripe.checkout.sessions.create, price.id).not.toHaveBeenCalled()
    }
  })

  it('abonné avec carte déjà sur le prix demandé (colonne plan en retard) : 409 deja_sur_ce_plan, sans aucun update', async () => {
    // Stripe a déjà basculé l'abonnement sur Pro, le webhook n'a pas encore
    // réécrit `plan` : refaire le changement annoncerait un succès de trop.
    // La carte est rangée sur le client Stripe, pas sur l'abonnement.
    abonneStarterMensuel({ default_payment_method: null, items: { data: [{ id: 'si_1', price: PRIX_PRO_MENSUEL }] } })
    h.customerCards = [{ id: 'pm_x' }]
    const res = await envoyer(post({ target_plan: 'pro', billing_period: 'monthly' }))
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('deja_sur_ce_plan')
    expect(h.stripe.subscriptions.update).not.toHaveBeenCalled()
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('subscriptions.retrieve en erreur 500 : 500 erreur_interne, ni échange ni nouvelle page Stripe', async () => {
    h.clientRow.plan = 'starter'
    h.clientRow.stripe_subscription_id = 'sub_1'
    h.stripe.subscriptions.retrieve = vi.fn(async () => {
      throw Object.assign(new Error('Stripe indisponible'), { type: 'StripeAPIError', statusCode: 500 })
    })
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('erreur_interne')
    expect(h.stripe.subscriptions.update).not.toHaveBeenCalled()
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('carte d’un abonné illisible (panne Stripe) : 503, ni échange ni nouvelle page Stripe', async () => {
    // Une panne ne vaut pas « pas de carte » : repasser par Checkout créerait un
    // second abonnement pendant que le premier continue de facturer.
    abonneStarterMensuel({ default_payment_method: null })
    h.stripe.paymentMethods.list = vi.fn(async () => { throw new Error('panne') })
    const res = await envoyer(post({ target_plan: 'pro', billing_period: 'monthly' }))
    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ error: 'indisponible', message: INDISPONIBLE })
    expect(h.stripe.subscriptions.update).not.toHaveBeenCalled()
    expect(h.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('la carte se cherche chez le client Stripe qui porte l’abonnement', async () => {
    // stripe_customer_id désigne un autre client Stripe que celui de l'abonnement.
    abonneStarterMensuel({ customer: 'cus_abo', default_payment_method: null })
    h.customerCards = [{ id: 'pm_abo' }]
    const res = await envoyer(post({ target_plan: 'pro' }))
    expect(res.statusCode).toBe(200)
    const clientsInterroges = h.stripe.paymentMethods.list.mock.calls.map(([p]) => p.customer)
    expect(clientsInterroges).toEqual(['cus_abo'])
    expect(h.stripe.subscriptions.update.mock.calls[0][1].default_payment_method).toBe('pm_abo')
  })
})

describe('POST /api/billing/upgrade — code promo', () => {
  /** Ce que lève le SDK Stripe quand il refuse la requête. */
  const refusStripe = (param) => Object.assign(new Error('This promotion code cannot be redeemed'), { type: 'StripeInvalidRequestError', statusCode: 400, param })

  it('code promo résolu : la session porte le code, et metadata.promo_code est posé', async () => {
    h.codesPromo = { BIENVENUE: 'promo_1' }
    const res = await envoyer(post({ target_plan: 'pro', promo_code: 'BIENVENUE' }))
    expect(res.statusCode).toBe(200)
    expect(h.stripe.promotionCodes.list).toHaveBeenCalledWith({ code: 'BIENVENUE', active: true, limit: 1 })
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(params.discounts).toEqual([{ promotion_code: 'promo_1' }])
    expect(params.metadata.promo_code).toBe('BIENVENUE')
  })

  it('un code promo qui n’est pas une chaîne de 64 caractères au plus est ignoré', async () => {
    for (const promo_code of ['X'.repeat(65), 42, { code: 'BIENVENUE' }]) {
      h.stripe = baseStripe()
      const res = await envoyer(post({ target_plan: 'pro', promo_code }))
      expect(res.statusCode).toBe(200)
      expect(h.stripe.promotionCodes.list).not.toHaveBeenCalled()
      const params = h.stripe.checkout.sessions.create.mock.calls[0][0]
      expect(params.metadata.promo_code).toBeUndefined()
      expect(params.allow_promotion_codes).toBe(true)
    }
    // 64 caractères : encore un code.
    h.stripe = baseStripe()
    await envoyer(post({ target_plan: 'pro', promo_code: 'X'.repeat(64) }))
    expect(h.stripe.promotionCodes.list).toHaveBeenCalledTimes(1)
  })

  it('Stripe refuse la session sur `discounts` avec un code appliqué : 400 code_promo_refuse', async () => {
    for (const param of ['discounts', 'discounts[0][promotion_code]']) {
      reinitialiser()
      h.codesPromo = { BIENVENUE: 'promo_1' }
      h.stripe.checkout.sessions.create = vi.fn(async () => { throw refusStripe(param) })
      const res = await envoyer(post({ target_plan: 'pro', promo_code: 'BIENVENUE' }))
      expect(res.statusCode, param).toBe(400)
      expect(res.body, param).toEqual({ error: 'code_promo_refuse', message: 'Ce code promo ne peut pas être appliqué à cet abonnement.' })
    }
  })

  it('un refus qui ne vise pas le code, ou une panne : 500, le marchand n’abandonne pas un code valable', async () => {
    h.codesPromo = { BIENVENUE: 'promo_1' }
    const erreurs = [
      refusStripe('payment_method_types'),
      refusStripe(undefined),
      Object.assign(new Error('Stripe indisponible'), { type: 'StripeAPIError', statusCode: 500 }),
    ]
    for (const erreur of erreurs) {
      h.stripe = baseStripe()
      h.stripe.checkout.sessions.create = vi.fn(async () => { throw erreur })
      const res = await envoyer(post({ target_plan: 'pro', promo_code: 'BIENVENUE' }))
      expect(res.statusCode, String(erreur.param)).toBe(500)
      expect(res.body.error).toBe('erreur_interne')
    }
  })

  it('StripeInvalidRequestError sur `discounts` sans code promo appliqué : 500, pas code_promo_refuse', async () => {
    // Le coupon trimestriel passe aussi par `discounts` : sans code saisi, ce
    // n'est pas au marchand d'y renoncer.
    for (const promo_code of [undefined, 'INCONNU']) {
      h.stripe = baseStripe()
      h.stripe.checkout.sessions.create = vi.fn(async () => { throw refusStripe('discounts') })
      const res = await envoyer(post({ target_plan: 'pro', billing_period: 'quarterly', promo_code }))
      expect(res.statusCode, String(promo_code)).toBe(500)
      expect(res.body.error).toBe('erreur_interne')
    }
  })
})

describe('POST /api/billing/upgrade — un contrat de réponse stable', () => {
  const CODES = [
    'methode_non_autorisee', 'non_authentifie', 'requete_invalide', 'enterprise_contact', 'downgrade_non_self_serve',
    'code_promo_refuse', 'paiement_refuse', 'acces_refuse', 'role_non_autorise', 'client_introuvable',
    'deja_sur_ce_plan', 'changement_de_formule', 'paiement_en_attente', 'abonnement_en_cours', 'abonnement_en_resiliation',
    'Stripe not configured', 'indisponible', 'erreur_interne',
  ]
  const STATUTS = ['checkout', 'change_applique', 'paiement_a_valider', 'paiement_en_cours']
  const rien = () => {}

  // [nom, statut HTTP attendu, préparation, requête]
  const SCENARIOS = [
    ['méthode', 405, rien, { method: 'GET', headers: { authorization: 'Bearer t' }, body: {} }],
    ['sans jeton', 401, rien, { method: 'POST', headers: {}, body: {} }],
    ['jeton refusé', 401, () => { h.user = null }, post()],
    ['champs manquants', 400, rien, post({ client_id: undefined })],
    ['période inconnue', 400, rien, post({ billing_period: 'weekly' })],
    ['plan inconnu', 400, rien, post({ target_plan: 'gold' })],
    ['enterprise', 400, rien, post({ target_plan: 'enterprise' })],
    ['downgrade', 400, () => { h.clientRow.plan = 'pro' }, post({ target_plan: 'starter' })],
    ['code promo refusé', 400, () => {
      h.codesPromo = { BIENVENUE: 'promo_1' }
      h.stripe.checkout.sessions.create = vi.fn(async () => { throw Object.assign(new Error('refus'), { type: 'StripeInvalidRequestError', param: 'discounts' }) })
    }, post({ target_plan: 'pro', promo_code: 'BIENVENUE' })],
    ['refus avec facture', 402, () => { abonneStarterMensuel(); changementEnAttente({ status: 'requires_payment_method' }) }, post({ target_plan: 'pro' })],
    ['refus sans facture', 402, () => { abonneStarterMensuel(); changementEnAttente({ status: 'requires_payment_method' }, { status: 'void' }) }, post({ target_plan: 'pro' })],
    ['accès refusé', 403, () => { h.base.client_users = [] }, post({ target_plan: 'pro' })],
    ['rôle', 403, () => { h.base.client_users = [{ user_id: 'u1', client_id: 'c1', role: 'finance' }] }, post({ target_plan: 'pro' })],
    ['fiche absente', 404, () => { h.base.clients = [] }, post()],
    ['déjà sur ce plan', 409, () => { h.clientRow.plan = 'starter' }, post()],
    ['déjà sur le prix', 409, () => { abonneStarterMensuel({ items: { data: [{ id: 'si_1', price: { id: 'price_actero_pro_mensuel', recurring: { interval: 'month', interval_count: 1 } } }] } }) }, post({ target_plan: 'pro' })],
    ['changement de formule', 409, () => { abonneStarterMensuel() }, post({ target_plan: 'pro', billing_period: 'annual' })],
    ['paiement en attente', 409, () => { abonneStarterMensuel({ status: 'past_due' }) }, post({ target_plan: 'pro' })],
    ['abonnement en cours', 409, () => { h.abonnements = [{ id: 'sub_2', status: 'active', customer: 'cus_1' }] }, post({ target_plan: 'pro' })],
    ['abonnement suspendu', 409, () => { abonneStarterMensuel({ status: 'unpaid' }) }, post({ target_plan: 'pro' })],
    ['abonnement en résiliation', 409, () => { abonneStarterMensuel({ cancel_at_period_end: true }) }, post({ target_plan: 'pro' })],
    ['clé Stripe absente', 503, () => { delete process.env.STRIPE_SECRET_KEY }, post()],
    ['prix absent', 503, () => { h.stripe.prices.list = vi.fn(async () => ({ data: [] })) }, post()],
    ['base illisible', 503, () => { h.erreursBase.client_users = { message: 'panne' } }, post()],
    ['historique illisible', 503, () => { h.stripe.subscriptions.list = vi.fn(async () => { throw new Error('panne') }) }, post()],
    ['carte illisible', 503, () => { abonneStarterMensuel({ default_payment_method: null }); h.stripe.paymentMethods.list = vi.fn(async () => { throw new Error('panne') }) }, post({ target_plan: 'pro' })],
    ['essai non neutralisé', 503, () => { abonneStarterMensuel({ status: 'trialing', default_payment_method: null }); h.stripe.subscriptions.update = vi.fn(async () => { throw new Error('panne') }) }, post({ target_plan: 'pro' })],
    ['erreur interne', 500, () => { h.stripe.checkout.sessions.create = vi.fn(async () => { throw new Error('panne') }) }, post()],
    ['page Stripe', 200, rien, post()],
    ['changement appliqué', 200, () => { abonneStarterMensuel() }, post({ target_plan: 'pro' })],
    ['paiement à valider', 200, () => { abonneStarterMensuel(); changementEnAttente({ status: 'requires_action' }) }, post({ target_plan: 'pro' })],
    ['paiement en cours', 200, () => { abonneStarterMensuel(); changementEnAttente({ status: 'processing' }) }, post({ target_plan: 'pro' })],
  ]

  it('toute erreur porte `error` et `message` en chaînes, toute réponse 200 porte un `statut`', async () => {
    const journaux = ['error', 'warn', 'log'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
    try {
      for (const [nom, attendu, preparer, requete] of SCENARIOS) {
        reinitialiser()
        preparer()
        const res = await envoyer(requete)
        expect(res.statusCode, nom).toBe(attendu)
        expect(res.body, nom).not.toHaveProperty('hint')
        if (res.statusCode === 200) {
          expect(STATUTS, nom).toContain(res.body.statut)
        } else {
          expect(CODES, nom).toContain(res.body.error)
          expect(typeof res.body.message, nom).toBe('string')
          expect(res.body.message.length, nom).toBeGreaterThan(0)
        }
      }
    } finally {
      for (const j of journaux) j.mockRestore()
    }
  })
})
