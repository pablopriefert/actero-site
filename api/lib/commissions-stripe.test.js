import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'
import { creerFauxSupabase } from './faux-supabase.js'
import { traiterFacturePayee, traiterRemboursement, VERSION_API_COMMISSIONS, OPTIONS_STRIPE_COMMISSIONS } from './commissions-stripe.js'
import { OPTIONS_REQUETE_COURTE } from './stripe-customer.js'
import { NOTE_REMBOURSEE, NOTE_REMBOURSEE_APRES_PAIEMENT } from './commissions-closer.js'

/**
 * Commissions et webhook Stripe — spec closers, famille de tests 3.
 *
 * LA CHARGE UTILE EST FIGÉE ICI, dans la forme de l'API 2026-02-25.clover que
 * décrivent les types du SDK 20.4.1 (node_modules/stripe/types) :
 *   - Invoice : plus de `subscription` ni de `payment_intent` ; l'abonnement
 *     et ses métadonnées dans `parent.subscription_details` ; la date de
 *     paiement dans `status_transitions.paid_at` ;
 *   - InvoiceLineItem : plus de `price` ; `pricing.price_details.price`
 *     (étendu), et `parent.subscription_item_details.proration` ;
 *   - Charge : plus d'`invoice` ; la facture se retrouve par
 *     `invoicePayments.list({ payment: { type: 'payment_intent', payment_intent } })`.
 * Un code qui lirait encore `invoice.subscription` ou `charge.invoice`
 * échouerait ici : ces propriétés n'existent pas dans ces objets.
 *
 * Avant la mise en production, remplacer ces objets par ceux d'un vrai
 * événement de test (Stripe → Webhooks → événement → « Données de
 * l'événement ») si leur forme diffère (voir la Task 4 du plan).
 */

const CLIENT_ID = '11111111-1111-4111-8111-111111111111'

const PRIX_PRO_MENSUEL = { id: 'price_pro_m', object: 'price', lookup_key: 'actero_pro_mensuel', unit_amount: 39900, currency: 'eur', recurring: { interval: 'month', interval_count: 1 } }
const PRIX_STARTER_ANNUEL = { id: 'price_st_a', object: 'price', lookup_key: 'actero_starter_annuel', unit_amount: 98010, currency: 'eur', recurring: { interval: 'year', interval_count: 1 } }

function facture({ id = 'in_100', billing_reason = 'subscription_cycle', amount_paid = 39900, metadata = { client_id: CLIENT_ID } } = {}) {
  return {
    id,
    object: 'invoice',
    amount_due: amount_paid,
    amount_paid,
    amount_remaining: 0,
    billing_reason,
    currency: 'eur',
    customer: 'cus_100',
    lines: { object: 'list', data: [], has_more: true, url: `/v1/invoices/${id}/lines` },
    parent: {
      type: 'subscription_details',
      quote_details: null,
      subscription_details: { metadata, subscription: 'sub_100' },
    },
    status: 'paid',
    status_transitions: { finalized_at: 1_789_000_000, marked_uncollectible_at: null, paid_at: 1_789_000_100, voided_at: null },
  }
}

function ligne(prix, { id = 'il_100', proration = false } = {}) {
  return {
    id,
    object: 'line_item',
    amount: prix.unit_amount,
    currency: 'eur',
    invoice: 'in_100',
    parent: {
      type: 'subscription_item_details',
      invoice_item_details: null,
      subscription_item_details: { invoice_item: null, proration, proration_details: { credited_items: null }, subscription: 'sub_100', subscription_item: 'si_100' },
    },
    pricing: { type: 'price_details', unit_amount_decimal: String(prix.unit_amount), price_details: { price: prix, product: 'prod_100' } },
    quantity: 1,
    subscription: 'sub_100',
  }
}

const page = (data, has_more = false) => ({ object: 'list', has_more, data, url: '/v1/invoices/in_100/lines' })
const lignes = (prix) => page([ligne(prix)])

