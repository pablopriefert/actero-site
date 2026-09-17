import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { creerFauxSupabase, appeler } from './faux-supabase.js'
import { FAMILLE_DU_TYPE, TYPES_EVENEMENT } from './familles-evenements.js'

/**
 * GET /api/closer/activite — le fil d'activité du closer.
 * Spec : docs/superpowers/specs/2026-09-17-closers-fil-activite-design.md
 *
 * Deux closers, A et B. A ne lit jamais une étape, une boutique ni un client
 * de B ; le parcours d'un client de B lui répond 404. La réponse ne contient
 * ni montant ni adresse e-mail, même si la base en contenait. Le curseur
 * `avant` parcourt tout le fil sans perte ni doublon, y compris quand
 * plusieurs étapes tombent au même instant.
 */

const h = vi.hoisted(() => ({ supabase: null }))

vi.mock('./sentry.js', () => ({ withSentry: (fn) => fn, captureError: () => {} }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => new Proxy({}, { get: (_, cle) => h.supabase[cle] }),
}))

const route = (await import('../closer/activite.js')).default

const MAINTENANT = Date.parse('2026-09-20T12:00:00.000Z')
/** Il y a `jours` jours (et `heures` heures), au format que rend `toISOString`. */
const ilYa = (jours, heures = 0) => new Date(MAINTENANT - (jours * 24 + heures) * 3_600_000).toISOString()

const CA1 = '11111111-1111-4111-8111-111111111111' // abonné après son paiement
const CA2 = '22222222-2222-4222-8222-222222222222' // paiement ouvert
const CA3 = '33333333-3333-4333-8333-333333333333' // abonné avant, puis paiement ouvert
const CA4 = '44444444-4444-4444-8444-444444444444' // paiement abandonné
const CA9 = '99999999-9999-4999-8999-999999999999' // détaché de A depuis
const CB1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' // client de B

const ev = (id, closer_id, type, survenu_le, client_id = null, details = {}) => ({
  id, closer_id, type, survenu_le, client_id, details, visite_id: 'visite-secrete', source_key: `cle:${id}`, created_at: survenu_le,
})

const EVENEMENTS_A = [
  ev('a-lien-1', 'k-a', 'lien_ouvert', ilYa(1)),
  ev('a-lien-2', 'k-a', 'lien_ouvert', ilYa(6), CA1),
  ev('a-lien-3', 'k-a', 'lien_ouvert', ilYa(8)),
  ev('a-insc-1', 'k-a', 'inscription', ilYa(6, -1), CA1),
  ev('a-insc-2', 'k-a', 'inscription', ilYa(20), CA2),
  ev('a-insc-3', 'k-a', 'inscription', ilYa(29, 1), CA4),
  ev('a-insc-4', 'k-a', 'inscription', ilYa(40), CA3),
  ev('a-insc-9', 'k-a', 'inscription', ilYa(45), CA9),
  ev('a-pay-1', 'k-a', 'paiement_ouvert', ilYa(5), CA1, { plan: 'pro', formule: 'annuel', plateforme: 'stripe', montant: 4900, email: 'alice@alice-shop.fr', partiel: 'non' }),
  ev('a-pay-2', 'k-a', 'abonnement_demarre', ilYa(4), CA1, { plan: 'pro', formule: 'annuel', plateforme: 'stripe', montant_centimes: 59900, customer_email: 'alice@alice-shop.fr' }),
  ev('a-pay-3', 'k-a', 'paiement_ouvert', ilYa(3), CA2, { plan: 'starter', formule: 'mensuel', plateforme: 'stripe' }),
  ev('a-pay-4', 'k-a', 'abonnement_demarre', ilYa(38), CA3, { plan: 'starter', formule: 'mensuel' }),
  ev('a-pay-5', 'k-a', 'renouvellement_paye', ilYa(8, 2), CA3, { plan: 'starter', formule: 'mensuel' }),
  ev('a-pay-6', 'k-a', 'paiement_ouvert', ilYa(2), CA3, { plan: 'pro', formule: 'annuel' }),
  ev('a-pay-7', 'k-a', 'paiement_ouvert', ilYa(3, 5), CA4),
  ev('a-pay-8', 'k-a', 'paiement_abandonne', ilYa(2, 5), CA4, { plan: 'pro' }),
  ev('a-abo-1', 'k-a', 'rembourse', ilYa(1, 3), CA1, { partiel: true, montant_rembourse: 1200 }),
  ev('a-mer-1', 'k-a', 'boutique_connectee', ilYa(0, 2), CA2, { plateforme: 'shopify' }),
  ev('a-inconnu', 'k-a', 'type_de_demain', ilYa(0, 1), CA1),
]
const EVENEMENTS_B = [
  ev('b-lien-1', 'k-b', 'lien_ouvert', ilYa(1)),
  ev('b-insc-1', 'k-b', 'inscription', ilYa(2), CB1),
  ev('b-pay-1', 'k-b', 'paiement_ouvert', ilYa(1, 2), CB1, { plan: 'starter', formule: 'annuel' }),
]

