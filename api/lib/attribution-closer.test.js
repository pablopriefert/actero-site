import { describe, it, expect, vi, beforeEach } from 'vitest'
import { creerFauxSupabase, appeler } from './faux-supabase.js'
import { decisionAttribution, rattacherCloser, clientPayant, etatClient } from './attribution-closer.js'

/**
 * Règles d'attribution — spec 2026-09-14-closers-espace-commissions-design.md.
 *
 * Premier closer gagne ; client payant refusé ; auto-attribution refusée ;
 * closer suspendu refusé ; code inconnu refusé. Chaque test échoue si la règle
 * qu'il nomme disparaît, au niveau de la décision ET au niveau de la route.
 */

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
const LIBRE = { id: 'c1', plan: 'free', status: 'active', closer_id: null, owner_user_id: 'u-marchand' }

describe('decisionAttribution — la règle seule', () => {
  const decider = (over) => decisionAttribution({ closer: ACTIF, client: LIBRE, estMembre: false, ...over })

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

  it('rattache avec la source « lien » et la date', async () => {
    const sb = base()
    const le = new Date('2026-09-18T09:00:00Z')
    expect(await rattacherCloser(sb, { clientId: 'c1', code: ' act-aaaaa ', maintenant: le })).toEqual({ rattache: true, closerId: 'k-a' })
    expect(sb.base.clients[0]).toMatchObject({ closer_id: 'k-a', closer_source: 'lien', closer_attribue_at: le.toISOString() })
  })

  it('le propriétaire du client ou un membre de son équipe ne s’attribue pas le client', async () => {
    const proprietaire = base({ client: { ...LIBRE, owner_user_id: 'u-closer-a' } })
    expect(await rattacherCloser(proprietaire, { clientId: 'c1', code: 'ACT-AAAAA' })).toEqual({ rattache: false, raison: 'auto_attribution' })
    const membre = base({ liens: [{ client_id: 'c1', user_id: 'u-closer-a', role: 'manager' }] })
    expect(await rattacherCloser(membre, { clientId: 'c1', code: 'ACT-AAAAA' })).toEqual({ rattache: false, raison: 'auto_attribution' })
    expect(membre.base.clients[0].closer_id).toBeNull()
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
    expect(await rattacherCloser(sb, { clientId: 'c1', code: 'ACT-AAAAA' })).toEqual({ rattache: false, raison: 'deja_rattache' })
    expect(sb.base.clients[0].closer_id).toBe('k-b')
    const ecriture = sb.journal.find((j) => j.table === 'clients' && j.operation === 'update')
    expect(ecriture.filtres).toContainEqual(['is', 'closer_id', null])
  })

  it('une lecture en échec lève : rien n’est tranché', async () => {
    const sb = base({ erreurs: { closers: { message: 'panne' } } })
    await expect(rattacherCloser(sb, { clientId: 'c1', code: 'ACT-AAAAA' })).rejects.toThrow(/closers illisible/)
  })

  it('un code au mauvais format ne coûte aucune lecture', async () => {
    const sb = base()
    expect(await rattacherCloser(sb, { clientId: 'c1', code: 'n’importe quoi' })).toEqual({ rattache: false, raison: 'code_inconnu' })
    expect(sb.journal).toEqual([])
  })
})

describe('POST /api/closer/attribuer', () => {
  const MARCHAND = { id: 'u-marchand', email: 'boutique@ex.com' }
  const AUTRE_MARCHAND = { id: 'u-autre', email: 'autre@ex.com' }
  const COMPTE_CLOSER = { id: 'u-closer-a', email: 'closer@ex.com' }

  function monde({ client = LIBRE } = {}) {
    h.supabase = creerFauxSupabase({
      tables: {
        closers: [ACTIF, AUTRE, SUSPENDU],
        clients: [client, { id: 'c-autre', plan: 'free', status: 'active', closer_id: null, owner_user_id: 'u-autre' }],
        client_users: [{ client_id: 'c1', user_id: 'u-marchand', role: 'owner' }],
      },
      comptes: { 'jeton-marchand': MARCHAND, 'jeton-autre': AUTRE_MARCHAND, 'jeton-closer': COMPTE_CLOSER },
    })
    return h.supabase
  }

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