const CHARGE = { id: 'ch_100', object: 'charge', amount: 39900, amount_refunded: 39900, refunded: true, payment_intent: 'pi_100', customer: 'cus_100', status: 'succeeded' }
const PAIEMENTS = { object: 'list', has_more: false, data: [{ id: 'inpay_100', object: 'invoice_payment', invoice: 'in_100', is_default: true, status: 'paid', payment: { type: 'payment_intent', payment_intent: 'pi_100' } }] }

function fauxStripe({ factures = {}, lignesParFacture = {}, charge = CHARGE, paiements = PAIEMENTS } = {}) {
  return {
    invoices: {
      retrieve: vi.fn(async (id) => {
        if (!factures[id]) throw Object.assign(new Error(`No such invoice: '${id}'`), { statusCode: 404 })
        return factures[id]
      }),
      // Une liste simple, ou des pages : la suivante est celle qui suit `starting_after`.
      listLineItems: vi.fn(async (id, params) => {
        const pages = lignesParFacture[id]
        if (!Array.isArray(pages)) return pages
        if (!params?.starting_after) return pages[0]
        return pages[pages.findIndex((p) => p.data.at(-1)?.id === params.starting_after) + 1]
      }),
    },
    charges: { retrieve: vi.fn(async () => charge) },
    invoicePayments: { list: vi.fn(async () => paiements) },
  }
}

const fauxSupabase = ({ commissions = [], closerId = 'k1', erreurs, clients } = {}) => creerFauxSupabase({
  tables: {
    clients: clients ?? [{ id: CLIENT_ID, closer_id: closerId, stripe_subscription_id: 'sub_100', contact_email: 'marchand@boutique.fr', brand_name: 'Boutique' }],
    closer_commissions: commissions,
  },
  uniques: { closer_commissions: ['source_key'] },
  erreurs,
})

describe('la forme lue est celle du SDK', () => {
  it('la version fixée est celle des types installés — mettre à jour le SDK impose de revoir ce fichier', () => {
    expect(VERSION_API_COMMISSIONS).toBe(Stripe.API_VERSION)
  })

  it('les objets figés n’ont plus les champs retirés en 2025-03-31.basil', () => {
    expect(facture()).not.toHaveProperty('subscription')
    expect(facture()).not.toHaveProperty('payment_intent')
    expect(facture()).not.toHaveProperty('charge')
    expect(lignes(PRIX_PRO_MENSUEL).data[0]).not.toHaveProperty('price')
    expect(CHARGE).not.toHaveProperty('invoice')
  })

  it('chaque lecture fixe la version et garde le délai borné du webhook', async () => {
    const stripe = fauxStripe({ factures: { in_100: facture() }, lignesParFacture: { in_100: lignes(PRIX_PRO_MENSUEL) } })
    await traiterFacturePayee(stripe, fauxSupabase(), 'in_100')
    await traiterRemboursement(stripe, fauxSupabase(), 'ch_100')
    expect(OPTIONS_STRIPE_COMMISSIONS).toEqual({ ...OPTIONS_REQUETE_COURTE, apiVersion: '2026-02-25.clover' })
    const appels = [
      stripe.invoices.retrieve.mock.calls[0],
      stripe.invoices.listLineItems.mock.calls[0],
      stripe.charges.retrieve.mock.calls[0],
      stripe.invoicePayments.list.mock.calls[0],
    ]
    for (const appel of appels) expect(appel.at(-1), JSON.stringify(appel)).toEqual(OPTIONS_STRIPE_COMMISSIONS)
    expect(stripe.invoices.listLineItems).toHaveBeenCalledWith('in_100', { limit: 100, expand: ['data.pricing.price_details.price'] }, OPTIONS_STRIPE_COMMISSIONS)
    expect(stripe.invoicePayments.list).toHaveBeenCalledWith({ payment: { type: 'payment_intent', payment_intent: 'pi_100' }, limit: 10 }, OPTIONS_STRIPE_COMMISSIONS)
  })
})

