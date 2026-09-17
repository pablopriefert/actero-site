import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { creerFauxSupabase, fausseReponse } from './faux-supabase.js'

/**
 * Le webhook Stripe écrit le fil d'activité des closers.
 *
 * Ce qui est protégé : chaque événement écrit la bonne étape pour le bon
 * client, un client sans closer n'écrit rien, et surtout le fil ne change
 * jamais la réponse du webhook — une panne du fil laisse le 200, et le
 * traitement métier reste le même.
 */

const h = vi.hoisted(() => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  return { supabase: null, stripe: null, event: null, commission: null }
})

vi.mock('./sentry.js', () => ({ withSentry: (fn) => fn, captureError: () => {} }))
vi.mock('@supabase/supabase-js', () => ({
  // Le webhook crée son client au chargement : il délègue au faux du test en cours.
  createClient: () => new Proxy({}, { get: (_, cle) => h.supabase[cle] }),
}))
vi.mock('stripe', () => ({ default: function Stripe() { return new Proxy({}, { get: (_, cle) => h.stripe[cle] }) } }))
vi.mock('resend', () => ({ Resend: function Resend() { return { emails: { send: async () => ({}) } } } }))
vi.mock('./amplitude.js', () => ({ trackServerEvent: async () => {} }))
vi.mock('../marketplace/install.js', () => ({ finalizeInstall: async () => ({ id: 'install' }) }))
vi.mock('./entitlements.js', () => ({ syncEntitlementsFromStripe: async () => {} }))
vi.mock('./commissions-stripe.js', () => ({
  traiterFacturePayee: async () => {
    if (h.commission instanceof Error) throw h.commission
    return { cree: false, raison: 'sans_closer' }
  },
  traiterRemboursement: async () => ({ touchees: 0 }),
}))

const { default: webhook } = await import('../stripe-webhook.js')

const CLIENT = '11111111-1111-4111-8111-111111111111'
const AUTRE = '22222222-2222-4222-8222-222222222222'
const CREE_LE = 1_789_000_000

const PRIX_PRO_ANNUEL = { id: 'price_pa', lookup_key: 'actero_pro_annuel', recurring: { interval: 'year', interval_count: 1 } }

function monde({ clients, erreurs } = {}) {
  h.supabase = creerFauxSupabase({
    tables: {
      clients: clients ?? [
        { id: CLIENT, closer_id: 'k1', plan: 'pro', status: 'active', stripe_subscription_id: 'sub_1', stripe_customer_id: 'cus_1' },
        { id: AUTRE, closer_id: null, plan: 'free', status: 'active', stripe_subscription_id: null, stripe_customer_id: 'cus_2' },
      ],
      closer_evenements: [],
      webhook_events_processed: [],
      funnel_clients: [],
      client_entitlements: [],
    },
    uniques: { closer_evenements: ['source_key'], webhook_events_processed: ['event_id'] },
    erreurs,
  })
  return h.supabase
}

let numero = 0

function recevoir(type, object, extra = {}) {
  h.event = { id: `evt_${++numero}`, type, created: CREE_LE, data: { object, ...extra } }
  return envoyer()
}

async function envoyer() {
  const res = fausseReponse()
  await webhook({
    method: 'POST',
    headers: { 'stripe-signature': 't=1,v1=signature' },
    async *[Symbol.asyncIterator]() { yield Buffer.from('{}') },
  }, res)
  return res
}

/** Les événements reçus, tels que Stripe les enverrait. */
const EVENEMENTS = {
  abonnementDemarre: () => ['invoice.paid', {
    id: 'in_1', object: 'invoice', status: 'paid', amount_paid: 395010, billing_reason: 'subscription_create', customer: 'cus_1',
    parent: { type: 'subscription_details', subscription_details: { metadata: { client_id: CLIENT }, subscription: 'sub_1' } },
    lines: { data: [{ amount: 395010, parent: { type: 'subscription_item_details', subscription_item_details: { proration: false } }, pricing: { price_details: { price: PRIX_PRO_ANNUEL } } }] },
  }],
  renouvellementAcacia: () => ['invoice.paid', {
    id: 'in_2', object: 'invoice', status: 'paid', amount_paid: 39900, billing_reason: 'subscription_cycle', subscription: 'sub_1', customer: 'cus_x',
    lines: { data: [] },
  }],
  paiementEchoue: () => ['invoice.payment_failed', {
    id: 'in_3', object: 'invoice', status: 'open', amount_paid: 0, billing_reason: 'subscription_cycle', customer: 'cus_1', lines: { data: [] },
  }],
  paiementAbandonne: () => ['checkout.session.expired', {
    id: 'cs_1', object: 'checkout.session', mode: 'subscription', status: 'expired', expires_at: CREE_LE - 5, customer: 'cus_1',
    metadata: { actero_client_id: CLIENT, upgrade_from: 'free', upgrade_to: 'pro', formule: 'pro_annuel' },
  }],
  resiliationProgrammee: () => ['customer.subscription.updated',
    { id: 'sub_1', object: 'subscription', status: 'active', cancel_at_period_end: true, metadata: { client_id: CLIENT } },
    { previous_attributes: { cancel_at_period_end: false } },
  ],
  abonnementTermine: () => ['customer.subscription.deleted',
    { id: 'sub_1', object: 'subscription', status: 'canceled', cancel_at_period_end: false, metadata: { client_id: CLIENT } },
  ],
  rembourse: () => ['charge.refunded', {
    id: 'ch_1', object: 'charge', customer: 'cus_1', amount: 39900, amount_refunded: 10000, refunded: false, metadata: {},
  }],
}

