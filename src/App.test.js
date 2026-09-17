// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

/**
 * La déconnexion, depuis le routeur de l'application.
 *
 *   - un closer qui se déconnecte de son espace arrive sur /closer/connexion,
 *     pas sur l'accueil marchand ;
 *   - le cache React Query est vidé, au clic comme sur l'événement
 *     SIGNED_OUT de Supabase (autre onglet, session expirée) : les données
 *     d'un compte ne doivent pas servir au suivant dans le même navigateur.
 *
 * Le vrai App est monté ; les pages et Supabase sont remplacés.
 */

const h = vi.hoisted(() => ({ ecouteurs: [], client: null, signOut: null }))

vi.mock('./lib/supabase', () => ({
  INITIAL_URL: { hash: '', search: '', path: '/closer' },
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: (ecouteur) => {
        h.ecouteurs.push(ecouteur)
        return { data: { subscription: { unsubscribe() {} } } }
      },
      signOut: (...args) => h.signOut(...args),
    },
  },
}))
vi.mock('./lib/analytics', () => ({ resetUser: () => {} }))
vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }))
vi.mock('./pages/LandingPage', () => ({ LandingPage: () => null }))
vi.mock('./components/auth/LoginPage', () => ({ LoginPage: () => null }))
vi.mock('./components/auth/DashboardGate', () => ({ DashboardGate: () => null }))
vi.mock('./components/ui/cursor-glow', () => ({ CursorGlow: () => null }))
vi.mock('./components/ui/command-palette', () => ({ CommandPalette: () => null }))
vi.mock('./components/ui/Toaster', () => ({ Toaster: () => null }))
vi.mock('./pages/closer/CloserConnexionPage', async () => {
  const { createElement } = await import('react')
  return { CloserConnexionPage: () => createElement('p', null, 'Connexion closer') }
})
vi.mock('./pages/closer/CloserEspacePage', async () => {
  const { createElement } = await import('react')
  const { useQueryClient } = await import('@tanstack/react-query')
  return {
    CloserEspacePage: ({ onLogout }) => {
      h.client = useQueryClient()
      return createElement('button', { type: 'button', onClick: onLogout }, 'Déconnexion')
    },
  }
})

let App
let conteneur
let racine

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  ;({ default: App } = await import('./App.jsx'))
})

beforeEach(async () => {
  h.ecouteurs = []
  h.signOut = vi.fn(async () => ({ error: null }))
  window.history.replaceState({}, '', '/closer')
  window.scrollTo = () => {}
  conteneur = document.createElement('div')
  racine = createRoot(conteneur)
  await act(async () => {
    racine.render(React.createElement(App))
  })
  await act(async () => {
    await new Promise((fin) => setTimeout(fin, 20))
  })
})

afterEach(() => {
  act(() => racine.unmount())
})

const bouton = () => [...conteneur.querySelectorAll('button')].find((b) => b.textContent === 'Déconnexion')

describe('App — déconnexion', () => {
  it('un closer qui se déconnecte arrive sur /closer/connexion, cache vidé', async () => {
    expect(bouton(), 'l’espace closer factice n’a pas été rendu').toBeTruthy()
    h.client.setQueryData(['closer-moi'], { fiche: { code: 'ACT-AAAAA' } })

    await act(async () => {
      bouton().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      await new Promise((fin) => setTimeout(fin, 20))
    })

    expect(h.signOut).toHaveBeenCalledTimes(1)
    expect(window.location.pathname).toBe('/closer/connexion')
    expect(conteneur.textContent).toContain('Connexion closer')
    expect(h.client.getQueryData(['closer-moi'])).toBeUndefined()
  })

  it('SIGNED_OUT venu de Supabase vide le cache ; un autre événement non', async () => {
    expect(h.ecouteurs.length).toBeGreaterThan(0)
    h.client.setQueryData(['closer-moi'], { fiche: { code: 'ACT-AAAAA' } })

    act(() => h.ecouteurs.forEach((e) => e('TOKEN_REFRESHED', { user: { id: 'u-1' } })))
    expect(h.client.getQueryData(['closer-moi'])).toBeTruthy()

    act(() => h.ecouteurs.forEach((e) => e('SIGNED_OUT', null)))
    expect(h.client.getQueryData(['closer-moi'])).toBeUndefined()
  })
})