describe('invoice.paid → commission', () => {
  it('une mensualité : une commission à valider', async () => {
    const sb = fauxSupabase()
    const stripe = fauxStripe({ factures: { in_100: facture() }, lignesParFacture: { in_100: lignes(PRIX_PRO_MENSUEL) } })
    expect(await traiterFacturePayee(stripe, sb, 'in_100')).toEqual({ cree: true, source_key: 'stripe:in_100' })
    expect(sb.base.closer_commissions).toHaveLength(1)
    expect(sb.base.closer_commissions[0]).toMatchObject({
      closer_id: 'k1', client_id: CLIENT_ID, montant_centimes: 10000, type: 'mensuelle', statut: 'a_valider',
      stripe_invoice_id: 'in_100', payee_par_client_le: new Date(1_789_000_100 * 1000).toISOString(),
      montant_facture_centimes: 39900, note: null,
    })
  })

  it('un code promo qui fait payer moins que la commission : montant payé écrit, et une note à vérifier', async () => {
    const sb = fauxSupabase()
    const stripe = fauxStripe({ factures: { in_100: facture({ amount_paid: 3990 }) }, lignesParFacture: { in_100: lignes(PRIX_PRO_MENSUEL) } })
    expect((await traiterFacturePayee(stripe, sb, 'in_100')).cree).toBe(true)
    expect(sb.base.closer_commissions[0]).toMatchObject({
      montant_centimes: 10000,
      montant_facture_centimes: 3990,
      statut: 'a_valider',
      note: 'Commission supérieure au montant payé (39,90 €) : à vérifier',
    })
  })

  it('la même facture traitée deux fois : une seule commission', async () => {
    const sb = fauxSupabase()
    const stripe = fauxStripe({ factures: { in_100: facture() }, lignesParFacture: { in_100: lignes(PRIX_PRO_MENSUEL) } })
    await traiterFacturePayee(stripe, sb, 'in_100')
    expect(await traiterFacturePayee(stripe, sb, 'in_100')).toEqual({ cree: false, raison: 'deja_creee' })
    expect(sb.base.closer_commissions).toHaveLength(1)
  })

  it('annuel : une commission unique, pas une seconde au renouvellement', async () => {
    const sb = fauxSupabase()
    const stripe = fauxStripe({
      factures: { in_1: facture({ id: 'in_1', billing_reason: 'subscription_create', amount_paid: 98010 }), in_2: facture({ id: 'in_2', amount_paid: 98010 }) },
      lignesParFacture: { in_1: lignes(PRIX_STARTER_ANNUEL), in_2: lignes(PRIX_STARTER_ANNUEL) },
    })
    expect(await traiterFacturePayee(stripe, sb, 'in_1')).toEqual({ cree: true, source_key: `unique:${CLIENT_ID}` })
    expect(await traiterFacturePayee(stripe, sb, 'in_2')).toEqual({ cree: false, raison: 'unique_deja_versee' })
    expect(sb.base.closer_commissions).toHaveLength(1)
    expect(sb.base.closer_commissions[0]).toMatchObject({ montant_centimes: 25000, type: 'unique' })
  })

  it('le client se retrouve par l’abonnement si les métadonnées n’ont pas son identifiant', async () => {
    const sb = fauxSupabase()
    const stripe = fauxStripe({ factures: { in_100: facture({ metadata: {} }) }, lignesParFacture: { in_100: lignes(PRIX_PRO_MENSUEL) } })
    expect((await traiterFacturePayee(stripe, sb, 'in_100')).cree).toBe(true)
  })

  it('le client se retrouve par l’identifiant des métadonnées, même quand l’abonnement enregistré a changé', async () => {
    const sb = fauxSupabase({ clients: [{ id: CLIENT_ID, closer_id: 'k1', stripe_subscription_id: 'sub_nouveau' }] })
    const stripe = fauxStripe({ factures: { in_100: facture() }, lignesParFacture: { in_100: lignes(PRIX_PRO_MENSUEL) } })
    expect((await traiterFacturePayee(stripe, sb, 'in_100')).cree).toBe(true)
    expect(sb.base.closer_commissions[0]).toMatchObject({ client_id: CLIENT_ID, closer_id: 'k1' })
  })

  it('un identifiant de métadonnées sans client : repli sur l’abonnement', async () => {
    const sb = fauxSupabase()
    const stripe = fauxStripe({
      factures: { in_100: facture({ metadata: { client_id: '22222222-2222-4222-8222-222222222222' } }) },
      lignesParFacture: { in_100: lignes(PRIX_PRO_MENSUEL) },
    })
    expect(await traiterFacturePayee(stripe, sb, 'in_100')).toEqual({ cree: true, source_key: 'stripe:in_100' })
    expect(sb.base.closer_commissions[0].client_id).toBe(CLIENT_ID)
  })

  it('deux clients sur le même abonnement : rien, raison client_ambigu journalisée, sans lever', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sb = fauxSupabase({
      clients: [
        { id: CLIENT_ID, closer_id: 'k1', stripe_subscription_id: 'sub_100' },
        { id: '33333333-3333-4333-8333-333333333333', closer_id: 'k2', stripe_subscription_id: 'sub_100' },
      ],
    })
    const stripe = fauxStripe({ factures: { in_100: facture({ metadata: {} }) }, lignesParFacture: { in_100: lignes(PRIX_PRO_MENSUEL) } })
    expect(await traiterFacturePayee(stripe, sb, 'in_100')).toEqual({ cree: false, raison: 'client_ambigu' })
    expect(sb.base.closer_commissions).toEqual([])
    expect(stripe.invoices.listLineItems).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith('[CLOSER] facture sans commission', { facture: 'in_100', client: null, abonnement: 'sub_100', raison: 'client_ambigu' })
    warn.mockRestore()
  })

  describe('un client rattaché sans commission : un avertissement, avec des identifiants seulement', () => {
    let warn
    beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
    afterEach(() => warn.mockRestore())

    const PRIX_SUR_MESURE = { ...PRIX_PRO_MENSUEL, id: 'price_sur_mesure', lookup_key: 'actero_enterprise_acme', unit_amount: 99900 }

    it.each([
      ['hors_grille', () => fauxStripe({ factures: { in_100: facture() }, lignesParFacture: { in_100: lignes(PRIX_SUR_MESURE) } })],
      ['devise', () => fauxStripe({ factures: { in_100: { ...facture(), currency: 'usd' } }, lignesParFacture: { in_100: lignes(PRIX_PRO_MENSUEL) } })],
    ])('%s', async (raison, monStripe) => {
      const sb = fauxSupabase()
      expect(await traiterFacturePayee(monStripe(), sb, 'in_100')).toEqual({ cree: false, raison })
      expect(sb.base.closer_commissions).toEqual([])
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn).toHaveBeenCalledWith('[CLOSER] facture sans commission', { facture: 'in_100', client: CLIENT_ID, raison })
      expect(JSON.stringify(warn.mock.calls)).not.toMatch(/marchand@boutique\.fr|Boutique/)
    })

    it('unique_deja_versee', async () => {
      const sb = fauxSupabase({ commissions: [{ id: 'kc0', source_key: `unique:${CLIENT_ID}`, statut: 'payee' }] })
      const stripe = fauxStripe({ factures: { in_100: facture({ amount_paid: 98010 }) }, lignesParFacture: { in_100: lignes(PRIX_STARTER_ANNUEL) } })
      expect(await traiterFacturePayee(stripe, sb, 'in_100')).toEqual({ cree: false, raison: 'unique_deja_versee' })
      expect(warn).toHaveBeenCalledWith('[CLOSER] facture sans commission', { facture: 'in_100', client: CLIENT_ID, raison: 'unique_deja_versee' })
    })

    it('une devise étrangère ne fait même pas lire les lignes', async () => {
      const stripe = fauxStripe({ factures: { in_100: { ...facture(), currency: 'usd' } }, lignesParFacture: { in_100: lignes(PRIX_PRO_MENSUEL) } })
      await traiterFacturePayee(stripe, fauxSupabase(), 'in_100')
      expect(stripe.invoices.listLineItems).not.toHaveBeenCalled()
    })

    it('rien pour un client sans closer, un client inconnu, ou une commission déjà créée', async () => {
      const stripe = fauxStripe({ factures: { in_100: facture() }, lignesParFacture: { in_100: lignes(PRIX_PRO_MENSUEL) } })
      await traiterFacturePayee(stripe, fauxSupabase({ closerId: null }), 'in_100')
      await traiterFacturePayee(stripe, fauxSupabase({ clients: [] }), 'in_100')
      const sb = fauxSupabase()
      await traiterFacturePayee(stripe, sb, 'in_100')
      expect(await traiterFacturePayee(stripe, sb, 'in_100')).toEqual({ cree: false, raison: 'deja_creee' })
      expect(warn).not.toHaveBeenCalled()
    })
  })

  describe('toutes les lignes de la facture sont lues', () => {
    const PRIX_STARTER_MENSUEL = { ...PRIX_PRO_MENSUEL, id: 'price_st_m', lookup_key: 'actero_starter_mensuel', unit_amount: 9900 }

    it('la ligne d’abonnement en seconde page compte', async () => {
      const sb = fauxSupabase()
      const stripe = fauxStripe({
        factures: { in_100: facture() },
        lignesParFacture: { in_100: [page([ligne(PRIX_STARTER_MENSUEL, { id: 'il_1', proration: true })], true), page([ligne(PRIX_PRO_MENSUEL, { id: 'il_2' })])] },
      })
      expect(await traiterFacturePayee(stripe, sb, 'in_100')).toEqual({ cree: true, source_key: 'stripe:in_100' })
      expect(sb.base.closer_commissions[0].montant_centimes).toBe(10000)
      expect(stripe.invoices.listLineItems).toHaveBeenCalledTimes(2)
      expect(stripe.invoices.listLineItems).toHaveBeenLastCalledWith(
        'in_100',
        { limit: 100, expand: ['data.pricing.price_details.price'], starting_after: 'il_1' },
        OPTIONS_STRIPE_COMMISSIONS,
      )
    })

    it('une seconde page qui porte une autre formule : rien, on ne devine pas', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const sb = fauxSupabase()
      const stripe = fauxStripe({
        factures: { in_100: facture() },
        lignesParFacture: { in_100: [page([ligne(PRIX_PRO_MENSUEL, { id: 'il_1' })], true), page([ligne(PRIX_STARTER_MENSUEL, { id: 'il_2' })])] },
      })
      expect(await traiterFacturePayee(stripe, sb, 'in_100')).toEqual({ cree: false, raison: 'hors_grille' })
      expect(sb.base.closer_commissions).toEqual([])
      warn.mockRestore()
    })
  })

  it('facture à 0 €, client sans closer : rien, et les lignes ne sont même pas lues pour 0 €', async () => {
    const zero = fauxStripe({ factures: { in_100: facture({ amount_paid: 0 }) }, lignesParFacture: { in_100: lignes(PRIX_PRO_MENSUEL) } })
    expect(await traiterFacturePayee(zero, fauxSupabase(), 'in_100')).toEqual({ cree: false, raison: 'rien_encaisse' })
    expect(zero.invoices.listLineItems).not.toHaveBeenCalled()
    const sansCloser = fauxStripe({ factures: { in_100: facture() }, lignesParFacture: { in_100: lignes(PRIX_PRO_MENSUEL) } })
    expect(await traiterFacturePayee(sansCloser, fauxSupabase({ closerId: null }), 'in_100')).toEqual({ cree: false, raison: 'sans_closer' })
  })

  it('une panne de lecture ou d’écriture lève : le webhook fera réessayer Stripe', async () => {
    const stripe = fauxStripe({ factures: { in_100: facture() }, lignesParFacture: { in_100: lignes(PRIX_PRO_MENSUEL) } })
    await expect(traiterFacturePayee(stripe, fauxSupabase({ erreurs: { clients: { message: 'panne' } } }), 'in_100')).rejects.toThrow(/clients illisible/)
    const ecritureRatee = fauxSupabase({ erreurs: { closer_commissions: ({ operation }) => (operation === 'insert' ? { message: 'disque plein' } : null) } })
    await expect(traiterFacturePayee(stripe, ecritureRatee, 'in_100')).rejects.toThrow(/commission non écrite/)
  })
})

