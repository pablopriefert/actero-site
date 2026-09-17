import { describe, it, expect, vi, beforeEach } from 'vitest'
import { creerFauxSupabase, appeler } from './faux-supabase.js'
import {
  decisionAttribution, rattacherCloser, clientPayant, aDejaPaye, etatClient, ANCIENNETE_MAX_CLIENT_JOURS,
} from './attribution-closer.js'
import { DUREE_ATTRIBUTION_JOURS } from '../../src/lib/code-closer.js'

/**
 * Règles d'attribution — spec 2026-09-14-closers-espace-commissions-design.md.
 *
 * Premier closer gagne ; client payant (ou qui a déjà payé) refusé ;
 * auto-attribution refusée ; closer suspendu refusé ; code inconnu refusé ;
 * appelant qui n'est pas le propriétaire refusé ; client de plus de 60 jours
 * refusé. Chaque test échoue si la règle qu'il nomme disparaît, au niveau de
 * la décision ET au niveau de la route.
 */

const JOUR_MS = 86_400_000
/** `clients.created_at` est un timestamp SANS fuseau : PostgREST le rend sans « Z ». */
const sansFuseau = (date) => date.toISOString().replace('Z', '')
const ilYA = (jours) => sansFuseau(new Date(Date.now() - jours * JOUR_MS))

const h = vi.hoisted(() => ({ supabase: null }))

vi.mock('./sentry.js', () => ({ withSentry: (fn) => fn, captureError: () => {} }))
vi.mock('@supabase/supabase-js', () => ({
  // La route crée son client au chargement : il délègue au faux du test en cours.
  createClient: () => new Proxy({}, { get: (_, cle) => h.supabase[cle] }),
}))

const { default: attribuer } = await import('../closer/attribuer.js')

const ACTIF = { id: 'k-a', user_id: 'u-closer-a', statut: 'actif', code: 'ACT-AAAAA' }
const AUTRE = { id: 'k-b', user_id: 'u-closer-b', statut: 'actif', code: 'ACT-BBBBB' }
const SUSPENDU = { id: 'k-s', user_id: 'u-closer-s', statut: 'suspendu', code: 'ACT-SSSSS' }
const LIBRE = { id: 'c1', plan: 'free', status: 'active', closer_id: null, owner_user_id: 'u-marchand', created_at: ilYA(1) }