const ATTENDU = {
  // Le démarrage est unique par abonnement : sa clé est celle de l'abonnement.
  abonnementDemarre: { type: 'abonnement_demarre', details: { plan: 'pro', formule: 'annuel', plateforme: 'stripe' }, source_key: 'demarre:stripe:sub_1' },
  // Premier paiement réel de l'abonnement, même au renouvellement (mois offert) : c'est son démarrage.
  renouvellementAcacia: { type: 'abonnement_demarre', details: { plateforme: 'stripe' }, source_key: 'demarre:stripe:sub_1' },
  paiementEchoue: { type: 'paiement_echoue', details: {} },
  paiementAbandonne: { type: 'paiement_abandonne', details: { plan: 'pro', formule: 'annuel' } },
  resiliationProgrammee: { type: 'resiliation_programmee', details: {} },
  abonnementTermine: { type: 'abonnement_termine', details: { plateforme: 'stripe' } },
  rembourse: { type: 'rembourse', details: { partiel: true } },
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  h.commission = null
  h.event = null
  h.stripe = {
    webhooks: { constructEvent: () => h.event },
    subscriptions: {
      // L'abonnement relu : un prix hors catalogue, pour ne rien accorder ni chercher de carte.
      retrieve: vi.fn(async (id) => ({
        ...h.event.data.object, id, items: { data: [{ price: { id: 'price_x', lookup_key: null } }] },
      })),
    },
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('chaque événement écrit la bonne étape', () => {
  it.each(Object.keys(EVENEMENTS))('%s', async (nom) => {
    const sb = monde()
    const res = await recevoir(...EVENEMENTS[nom]())
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ received: true })
    expect(sb.base.closer_evenements).toHaveLength(1)
    expect(sb.base.closer_evenements[0]).toMatchObject({
      closer_id: 'k1',
      client_id: CLIENT,
      visite_id: null,
      source_key: `stripe:${h.event.id}`,
      ...ATTENDU[nom],
      survenu_le: new Date(CREE_LE * 1000).toISOString(),
    })
  })

  it('aucun montant ni adresse n’entre dans le fil', async () => {
    const sb = monde()
    for (const nom of Object.keys(EVENEMENTS)) await recevoir(...EVENEMENTS[nom]())
    expect(sb.base.closer_evenements).toHaveLength(Object.keys(EVENEMENTS).length)
    expect(JSON.stringify(sb.base.closer_evenements)).not.toMatch(/395010|39900|10000|cus_|@/)
  })

  it('mois offert : le premier vrai paiement est le démarrage, le suivant un renouvellement', async () => {
    const sb = monde()
    await recevoir(...EVENEMENTS.renouvellementAcacia())
    await recevoir(...EVENEMENTS.renouvellementAcacia())
    expect(sb.base.closer_evenements.map((e) => [e.type, e.source_key])).toEqual([
      ['abonnement_demarre', 'demarre:stripe:sub_1'],
      ['renouvellement_paye', `stripe:${h.event.id}`],
    ])
  })

  it('un abonnement démarré à la souscription : le renouvellement suivant reste un renouvellement', async () => {
    const sb = monde()
    await recevoir(...EVENEMENTS.abonnementDemarre())
    await recevoir(...EVENEMENTS.renouvellementAcacia())
    expect(sb.base.closer_evenements.map((e) => e.type)).toEqual(['abonnement_demarre', 'renouvellement_paye'])
  })

  it('une seconde facture de souscription du même abonnement n’écrit rien de plus', async () => {
    const sb = monde()
    await recevoir(...EVENEMENTS.abonnementDemarre())
    await recevoir(...EVENEMENTS.abonnementDemarre())
    expect(sb.base.closer_evenements).toHaveLength(1)
  })

  it('un événement rejoué n’écrit pas deux fois', async () => {
    const sb = monde()
    await recevoir(...EVENEMENTS.paiementEchoue())
    const res = await envoyer()
    expect(res.body).toEqual({ received: true, duplicate: true })
    expect(sb.base.closer_evenements).toHaveLength(1)
  })

  it('la fin d’abonnement est écrite même si la fiche a perdu son abonnement entre-temps', async () => {
    const sb = monde()
    await recevoir(...EVENEMENTS.abonnementTermine())
    expect(sb.base.clients.find((c) => c.id === CLIENT)).toMatchObject({ plan: 'free', status: 'canceled', stripe_subscription_id: null })
    expect(sb.base.closer_evenements.map((e) => e.type)).toEqual(['abonnement_termine'])
  })
})