describe('charge.refunded → commission annulée ou annotée', () => {
  const commission = (statut, note = null) => ({ id: 'kc1', source_key: 'stripe:in_100', stripe_invoice_id: 'in_100', statut, note, montant_centimes: 10000, closer_id: 'k1' })

  it('avant paiement : annulée', async () => {
    for (const statut of ['a_valider', 'validee']) {
      const sb = fauxSupabase({ commissions: [commission(statut)] })
      expect(await traiterRemboursement(fauxStripe(), sb, 'ch_100'), statut).toEqual({ touchees: 1 })
      expect(sb.base.closer_commissions[0], statut).toMatchObject({ statut: 'annulee', note: NOTE_REMBOURSEE })
    }
  })

  it('après paiement : reste payée, avec une note', async () => {
    const sb = fauxSupabase({ commissions: [commission('payee')] })
    await traiterRemboursement(fauxStripe(), sb, 'ch_100')
    expect(sb.base.closer_commissions[0]).toMatchObject({ statut: 'payee', note: NOTE_REMBOURSEE_APRES_PAIEMENT })
  })

  it('remboursement partiel : une note, le statut ne bouge pas', async () => {
    const sb = fauxSupabase({ commissions: [commission('a_valider')] })
    await traiterRemboursement(fauxStripe({ charge: { ...CHARGE, refunded: false, amount_refunded: 1000 } }), sb, 'ch_100')
    expect(sb.base.closer_commissions[0]).toMatchObject({ statut: 'a_valider', note: 'Remboursement partiel de 10,00 € par le client' })
  })

  it('l’écriture ne touche que la commission encore dans l’état lu', async () => {
    const sb = fauxSupabase({ commissions: [commission('validee')] })
    await traiterRemboursement(fauxStripe(), sb, 'ch_100')
    const ecriture = sb.journal.find((j) => j.table === 'closer_commissions' && j.operation === 'update')
    expect(ecriture.filtres).toContainEqual(['eq', 'statut', 'validee'])
  })

  it('une charge sans paiement ni facture : rien', async () => {
    const sb = fauxSupabase({ commissions: [commission('a_valider')] })
    expect(await traiterRemboursement(fauxStripe({ charge: { ...CHARGE, payment_intent: null } }), sb, 'ch_100')).toEqual({ touchees: 0, raison: 'sans_paiement' })
    expect(await traiterRemboursement(fauxStripe({ paiements: { data: [] } }), sb, 'ch_100')).toEqual({ touchees: 0, raison: 'hors_facture' })
    expect(sb.base.closer_commissions[0].statut).toBe('a_valider')
  })
})

