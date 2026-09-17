import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { creerFauxSupabase, appeler } from './faux-supabase.js'
import { encryptToken } from './crypto.js'
import { STATUTS_COMMISSION, moisCourant } from './commissions-closer.js'
import { OPTIONS_STRIPE_COMMISSIONS } from './commissions-stripe.js'
import { FORMAT_CODE_CLOSER } from './code-closer.js'

/**
 * Les routes admin du programme closers — requireAdmin, saisie manuelle,
 * validation, paiement, rejeu des factures, IBAN journalisé, attributions.
 */

const h = vi.hoisted(() => ({ supabase: null, stripe: null }))

vi.mock('./sentry.js', () => ({ withSentry: (fn) => fn, captureError: () => {} }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => new Proxy({}, { get: (_, cle) => h.supabase[cle] }),
}))
// Le rejeu des factures lit Stripe : un faux, jamais le réseau.
vi.mock('stripe', () => ({
  default: function FauxStripe() { return new Proxy({}, { get: (_, cle) => h.stripe[cle] }) },
}))

const closersRoute = (await import('../admin/closers.js')).default
const commissionsRoute = (await import('../admin/closer-commissions.js')).default
const ibanRoute = (await import('../admin/closer-iban.js')).default
const attributionRoute = (await import('../admin/closer-attribution.js')).default

const ADMIN = { id: 'admin-1', email: 'pablo@actero.fr', app_metadata: { role: 'admin' } }
const MARCHAND = { id: 'u-m', email: 'marchand@ex.com', app_metadata: {} }
const IBAN = 'FR7630006000011234567890189'
const MOIS = moisCourant()

const COMPLET = { telephone: '0611111111', siret: '73282932000074', titulaire_iban: 'Alice Aubert' }

function monde({ erreurs } = {}) {
  h.supabase = creerFauxSupabase({
    tables: {
      profiles: [{ id: 'u-m', role: 'client' }],
      admin_users: [],
      admin_action_logs: [],
      closers: [
        { id: 'k-a', user_id: 'u-a', prenom: 'Alice', nom: 'Aubert', email: 'alice@ex.com', code: 'ACT-AAAAA', statut: 'actif', ...COMPLET, iban_chiffre: encryptToken(IBAN), created_at: '2026-09-01T00:00:00Z' },
        { id: 'k-b', user_id: 'u-b', prenom: 'Bruno', nom: 'Bernard', email: 'bruno@ex.com', code: 'ACT-BBBBB', statut: 'actif', telephone: null, siret: null, titulaire_iban: null, iban_chiffre: null, created_at: '2026-09-02T00:00:00Z' },
      ],
      clients: [
        { id: 'c-stripe', brand_name: 'Stripe Shop', contact_email: 'stripe@shop.fr', plan: 'pro', status: 'active', billing_period: 'monthly', billing_provider: 'stripe', stripe_subscription_id: 'sub_1', closer_id: 'k-a', closer_source: 'lien', closer_attribue_at: '2026-09-03T00:00:00Z' },
        { id: 'c-shopify', brand_name: 'Shopify Shop', contact_email: 'shopify@shop.fr', plan: 'pro', status: 'active', billing_period: 'monthly', billing_provider: 'shopify', stripe_subscription_id: null, closer_id: 'k-a', closer_source: 'manuel', closer_attribue_at: '2026-09-04T00:00:00Z' },
        { id: 'c-libre', brand_name: 'Libre Shop', contact_email: 'libre@shop.fr', plan: 'pro', status: 'active', billing_period: 'monthly', billing_provider: 'stripe', stripe_subscription_id: 'sub_2', closer_id: null, closer_source: null, closer_attribue_at: null },
      ],
      client_shopify_connections: [{ client_id: 'c-shopify', shop_domain: 'shop.myshopify.com' }],
      closer_commissions: [
        { id: 'kc-1', closer_id: 'k-a', client_id: 'c-stripe', montant_centimes: 10000, plan: 'pro', formule: 'mensuel', type: 'mensuelle', source: 'stripe', source_key: 'stripe:in_1', statut: 'a_valider', payee_par_client_le: '2026-09-05T10:00:00.000Z', note: null, created_at: '2026-09-05T10:00:01Z' },
        { id: 'kc-2', closer_id: 'k-b', client_id: 'c-stripe', montant_centimes: 2500, plan: 'starter', formule: 'mensuel', type: 'mensuelle', source: 'stripe', source_key: 'stripe:in_0', statut: 'validee', payee_par_client_le: null, note: null, created_at: '2026-08-05T10:00:01Z' },
        { id: 'kc-3', closer_id: 'k-a', client_id: 'c-stripe', montant_centimes: 10000, plan: 'pro', formule: 'mensuel', type: 'mensuelle', source: 'stripe', source_key: 'stripe:in_2', statut: 'validee', payee_par_client_le: null, note: null, created_at: '2026-08-06T10:00:01Z' },
      ],
    },
    uniques: { closer_commissions: ['source_key'] },
    comptes: { 'jeton-admin': ADMIN, 'jeton-marchand': MARCHAND },
    erreurs,
  })
  return h.supabase
}

