import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { creerFauxSupabase, appeler } from './faux-supabase.js'
import { encryptToken } from './crypto.js'
import { STATUTS_COMMISSION, moisCourant } from './commissions-closer.js'
import { FORMAT_CODE_CLOSER } from './code-closer.js'

/**
 * Les routes admin du programme closers — requireAdmin, saisie manuelle,
 * validation, paiement, IBAN journalisé, attributions.
 */

const h = vi.hoisted(() => ({ supabase: null }))

vi.mock('./sentry.js', () => ({ withSentry: (fn) => fn, captureError: () => {} }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => new Proxy({}, { get: (_, cle) => h.supabase[cle] }),
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