describe('le bon client, ou aucun', () => {
  it('un client sans closer n’écrit rien', async () => {
    const sb = monde({ clients: [{ id: CLIENT, closer_id: null, stripe_subscription_id: 'sub_1', stripe_customer_id: 'cus_1' }] })
    for (const nom of Object.keys(EVENEMENTS)) {
      const res = await recevoir(...EVENEMENTS[nom]())
      expect(res.statusCode, nom).toBe(200)
    }
    expect(sb.base.closer_evenements).toEqual([])
  })

  it('un client Stripe porté par deux fiches : aucune étape, on ne choisit pas', async () => {
    const sb = monde({
      clients: [
        { id: CLIENT, closer_id: 'k1', stripe_customer_id: 'cus_1' },
        { id: AUTRE, closer_id: 'k2', stripe_customer_id: 'cus_1' },
      ],
    })
    await recevoir(...EVENEMENTS.paiementEchoue())
    await recevoir(...EVENEMENTS.rembourse())
    expect(sb.base.closer_evenements).toEqual([])
  })

  it('un abonnement qui n’est plus celui de la fiche : sa fin n’est pas écrite', async () => {
    const sb = monde()
    const [type, abonnement] = EVENEMENTS.abonnementTermine()
    await recevoir(type, { ...abonnement, id: 'sub_ancien' })
    expect(sb.base.closer_evenements).toEqual([])
    expect(sb.base.clients.find((c) => c.id === CLIENT).plan).toBe('pro')
  })

  it('un événement sans étape n’écrit rien et ne lit aucune fiche pour le fil', async () => {
    const sb = monde()
    const [type, session] = EVENEMENTS.paiementAbandonne()
    await recevoir(type, { ...session, mode: 'payment', metadata: { type: 'credit_purchase' } })
    await recevoir('invoice.paid', { id: 'in_4', status: 'paid', amount_paid: 0, billing_reason: 'subscription_create', customer: 'cus_1' })
    expect(sb.base.closer_evenements).toEqual([])
    expect(sb.journal.filter((j) => j.table === 'clients')).toEqual([])
  })
})

describe('le fil ne change jamais la réponse', () => {
  it.each(Object.keys(EVENEMENTS))('%s : fil en panne, toujours 200', async (nom) => {
    const sb = monde({ erreurs: { closer_evenements: { code: '57014', message: 'délai dépassé' } } })
    const res = await recevoir(...EVENEMENTS[nom]())
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ received: true })
    expect(sb.base.closer_evenements).toEqual([])
    // L'événement reste traité : Stripe ne le renverra pas pour le fil.
    expect(sb.base.webhook_events_processed.map((e) => e.event_id)).toEqual([h.event.id])
  })

  it('fiche illisible pour retrouver le client : toujours 200', async () => {
    const sb = monde({ erreurs: { clients: ({ operation }) => (operation === 'select' ? { message: 'panne' } : null) } })
    for (const nom of ['paiementEchoue', 'paiementAbandonne', 'rembourse', 'renouvellementAcacia']) {
      const res = await recevoir(...EVENEMENTS[nom]())
      expect(res.statusCode, nom).toBe(200)
      expect(res.body, nom).toEqual({ received: true })
    }
    expect(sb.base.closer_evenements).toEqual([])
  })

  it('le traitement métier reste le même quand le fil est en panne', async () => {
    const sb = monde({ erreurs: { closer_evenements: { message: 'panne' } } })
    await recevoir(...EVENEMENTS.abonnementTermine())
    expect(sb.base.clients.find((c) => c.id === CLIENT)).toMatchObject({ plan: 'free', status: 'canceled', stripe_subscription_id: null })
  })

  it('commission en échec : 500 comme avant, et rien dans le fil — le réessai l’écrira', async () => {
    const sb = monde()
    h.commission = new Error('Stripe indisponible')
    const res = await recevoir(...EVENEMENTS.abonnementDemarre())
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'commission_processing_failed' })
    expect(sb.base.closer_evenements).toEqual([])

    h.commission = null
    expect((await envoyer()).statusCode).toBe(200)
    expect(sb.base.closer_evenements.map((e) => e.type)).toEqual(['abonnement_demarre'])
  })
})
