// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  memoriserCodeCampagne,
  codeCampagneCourant,
  oublierCodeCampagne,
  presenterCodeCampagne,
  reinitialiserAdjudication,
} from './campagne'

/**
 * Le code de campagne est un jeton à USAGE UNIQUE.
 *
 * CE QUE CE FICHIER EXISTE POUR ARRÊTER
 *
 * Le 11 septembre 2026, Pablo : « même si je passe pas par le lien de la
 * campagne du mois gratuit, j'ai quand même le mois gratuit ».
 *
 * Le code était mémorisé dans un cookie de trente jours et **jamais effacé**,
 * même une fois le mois accordé. Chaque compte créé ensuite dans ce navigateur
 * repartait avec trente jours au lieu de sept, sans aucun paramètre dans
 * l'URL. Et le cookie se renouvelait seul : le retour de Google redirigeait
 * vers `/signup/plan?campagne=<code>`, `memoriserCodeCampagne()` tourne à
 * chaque chargement, et repoussait l'expiration de trente jours.
 *
 * Une visite au lien de la publicité armait le navigateur pour de bon.
 *
 * POURQUOI VINGT-TROIS TESTS NE L'ONT PAS VU
 *
 * `api/lib/essai-gratuit.test.js` gardait l'essai sous tous les angles — sauf
 * celui-là. Son test le plus proche, « le code survit à l'aller-retour vers
 * Google », exigeait **exactement le contraire** : que le code survive. On
 * avait garanti la survie et rien dit sur la dépense.
 *
 * Ces tests-ci ne lisent pas du code source, ils font tourner le module contre
 * un vrai `document.cookie` et un `fetch` simulé. Une garde qui lit du texte
 * n'aurait pas distingué « efface le cookie » de « efface le cookie une fois
 * sur deux ».
 */

/** Notre propre cookie jar : jsdom n'expose pas l'expiration, donc on observe
 *  les ÉCRITURES, ce qui est la vraie propriété à garder. */
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
      // Une expiration dans le passé retire le cookie, comme un vrai navigateur.
      if (/expires=Thu, 01 Jan 1970/i.test(v) || val === '') jar = autres.join('; ')
      else jar = [...autres, `${nom.trim()}=${val}`].join('; ')
    },
  })
}

function allerSur(url) {
  window.history.replaceState({}, '', url)
}

const supabaseOk = {
  auth: { getSession: async () => ({ data: { session: { access_token: 'jeton' } } }) },
}

function repond(status, corps) {
  globalThis.fetch = vi.fn(async () => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => corps,
  }))
}

beforeEach(() => {
  installerCookies()
  allerSur('/')
  reinitialiserAdjudication()
})

describe('le code de campagne se dépense', () => {
  it('LE DÉFAUT : un second compte ne récupère pas le mois du premier', async () => {
    // Le test qui compte. C'est exactement ce que Pablo a constaté.
    allerSur('/signup?campagne=ONEMONTHFREE')
    memoriserCodeCampagne()
    expect(codeCampagneCourant()).toBe('ONEMONTHFREE')

    // Premier compte : le serveur accorde le mois.
    repond(200, { ok: true, applique: true })
    expect(await presenterCodeCampagne(supabaseOk)).toBe(true)

    // Le marchand navigue ailleurs : plus aucun code dans l'URL.
    allerSur('/signup')
    reinitialiserAdjudication()   // nouvelle vie de page

    // Second compte, sans passer par le lien : plus rien à présenter.
    expect(codeCampagneCourant()).toBe(null)
    repond(200, { ok: true, applique: true })
    expect(await presenterCodeCampagne(supabaseOk)).toBe(false)
    expect(globalThis.fetch, 'le serveur a été appelé alors qu’il n’y avait plus de code')
      .not.toHaveBeenCalled()
  })

  it('un code refusé est dépensé aussi — il ne vaudra jamais rien', async () => {
    allerSur('/signup?campagne=CODE_PERIME')
    memoriserCodeCampagne()
    repond(200, { ok: true, applique: false })
    expect(await presenterCodeCampagne(supabaseOk)).toBe(false)

    allerSur('/signup')
    expect(codeCampagneCourant(), 'un code refusé reste en mémoire et resservira').toBe(null)
  })

  it('une panne de NOTRE côté ne consomme pas le code', async () => {
    // La nuance qui compte : tout effacer serait aussi faux. Un 500 ou une
    // coupure réseau ne tranche rien — le marchand n'a pas à payer notre panne.
    allerSur('/signup?campagne=ONEMONTHFREE')
    memoriserCodeCampagne()
    repond(500, { error: 'boom' })
    expect(await presenterCodeCampagne(supabaseOk)).toBe(false)

    allerSur('/signup')
    expect(codeCampagneCourant(), 'le code a été brûlé par une erreur serveur').toBe('ONEMONTHFREE')
  })

  it('un 404 « client introuvable » ne consomme pas le code non plus', async () => {
    // Le compte vient d'être créé côté navigateur ; la route peut ne pas
    // encore le voir. Brûler le code ici coûterait son mois au marchand.
    allerSur('/signup?campagne=ONEMONTHFREE')
    memoriserCodeCampagne()
    repond(404, { error: 'Client introuvable' })
    expect(await presenterCodeCampagne(supabaseOk)).toBe(false)

    allerSur('/signup')
    expect(codeCampagneCourant()).toBe('ONEMONTHFREE')
  })

  it('une coupure réseau ne consomme pas le code', async () => {
    allerSur('/signup?campagne=ONEMONTHFREE')
    memoriserCodeCampagne()
    globalThis.fetch = vi.fn(async () => { throw new Error('réseau') })
    expect(await presenterCodeCampagne(supabaseOk)).toBe(false)

    allerSur('/signup')
    expect(codeCampagneCourant()).toBe('ONEMONTHFREE')
  })
})