const admin = (route, options) => appeler(route, { jeton: 'jeton-admin', ...options })

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('réservé aux admins', () => {
  it.each([
    ['closers', closersRoute, 'GET'],
    ['closers', closersRoute, 'PATCH'],
    ['closer-commissions', commissionsRoute, 'GET'],
    ['closer-commissions', commissionsRoute, 'POST'],
    ['closer-commissions', commissionsRoute, 'PATCH'],
    ['closer-iban', ibanRoute, 'GET'],
    ['closer-attribution', attributionRoute, 'GET'],
    ['closer-attribution', attributionRoute, 'PATCH'],
  ])('/api/admin/%s (%s) : 401 sans jeton, 403 pour un marchand, rien d’écrit', async (_nom, route, methode) => {
    const sb = monde()
    const corps = { closer_id: 'k-a', client_id: 'c-libre', id: 'kc-1', action: 'valider', formule: 'mensuel', montant_centimes: 100, mois: MOIS, note: 'test' }
    expect((await appeler(route, { methode, corps, query: { closer_id: 'k-a' } })).statusCode).toBe(401)
    const res = await appeler(route, { methode, jeton: 'jeton-marchand', corps, query: { closer_id: 'k-a' } })
    expect(res.statusCode).toBe(403)
    expect(JSON.stringify(res.body)).not.toContain(IBAN)
    expect(sb.journal.filter((j) => ['insert', 'update'].includes(j.operation))).toEqual([])
  })
})

describe('GET/PATCH /api/admin/closers', () => {
  it('les closers avec leurs totaux, leurs clients, et jamais l’IBAN en clair', async () => {
    monde()
    const res = await admin(closersRoute)
    expect(res.statusCode).toBe(200)
    const alice = res.body.closers.find((k) => k.id === 'k-a')
    expect(alice).toMatchObject({ code: 'ACT-AAAAA', nb_clients: 2, profil_complet: true, iban_masque: '•••• 0189' })
    expect(alice.totaux).toMatchObject({ a_valider: 10000, validee: 10000 })
    expect(res.body.closers.find((k) => k.id === 'k-b')).toMatchObject({ nb_clients: 0, profil_complet: false, iban_masque: null })
    const texte = JSON.stringify(res.body)
    expect(texte).not.toContain(IBAN)
    expect(texte).not.toContain('enc:v1:')
    expect(res.body.mois_courant).toBe(MOIS)
  })

  it('les clients Shopify dont la mensualité du mois manque sont en tête', async () => {
    monde()
    const { body } = await admin(closersRoute)
    expect(body.clients.map((c) => c.id)).toEqual(['c-shopify', 'c-stripe'])
    expect(body.clients[0]).toMatchObject({ facturation: 'shopify', formule: 'mensuel', montant_pre_rempli: 10000, mensualite_du_mois_saisie: false })
    expect(body.clients[1]).toMatchObject({ facturation: 'stripe', etat: 'actif' })
  })

  it('une fois la mensualité du mois saisie, le client Shopify n’est plus en tête', async () => {
    const sb = monde()
    sb.base.closer_commissions.push({ id: 'kc-9', closer_id: 'k-a', client_id: 'c-shopify', montant_centimes: 10000, statut: 'a_valider', source_key: `manuel:c-shopify:${MOIS}` })
    const { body } = await admin(closersRoute)
    expect(body.clients.find((c) => c.id === 'c-shopify').mensualite_du_mois_saisie).toBe(true)
  })

  it('suspendre puis réactiver', async () => {
    const sb = monde()
    expect((await admin(closersRoute, { methode: 'PATCH', corps: { closer_id: 'k-a', action: 'suspendre' } })).body.closer).toEqual({ id: 'k-a', statut: 'suspendu' })
    expect(sb.base.closers.find((k) => k.id === 'k-a').statut).toBe('suspendu')
    await admin(closersRoute, { methode: 'PATCH', corps: { closer_id: 'k-a', action: 'reactiver' } })
    expect(sb.base.closers.find((k) => k.id === 'k-a').statut).toBe('actif')
    expect(sb.base.admin_action_logs.map((l) => l.action)).toEqual(['closer_suspendre', 'closer_reactiver'])
  })

  it('action inconnue : 400 ; closer inconnu : 404', async () => {
    monde()
    expect((await admin(closersRoute, { methode: 'PATCH', corps: { closer_id: 'k-a', action: 'supprimer' } })).statusCode).toBe(400)
    expect((await admin(closersRoute, { methode: 'PATCH', corps: { closer_id: 'k-z', action: 'suspendre' } })).statusCode).toBe(404)
  })
})

