// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

/**
 * Les pages d'accès closer, montées pour de vrai : inscription, connexion,
 * retour Google. Supabase et `fetch` sont remplacés ; le module de l'espace
 * closer est le vrai.
 */

const h = vi.hoisted(() => ({
  url: { hash: '', search: '', path: '/closer/inscription' },
  connexion: null,
  reinitialisation: null,
  session: null,
}))

vi.mock('../../lib/supabase', () => ({
  INITIAL_URL: h.url,
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: h.session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: (...args) => h.connexion(...args),
      resetPasswordForEmail: (...args) => h.reinitialisation(...args),
      signInWithOAuth: async () => ({ error: null }),
    },
  },
}))
vi.mock('../../components/SEO', () => ({ SEO: () => null }))

let pages
let espace
let conteneur
let racine
let onNavigate

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  pages = {
    ...(await import('./CloserInscriptionPage.jsx')),
    ...(await import('./CloserConnexionPage.jsx')),
    ...(await import('./CloserCallbackPage.jsx')),
  }
  espace = await import('../../lib/espace-closer.js')
})

beforeEach(() => {
  Object.assign(h.url, { hash: '', search: '', path: '/closer/inscription' })
  h.connexion = vi.fn(async () => ({ error: null }))
  h.reinitialisation = vi.fn(async () => ({ error: null }))
  h.session = null
  sessionStorage.clear()
  onNavigate = vi.fn()
  conteneur = document.createElement('div')
  document.body.appendChild(conteneur)
  racine = createRoot(conteneur)
})

afterEach(() => {
  act(() => racine.unmount())
  conteneur.remove()
  vi.useRealTimers()
})

async function monter(Page) {
  await act(async () => {
    racine.render(React.createElement(Page, { onNavigate }))
  })
  await vider()
}

/** Laisse passer les promesses en cours (sans horloge : elle peut être simulée). */
async function vider() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await Promise.resolve()
    })
  }
}

const bouton = (debut) => [...conteneur.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(debut))

