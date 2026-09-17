// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

/**
 * /client renvoie un closer vers /closer — spec closers, famille de tests 7.
 *
 * Avant le programme closers, ouvrir /client connecté suffisait à créer une
 * boutique (ClientDashboard → resolveOrCreateClientId). Un compte closer sans
 * boutique doit être envoyé dans son espace, sans que le tableau de bord
 * marchand soit jamais rendu.
 *
 * Le vrai DashboardGate est monté ; seuls Supabase, le rôle et les deux
 * tableaux de bord sont remplacés.
 */

const h = vi.hoisted(() => ({ rendusMarchand: 0, reponseCloser: 404 }))

vi.mock('../../lib/supabase', () => {
  const chaine = { select: () => chaine, eq: () => chaine, maybeSingle: async () => ({ data: null, error: null }) }
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { access_token: 'jeton', user: { id: 'u-1', email: 'x@ex.com' } } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      from: () => chaine,
    },
  }
})
vi.mock('../../lib/auth-utils', () => ({ fetchUserRole: async () => 'client' }))
vi.mock('../../pages/AdminDashboard', () => ({ AdminDashboard: () => null }))
vi.mock('../../pages/ClientDashboard', () => ({
  ClientDashboard: () => {
    h.rendusMarchand += 1
    return null
  },
}))

let DashboardGate

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
  ;({ DashboardGate } = await import('./DashboardGate.jsx'))
})

afterAll(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  h.rendusMarchand = 0
  globalThis.fetch = vi.fn(async (url) => ({
    status: String(url) === '/api/closer/moi' ? h.reponseCloser : 404,
    ok: false,
    // Les corps de la vraie route (api/closer/moi.js, api/lib/fiche-closer.js).
    json: async () => ({ 200: { fiche: { code: 'ACT-AAAAA' } }, 404: { error: 'pas_de_fiche' } }[h.reponseCloser] ?? { error: 'indisponible' }),
  }))
})

async function ouvrir(route) {
  const onNavigate = vi.fn()
  const racine = createRoot(document.createElement('div'))
  await act(async () => {
    racine.render(React.createElement(DashboardGate, { currentRoute: route, onNavigate, onLogout: () => {} }))
  })
  await act(async () => {
    await new Promise((fin) => setTimeout(fin, 20))
  })
  act(() => racine.unmount())
  return onNavigate
}

describe('DashboardGate — séparation des espaces', () => {
  it('un compte closer sans boutique qui ouvre /client part vers /closer, sans tableau de bord marchand', async () => {
    h.reponseCloser = 200
    const onNavigate = await ouvrir('/client')
    expect(onNavigate).toHaveBeenCalledWith('/closer')
    expect(h.rendusMarchand).toBe(0)
  })

  it('un compte sans fiche closer garde le tableau de bord marchand', async () => {
    h.reponseCloser = 404
    const onNavigate = await ouvrir('/client')
    expect(onNavigate).not.toHaveBeenCalledWith('/closer')
    expect(h.rendusMarchand).toBeGreaterThan(0)
  })

  it('l’API closer en panne ne bloque pas un marchand', async () => {
    h.reponseCloser = 503
    const onNavigate = await ouvrir('/client')
    expect(onNavigate).not.toHaveBeenCalledWith('/closer')
    expect(h.rendusMarchand).toBeGreaterThan(0)
  })
})
