// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

/**
 * /signup — « Renvoyer le code ».
 *
 * Le défaut de production : l'URL portait un accent
 * (`/api/auth/send-vérification-code`), la route répondait 404, et la page
 * annonçait « Nouveau code envoyé ! » sans lire la réponse. Le marchand
 * attendait un code qui ne partait jamais.
 *
 * La vraie page est montée ; Supabase, la mesure d'audience et `fetch` sont
 * remplacés.
 */

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: async () => ({ error: null }), signInWithOAuth: async () => ({ error: null }) } },
}))
vi.mock('../lib/analytics', () => ({ trackEvent: () => {} }))
vi.mock('../components/SEO', () => ({ SEO: () => null }))

let SignupPage
let conteneur
let racine
let reponseRenvoi

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  ;({ SignupPage } = await import('./SignupPage.jsx'))
})

beforeEach(async () => {
  window.history.replaceState({}, '', '/signup')
  let appels = 0
  globalThis.fetch = vi.fn(async () => {
    appels += 1
    return appels === 1 ? { ok: true, status: 200, json: async () => ({ success: true }) } : reponseRenvoi
  })
  conteneur = document.createElement('div')
  racine = createRoot(conteneur)
  await act(async () => {
    racine.render(React.createElement(SignupPage, { onNavigate: () => {} }))
  })
  // Le formulaire, puis l'étape du code.
  saisir('input[type="email"]', 'marchand@exemple.fr')
  saisir('input[autocomplete="new-password"]', 'motdepasse-solide')
  saisir('input[autocomplete="organization"]', 'Ma Boutique')
  await act(async () => {
    conteneur.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
})

afterEach(() => {
  act(() => racine.unmount())
})

function saisir(selecteur, valeur) {
  const champ = conteneur.querySelector(selecteur)
  const ecrire = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  act(() => {
    ecrire.call(champ, valeur)
    champ.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function renvoyer() {
  const bouton = [...conteneur.querySelectorAll('button')].find((b) => b.textContent.startsWith('Renvoyer le code'))
  expect(bouton, 'l’étape du code n’est pas affichée').toBeTruthy()
  await act(async () => {
    bouton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('SignupPage — renvoyer le code', () => {
  it('appelle la route sans accent', async () => {
    reponseRenvoi = { ok: true, status: 200, json: async () => ({ success: true }) }
    await renvoyer()
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(globalThis.fetch.mock.calls[1][0]).toBe('/api/auth/send-verification-code')
    expect(conteneur.textContent).toContain('Nouveau code envoyé !')
  })

  it('un refus du serveur affiche son erreur, pas « Nouveau code envoyé ! »', async () => {
    reponseRenvoi = { ok: false, status: 429, json: async () => ({ error: 'Trop de demandes. Réessayez plus tard.' }) }
    await renvoyer()
    expect(conteneur.textContent).toContain('Trop de demandes. Réessayez plus tard.')
    expect(conteneur.textContent).not.toContain('Nouveau code envoyé')
  })

  it('une réponse illisible affiche un message d’échec', async () => {
    reponseRenvoi = { ok: false, status: 404, json: async () => { throw new SyntaxError('pas du JSON') } }
    await renvoyer()
    expect(conteneur.textContent).toContain('Le code n’a pas pu être renvoyé. Réessayez.')
    expect(conteneur.textContent).not.toContain('Nouveau code envoyé')
  })
})