describe('decisionAttribution — la règle seule', () => {
  const decider = (over) => decisionAttribution({ closer: ACTIF, client: LIBRE, estMembre: false, estProprietaire: true, ...over })

  it('un client libre, un closer actif : rattaché', () => {
    expect(decider()).toEqual({ rattacher: true })
  })

  it('premier closer gagne', () => {
    expect(decider({ client: { ...LIBRE, closer_id: 'k-b' } })).toEqual({ rattacher: false, raison: 'deja_rattache' })
    expect(decider({ client: { ...LIBRE, closer_id: 'k-a' } })).toEqual({ rattacher: false, raison: 'deja_rattache_a_ce_closer' })
  })

  it('client payant refusé', () => {
    for (const plan of ['starter', 'pro', 'enterprise']) {
      expect(decider({ client: { ...LIBRE, plan } }), plan).toEqual({ rattacher: false, raison: 'client_payant' })
    }
  })

  it('auto-attribution refusée', () => {
    expect(decider({ estMembre: true })).toEqual({ rattacher: false, raison: 'auto_attribution' })
  })

  it('« membre ? » inconnu : on lève plutôt que de laisser passer', () => {
    expect(() => decider({ estMembre: undefined })).toThrow(/estMembre/)
  })

  it('closer suspendu refusé', () => {
    expect(decider({ closer: SUSPENDU })).toEqual({ rattacher: false, raison: 'closer_suspendu' })
  })

  it('code inconnu refusé', () => {
    expect(decider({ closer: null })).toEqual({ rattacher: false, raison: 'code_inconnu' })
  })

  it('« paie déjà » : un plan payant ET un compte actif', () => {
    expect(clientPayant({ plan: 'pro', status: 'active' })).toBe(true)
    expect(clientPayant({ plan: 'pro', status: 'canceled' })).toBe(false)
    expect(clientPayant({ plan: 'free', status: 'active' })).toBe(false)
    expect(clientPayant({ plan: null, status: 'active' })).toBe(false)
  })

  it('seul le propriétaire de la boutique la rattache par un lien', () => {
    expect(decider({ estProprietaire: false })).toEqual({ rattacher: false, raison: 'non_proprietaire' })
  })

  it('« propriétaire ? » inconnu : on lève plutôt que de laisser passer', () => {
    expect(() => decider({ estProprietaire: undefined })).toThrow(/estProprietaire/)
  })

  it('un client créé il y a plus de 60 jours est refusé ; 60 jours pile passe encore', () => {
    const maintenant = new Date('2026-09-17T12:00:00Z')
    const creeLe = (texte) => decider({ maintenant, client: { ...LIBRE, created_at: texte } })
    expect(creeLe('2026-07-19T12:00:00')).toEqual({ rattacher: true })
    expect(creeLe('2026-07-19T11:59:59')).toEqual({ rattacher: false, raison: 'client_trop_ancien' })
    expect(creeLe('2026-09-16T08:00:00.123456')).toEqual({ rattacher: true })
    // Déjà avec un fuseau : lu tel quel.
    expect(creeLe('2026-07-19T14:00:00+02:00')).toEqual({ rattacher: true })
    expect(creeLe('2026-07-19T13:59:59+02:00')).toEqual({ rattacher: false, raison: 'client_trop_ancien' })
  })

  it('une date de création inconnue ou illisible ne vaut pas « récent »', () => {
    for (const created_at of [null, undefined, '', 'pas une date']) {
      expect(decider({ client: { ...LIBRE, created_at } }), String(created_at)).toEqual({ rattacher: false, raison: 'client_trop_ancien' })
    }
  })

  it('la fenêtre du serveur est celle du cookie du lien', () => {
    expect(ANCIENNETE_MAX_CLIENT_JOURS).toBe(DUREE_ATTRIBUTION_JOURS)
  })

  it('un client qui a déjà payé est refusé, même revenu en Free', () => {
    const historiques = {
      'paiement reçu': { payment_received_at: '2026-09-01T10:00:00Z' },
      'abonnement Stripe en cours': { stripe_subscription_id: 'sub_1' },
      'abonnement Shopify en cours': { shopify_subscription_id: 'gid://shopify/AppSubscription/1' },
      'facturation Stripe passée (résilié)': { billing_provider: 'stripe', status: 'canceled' },
      'facturation Shopify passée': { billing_provider: 'shopify' },
    }
    for (const [cas, historique] of Object.entries(historiques)) {
      expect(decider({ client: { ...LIBRE, ...historique } }), cas).toEqual({ rattacher: false, raison: 'client_payant' })
    }
  })

  it('un client Stripe qui n’a jamais payé (paiement abandonné) reste rattachable', () => {
    // Le code est présenté juste avant le paiement, parfois après une
    // tentative abandonnée : le client Stripe existe déjà, rien n'est payé.
    expect(decider({ client: { ...LIBRE, stripe_customer_id: 'cus_1' } })).toEqual({ rattacher: true })
    expect(decider({ client: { ...LIBRE, pending_shopify_subscription_id: 'gid://shopify/AppSubscription/2' } })).toEqual({ rattacher: true })
  })

  it('« a déjà payé » : paiement reçu, plan payant actif, ou abonnement accordé', () => {
    expect(aDejaPaye({ plan: 'pro', status: 'active' })).toBe(true)
    expect(aDejaPaye({ plan: 'free', status: 'active', payment_received_at: '2026-09-01T10:00:00Z' })).toBe(true)
    expect(aDejaPaye({ plan: 'free', status: 'active', stripe_customer_id: 'cus_1' })).toBe(false)
    expect(aDejaPaye({ plan: 'free', status: 'active' })).toBe(false)
  })

  it('l’état montré au closer', () => {
    expect(etatClient({ plan: 'pro', status: 'active' })).toBe('actif')
    expect(etatClient({ plan: 'free', status: 'active' })).toBe('inscrit')
    expect(etatClient({ plan: 'free', status: 'canceled' })).toBe('resilie')
    expect(etatClient({ plan: 'pro', status: 'uninstalled' })).toBe('resilie')
  })
})