describe('/api/admin/closer-commissions', () => {
  it('la file à valider, avec son contexte et « remboursable jusqu’au »', async () => {
    monde()
    const res = await admin(commissionsRoute, { query: { statut: 'a_valider' } })
    expect(res.statusCode).toBe(200)
    expect(res.body.commissions).toHaveLength(1)
    expect(res.body.commissions[0]).toMatchObject({
      id: 'kc-1', boutique: 'Stripe Shop', montant_centimes: 10000,
      closer: { id: 'k-a', prenom: 'Alice', code: 'ACT-AAAAA', profil_complet: true },
      remboursable_jusqu_au: '2026-10-05T10:00:00.000Z',
    })
    expect(JSON.stringify(res.body)).not.toContain('enc:v1:')
  })

  it('statut inconnu : 400', async () => {
    monde()
    expect((await admin(commissionsRoute, { query: { statut: 'toutes' } })).statusCode).toBe(400)
  })

  it('chaque commission expose le montant payé, la note et ses signaux', async () => {
    const sb = monde()
    const alice = sb.base.closers.find((k) => k.id === 'k-a')
    Object.assign(alice, { statut: 'suspendu', iban_modifie_le: new Date(Date.now() - 3_600_000).toISOString() })
    sb.base.clients.push({ id: 'c-auto', brand_name: 'Auto Shop', contact_email: ' ALICE@ex.com', plan: 'pro', billing_provider: 'stripe', stripe_subscription_id: 'sub_9', closer_id: 'k-a' })
    sb.base.closer_commissions.push({
      id: 'kc-4', closer_id: 'k-a', client_id: 'c-auto', montant_centimes: 10000, montant_facture_centimes: 3990, plan: 'pro', formule: 'mensuel',
      type: 'mensuelle', source: 'stripe', source_key: 'stripe:in_9', stripe_invoice_id: 'in_9', statut: 'a_valider',
      note: 'Commission supérieure au montant payé (39,90 €) : à vérifier', created_at: '2026-09-06T10:00:00Z',
    })

    const res = await admin(commissionsRoute, { query: { statut: 'a_valider' } })
    expect(res.statusCode).toBe(200)
    expect(res.body.tronque).toBe(false)
    const [kc4, kc1] = res.body.commissions
    expect(kc4).toMatchObject({
      id: 'kc-4', boutique: 'Auto Shop', montant_facture_centimes: 3990,
      note: 'Commission supérieure au montant payé (39,90 €) : à vérifier',
      signaux: ['meme_email', 'meme_domaine', 'iban_recent', 'closer_suspendu'],
    })
    expect(kc1).toMatchObject({ id: 'kc-1', montant_facture_centimes: null, note: null, signaux: ['iban_recent', 'closer_suspendu'] })
    // Les e-mails servent au calcul : ils ne sortent pas de la route.
    expect(JSON.stringify(res.body)).not.toMatch(/alice@ex\.com|stripe@shop\.fr/i)
  })

  it('sans signal : un tableau vide ; client effacé : aucun signal d’e-mail', async () => {
    const sb = monde()
    sb.base.closer_commissions.push({ id: 'kc-5', closer_id: 'k-a', client_id: null, montant_centimes: 2500, statut: 'a_valider', source_key: 'unique:efface', created_at: '2026-09-01T00:00:00Z' })
    const { body } = await admin(commissionsRoute, { query: { statut: 'a_valider' } })
    expect(body.commissions.map((c) => [c.id, c.boutique, c.signaux])).toEqual([
      ['kc-1', 'Stripe Shop', []],
      ['kc-5', 'Client supprimé', []],
    ])
  })

  it('au-delà de 500 lignes : la liste est coupée, et le dit', async () => {
    const sb = monde()
    for (let i = 0; i < 500; i += 1) {
      sb.base.closer_commissions.push({ id: `kc-x${i}`, closer_id: 'k-b', client_id: 'c-stripe', montant_centimes: 2500, statut: 'a_valider', source_key: `stripe:in_x${i}`, created_at: '2026-07-01T00:00:00Z' })
    }
    const coupee = await admin(commissionsRoute, { query: { statut: 'a_valider' } })
    expect(coupee.body.commissions).toHaveLength(500)
    expect(coupee.body.tronque).toBe(true)
    sb.base.closer_commissions.pop()
    const pleine = await admin(commissionsRoute, { query: { statut: 'a_valider' } })
    expect(pleine.body.commissions).toHaveLength(500)
    expect(pleine.body.tronque).toBe(false)
  })

  it('saisie manuelle Shopify : créée, puis refusée le même mois', async () => {
    const sb = monde()
    const corps = { client_id: 'c-shopify', formule: 'mensuel', montant_centimes: 10000, mois: '2026-09', note: 'Shopify septembre' }
    const res = await admin(commissionsRoute, { methode: 'POST', corps })
    expect(res.statusCode).toBe(201)
    expect(res.body.commission).toMatchObject({ source_key: 'manuel:c-shopify:2026-09', statut: 'a_valider' })
    expect(sb.base.closer_commissions.at(-1)).toMatchObject({ closer_id: 'k-a', source: 'manuel', note: 'Shopify septembre' })
    const doublon = await admin(commissionsRoute, { methode: 'POST', corps })
    expect(doublon.statusCode).toBe(409)
    expect(doublon.body.error).toBe('deja_saisie')
  })

  it('saisie refusée : client Stripe du catalogue, client non rattaché, note absente', async () => {
    monde()
    const base = { formule: 'mensuel', montant_centimes: 10000, mois: '2026-09', note: 'x'.repeat(5) }
    expect((await admin(commissionsRoute, { methode: 'POST', corps: { ...base, client_id: 'c-stripe' } })).body.error).toBe('commission_automatique')
    expect((await admin(commissionsRoute, { methode: 'POST', corps: { ...base, client_id: 'c-libre' } })).statusCode).toBe(409)
    expect((await admin(commissionsRoute, { methode: 'POST', corps: { ...base, client_id: 'c-shopify', note: '' } })).statusCode).toBe(400)
    expect((await admin(commissionsRoute, { methode: 'POST', corps: { ...base, client_id: 'c-inconnu' } })).statusCode).toBe(404)
  })

  it('valider : validée, par cet admin', async () => {
    const sb = monde()
    const res = await admin(commissionsRoute, { methode: 'PATCH', corps: { id: 'kc-1', action: 'valider' } })
    expect(res.statusCode).toBe(200)
    expect(sb.base.closer_commissions.find((c) => c.id === 'kc-1')).toMatchObject({ statut: 'validee', validee_par: 'admin-1' })
  })

  it('refuser exige une note', async () => {
    const sb = monde()
    expect((await admin(commissionsRoute, { methode: 'PATCH', corps: { id: 'kc-1', action: 'refuser' } })).statusCode).toBe(400)
    await admin(commissionsRoute, { methode: 'PATCH', corps: { id: 'kc-1', action: 'refuser', note: 'Client de test' } })
    expect(sb.base.closer_commissions.find((c) => c.id === 'kc-1')).toMatchObject({ statut: 'refusee', note: 'Client de test' })
  })

  it('marquer payée : refusé si le profil de paiement du closer est incomplet', async () => {
    const sb = monde()
    const incomplet = await admin(commissionsRoute, { methode: 'PATCH', corps: { id: 'kc-2', action: 'marquer_payee' } })
    expect(incomplet.statusCode).toBe(409)
    expect(incomplet.body.error).toBe('profil_incomplet')
    expect(sb.base.closer_commissions.find((c) => c.id === 'kc-2').statut).toBe('validee')
    const complet = await admin(commissionsRoute, { methode: 'PATCH', corps: { id: 'kc-3', action: 'marquer_payee' } })
    expect(complet.statusCode).toBe(200)
    expect(sb.base.closer_commissions.find((c) => c.id === 'kc-3').statut).toBe('payee')
  })

  it('une commission qui a changé entre-temps n’est pas écrasée', async () => {
    const sb = monde({
      erreurs: {
        closer_commissions: ({ operation }) => {
          if (operation === 'update') sb.base.closer_commissions.find((c) => c.id === 'kc-1').statut = 'annulee'
          return null
        },
      },
    })
    const res = await admin(commissionsRoute, { methode: 'PATCH', corps: { id: 'kc-1', action: 'valider' } })
    expect(res.statusCode).toBe(409)
    expect(sb.base.closer_commissions.find((c) => c.id === 'kc-1').statut).toBe('annulee')
  })

  it('statut incompatible : 409 ; commission inconnue : 404', async () => {
    monde()
    expect((await admin(commissionsRoute, { methode: 'PATCH', corps: { id: 'kc-2', action: 'valider' } })).statusCode).toBe(409)
    expect((await admin(commissionsRoute, { methode: 'PATCH', corps: { id: 'kc-z', action: 'valider' } })).statusCode).toBe(404)
  })
})

