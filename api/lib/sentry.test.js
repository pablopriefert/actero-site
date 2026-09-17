import { describe, it, expect, vi, beforeAll } from 'vitest'

/**
 * Sentry côté serveur (instrument.mjs, chargé par api/lib/sentry.js) : ce qui
 * part chez Sentry ne doit contenir ni le corps des requêtes (mots de passe,
 * IBAN, SIRET, adresses), ni les cookies, ni les jetons.
 *
 * `@sentry/node` est remplacé par un espion : la configuration est lue telle
 * qu'elle est passée à `Sentry.init`, sans rien initialiser ni envoyer.
 */

const h = vi.hoisted(() => ({ init: null, httpIntegration: null }))

vi.mock('@sentry/node', () => {
  h.init = vi.fn()
  h.httpIntegration = vi.fn((options) => ({ name: 'Http', options }))
  return { init: h.init, httpIntegration: h.httpIntegration }
})

let options

beforeAll(async () => {
  delete globalThis.__acteroSentryInitialized
  await import('./sentry.js')
  expect(h.init).toHaveBeenCalledTimes(1)
  options = h.init.mock.calls[0][0]
})

const evenement = () => ({
  message: 'HTTP 500 POST /api/closer/profil',
  request: {
    url: 'https://actero.fr/api/closer/profil',
    method: 'PATCH',
    data: { iban: 'FR7630006000011234567890189', password: 'secret' },
    cookies: { 'sb-access-token': 'jeton' },
    headers: {
      Authorization: 'Bearer jeton-secret',
      cookie: 'closer_code=ACT-AAAAA',
      // Les secrets partagés que des routes lisent dans leurs en-têtes.
      'x-internal-secret': 'secret-interne',
      'X-Engine-Secret': 'secret-moteur',
      'proxy-authorization': 'Basic jeton',
      'Content-Type': 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
  },
})

describe('Sentry côté serveur — rien de personnel ne part', () => {
  it('le corps des requêtes entrantes n’est jamais joint', () => {
    expect(h.httpIntegration).toHaveBeenCalledWith(expect.objectContaining({ maxIncomingRequestBodySize: 'none' }))
    const http = h.httpIntegration.mock.results[0].value
    expect(options.integrations).toContain(http)
  })

  it('sendDefaultPii est désactivé', () => {
    expect(options.sendDefaultPii).toBe(false)
  })

  it.each(['beforeSend', 'beforeSendTransaction'])('%s retire corps, cookies, Authorization, Cookie et en-têtes secrets', (crochet) => {
    const nettoye = options[crochet](evenement(), {})
    expect(nettoye.request).not.toHaveProperty('data')
    expect(nettoye.request).not.toHaveProperty('cookies')
    const entetes = Object.keys(nettoye.request.headers).map((e) => e.toLowerCase())
    expect(entetes).not.toContain('authorization')
    expect(entetes).not.toContain('cookie')
    // Le reste est gardé : il sert à comprendre l'erreur.
    expect(nettoye.request).toMatchObject({ url: 'https://actero.fr/api/closer/profil', method: 'PATCH' })
    expect(nettoye.request.headers).toEqual({ 'Content-Type': 'application/json', 'user-agent': 'Mozilla/5.0' })
    expect(nettoye.message).toBe('HTTP 500 POST /api/closer/profil')
    expect(JSON.stringify(nettoye)).not.toMatch(/FR76|secret|jeton|ACT-AAAAA/)
  })

  it('un événement sans requête passe tel quel', () => {
    const sansRequete = { message: 'x' }
    expect(options.beforeSend(sansRequete, {})).toEqual({ message: 'x' })
  })
})