function monde({ evenements = [...EVENEMENTS_A, ...EVENEMENTS_B], erreurs } = {}) {
  h.supabase = creerFauxSupabase({
    tables: {
      closers: [
        { id: 'k-a', user_id: 'u-a', prenom: 'Alice', nom: 'Aubert', email: 'alice@ex.com', code: 'ACT-AAAAA', statut: 'actif' },
        { id: 'k-b', user_id: 'u-b', prenom: 'Bruno', nom: 'Bernard', email: 'bruno@ex.com', code: 'ACT-BBBBB', statut: 'actif' },
      ],
      clients: [
        { id: CA1, brand_name: 'Boutique d’Alice', closer_id: 'k-a', contact_email: 'contact@alice-shop.fr', stripe_customer_id: 'cus_secret' },
        { id: CA2, brand_name: 'Atelier Alma', closer_id: 'k-a' },
        { id: CA3, brand_name: 'Maison Ambre', closer_id: 'k-a' },
        { id: CA4, brand_name: '', closer_id: 'k-a' },
        { id: CA9, brand_name: 'Boutique partie', closer_id: null },
        { id: CB1, brand_name: 'Boutique de Bruno', closer_id: 'k-b', contact_email: 'contact@bruno-shop.fr' },
      ],
      closer_evenements: evenements,
    },
    comptes: {
      'jeton-a': { id: 'u-a', email: 'alice@ex.com' },
      'jeton-b': { id: 'u-b', email: 'bruno@ex.com' },
      'jeton-m': { id: 'u-m', email: 'marchand@ex.com' },
    },
    erreurs,
  })
  return h.supabase
}

const lire = (jeton, query = {}) => appeler(route, { jeton, query })

/** Les étapes lisibles d'un closer, de la plus récente à la plus ancienne. */
const attendues = (closerId) => [...EVENEMENTS_A, ...EVENEMENTS_B]
  .filter((e) => e.closer_id === closerId && TYPES_EVENEMENT.includes(e.type))
  .sort((a, b) => (a.survenu_le < b.survenu_le ? 1 : -1))
  .map((e) => e.id)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(MAINTENANT)
  monde()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/closer/activite — accès', () => {
  it('anonyme : 401', async () => {
    const res = await lire(undefined)
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toBe('non_authentifie')
  })

  it('un compte sans fiche closer : 404 pas_de_fiche, et aucune étape lue', async () => {
    const res = await lire('jeton-m')
    expect(res.statusCode).toBe(404)
    expect(res.body.error).toBe('pas_de_fiche')
    expect(h.supabase.journal.some((j) => j.table === 'closer_evenements')).toBe(false)
  })

  it('autre méthode que GET : 405', async () => {
    const res = await appeler(route, { methode: 'POST', jeton: 'jeton-a' })
    expect(res.statusCode).toBe(405)
  })

  it.each([
    ['famille inconnue', { famille: 'commission' }],
    ['famille vide', { famille: '' }],
    ['famille répétée', { famille: ['paiement', 'lien'] }],
    ['limite nulle', { limite: '0' }],
    ['limite au-delà de 100', { limite: '101' }],
    ['limite non entière', { limite: '10.5' }],
    ['limite en lettres', { limite: 'dix' }],
    ['curseur qui n’est pas une date', { avant: 'hier' }],
    ['curseur hors calendrier', { avant: '2026-13-01T00:00:00Z' }],
    ['client qui n’est pas un identifiant', { client: 'c-a' }],
  ])('%s : 400 parametre_invalide', async (_cas, query) => {
    const res = await lire('jeton-a', query)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('parametre_invalide')
  })

  it('base en panne : 503 indisponible', async () => {
    monde({ erreurs: { closer_evenements: { message: 'panne' } } })
    const res = await lire('jeton-a')
    expect(res.statusCode).toBe(503)
    expect(res.body.error).toBe('indisponible')
  })
})

