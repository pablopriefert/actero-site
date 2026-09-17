import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { creerFauxSupabase } from './faux-supabase.js'

/**
 * POST /api/closer/clic — l'ouverture du lien d'un closer.
 *
 * Ce qui est protégé : une ouverture par visiteur, par lien et par jour ; ni
 * robot, ni code inconnu, ni closer suspendu dans le fil ; une limite par
 * adresse, qui n'est stockée nulle part ; et une réponse qui ne dit rien —
 * toujours 204, sans corps.
 */

const h = vi.hoisted(() => ({ supabase: null }))

vi.mock('./sentry.js', () => ({ withSentry: (fn) => fn, captureError: () => {} }))
vi.mock('@supabase/supabase-js', () => ({
  // La route et le compteur de débit gardent leur client : il délègue au faux du test en cours.
  createClient: () => new Proxy({}, { get: (_, cle) => h.supabase[cle] }),
}))

const { default: clic } = await import('../closer/clic.js')

const VISITE = '0f8b6c1e-3a2d-4c5b-9e7f-1a2b3c4d5e6f'
const AUTRE_VISITE = '9d7c5b3a-1e2f-4a6b-8c9d-0e1f2a3b4c5d'
const NAVIGATEUR = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
const IP = '198.51.100.23'

function monde({ erreurs } = {}) {
  const sb = creerFauxSupabase({
    tables: {
      closers: [
        { id: 'k-a', user_id: 'u-a', statut: 'actif', code: 'ACT-AAAAA' },
        { id: 'k-s', user_id: 'u-s', statut: 'suspendu', code: 'ACT-SSSSS' },
      ],
      closer_evenements: [],
    },
    uniques: { closer_evenements: ['source_key'] },
    erreurs,
  })
  // Le compteur partagé (consume_rate_limit), par clé, comme en base.
  sb.compteurs = {}
  sb.rpc = vi.fn(async (nom, { p_key, p_limit }) => {
    sb.compteurs[p_key] = (sb.compteurs[p_key] ?? 0) + 1
    return { data: [{ allowed: sb.compteurs[p_key] <= p_limit, remaining: 0, reset_at: new Date(Date.now() + 3_600_000).toISOString() }], error: null }
  })
  h.supabase = sb
  return sb
}

function reponse() {
  return {
    statusCode: 200,
    body: undefined,
    termine: false,
    status(code) { this.statusCode = code; return this },
    json(corps) { this.body = corps; this.termine = true; return this },
    end(corps) { this.body = corps; this.termine = true; return this },
  }
}

async function cliquer(corps = { code: 'ACT-AAAAA', visite: VISITE }, { agent = NAVIGATEUR, ip = IP, methode = 'POST' } = {}) {
  const res = reponse()
  await clic({
    method: methode,
    // `agent: null` : aucun en-tête user-agent.
    headers: { 'x-forwarded-for': ip, ...(agent === null ? {} : { 'user-agent': agent }) },
    body: corps,
  }, res)
  return res
}

/** 204, sans corps : la seule réponse d'une requête POST. */
function attendreSilence(res) {
  expect(res.statusCode).toBe(204)
  expect(res.body).toBeUndefined()
  expect(res.termine).toBe(true)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-17T09:30:00.000Z'))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('une ouverture notée', () => {
  it('le lien d’un closer actif : lien_ouvert, sans client, avec la visite', async () => {
    const sb = monde()
    attendreSilence(await cliquer())
    expect(sb.base.closer_evenements).toHaveLength(1)
    expect(sb.base.closer_evenements[0]).toMatchObject({
      closer_id: 'k-a',
      client_id: null,
      visite_id: VISITE,
      type: 'lien_ouvert',
      details: {},
      source_key: `clic:ACT-AAAAA:${VISITE}:2026-09-17`,
    })
  })

  it('une ouverture par visiteur, par lien et par jour', async () => {
    const sb = monde()
    await cliquer()
    await cliquer()
    await cliquer({ code: ' act-aaaaa ', visite: VISITE.toUpperCase() })
    expect(sb.base.closer_evenements).toHaveLength(1)
    await cliquer({ code: 'ACT-AAAAA', visite: AUTRE_VISITE })
    vi.setSystemTime(new Date('2026-09-18T07:00:00.000Z'))
    await cliquer()
    expect(sb.base.closer_evenements.map((e) => e.source_key)).toEqual([
      `clic:ACT-AAAAA:${VISITE}:2026-09-17`,
      `clic:ACT-AAAAA:${AUTRE_VISITE}:2026-09-17`,
      `clic:ACT-AAAAA:${VISITE}:2026-09-18`,
    ])
  })

  it('un corps envoyé en texte est lu aussi', async () => {
    const sb = monde()
    attendreSilence(await cliquer(JSON.stringify({ code: 'ACT-AAAAA', visite: VISITE })))
    expect(sb.base.closer_evenements).toHaveLength(1)
  })

  it('aucune adresse IP n’est stockée', async () => {
    const sb = monde()
    await cliquer()
    expect(sb.base.closer_evenements).toHaveLength(1)
    expect(JSON.stringify(sb.base)).not.toContain(IP)
    expect(JSON.stringify(sb.base)).not.toContain('Mozilla')
  })
})