async function cliquer(debut) {
  const b = bouton(debut)
  expect(b, `bouton « ${debut} » introuvable`).toBeTruthy()
  await act(async () => {
    b.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await vider()
}

function saisir(libelle, valeur) {
  const champ = [...conteneur.querySelectorAll('label')].find((l) => l.textContent.startsWith(libelle))?.querySelector('input')
  expect(champ, `champ « ${libelle} » introuvable`).toBeTruthy()
  const ecrire = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  act(() => {
    ecrire.call(champ, valeur)
    champ.dispatchEvent(new Event('input', { bubbles: true }))
  })
  return champ
}

async function soumettre() {
  await act(async () => {
    conteneur.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  await vider()
}

/** Une réponse d'API ; `enAttente` rend la main sans répondre, jusqu'à `repondre()`. */
function reponse(status, corps) {
  return { ok: status >= 200 && status < 300, status, json: async () => corps }
}

function differe() {
  let repondre
  const promesse = new Promise((r) => { repondre = r })
  return { promesse, repondre }
}

/** `fetch` qui répond selon la route, dans l'ordre des appels. */
function routes(table) {
  globalThis.fetch = vi.fn(async (url) => {
    const suite = table[url]
    expect(suite?.length, `appel inattendu : ${url}`).toBeGreaterThan(0)
    const r = suite.shift()
    return typeof r === 'function' ? r() : r
  })
}

async function jusquAuCode() {
  await monter(pages.CloserInscriptionPage)
  saisir('Prénom', 'Léa')
  saisir('Nom', 'Martin')
  saisir('E-mail', 'lea@exemple.fr')
  saisir('Mot de passe', 'motdepasse-solide')
  await soumettre()
}

describe('CloserInscriptionPage', () => {
  it('le champ du code prend le focus, et le renvoi attend 60 s avec un compte à rebours', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    routes({ '/api/closer/envoyer-code': [reponse(200, { ok: true })] })
    await jusquAuCode()

    const champ = [...conteneur.querySelectorAll('label')].find((l) => l.textContent.startsWith('Code reçu')).querySelector('input')
    expect(document.activeElement).toBe(champ)
    expect(bouton('Renvoyer le code').textContent).toBe('Renvoyer le code (60 s)')
    expect(bouton('Renvoyer le code').disabled).toBe(true)

    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(bouton('Renvoyer le code').textContent).toBe('Renvoyer le code (59 s)')
    for (let i = 0; i < 59; i++) {
      await act(async () => { vi.advanceTimersByTime(1000) })
    }
    expect(bouton('Renvoyer le code').textContent).toBe('Renvoyer le code')
    expect(bouton('Renvoyer le code').disabled).toBe(false)
  })

  it('pendant un renvoi, le bouton principal ne dit pas « Vérification… » ; ensuite, un retour visible et une nouvelle attente', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const renvoi = differe()
    routes({ '/api/closer/envoyer-code': [reponse(200, { ok: true }), () => renvoi.promesse] })
    await jusquAuCode()
    for (let i = 0; i < 60; i++) {
      await act(async () => { vi.advanceTimersByTime(1000) })
    }
    saisir('Code reçu', '123456')

    await cliquer('Renvoyer le code')
    expect(bouton('Envoi…')).toBeTruthy()
    expect(bouton('Créer mon espace')).toBeTruthy()
    expect(conteneur.textContent).not.toContain('Vérification…')

    await act(async () => { renvoi.repondre(reponse(200, { ok: true })) })
    await vider()
    expect(conteneur.querySelector('[role="status"]').textContent).toBe('Un nouveau code vient de partir à lea@exemple.fr. Il remplace le précédent.')
    expect(bouton('Renvoyer le code').textContent).toBe('Renvoyer le code (60 s)')
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('un renvoi refusé affiche l’erreur du serveur', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    routes({
      '/api/closer/envoyer-code': [
        reponse(200, { ok: true }),
        reponse(429, { error: 'trop_de_demandes', message: 'Trop de demandes. Réessayez dans une heure.' }),
      ],
    })
    await jusquAuCode()
    for (let i = 0; i < 60; i++) {
      await act(async () => { vi.advanceTimersByTime(1000) })
    }
    await cliquer('Renvoyer le code')
    expect(conteneur.querySelector('[role="alert"]').textContent).toBe('Trop de demandes. Réessayez dans une heure.')
    expect(bouton('Renvoyer le code').disabled).toBe(false)
  })

  it.each([
    [2, 'Code incorrect. 2 essais restants.'],
    [1, 'Code incorrect. 1 essai restant.'],
    [0, 'Code incorrect. Plus aucun essai : demandez un nouveau code.'],
  ])('essais_restants = %s : « %s »', async (restants, attendu) => {
    routes({
      '/api/closer/envoyer-code': [reponse(200, { ok: true })],
      '/api/closer/verifier-code': [reponse(400, { error: 'code_incorrect', message: 'Code incorrect.', essais_restants: restants })],
    })
    await jusquAuCode()
    saisir('Code reçu', '123456')
    await soumettre()
    expect(conteneur.querySelector('[role="alert"]').textContent).toBe(attendu)
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('sans essais_restants, le message du serveur seul', async () => {
    routes({
      '/api/closer/envoyer-code': [reponse(200, { ok: true })],
      '/api/closer/verifier-code': [reponse(400, { error: 'code_expire', message: 'Code expiré ou inexistant. Demandez un nouveau code.' })],
    })
    await jusquAuCode()
    saisir('Code reçu', '123456')
    await soumettre()
    expect(conteneur.querySelector('[role="alert"]').textContent).toBe('Code expiré ou inexistant. Demandez un nouveau code.')
  })

  it('compte créé, connexion ratée : la page le dit et propose de se connecter', async () => {
    routes({
      '/api/closer/envoyer-code': [reponse(200, { ok: true })],
      '/api/closer/verifier-code': [reponse(200, { ok: true })],
    })
    h.connexion = vi.fn(async () => ({ error: { message: 'Invalid login credentials', status: 400 } }))
    await jusquAuCode()
    saisir('Code reçu', '123456')
    await soumettre()

    expect(h.connexion).toHaveBeenCalledWith({ email: 'lea@exemple.fr', password: 'motdepasse-solide' })
    expect(onNavigate).not.toHaveBeenCalled()
    expect(conteneur.textContent).toContain('Votre espace closer est créé, mais la connexion automatique n’a pas abouti.')
    await cliquer('Se connecter')
    expect(onNavigate).toHaveBeenCalledWith('/closer/connexion')
  })

  it('compte créé et connecté : direction /closer', async () => {
    routes({
      '/api/closer/envoyer-code': [reponse(200, { ok: true })],
      '/api/closer/verifier-code': [reponse(200, { ok: true })],
    })
    await jusquAuCode()
    saisir('Code reçu', '123456')
    await soumettre()
    expect(onNavigate.mock.calls).toEqual([['/closer']])
  })
})

describe('CloserConnexionPage — mot de passe oublié', () => {
  it('le bouton est désactivé pendant l’envoi, et une erreur de Supabase s’affiche', async () => {
    const envoi = differe()
    h.reinitialisation = vi.fn(() => envoi.promesse)
    await monter(pages.CloserConnexionPage)
    saisir('E-mail', 'lea@exemple.fr')

    await cliquer('Mot de passe oublié')
    expect(bouton('Envoi…').disabled).toBe(true)
    await cliquer('Envoi…')
    expect(h.reinitialisation).toHaveBeenCalledTimes(1)

    await act(async () => { envoi.repondre({ error: { status: 429, message: 'email rate limit exceeded' } }) })
    await vider()
    expect(conteneur.querySelector('[role="alert"]').textContent).toBe('Trop de demandes de réinitialisation. Réessayez dans quelques minutes.')
    expect(conteneur.querySelector('[role="status"]')).toBeNull()
    expect(bouton('Mot de passe oublié').disabled).toBe(false)
  })

  it('une autre erreur : un message générique, jamais « un e-mail vient de partir »', async () => {
    h.reinitialisation = vi.fn(async () => ({ error: { status: 500, message: 'boom' } }))
    await monter(pages.CloserConnexionPage)
    saisir('E-mail', 'lea@exemple.fr')
    await cliquer('Mot de passe oublié')
    expect(conteneur.querySelector('[role="alert"]').textContent).toBe('L’e-mail de réinitialisation n’a pas pu partir. Réessayez.')
    expect(conteneur.textContent).not.toContain('vient de partir')
  })

  it('un envoi réussi l’annonce', async () => {
    await monter(pages.CloserConnexionPage)
    saisir('E-mail', 'lea@exemple.fr')
    await cliquer('Mot de passe oublié')
    expect(h.reinitialisation).toHaveBeenCalledWith('lea@exemple.fr', { redirectTo: `${window.location.origin}/reset-password` })
    expect(conteneur.querySelector('[role="status"]').textContent).toBe('Si un compte existe pour cette adresse, un e-mail de réinitialisation vient de partir.')
  })
})

describe('CloserCallbackPage — refus de Google', () => {
  it.each([
    ['dans la requête', { search: '?error=access_denied&error_description=User+cancelled' }],
    ['dans le fragment', { hash: '#error=server_error&error_description=Unable' }],
  ])('un refus %s s’affiche tout de suite, et l’intention est oubliée', async (_cas, url) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    Object.assign(h.url, { path: '/closer/callback' }, url)
    espace.memoriserIntentionGoogle('inscription')
    await monter(pages.CloserCallbackPage)

    expect(conteneur.querySelector('[role="alert"]').textContent).toBe('La connexion Google a été refusée ou annulée. Réessayez.')
    expect(espace.lireIntentionGoogle()).toBeNull()
    await cliquer('Revenir à l’inscription')
    expect(onNavigate.mock.calls).toEqual([['/closer/inscription']])
  })

  it('sans refus : la session mène à /closer', async () => {
    Object.assign(h.url, { path: '/closer/callback' })
    h.session = { access_token: 'jeton', user: { id: 'u-1' } }
    espace.memoriserIntentionGoogle('connexion')
    await monter(pages.CloserCallbackPage)
    expect(onNavigate.mock.calls).toEqual([['/closer']])
    expect(conteneur.querySelector('[role="alert"]')).toBeNull()
  })
})