describe('GET /api/closer/activite — cloisonnement', () => {
  it('A ne lit que ses étapes, et rien de B', async () => {
    const res = await lire('jeton-a', { limite: '100' })
    expect(res.statusCode).toBe(200)
    expect(res.body.evenements.map((e) => e.id)).toEqual(attendues('k-a'))
    const texte = JSON.stringify(res.body)
    for (const trace of ['k-b', CB1, 'Boutique de Bruno', 'b-lien-1', 'b-insc-1', 'b-pay-1', 'bruno']) {
      expect(texte).not.toContain(trace)
    }
  })

  it('B ne lit que les siennes, et rien de A', async () => {
    const res = await lire('jeton-b')
    expect(res.body.evenements.map((e) => e.id)).toEqual(['b-lien-1', 'b-pay-1', 'b-insc-1'])
    const texte = JSON.stringify(res.body)
    for (const trace of ['k-a', CA1, CA2, 'Alice', 'Alma', 'a-pay-1']) expect(texte).not.toContain(trace)
    expect(res.body.resume).toEqual({ visites_7j: 1, inscriptions_30j: 1, paiements_en_attente: 1 })
  })

  it('le parcours d’un client de B, demandé par A : 404 client_introuvable', async () => {
    const res = await lire('jeton-a', { client: CB1 })
    expect(res.statusCode).toBe(404)
    expect(res.body.error).toBe('client_introuvable')
    expect(JSON.stringify(res.body)).not.toContain('Bruno')
  })

  it('un client inconnu, ou détaché de A depuis : 404', async () => {
    expect((await lire('jeton-a', { client: '00000000-0000-4000-8000-000000000000' })).statusCode).toBe(404)
    expect((await lire('jeton-a', { client: CA9 })).statusCode).toBe(404)
  })

  it('le parcours d’un client de A : ses étapes seulement, sans résumé', async () => {
    const res = await lire('jeton-a', { client: CA1 })
    expect(res.statusCode).toBe(200)
    expect(res.body.evenements.map((e) => e.id)).toEqual(['a-abo-1', 'a-pay-2', 'a-pay-1', 'a-insc-1', 'a-lien-2'])
    expect(res.body.evenements.every((e) => e.client_id === CA1 && e.boutique === 'Boutique d’Alice')).toBe(true)
    expect(res.body.resume).toBeNull()
    expect(res.body.suivant).toBeNull()
  })

  it('une étape d’un client détaché depuis garde sa date, sans le nom de la boutique', async () => {
    const res = await lire('jeton-a', { famille: 'inscription' })
    const detache = res.body.evenements.find((e) => e.id === 'a-insc-9')
    expect(detache).toMatchObject({ client_id: CA9, boutique: null })
    expect(JSON.stringify(res.body)).not.toContain('Boutique partie')
  })
})

describe('GET /api/closer/activite — contenu', () => {
  it('chaque étape : type, famille, date, client, boutique et détails permis', async () => {
    const res = await lire('jeton-a', { limite: '100' })
    const paiement = res.body.evenements.find((e) => e.id === 'a-pay-1')
    expect(paiement).toEqual({
      id: 'a-pay-1',
      type: 'paiement_ouvert',
      famille: 'paiement',
      survenu_le: ilYa(5),
      client_id: CA1,
      boutique: 'Boutique d’Alice',
      details: { plan: 'pro', formule: 'annuel', plateforme: 'stripe' },
    })
    expect(res.body.evenements.find((e) => e.id === 'a-abo-1').details).toEqual({ partiel: true })
    expect(res.body.evenements.find((e) => e.id === 'a-lien-1')).toMatchObject({ client_id: null, boutique: null, details: {} })
    expect(res.body.evenements.find((e) => e.id === 'a-pay-8').boutique).toBeNull()
    for (const e of res.body.evenements) {
      expect(Object.keys(e)).toEqual(['id', 'type', 'famille', 'survenu_le', 'client_id', 'boutique', 'details'])
      expect(e.famille).toBe(FAMILLE_DU_TYPE[e.type])
    }
  })

  it('aucun montant ni aucune adresse e-mail, même si la base en contient', async () => {
    const res = await lire('jeton-a', { limite: '100' })
    const texte = JSON.stringify(res.body)
    expect(texte).not.toMatch(/@/)
    for (const trace of ['4900', '59900', '1200', 'montant', 'email', 'cus_secret', 'visite-secrete', 'cle:']) {
      expect(texte).not.toContain(trace)
    }
  })

  it('un type que la bibliothèque ne connaît pas n’est jamais rendu', async () => {
    const res = await lire('jeton-a', { limite: '100' })
    expect(res.body.evenements.map((e) => e.id)).not.toContain('a-inconnu')
  })

  it('filtre par famille', async () => {
    const res = await lire('jeton-a', { famille: 'paiement' })
    expect(res.body.evenements.map((e) => e.id)).toEqual(['a-pay-6', 'a-pay-8', 'a-pay-3', 'a-pay-7', 'a-pay-2', 'a-pay-1', 'a-pay-5', 'a-pay-4'])
    expect(res.body.evenements.every((e) => e.famille === 'paiement')).toBe(true)
    const lien = await lire('jeton-a', { famille: 'lien' })
    expect(lien.body.evenements.map((e) => e.type)).toEqual(['lien_ouvert', 'lien_ouvert', 'lien_ouvert'])
  })
})