describe('ce qui n’est pas une ouverture : 204, rien d’écrit', () => {
  it.each([
    ['sans agent', null],
    ['agent vide', '   '],
    ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['robot d’exploration', 'Mozilla/5.0 (compatible; AhrefsCrawler/1.0)'],
    ['araignée', 'Baiduspider/2.0'],
    ['aperçu de lien', 'Mozilla/5.0 (compatible; LinkPreview/1.0)'],
    ['Slurp', 'Mozilla/5.0 (compatible; Yahoo! Slurp)'],
    ['aperçu Facebook', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
    ['navigateur sans tête', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/126.0 Safari/537.36'],
  ])('%s', async (_, agent) => {
    const sb = monde()
    attendreSilence(await cliquer(undefined, { agent }))
    expect(sb.base.closer_evenements).toEqual([])
    // Rien n'est lu ni compté pour un robot.
    expect(sb.journal).toEqual([])
    expect(sb.rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['code au mauvais format', { code: 'ACT-AAAA', visite: VISITE }],
    ['code absent', { visite: VISITE }],
    ['visite absente', { code: 'ACT-AAAAA' }],
    ['visite qui n’est pas un UUID', { code: 'ACT-AAAAA', visite: 'visiteur-1' }],
    ['visite d’un autre type', { code: 'ACT-AAAAA', visite: 42 }],
    ['corps illisible', '{pas du json'],
    ['sans corps', undefined],
  ])('%s', async (_, corps) => {
    const sb = monde()
    const res = reponse()
    await clic({ method: 'POST', headers: { 'x-forwarded-for': IP, 'user-agent': NAVIGATEUR }, body: corps }, res)
    attendreSilence(res)
    expect(sb.base.closer_evenements).toEqual([])
    expect(sb.journal).toEqual([])
  })

  it('code inconnu ou closer suspendu', async () => {
    const sb = monde()
    attendreSilence(await cliquer({ code: 'ACT-ZZZZZ', visite: VISITE }))
    attendreSilence(await cliquer({ code: 'ACT-SSSSS', visite: VISITE }))
    expect(sb.base.closer_evenements).toEqual([])
  })

  it('30 ouvertures par heure et par adresse, au-delà rien d’écrit', async () => {
    const sb = monde()
    const visites = Array.from({ length: 31 }, (_, i) => `0f8b6c1e-3a2d-4c5b-9e7f-${String(i).padStart(12, '0')}`)
    for (const visite of visites) attendreSilence(await cliquer({ code: 'ACT-AAAAA', visite }))
    expect(sb.base.closer_evenements).toHaveLength(30)
    expect(sb.rpc).toHaveBeenCalledWith('consume_rate_limit', expect.objectContaining({ p_limit: 30, p_window_ms: 3_600_000 }))
    // Une autre adresse n'est pas limitée par la première.
    await cliquer({ code: 'ACT-AAAAA', visite: visites[30] }, { ip: '203.0.113.77' })
    expect(sb.base.closer_evenements).toHaveLength(31)
  })

  it('base ou fil en panne : toujours 204', async () => {
    for (const erreurs of [{ closers: { message: 'panne' } }, { closer_evenements: { message: 'panne' } }]) {
      const sb = monde({ erreurs })
      attendreSilence(await cliquer())
      expect(sb.base.closer_evenements).toEqual([])
    }
    const sb = monde()
    sb.rpc = vi.fn(async () => { throw new Error('rpc en panne') })
    attendreSilence(await cliquer())
  })
})

describe('les autres méthodes', () => {
  it.each(['GET', 'PUT', 'DELETE'])('%s : 405', async (methode) => {
    const sb = monde()
    const res = await cliquer(undefined, { methode })
    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ error: 'methode_non_autorisee' })
    expect(sb.base.closer_evenements).toEqual([])
  })
})
