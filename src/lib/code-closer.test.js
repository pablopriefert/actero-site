// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { creerFauxSupabase, appeler } from '../../api/lib/faux-supabase.js'
import {
  DUREE_ATTRIBUTION_JOURS,
  FORMAT_CODE_CLOSER,
  memoriserCodeCloser,
  codeCloserCourant,
  oublierCodeCloser,
  presenterCodeCloser,
  reinitialiserAdjudicationCloser,
  estCompteCloser,
  formuleDuLien,
  destinationDuLien,
  destinationApresRattachement,
} from './code-closer'

/**
 * Le code closer côté navigateur — même contrat que le code de campagne
 * (src/lib/campagne.test.js) : mémorisé une fois, présenté une fois, oublié
 * dès que le serveur a tranché, gardé si rien n'est tranché.
 *
 * Ces tests font tourner le module contre un vrai `document.cookie` et un
 * `fetch` simulé : une garde qui lirait le texte ne distinguerait pas
 * « efface le cookie » de « efface le cookie une fois sur deux ».
 */

// La vraie route du serveur, pour vérifier que les deux côtés s'accordent.
const h = vi.hoisted(() => ({ supabase: null }))
vi.mock('../../api/lib/sentry.js', () => ({ withSentry: (fn) => fn, captureError: () => {} }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => new Proxy({}, { get: (_, cle) => h.supabase[cle] }),
}))
const { default: routeAttribuer } = await import('../../api/closer/attribuer.js')

let ecritures = []

function installerCookies(valeurInitiale = '') {
  ecritures = []
  let jar = valeurInitiale
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => jar,
    set: (v) => {
      ecritures.push(v)
      const [paire] = v.split(';')
      const [nom, val = ''] = paire.split('=')
      const autres = jar.split('; ').filter((c) => c && !c.startsWith(`${nom.trim()}=`))
      if (/expires=Thu, 01 Jan 1970/i.test(v) || val === '') jar = autres.join('; ')
      else jar = [...autres, `${nom.trim()}=${val}`].join('; ')
    },
  })
}

const supabaseConnecte = { auth: { getSession: async () => ({ data: { session: { access_token: 'jeton-marchand' } } }) } }
const supabaseAnonyme = { auth: { getSession: async () => ({ data: { session: null } }) } }

function repond(status, corps = {}) {
  globalThis.fetch = vi.fn(async () => ({ status, ok: status >= 200 && status < 300, json: async () => corps }))
}

beforeEach(() => {
  installerCookies()
  reinitialiserAdjudicationCloser()
})

describe('mémoriser le code du lien', () => {
  it('un code valide est gardé 60 jours', () => {
    expect(DUREE_ATTRIBUTION_JOURS).toBe(60)
    expect(memoriserCodeCloser(' act-ab2cd ')).toBe('ACT-AB2CD')
    expect(codeCloserCourant()).toBe('ACT-AB2CD')
    const expire = Date.parse(ecritures[0].match(/expires=([^;]+)/)[1])
    const attendu = Date.now() + 60 * 86_400_000
    expect(Math.abs(expire - attendu)).toBeLessThan(5_000)
  })

  it('un code au mauvais format n’est pas gardé', () => {
    for (const brut of ['', 'ACT-AB2C', 'ONEMONTHFREE', 'ACT-AB2CD;x=1', null]) {
      expect(memoriserCodeCloser(brut), String(brut)).toBeNull()
    }
    expect(ecritures).toEqual([])
  })

  it('le premier lien gagne, et un second passage ne repousse pas l’expiration', () => {
    memoriserCodeCloser('ACT-AAAAA')
    expect(memoriserCodeCloser('ACT-BBBBB')).toBe('ACT-AAAAA')
    memoriserCodeCloser('ACT-AAAAA')
    expect(ecritures).toHaveLength(1)
    expect(codeCloserCourant()).toBe('ACT-AAAAA')
  })

  it('même format que le serveur', () => {
    const serveur = readFileSync('api/lib/code-closer.js', 'utf8').match(/FORMAT_CODE_CLOSER = \/(.+)\/\n/)[1]
    expect(FORMAT_CODE_CLOSER.source).toBe(serveur)
  })
})

describe('le cookie ne part qu’en https quand la page est en https', () => {
  // eslint-disable-next-line no-undef -- instance exposée par l'environnement jsdom de vitest
  const allerSur = (url) => jsdom.reconfigure({ url })
  afterEach(() => allerSur('http://localhost:3000/'))

  it('page https : Secure à l’écriture comme à l’effacement', () => {
    allerSur('https://actero.fr/c/ACT-AAAAA')
    memoriserCodeCloser('ACT-AAAAA')
    oublierCodeCloser()
    expect(ecritures).toHaveLength(2)
    for (const ecriture of ecritures) {
      expect(ecriture).toMatch(/;\s*Secure(;|$)/)
      expect(ecriture).toMatch(/;\s*SameSite=Lax(;|$)/)
      expect(ecriture).toMatch(/;\s*path=\/(;|$)/)
    }
  })

  it('page http (développement local) : sans Secure, que le navigateur refuserait', () => {
    memoriserCodeCloser('ACT-AAAAA')
    oublierCodeCloser()
    for (const ecriture of ecritures) expect(ecriture).not.toMatch(/secure/i)
  })
})