describe('le cookie ne se renouvelle pas tout seul', () => {
  it('un code déjà mémorisé n’est pas réécrit', () => {
    // Le second défaut : notre propre parcours remettait le code dans l'URL au
    // retour de Google, et chaque chargement repoussait l'expiration de trente
    // jours. Un marchand actif ne perdait jamais son code.
    allerSur('/signup?campagne=ONEMONTHFREE')
    memoriserCodeCampagne()
    const apresPremiere = ecritures.length
    expect(apresPremiere).toBe(1)

    // Deuxième chargement, même code dans l'URL.
    memoriserCodeCampagne()
    expect(ecritures.length, 'le cookie a été réécrit : son expiration est repoussée')
      .toBe(apresPremiere)
  })

  it('aucune page du parcours ne remet le code dans l’URL', () => {
    // C'est ce qui alimentait le renouvellement. Le marqueur d'affichage
    // `offre=mois` ne porte pas de code et n'est donc pas re-mémorisé.
    const callback = readFileSync('src/pages/AuthCallbackPage.jsx', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(callback, 'le code de campagne est réinjecté dans l’URL')
      .not.toMatch(/campagne=\$\{/)
  })

  it('la page de plans sait afficher l’offre sans qu’on lui repasse le code', () => {
    const page = readFileSync('src/pages/PlanSelectionPage.jsx', 'utf8')
    expect(page, 'le marqueur d’affichage n’est pas lu').toMatch(/urlParams\.get\("offre"\)/)
  })
})

describe('les invariants qui tenaient déjà', () => {
  it('le code survit à l’aller-retour vers Google', async () => {
    // Ce que le cookie sert à faire, et qui reste vrai : la redirection OAuth
    // perd la chaîne de requête.
    allerSur('/signup?campagne=ONEMONTHFREE')
    memoriserCodeCampagne()
    allerSur('/auth/callback')          // Google nous rend la main, sans paramètre
    expect(codeCampagneCourant()).toBe('ONEMONTHFREE')
  })

  it('sans code nulle part, on n’appelle même pas le serveur', async () => {
    repond(200, { ok: true, applique: true })
    expect(await presenterCodeCampagne(supabaseOk)).toBe(false)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('deux appels dans la même page donnent la même réponse', async () => {
    // AuthCallbackPage appelle resolveOrCreateClientId (qui présente déjà le
    // code) PUIS presenterCodeCampagne pour connaître l'issue. Sans mémoire, le
    // second appel renverrait false pour un mois pourtant accordé, et le
    // marchand atterrirait au tableau de bord au lieu de la page des formules.
    allerSur('/signup?campagne=ONEMONTHFREE')
    memoriserCodeCampagne()
    repond(200, { ok: true, applique: true })

    expect(await presenterCodeCampagne(supabaseOk)).toBe(true)
    allerSur('/auth/callback')
    expect(await presenterCodeCampagne(supabaseOk), 'la seconde réponse contredit la première').toBe(true)
  })

  it('oublierCodeCampagne efface vraiment', () => {
    allerSur('/signup?campagne=ONEMONTHFREE')
    memoriserCodeCampagne()
    allerSur('/')
    expect(codeCampagneCourant()).toBe('ONEMONTHFREE')
    oublierCodeCampagne()
    expect(codeCampagneCourant()).toBe(null)
  })
})