describe('rattacherCloser — lectures et écriture', () => {
  function base({ client = LIBRE, liens = [], closers = [ACTIF, AUTRE, SUSPENDU], erreurs } = {}) {
    return creerFauxSupabase({ tables: { closers, clients: [client], client_users: liens }, erreurs })
  }

  const PAR_LE_MARCHAND = { clientId: 'c1', userId: 'u-marchand' }

  it('rattache avec la source « lien » et la date', async () => {
    const le = new Date('2026-09-18T09:00:00Z')
    const sb = base({ client: { ...LIBRE, created_at: sansFuseau(new Date(le.getTime() - JOUR_MS)) } })
    expect(await rattacherCloser(sb, { ...PAR_LE_MARCHAND, code: ' act-aaaaa ', maintenant: le })).toEqual({ rattache: true, closerId: 'k-a' })
    expect(sb.base.clients[0]).toMatchObject({ closer_id: 'k-a', closer_source: 'lien', closer_attribue_at: le.toISOString() })
  })

  it('le propriétaire du client ou un membre de son équipe ne s’attribue pas le client', async () => {
    const proprietaire = base({ client: { ...LIBRE, owner_user_id: 'u-closer-a' } })
    expect(await rattacherCloser(proprietaire, { clientId: 'c1', userId: 'u-closer-a', code: 'ACT-AAAAA' })).toEqual({ rattache: false, raison: 'auto_attribution' })
    const membre = base({ liens: [{ client_id: 'c1', user_id: 'u-closer-a', role: 'manager' }] })
    expect(await rattacherCloser(membre, { ...PAR_LE_MARCHAND, code: 'ACT-AAAAA' })).toEqual({ rattache: false, raison: 'auto_attribution' })
    expect(membre.base.clients[0].closer_id).toBeNull()
  })

  it('l’appelant doit être propriétaire : par owner_user_id ou par le rôle owner', async () => {
    const liens = [
      { client_id: 'c1', user_id: 'u-coproprietaire', role: 'owner' },
      { client_id: 'c1', user_id: 'u-equipe', role: 'manager' },
    ]
    for (const [appelant, attendu] of [
      ['u-marchand', { rattache: true, closerId: 'k-a' }],
      ['u-coproprietaire', { rattache: true, closerId: 'k-a' }],
      ['u-equipe', { rattache: false, raison: 'non_proprietaire' }],
      ['u-inconnu', { rattache: false, raison: 'non_proprietaire' }],
    ]) {
      const sb = base({ liens })
      expect(await rattacherCloser(sb, { clientId: 'c1', userId: appelant, code: 'ACT-AAAAA' }), appelant).toEqual(attendu)
      const lecture = sb.journal.find((j) => j.table === 'client_users' && j.filtres.some(([, c, v]) => c === 'user_id' && v === appelant))
      if (appelant !== 'u-marchand') expect(lecture?.filtres, appelant).toContainEqual(['eq', 'role', 'owner'])
    }
  })

  it('sans appelant connu : on lève plutôt que de laisser passer', async () => {
    const sb = base()
    await expect(rattacherCloser(sb, { clientId: 'c1', code: 'ACT-AAAAA' })).rejects.toThrow(/userId/)
    expect(sb.base.clients[0].closer_id).toBeNull()
  })

  it('un client trop ancien, ou qui a déjà payé, n’est pas rattaché', async () => {
    for (const [cas, client, raison] of [
      ['ancien', { ...LIBRE, created_at: ilYA(61) }, 'client_trop_ancien'],
      ['déjà payé', { ...LIBRE, payment_received_at: '2026-09-01T10:00:00Z' }, 'client_payant'],
    ]) {
      const sb = base({ client })
      expect(await rattacherCloser(sb, { ...PAR_LE_MARCHAND, code: 'ACT-AAAAA' }), cas).toEqual({ rattache: false, raison })
      expect(sb.base.clients[0].closer_id, cas).toBeNull()
    }
  })

  it('l’écriture ne touche qu’un client encore sans closer', async () => {
    // Un autre code est accepté entre la lecture et l'écriture : le premier gagne.
    const sb = base({
      erreurs: {
        clients: ({ operation }) => {
          if (operation === 'update') sb.base.clients[0].closer_id = 'k-b'
          return null
        },
      },
    })
    expect(await rattacherCloser(sb, { ...PAR_LE_MARCHAND, code: 'ACT-AAAAA' })).toEqual({ rattache: false, raison: 'deja_rattache' })
    expect(sb.base.clients[0].closer_id).toBe('k-b')
    const ecriture = sb.journal.find((j) => j.table === 'clients' && j.operation === 'update')
    expect(ecriture.filtres).toContainEqual(['is', 'closer_id', null])
  })

  it('une lecture en échec lève : rien n’est tranché', async () => {
    const sb = base({ erreurs: { closers: { message: 'panne' } } })
    await expect(rattacherCloser(sb, { ...PAR_LE_MARCHAND, code: 'ACT-AAAAA' })).rejects.toThrow(/closers illisible/)
  })

  it('un code au mauvais format ne coûte aucune lecture', async () => {
    const sb = base()
    expect(await rattacherCloser(sb, { ...PAR_LE_MARCHAND, code: 'n’importe quoi' })).toEqual({ rattache: false, raison: 'code_inconnu' })
    expect(sb.journal).toEqual([])
  })
})