describe('GET /api/closer/activite — pagination', () => {
  async function toutesLesPages(jeton, query) {
    const ids = []
    let avant
    for (let tour = 0; tour < 30; tour += 1) {
      const res = await lire(jeton, { ...query, ...(avant ? { avant } : {}) })
      expect(res.statusCode).toBe(200)
      expect(res.body.evenements.length).toBeLessThanOrEqual(Number(query.limite))
      ids.push(...res.body.evenements.map((e) => e.id))
      if (!res.body.suivant) return ids
      expect(res.body.suivant).toBe(res.body.evenements.at(-1).survenu_le)
      avant = res.body.suivant
    }
    throw new Error('la pagination ne s’arrête pas')
  }

  it('limite 50 par défaut : tout tient, pas de page suivante', async () => {
    const res = await lire('jeton-a')
    expect(res.body.evenements).toHaveLength(attendues('k-a').length)
    expect(res.body.suivant).toBeNull()
  })

  it('le curseur « avant » parcourt tout le fil, sans perte ni doublon', async () => {
    const premiere = await lire('jeton-a', { limite: '3' })
    expect(premiere.body.evenements.map((e) => e.id)).toEqual(attendues('k-a').slice(0, 3))
    expect(premiere.body.suivant).toBe(premiere.body.evenements[2].survenu_le)
    expect(await toutesLesPages('jeton-a', { limite: '3' })).toEqual(attendues('k-a'))
  })

  it('le curseur respecte la famille', async () => {
    expect(await toutesLesPages('jeton-a', { limite: '2', famille: 'inscription' }))
      .toEqual(['a-insc-1', 'a-insc-2', 'a-insc-3', 'a-insc-4', 'a-insc-9'])
  })

  it('des étapes du même instant, à cheval sur deux pages, ne sont pas perdues', async () => {
    const meme = ilYa(3)
    monde({
      evenements: [
        ev('t5', 'k-a', 'lien_ouvert', ilYa(1)),
        ev('t4', 'k-a', 'lien_ouvert', ilYa(2)),
        ev('t3-a', 'k-a', 'formule_changee', meme, CA1),
        ev('t3-b', 'k-a', 'resiliation_annulee', meme, CA1),
        ev('t3-c', 'k-a', 'renouvellement_paye', meme, CA1),
        ev('t2', 'k-a', 'lien_ouvert', ilYa(4)),
      ],
    })
    const premiere = await lire('jeton-a', { limite: '3' })
    expect(premiere.body.evenements.map((e) => e.id)).toEqual(['t5', 't4'])
    const ids = await toutesLesPages('jeton-a', { limite: '3' })
    expect([...ids].sort()).toEqual(['t2', 't3-a', 't3-b', 't3-c', 't4', 't5'])
    expect(ids).toHaveLength(6)
  })
})

describe('GET /api/closer/activite — résumé', () => {
  it('visites sur 7 jours, inscriptions sur 30 jours, paiements en attente', async () => {
    const res = await lire('jeton-a')
    // Visites : a-lien-1 et a-lien-2 (a-lien-3 a 8 jours).
    // Inscriptions : CA1, CA2 et CA4 (CA3 et CA9 ont plus de 30 jours).
    // En attente : CA2 (ouvert), CA3 (abonné avant, puis ouvert), CA4
    // (abandonné) ; pas CA1, abonné après son paiement.
    expect(res.body.resume).toEqual({ visites_7j: 2, inscriptions_30j: 3, paiements_en_attente: 3 })
  })

  it('un abonnement démarré après le paiement le sort de l’attente', async () => {
    monde({
      evenements: [
        ...EVENEMENTS_A,
        ev('a-pay-9', 'k-a', 'abonnement_demarre', ilYa(1), CA2, { plan: 'starter', formule: 'mensuel' }),
        ev('a-pay-10', 'k-a', 'renouvellement_paye', ilYa(0, 1), CA3, { plan: 'starter', formule: 'mensuel' }),
      ],
    })
    const res = await lire('jeton-a')
    expect(res.body.resume.paiements_en_attente).toBe(1)
  })

  it('calculé aussi avec un filtre de famille ou un curseur', async () => {
    const res = await lire('jeton-a', { famille: 'lien', avant: ilYa(2) })
    expect(res.body.evenements.map((e) => e.id)).toEqual(['a-lien-2', 'a-lien-3'])
    expect(res.body.resume).toEqual({ visites_7j: 2, inscriptions_30j: 3, paiements_en_attente: 3 })
  })

  it('un closer sans activité : trois zéros et un fil vide', async () => {
    monde({ evenements: [] })
    const res = await lire('jeton-a')
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ evenements: [], suivant: null, resume: { visites_7j: 0, inscriptions_30j: 0, paiements_en_attente: 0 } })
  })
})