describe('le webhook branche invoice.paid et charge.refunded', () => {
  // Le vrai webhook est chargé, ses dépendances externes remplacées pour ce
  // bloc seulement (vi.doMock) — même montage que api/lib/subscription-plan.test.js.
  const w = { stripe: null, supabase: null, evenement: null }
  const MODULES = ['./sentry.js', '../marketplace/install.js', './amplitude.js', 'resend', '@supabase/supabase-js', 'stripe']
  const secretAvant = process.env.STRIPE_WEBHOOK_SECRET
  let webhook

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    vi.resetModules()
    vi.doMock('./sentry.js', () => ({ withSentry: (fn) => fn, captureError: () => {} }))
    vi.doMock('../marketplace/install.js', () => ({ finalizeInstall: async () => {} }))
    vi.doMock('./amplitude.js', () => ({ trackServerEvent: async () => {} }))
    vi.doMock('resend', () => ({ Resend: function Resend() { return { emails: { send: async () => ({}) } } } }))
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => new Proxy({}, { get: (_, cle) => w.supabase[cle] }) }))
    vi.doMock('stripe', () => ({ default: function FauxStripe() { return new Proxy({}, { get: (_, cle) => w.stripe[cle] }) } }))
    ;({ default: webhook } = await import('../stripe-webhook.js'))
  })

  afterAll(() => {
    for (const module of MODULES) vi.doUnmock(module)
    vi.resetModules()
    if (secretAvant === undefined) delete process.env.STRIPE_WEBHOOK_SECRET
    else process.env.STRIPE_WEBHOOK_SECRET = secretAvant
  })

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => vi.restoreAllMocks())

  function monde(options) {
    w.supabase = creerFauxSupabase({
      tables: {
        clients: [{ id: CLIENT_ID, closer_id: 'k1', stripe_subscription_id: 'sub_100' }],
        closer_commissions: options?.commissions ?? [],
        webhook_events_processed: [],
      },
      uniques: { closer_commissions: ['source_key'], webhook_events_processed: ['event_id'] },
      erreurs: options?.erreurs,
    })
    const stripe = fauxStripe({ factures: { in_100: facture() }, lignesParFacture: { in_100: lignes(PRIX_PRO_MENSUEL) } })
    w.stripe = { ...stripe, webhooks: { constructEvent: vi.fn(() => w.evenement) } }
  }

  async function livrer(evenement) {
    w.evenement = evenement
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this }, json(b) { this.body = b; return this } }
    await webhook({
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=signature' },
      async *[Symbol.asyncIterator]() { yield Buffer.from('{}') },
    }, res)
    return res
  }

  // Objet d'événement volontairement minimal : le webhook n'en lit que l'identifiant.
  const facturePayee = (id) => ({ id, type: 'invoice.paid', data: { object: { id: 'in_100', object: 'invoice' } } })
  const chargeRemboursee = (id) => ({ id, type: 'charge.refunded', data: { object: { id: 'ch_100', object: 'charge' } } })

  it('le même invoice.paid reçu deux fois : une seule commission', async () => {
    monde()
    expect((await livrer(facturePayee('evt_1'))).statusCode).toBe(200)
    expect((await livrer(facturePayee('evt_1'))).body).toEqual({ received: true, duplicate: true })
    expect(w.supabase.base.closer_commissions).toHaveLength(1)
  })

  it('deux événements différents pour la même facture : une seule commission', async () => {
    monde()
    await livrer(facturePayee('evt_1'))
    expect((await livrer(facturePayee('evt_2'))).statusCode).toBe(200)
    expect(w.supabase.base.closer_commissions).toHaveLength(1)
  })

  it('une écriture ratée : 500, et l’événement est libéré pour que Stripe réessaie', async () => {
    monde({ erreurs: { closer_commissions: ({ operation }) => (operation === 'insert' ? { message: 'disque plein' } : null) } })
    const res = await livrer(facturePayee('evt_3'))
    expect(res.statusCode).toBe(500)
    expect(w.supabase.base.webhook_events_processed).toEqual([])
  })

  it('charge.refunded : la commission à valider passe annulée', async () => {
    monde({ commissions: [{ id: 'kc1', source_key: 'stripe:in_100', stripe_invoice_id: 'in_100', statut: 'a_valider', note: null }] })
    expect((await livrer(chargeRemboursee('evt_4'))).statusCode).toBe(200)
    expect(w.supabase.base.closer_commissions[0].statut).toBe('annulee')
  })

  it('les deux branches libèrent l’événement et répondent 500 sur une erreur', () => {
    const source = readFileSync('api/stripe-webhook.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const [evenement, appel] of [['invoice.paid', 'traiterFacturePayee('], ['charge.refunded', 'traiterRemboursement(']]) {
      const debut = source.indexOf(`case '${evenement}'`)
      expect(debut, evenement).toBeGreaterThan(-1)
      const fin = source.indexOf("case '", debut + 1)
      const bloc = source.slice(debut, fin === -1 ? undefined : fin)
      expect(bloc, evenement).toContain(appel)
      expect(bloc, evenement).toMatch(/webhook_events_processed[\s\S]*\.delete\(\)[\s\S]*status\(500\)/)
    }
  })
})
