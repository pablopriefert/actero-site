// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
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

  it.each([404, 429, 500, 503])('réponse %i : rien n’est tranché, le code reste', async (status) => {
    memoriserCodeCloser('ACT-AAAAA')
    repond(status, { error: 'x' })
    expect(await presenterCodeCloser(supabaseConnecte)).toBe(false)
    expect(codeCloserCourant()).toBe('ACT-AAAAA')
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

  it('une seconde présentation dans la même page rend la même réponse, sans rappeler', async () => {
    memoriserCodeCloser('ACT-AAAAA')
    repond(200, { ok: true, rattache: true })
    expect(await presenterCodeCloser(supabaseConnecte)).toBe(true)
    expect(await presenterCodeCloser(supabaseConnecte)).toBe(true)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('oublierCodeCloser efface vraiment', () => {
    memoriserCodeCloser('ACT-AAAAA')
    oublierCodeCloser()
    expect(codeCloserCourant()).toBeNull()
  })
})

describe('compte closer ou pas', () => {
  it('200 : oui ; 404 : non ; autre chose : on ne sait pas', async () => {
    repond(200)
    expect(await estCompteCloser('jeton')).toBe(true)
    expect(globalThis.fetch.mock.calls[0]).toEqual(['/api/closer/moi', { headers: { Authorization: 'Bearer jeton' } }])
    repond(404)
    expect(await estCompteCloser('jeton')).toBe(false)
    repond(500)
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
