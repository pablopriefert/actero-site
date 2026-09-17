// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

/**
 * /auth/callback — l'aiguillage après une connexion.
 *
 * La vraie page est montée. Supabase, le rôle, la création du client et les
 * deux codes (closer, campagne) sont remplacés par des doubles qui notent
 * chaque appel dans l'ordre. Le module de l'espace closer est le vrai : il lit
 * sessionStorage et appelle /api/closer/devenir-closer par `fetch`.
 *
 * Deux défauts visés :
 *   - le rôle était lu en dernier : un admin présentait le code closer et le
 *     code de campagne mémorisés, et passait par la création de client ;
 *   - un retour Google closer arrivé ici (au lieu de /closer/callback) suivait
 *     le parcours marchand, création de client comprise.
 */

const h = vi.hoisted(() => ({ role: 'client', journal: [] }))

vi.mock('../lib/supabase', () => {
  const session = { access_token: 'jeton', user: { id: 'u-1', email: 'x@ex.com' } }
  return {
    INITIAL_URL: { hash: '', search: '', path: '/auth/callback' },
    supabase: {
      auth: {
        getSession: async () => ({ data: { session }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
    },
  }
})
vi.mock('../lib/auth-utils', () => ({
  fetchUserRole: async () => {
    h.journal.push('rôle')
    return h.role
  },
}))
vi.mock('../lib/resolve-client', () => ({
  resolveOrCreateClientId: async () => {
    h.journal.push('client')
    return 'c-1'
  },
}))
vi.mock('../lib/campagne', () => ({
  codeCampagneCourant: () => 'PUB-TEST',
  presenterCodeCampagne: async () => {
    h.journal.push('code campagne')
    return false
  },
}))
vi.mock('../lib/code-closer', () => ({
  codeCloserCourant: () => 'ACT-AAAAA',
  presenterCodeCloser: async () => {
    h.journal.push('code closer')
    return false
  },
  destinationApresRattachement: () => null,
}))
vi.mock('../components/SEO', () => ({ SEO: () => null }))

let AuthCallbackPage
let memoriserIntentionGoogle
let lireIntentionGoogle

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  ;({ AuthCallbackPage } = await import('./AuthCallbackPage.jsx'))
  ;({ memoriserIntentionGoogle, lireIntentionGoogle } = await import('../lib/espace-closer.js'))
})

beforeEach(() => {
  h.role = 'client'
  h.journal = []
  sessionStorage.clear()
  globalThis.fetch = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ fiche: {} }) }))
})

async function ouvrir() {
  const onNavigate = vi.fn()
  const racine = createRoot(document.createElement('div'))
  await act(async () => {
    racine.render(React.createElement(AuthCallbackPage, { onNavigate }))
  })
  await act(async () => {
    await new Promise((fin) => setTimeout(fin, 20))
  })
  act(() => racine.unmount())
  return onNavigate
}

const appelsDevenirCloser = () => globalThis.fetch.mock.calls.filter(([url]) => url === '/api/closer/devenir-closer')

describe('AuthCallbackPage — le rôle d’abord', () => {
  it('un admin va vers /admin sans présenter de code ni créer de client', async () => {
    h.role = 'admin'
    memoriserIntentionGoogle('inscription')
    const onNavigate = await ouvrir()
    expect(onNavigate.mock.calls).toEqual([['/admin']])
    expect(h.journal).toEqual(['rôle'])
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(lireIntentionGoogle()).toBeNull()
  })

  it('un marchand : le rôle est lu avant les codes et la création du client', async () => {
    const onNavigate = await ouvrir()
    expect(h.journal[0]).toBe('rôle')
    expect(h.journal).toEqual(['rôle', 'client', 'code closer', 'client', 'code campagne'])
    expect(onNavigate.mock.calls).toEqual([['/client']])
  })
})

describe('AuthCallbackPage — un retour Google closer arrivé ici', () => {
  it('après une inscription : crée la fiche closer puis mène à /closer, sans client marchand', async () => {
    memoriserIntentionGoogle('inscription')
    const onNavigate = await ouvrir()
    expect(appelsDevenirCloser()).toHaveLength(1)
    const [, options] = appelsDevenirCloser()[0]
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer jeton')
    expect(onNavigate.mock.calls).toEqual([['/closer']])
    expect(h.journal).toEqual(['rôle'])
    expect(lireIntentionGoogle()).toBeNull()
  })

  it('une fiche qui ne se crée pas ne bloque pas : direction /closer quand même', async () => {
    memoriserIntentionGoogle('inscription')
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: 'erreur_interne' }) }))
    const onNavigate = await ouvrir()
    expect(onNavigate.mock.calls).toEqual([['/closer']])
    expect(h.journal).toEqual(['rôle'])
  })

  it('après une connexion : aucune fiche créée, direction /closer', async () => {
    memoriserIntentionGoogle('connexion')
    const onNavigate = await ouvrir()
    expect(appelsDevenirCloser()).toHaveLength(0)
    expect(onNavigate.mock.calls).toEqual([['/closer']])
    expect(h.journal).toEqual(['rôle'])
  })

  it('une intention trop ancienne est ignorée : parcours marchand', async () => {
    const maintenant = Date.now()
    const horloge = vi.spyOn(Date, 'now').mockReturnValue(maintenant - 16 * 60 * 1000)
    memoriserIntentionGoogle('inscription')
    horloge.mockRestore()
    const onNavigate = await ouvrir()
    expect(appelsDevenirCloser()).toHaveLength(0)
    expect(onNavigate.mock.calls).toEqual([['/client']])
  })
})