describe('POST /api/admin/closer-commissions { action: rejouer_factures } — relire les factures d’un client', () => {
  // Forme de l'API 2026-02-25.clover, comme dans commissions-stripe.test.js.
  const PRIX_PRO_MENSUEL = { id: 'price_pro_m', object: 'price', lookup_key: 'actero_pro_mensuel', unit_amount: 39900, currency: 'eur', recurring: { interval: 'month', interval_count: 1 } }
  const PRIX_SUR_MESURE = { ...PRIX_PRO_MENSUEL, id: 'price_acme', lookup_key: 'actero_enterprise_acme' }

  const factureStripe = (id, created, billing_reason = 'subscription_cycle') => ({
    id, object: 'invoice', created, status: 'paid', amount_paid: 39900, currency: 'eur', billing_reason, customer: 'cus_1',
    parent: { type: 'subscription_details', quote_details: null, subscription_details: { subscription: 'sub_1', metadata: {} } },
    status_transitions: { finalized_at: created, paid_at: created, marked_uncollectible_at: null, voided_at: null },
  })
  const lignesStripe = (prix) => ({
    object: 'list',
    has_more: false,
    data: [{
      id: `il_${prix.id}`,
      object: 'line_item',
      parent: { type: 'subscription_item_details', subscription_item_details: { proration: false, subscription: 'sub_1' } },
      pricing: { type: 'price_details', price_details: { price: prix, product: 'prod_1' } },
    }],
  })

  const FACTURES = [
    factureStripe('in_r1', 1_788_000_000, 'subscription_create'),
    factureStripe('in_r2', 1_790_000_000),
    factureStripe('in_r3', 1_792_000_000),
  ]
  const LIGNES = { in_r1: lignesStripe(PRIX_PRO_MENSUEL), in_r2: lignesStripe(PRIX_PRO_MENSUEL), in_r3: lignesStripe(PRIX_SUR_MESURE) }

  function mondeStripe(factures = FACTURES, lignes = LIGNES) {
    h.stripe = {
      invoices: {
        // Stripe rend les plus récentes d'abord.
        list: vi.fn(async () => ({ object: 'list', has_more: false, data: [...factures].reverse() })),
        retrieve: vi.fn(async (id) => factures.find((f) => f.id === id)),
        listLineItems: vi.fn(async (id) => lignes[id]),
      },
      invoicePayments: { list: vi.fn(async () => ({ object: 'list', has_more: false, data: [{ id: 'inpay_1', status: 'paid', payment: { type: 'payment_intent', payment_intent: 'pi_1' } }] })) },
      paymentIntents: { retrieve: vi.fn(async () => ({ id: 'pi_1', object: 'payment_intent', latest_charge: { id: 'ch_1', object: 'charge', amount: 39900, amount_refunded: 0, refunded: false } })) },
      charges: { retrieve: vi.fn() },
    }
    return h.stripe
  }

  const rejouer = (clientId) => admin(commissionsRoute, { methode: 'POST', corps: { action: 'rejouer_factures', client_id: clientId } })
  const creeesParLeRejeu = (sb) => sb.base.closer_commissions.filter((c) => String(c.stripe_invoice_id).startsWith('in_r'))

  beforeEach(() => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_faux')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('relit les factures payées de l’abonnement et les traite de la plus ancienne à la plus récente', async () => {
    const sb = monde()
    const stripe = mondeStripe()
    const res = await rejouer('c-stripe')
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      resultats: [
        { facture: 'in_r1', issue: 'creee' },
        { facture: 'in_r2', issue: 'creee' },
        { facture: 'in_r3', issue: 'hors_grille' },
      ],
    })
    expect(stripe.invoices.list).toHaveBeenCalledTimes(1)
    expect(stripe.invoices.list).toHaveBeenCalledWith({ subscription: 'sub_1', status: 'paid', limit: 100 }, OPTIONS_STRIPE_COMMISSIONS)
    expect(creeesParLeRejeu(sb)).toEqual([
      expect.objectContaining({ source_key: 'stripe:in_r1', closer_id: 'k-a', client_id: 'c-stripe', statut: 'a_valider', montant_centimes: 10000, montant_facture_centimes: 39900 }),
      expect.objectContaining({ source_key: 'stripe:in_r2', statut: 'a_valider' }),
    ])
    expect(sb.base.admin_action_logs).toHaveLength(1)
    expect(sb.base.admin_action_logs[0]).toMatchObject({
      actor_id: 'admin-1', actor_email: 'pablo@actero.fr', action: 'closer_commissions_rejouees',
      target_type: 'client', target_id: 'c-stripe', client_id: 'c-stripe', metadata: { factures: 3, creees: 2 },
    })
  })

  it('un second appel ne crée rien de plus, et ne relit pas les factures qui ont déjà leur commission', async () => {
    const sb = monde()
    const stripe = mondeStripe()
    await rejouer('c-stripe')
    const avant = sb.base.closer_commissions.length
    stripe.invoices.retrieve.mockClear()
    const res = await rejouer('c-stripe')
    expect(res.statusCode).toBe(200)
    expect(res.body.resultats).toEqual([
      { facture: 'in_r1', issue: 'deja_creee' },
      { facture: 'in_r2', issue: 'deja_creee' },
      { facture: 'in_r3', issue: 'hors_grille' },
    ])
    expect(sb.base.closer_commissions).toHaveLength(avant)
    expect(stripe.invoices.retrieve.mock.calls.map(([id]) => id)).toEqual(['in_r3'])
    expect(sb.base.admin_action_logs.at(-1).metadata).toEqual({ factures: 3, creees: 0 })
  })

  it('sans abonnement enregistré : les factures du client Stripe', async () => {
    const sb = monde()
    sb.base.clients.push({ id: 'c-cus', brand_name: 'Cus Shop', plan: 'pro', billing_provider: 'stripe', stripe_subscription_id: null, stripe_customer_id: 'cus_9', closer_id: 'k-a' })
    const stripe = mondeStripe([], {})
    const res = await rejouer('c-cus')
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ resultats: [] })
    expect(stripe.invoices.list).toHaveBeenCalledWith({ customer: 'cus_9', status: 'paid', limit: 100 }, OPTIONS_STRIPE_COMMISSIONS)
  })

  it('une facture en panne n’arrête pas les suivantes', async () => {
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sb = monde({
      erreurs: { closer_commissions: ({ operation, charge }) => (operation === 'insert' && charge?.stripe_invoice_id === 'in_r1' ? { message: 'disque plein' } : null) },
    })
    mondeStripe()
    const res = await rejouer('c-stripe')
    expect(res.statusCode).toBe(200)
    expect(res.body.resultats.map((r) => r.issue)).toEqual(['erreur', 'creee', 'hors_grille'])
    expect(creeesParLeRejeu(sb).map((c) => c.source_key)).toEqual(['stripe:in_r2'])
    expect(erreur).toHaveBeenCalledWith('[CLOSER] rejeu : facture non traitée', expect.objectContaining({ facture: 'in_r1', client: 'c-stripe' }))
  })

  it.each([
    ['client absent', undefined, 400, 'client_requis'],
    ['client inconnu', 'c-inconnu', 404, 'client_introuvable'],
    ['client sans closer', 'c-libre', 409, 'client_non_rattache'],
    ['client sans Stripe', 'c-shopify', 409, 'client_sans_stripe'],
  ])('%s (%s) : %i %s, sans appel à Stripe ni trace', async (_cas, clientId, statut, code) => {
    const sb = monde()
    const stripe = mondeStripe()
    const res = await rejouer(clientId)
    expect(res.statusCode).toBe(statut)
    expect(res.body).toEqual({ error: code, message: expect.any(String) })
    expect(stripe.invoices.list).not.toHaveBeenCalled()
    expect(sb.base.admin_action_logs).toEqual([])
  })

  it('Stripe non configuré : 503, sans appel', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    monde()
    const stripe = mondeStripe()
    const res = await rejouer('c-stripe')
    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ error: 'stripe_non_configure', message: expect.any(String) })
    expect(stripe.invoices.list).not.toHaveBeenCalled()
  })

  it('Stripe ne répond pas : 503 indisponible, rien d’écrit ni de journalisé', async () => {
    const sb = monde()
    const stripe = mondeStripe()
    stripe.invoices.list.mockRejectedValueOnce(new Error('Stripe indisponible'))
    const res = await rejouer('c-stripe')
    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ error: 'indisponible', message: 'Stripe indisponible' })
    expect(creeesParLeRejeu(sb)).toEqual([])
    expect(sb.base.admin_action_logs).toEqual([])
  })

  it('lecture du client impossible : 503 indisponible', async () => {
    monde({ erreurs: { clients: { message: 'panne' } } })
    mondeStripe()
    const res = await rejouer('c-stripe')
    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ error: 'indisponible', message: 'panne' })
  })

  it('une action POST inconnue : 400 action_inconnue ; sans action, c’est toujours la saisie manuelle', async () => {
    const sb = monde()
    const stripe = mondeStripe()
    const inconnue = await admin(commissionsRoute, { methode: 'POST', corps: { action: 'tout_rejouer', client_id: 'c-stripe' } })
    expect(inconnue.statusCode).toBe(400)
    expect(inconnue.body).toEqual({ error: 'action_inconnue', message: 'Action inconnue.' })
    const saisie = await admin(commissionsRoute, { methode: 'POST', corps: { client_id: 'c-shopify', formule: 'mensuel', montant_centimes: 10000, mois: '2026-09', note: 'Shopify septembre' } })
    expect(saisie.statusCode).toBe(201)
    expect(stripe.invoices.list).not.toHaveBeenCalled()
    expect(sb.base.admin_action_logs.map((l) => l.action)).toEqual(['closer_commission_saisie'])
  })

  it('réservé aux admins : 401 sans jeton, 403 pour un marchand, Stripe jamais appelé', async () => {
    const sb = monde()
    const stripe = mondeStripe()
    const corps = { action: 'rejouer_factures', client_id: 'c-stripe' }
    expect((await appeler(commissionsRoute, { methode: 'POST', corps })).statusCode).toBe(401)
    expect((await appeler(commissionsRoute, { methode: 'POST', jeton: 'jeton-marchand', corps })).statusCode).toBe(403)
    expect(stripe.invoices.list).not.toHaveBeenCalled()
    expect(creeesParLeRejeu(sb)).toEqual([])
  })
})