describe('POST /api/closer/attribuer', () => {
  const MARCHAND = { id: 'u-marchand', email: 'boutique@ex.com' }
  const AUTRE_MARCHAND = { id: 'u-autre', email: 'autre@ex.com' }
  const COMPTE_CLOSER = { id: 'u-closer-a', email: 'closer@ex.com' }
  const EQUIPIER = { id: 'u-equipe', email: 'equipe@ex.com' }

  function monde({ client = LIBRE, clients = [], liens = [] } = {}) {
    h.supabase = creerFauxSupabase({
      tables: {
        closers: [ACTIF, AUTRE, SUSPENDU],
        clients: [client, { id: 'c-autre', plan: 'free', status: 'active', closer_id: null, owner_user_id: 'u-autre', created_at: ilYA(2) }, ...clients],
        client_users: [{ client_id: 'c1', user_id: 'u-marchand', role: 'owner' }, ...liens],
      },
      comptes: { 'jeton-marchand': MARCHAND, 'jeton-autre': AUTRE_MARCHAND, 'jeton-closer': COMPTE_CLOSER, 'jeton-equipe': EQUIPIER },
    })
    return h.supabase
  }
  const closerDe = (sb, id) => sb.base.clients.find((c) => c.id === id).closer_id

  const presenter = (code, { jeton = 'jeton-marchand', corps } = {}) => appeler(attribuer, { methode: 'POST', jeton, corps: corps ?? { code } })

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rattache le client de la session au closer du code', async () => {
    const sb = monde()
    const res = await presenter('ACT-AAAAA')
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, rattache: true })
    expect(sb.base.clients.find((c) => c.id === 'c1')).toMatchObject({ closer_id: 'k-a', closer_source: 'lien' })
  })

  it('premier closer gagne : un second code ne change rien', async () => {
    const sb = monde()
    await presenter('ACT-AAAAA')
    const res = await presenter('ACT-BBBBB')
    expect(res.body).toEqual({ ok: true, rattache: false })
    expect(sb.base.clients.find((c) => c.id === 'c1').closer_id).toBe('k-a')
  })

  it('client payant, closer suspendu, code inconnu : refusés sans dire pourquoi', async () => {
    for (const [cas, code, client] of [
      ['payant', 'ACT-AAAAA', { ...LIBRE, plan: 'pro' }],
      ['suspendu', 'ACT-SSSSS', LIBRE],
      ['inconnu', 'ACT-ZZZZZ', LIBRE],
    ]) {
      const sb = monde({ client })
      const res = await presenter(code)
      expect(res.statusCode, cas).toBe(200)
      expect(res.body, cas).toEqual({ ok: true, rattache: false })
      expect(sb.base.clients.find((c) => c.id === 'c1').closer_id, cas).toBeNull()
    }
  })

  it('le client est celui de la session : un client_id reçu est ignoré', async () => {
    const sb = monde()
    await presenter(null, { corps: { code: 'ACT-AAAAA', client_id: 'c-autre' } })
    expect(sb.base.clients.find((c) => c.id === 'c-autre').closer_id).toBeNull()
    expect(sb.base.clients.find((c) => c.id === 'c1').closer_id).toBe('k-a')
  })

  it('un propriétaire sans lien client_users est retrouvé par owner_user_id', async () => {
    const sb = monde()
    await presenter('ACT-AAAAA', { jeton: 'jeton-autre' })
    expect(sb.base.clients.find((c) => c.id === 'c-autre').closer_id).toBe('k-a')
  })

  it('un membre de l’équipe qui n’est pas propriétaire : refusé sans dire pourquoi', async () => {
    const sb = monde({ liens: [{ client_id: 'c1', user_id: 'u-equipe', role: 'manager' }] })
    const res = await presenter('ACT-AAAAA', { jeton: 'jeton-equipe' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, rattache: false })
    expect(closerDe(sb, 'c1')).toBeNull()
  })

  it('une boutique de plus de 60 jours : refusée sans dire pourquoi', async () => {
    const sb = monde({ client: { ...LIBRE, created_at: ilYA(61) } })
    const res = await presenter('ACT-AAAAA')
    expect(res.body).toEqual({ ok: true, rattache: false })
    expect(closerDe(sb, 'c1')).toBeNull()
  })

  it('un client Stripe qui a abandonné son paiement reste rattachable', async () => {
    const sb = monde({ client: { ...LIBRE, stripe_customer_id: 'cus_abandon' } })
    const res = await presenter('ACT-AAAAA')
    expect(res.body).toEqual({ ok: true, rattache: true })
    expect(closerDe(sb, 'c1')).toBe('k-a')
  })

  it('un client revenu en Free après avoir payé : refusé sans dire pourquoi', async () => {
    const sb = monde({ client: { ...LIBRE, stripe_customer_id: 'cus_1', billing_provider: 'stripe', status: 'canceled' } })
    const res = await presenter('ACT-AAAAA')
    expect(res.body).toEqual({ ok: true, rattache: false })
    expect(closerDe(sb, 'c1')).toBeNull()
  })

  it('propriétaire de plusieurs boutiques : c’est la plus récente qui est rattachée', async () => {
    const sb = monde({
      client: { ...LIBRE, created_at: ilYA(200) },
      clients: [{ id: 'c-nouvelle', plan: 'free', status: 'active', closer_id: null, owner_user_id: 'u-marchand', created_at: ilYA(1) }],
    })
    const res = await presenter('ACT-AAAAA')
    expect(res.body).toEqual({ ok: true, rattache: true })
    expect(closerDe(sb, 'c-nouvelle')).toBe('k-a')
    expect(closerDe(sb, 'c1')).toBeNull()
  })

  it('membre d’une boutique, propriétaire d’une autre : c’est la sienne qui est rattachée', async () => {
    const sb = monde({
      liens: [{ client_id: 'c1', user_id: 'u-equipe', role: 'manager' }],
      clients: [{ id: 'c-sienne', plan: 'free', status: 'active', closer_id: null, owner_user_id: null, created_at: ilYA(3) }],
    })
    sb.base.client_users.push({ client_id: 'c-sienne', user_id: 'u-equipe', role: 'owner' })
    const res = await presenter('ACT-AAAAA', { jeton: 'jeton-equipe' })
    expect(res.body).toEqual({ ok: true, rattache: true })
    expect(closerDe(sb, 'c-sienne')).toBe('k-a')
    expect(closerDe(sb, 'c1')).toBeNull()
  })

  it('un compte sans boutique (un closer) : 404, et aucune boutique créée', async () => {
    const sb = monde()
    const res = await presenter('ACT-BBBBB', { jeton: 'jeton-closer' })
    expect(res.statusCode).toBe(404)
    expect(sb.journal.filter((j) => j.operation === 'insert')).toEqual([])
  })

  it('sans jeton : 401 ; sans code : 400 ; autre méthode : 405', async () => {
    monde()
    expect((await presenter('ACT-AAAAA', { jeton: null })).statusCode).toBe(401)
    expect((await presenter('ACT-AAAAA', { jeton: 'faux' })).statusCode).toBe(401)
    expect((await presenter(null, { corps: {} })).statusCode).toBe(400)
    expect((await appeler(attribuer, { methode: 'GET', jeton: 'jeton-marchand' })).statusCode).toBe(405)
  })

  it('une panne de lecture : 500, le navigateur garde le code', async () => {
    h.supabase = creerFauxSupabase({
      tables: { clients: [LIBRE], client_users: [{ client_id: 'c1', user_id: 'u-marchand' }] },
      comptes: { 'jeton-marchand': MARCHAND },
      erreurs: { closers: { message: 'panne' } },
    })
    expect((await presenter('ACT-AAAAA')).statusCode).toBe(500)
  })
})