describe('présenter le code, puis le dépenser', () => {
  it('rattaché : true, et le code est effacé', async () => {
    memoriserCodeCloser('ACT-AAAAA')
    repond(200, { ok: true, rattache: true })
    expect(await presenterCodeCloser(supabaseConnecte)).toBe(true)
    expect(codeCloserCourant()).toBeNull()
    const [url, options] = globalThis.fetch.mock.calls[0]
    expect(url).toBe('/api/closer/attribuer')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer jeton-marchand')
    expect(JSON.parse(options.body)).toEqual({ code: 'ACT-AAAAA' })
  })

  it('refusé : false, et le code est effacé quand même — il a servi', async () => {
    memoriserCodeCloser('ACT-AAAAA')
    repond(200, { ok: true, rattache: false })
    expect(await presenterCodeCloser(supabaseConnecte)).toBe(false)
    expect(codeCloserCourant()).toBeNull()
  })

  it.each([401, 404, 408, 429, 500, 502, 503])('réponse %i : rien n’est tranché, le code reste', async (status) => {
    memoriserCodeCloser('ACT-AAAAA')
    repond(status, { error: 'x' })
    expect(await presenterCodeCloser(supabaseConnecte)).toBe(false)
    expect(codeCloserCourant()).toBe('ACT-AAAAA')
  })

  it.each([400, 403])('réponse %i : la requête est refusée telle quelle, la représenter n’y changerait rien — le code est oublié', async (status) => {
    memoriserCodeCloser('ACT-AAAAA')
    repond(status, { error: 'code_requis' })
    expect(await presenterCodeCloser(supabaseConnecte)).toBe(false)
    expect(codeCloserCourant()).toBeNull()
    expect(await presenterCodeCloser(supabaseConnecte)).toBe(false)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('coupure réseau ou pas de session : le code reste', async () => {
    memoriserCodeCloser('ACT-AAAAA')
    globalThis.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    expect(await presenterCodeCloser(supabaseConnecte)).toBe(false)
    expect(await presenterCodeCloser(supabaseAnonyme)).toBe(false)
    expect(codeCloserCourant()).toBe('ACT-AAAAA')
  })

  it('sans code, aucun appel', async () => {
    repond(200, { ok: true, rattache: true })
    expect(await presenterCodeCloser(supabaseConnecte)).toBe(false)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  const sessionDe = (id) => ({ auth: { getSession: async () => ({ data: { session: { access_token: `jeton-${id}`, user: { id } } } }) } })

  it('après la décision le code est oublié : une seconde présentation ne rend rien, sans rappeler', async () => {
    memoriserCodeCloser('ACT-AAAAA')
    repond(200, { ok: true, rattache: true })
    expect(await presenterCodeCloser(sessionDe('u-a'))).toBe(true)
    expect(await presenterCodeCloser(sessionDe('u-a'))).toBe(false)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('code toujours là (effacement impossible) : même compte, même code, même réponse sans rappeler', async () => {
    memoriserCodeCloser('ACT-AAAAA')
    repond(200, { ok: true, rattache: true })
    expect(await presenterCodeCloser(sessionDe('u-a'))).toBe(true)
    installerCookies('closer_code=ACT-AAAAA')
    expect(await presenterCodeCloser(sessionDe('u-a'))).toBe(true)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('le verdict d’un compte ne sert jamais à un autre compte', async () => {
    memoriserCodeCloser('ACT-AAAAA')
    repond(200, { ok: true, rattache: true })
    expect(await presenterCodeCloser(sessionDe('u-a'))).toBe(true)
    installerCookies('closer_code=ACT-AAAAA')
    repond(200, { ok: true, rattache: false })
    expect(await presenterCodeCloser(sessionDe('u-b'))).toBe(false)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(globalThis.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer jeton-u-b')
  })

  it('sans code, le verdict mémorisé n’est pas rendu', async () => {
    memoriserCodeCloser('ACT-AAAAA')
    repond(200, { ok: true, rattache: true })
    expect(await presenterCodeCloser(sessionDe('u-a'))).toBe(true)
    installerCookies('')
    expect(await presenterCodeCloser(sessionDe('u-a'))).toBe(false)
  })

  it('un autre code pour le même compte est présenté au serveur', async () => {
    memoriserCodeCloser('ACT-AAAAA')
    repond(200, { ok: true, rattache: false })
    expect(await presenterCodeCloser(sessionDe('u-a'))).toBe(false)
    installerCookies('closer_code=ACT-BBBBB')
    repond(200, { ok: true, rattache: true })
    expect(await presenterCodeCloser(sessionDe('u-a'))).toBe(true)
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body)).toEqual({ code: 'ACT-BBBBB' })
  })

  it('oublierCodeCloser efface vraiment', () => {
    memoriserCodeCloser('ACT-AAAAA')
    oublierCodeCloser()
    expect(codeCloserCourant()).toBeNull()
  })
})

describe('le navigateur et api/closer/attribuer.js s’accordent', () => {
  // Le vrai `presenterCodeCloser`, branché sur la vraie route : chaque
  // réponse du serveur doit faire oublier ou garder le code comme il faut.
  const JOUR_MS = 86_400_000
  const ilYA = (jours) => new Date(Date.now() - jours * JOUR_MS).toISOString().replace('Z', '')
  const BOUTIQUE = { id: 'c1', plan: 'free', status: 'active', closer_id: null, owner_user_id: 'u-marchand', created_at: ilYA(1) }
  const panne = { message: 'panne' }

  const scenarios = {
    // Tranché : le code est oublié.
    'rattaché': { oublie: true, rattache: true },
    'code inconnu': { oublie: true, code: 'ACT-ZZZZZ' },
    'client déjà rattaché': { oublie: true, boutique: { closer_id: 'k-b' } },
    'client payant': { oublie: true, boutique: { plan: 'pro' } },
    'client qui a déjà payé': { oublie: true, boutique: { billing_provider: 'stripe', status: 'canceled' } },
    'auto-rattachement': { oublie: true, closer: { user_id: 'u-marchand' } },
    'client trop ancien': { oublie: true, boutique: { created_at: ilYA(61) } },
    'non-propriétaire': { oublie: true, jeton: 'jeton-equipe' },
    // Rien n'est tranché : le code est gardé.
    'boutique pas encore créée (404)': { oublie: false, jeton: 'jeton-sans-boutique' },
    'session refusée (401)': { oublie: false, jeton: 'jeton-perime' },
    'trop de demandes (429)': { oublie: false, limite: true },
    'lecture du closer en panne (500)': { oublie: false, erreurs: { closers: panne } },
    'lecture des boutiques en panne (503)': { oublie: false, erreurs: { client_users: panne } },
  }

  function serveur({ boutique = {}, closer = {}, erreurs, limite = false }) {
    h.supabase = creerFauxSupabase({
      tables: {
        closers: [{ id: 'k-a', user_id: 'u-closer-a', statut: 'actif', code: 'ACT-AAAAA', ...closer }],
        clients: [{ ...BOUTIQUE, ...boutique }],
        client_users: [
          { client_id: 'c1', user_id: 'u-marchand', role: 'owner' },
          { client_id: 'c1', user_id: 'u-equipe', role: 'support' },
        ],
      },
      comptes: {
        'jeton-marchand': { id: 'u-marchand' },
        'jeton-equipe': { id: 'u-equipe' },
        'jeton-sans-boutique': { id: 'u-sans-boutique' },
      },
      erreurs,
    })
    if (limite) h.supabase.rpc = async () => ({ data: [{ allowed: false, remaining: 0, reset_at: new Date().toISOString() }], error: null })
    // `fetch` passe par la route, comme le ferait Vercel.
    globalThis.fetch = vi.fn(async (url, options) => {
      expect(url).toBe('/api/closer/attribuer')
      const res = await appeler(routeAttribuer, {
        methode: options.method,
        jeton: options.headers.Authorization.replace('Bearer ', ''),
        corps: JSON.parse(options.body),
      })
      return { status: res.statusCode, ok: res.statusCode < 300, json: async () => res.body }
    })
  }

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it.each(Object.keys(scenarios))('%s', async (nom) => {
    const { oublie, rattache = false, code = 'ACT-AAAAA', jeton = 'jeton-marchand', ...monde } = scenarios[nom]
    serveur(monde)
    memoriserCodeCloser(code)
    const session = { auth: { getSession: async () => ({ data: { session: { access_token: jeton } } }) } }
    expect(await presenterCodeCloser(session)).toBe(rattache)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(codeCloserCourant()).toBe(oublie ? null : code)
  })
})

describe('compte closer ou pas', () => {
  it('oui : seulement une réponse qui porte la fiche', async () => {
    repond(200, { fiche: { code: 'ACT-AAAAA' }, totaux: {} })
    expect(await estCompteCloser('jeton')).toBe(true)
    expect(globalThis.fetch.mock.calls[0]).toEqual(['/api/closer/moi', { headers: { Authorization: 'Bearer jeton' } }])
  })

  it('non : seulement le 404 « pas_de_fiche » de api/lib/fiche-closer.js', async () => {
    repond(404, { error: 'pas_de_fiche', message: 'Ce compte n’a pas encore d’espace closer.' })
    expect(await estCompteCloser('jeton')).toBe(false)
    const route = readFileSync('api/lib/fiche-closer.js', 'utf8')
    expect(route).toMatch(/status\(404\)\.json\(\{ error: 'pas_de_fiche'/)
  })

  it.each([
    ['un 200 sans fiche', 200, {}],
    ['un 200 dont la fiche n’est pas un objet', 200, { fiche: 'oui' }],
    ['un 404 d’une autre origine', 404, { error: 'introuvable' }],
    ['un 404 sans corps', 404, null],
    ['un 401', 401, { error: 'non_authentifie' }],
    ['un 503', 503, { error: 'indisponible' }],
  ])('on ne sait pas : %s', async (_, status, corps) => {
    repond(status, corps)
    expect(await estCompteCloser('jeton')).toBeNull()
  })

  it('on ne sait pas : une réponse qui n’est pas du JSON (page HTML), ou une coupure', async () => {
    globalThis.fetch = vi.fn(async () => ({ status: 200, ok: true, json: async () => { throw new SyntaxError('Unexpected token <') } }))
    expect(await estCompteCloser('jeton')).toBeNull()
    globalThis.fetch = vi.fn(async () => ({ status: 404, ok: false, json: async () => { throw new SyntaxError('Unexpected token <') } }))
    expect(await estCompteCloser('jeton')).toBeNull()
    globalThis.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    expect(await estCompteCloser('jeton')).toBeNull()
  })

  it('sans jeton : on ne sait pas, et on ne demande rien', async () => {
    repond(200)
    expect(await estCompteCloser(undefined)).toBeNull()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})

describe('où mène le lien', () => {
  it('plan et formule convenus, sinon l’inscription seule', () => {
    const formule = formuleDuLien(new URLSearchParams('?plan=pro&formule=annuel'))
    expect(formule).toEqual({ plan: 'pro', periode: 'annuel' })
    expect(destinationDuLien(formule)).toBe('/signup?plan=pro&formule=annuel')
    expect(formuleDuLien(new URLSearchParams('?plan=enterprise&formule=annuel'))).toBeNull()
    expect(formuleDuLien(new URLSearchParams('?plan=pro&formule=hebdo'))).toBeNull()
    expect(destinationDuLien(null)).toBe('/signup')
  })

  it('après rattachement : la page des plans, seulement si le prospect vient d’être rattaché', () => {
    expect(destinationApresRattachement(true, { plan: 'starter', periode: 'trimestriel' })).toBe('/signup/plan?plan=starter&formule=trimestriel')
    expect(destinationApresRattachement(false, { plan: 'pro', periode: 'annuel' })).toBeNull()
    expect(destinationApresRattachement(true, { plan: null, periode: 'mensuel' })).toBeNull()
    expect(destinationApresRattachement(true, null)).toBeNull()
  })
})

describe('le code est présenté là où le compte est créé, avant tout paiement', () => {
  const lire = (f) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('inscription e-mail : après la vérification, avant de naviguer', () => {
    const page = lire('src/pages/SignupPage.jsx')
    const presentation = page.indexOf('await presenterCodeCloser(supabase)')
    expect(presentation).toBeGreaterThan(page.indexOf('/api/auth/verify-code'))
    expect(presentation).toBeLessThan(page.indexOf('onNavigate(destination)'))
  })

  it('retour Google : avant la redirection de la campagne', () => {
    const page = lire('src/pages/AuthCallbackPage.jsx')
    const presentation = page.indexOf('await presenterCodeCloser(supabase)')
    expect(presentation).toBeGreaterThan(-1)
    expect(presentation).toBeLessThan(page.indexOf("onNavigate('/signup/plan?offre=mois')"))
  })

  it('page des plans : avant de lancer le paiement', () => {
    const page = lire('src/pages/PlanSelectionPage.jsx')
    const presentation = page.indexOf('await presenterCodeCloser(supabase)')
    expect(presentation).toBeGreaterThan(-1)
    expect(presentation).toBeLessThan(page.indexOf('fetch("/api/billing/upgrade"'))
  })

  it('tableau de bord : en dernier recours', () => {
    expect(lire('src/pages/ClientDashboard.jsx')).toMatch(/presenterCodeCloser\(supabase\)/)
  })

  it('le lien mémorise le code et la formule, et n’est pas indexé', () => {
    const page = lire('src/pages/LienCloserPage.jsx')
    expect(page).toMatch(/memoriserCodeCloser\(/)
    expect(page).toMatch(/memoriserFormuleChoisie\(formule\)/)
    expect(page).toMatch(/<SEO[^>]*\bnoindex\b/)
  })
})