describe('GET /api/admin/closer-iban — lu en clair, et journalisé', () => {
  it('rend l’IBAN et laisse une trace, sans cache', async () => {
    const sb = monde()
    const res = await admin(ibanRoute, { query: { closer_id: 'k-a' } })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ iban: IBAN, titulaire: 'Alice Aubert' })
    expect(res.headers['cache-control']).toBe('no-store')
    expect(sb.base.admin_action_logs).toHaveLength(1)
    expect(sb.base.admin_action_logs[0]).toMatchObject({ actor_id: 'admin-1', action: 'closer_iban_lu', target_type: 'closer', target_id: 'k-a' })
  })

  it('sans trace écrite, pas d’IBAN', async () => {
    monde({ erreurs: { admin_action_logs: { message: 'panne' } } })
    const res = await admin(ibanRoute, { query: { closer_id: 'k-a' } })
    expect(res.statusCode).toBe(503)
    expect(JSON.stringify(res.body)).not.toContain(IBAN)
  })

  it('pas d’IBAN renseigné : 404, et aucune trace', async () => {
    const sb = monde()
    expect((await admin(ibanRoute, { query: { closer_id: 'k-b' } })).statusCode).toBe(404)
    expect(sb.base.admin_action_logs).toEqual([])
  })
})

describe('/api/admin/closer-attribution — décision d’Actero, sans les règles du lien', () => {
  it('rattache un client, même payant, avec la source « manuel »', async () => {
    const sb = monde()
    const res = await admin(attributionRoute, { methode: 'PATCH', corps: { client_id: 'c-libre', closer_id: 'k-b' } })
    expect(res.statusCode).toBe(200)
    expect(sb.base.clients.find((c) => c.id === 'c-libre')).toMatchObject({ closer_id: 'k-b', closer_source: 'manuel' })
  })

  it('change de closer sans toucher aux commissions déjà créées', async () => {
    const sb = monde()
    await admin(attributionRoute, { methode: 'PATCH', corps: { client_id: 'c-stripe', closer_id: 'k-b' } })
    expect(sb.base.clients.find((c) => c.id === 'c-stripe').closer_id).toBe('k-b')
    expect(sb.base.closer_commissions.find((c) => c.id === 'kc-1').closer_id).toBe('k-a')
    expect(sb.base.admin_action_logs.at(-1)).toMatchObject({ action: 'closer_attribution', metadata: { avant: 'k-a', apres: 'k-b' } })
  })

  it('retire le closer : les trois colonnes reviennent à vide', async () => {
    const sb = monde()
    await admin(attributionRoute, { methode: 'PATCH', corps: { client_id: 'c-stripe', closer_id: null } })
    expect(sb.base.clients.find((c) => c.id === 'c-stripe')).toMatchObject({ closer_id: null, closer_source: null, closer_attribue_at: null })
  })

  it('client ou closer inconnu : 404 ; closer_id absent : 400', async () => {
    monde()
    expect((await admin(attributionRoute, { methode: 'PATCH', corps: { client_id: 'c-z', closer_id: 'k-a' } })).statusCode).toBe(404)
    expect((await admin(attributionRoute, { methode: 'PATCH', corps: { client_id: 'c-libre', closer_id: 'k-z' } })).statusCode).toBe(404)
    expect((await admin(attributionRoute, { methode: 'PATCH', corps: { client_id: 'c-libre' } })).statusCode).toBe(400)
  })

  it('recherche par boutique ou par e-mail, avec la liste des closers', async () => {
    monde()
    const res = await admin(attributionRoute, { query: { q: 'shop.fr' } })
    expect(res.body.clients.map((c) => c.id).sort()).toEqual(['c-libre', 'c-shopify', 'c-stripe'])
    expect(res.body.closers.map((k) => k.code)).toEqual(['ACT-AAAAA', 'ACT-BBBBB'])
    const court = await admin(attributionRoute, { query: { q: 'S%' } })
    expect(court.body.clients).toEqual([])
  })
})

describe('le code et la base disent la même chose', () => {
  const [fichier] = readdirSync('supabase/migrations').filter((f) => f.endsWith('_programme_closers.sql'))
  const sql = readFileSync(`supabase/migrations/${fichier}`, 'utf8')

  it('les statuts de commission', () => {
    const bloc = sql.match(/check \(statut in \('a_valider'[^)]*\)\)/)?.[0] ?? ''
    expect([...bloc.matchAll(/'(\w+)'/g)].map((m) => m[1])).toEqual([...STATUTS_COMMISSION])
  })

  it('le format du code closer', () => {
    expect(sql.match(/check \(code ~ '([^']+)'\)/)?.[1]).toBe(FORMAT_CODE_CLOSER.source)
  })
})
