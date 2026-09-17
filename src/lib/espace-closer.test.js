import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Le client de l'espace closer : le fil d'activité passe par appelCloser,
 * avec le jeton de la session et des paramètres encodés.
 */

vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'jeton-a' } } }) } },
}))

const { lireActivite } = await import('./espace-closer.js')

beforeEach(() => {
  fetch.mockReset()
  fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ evenements: [], suivant: null, resume: null }) })
})

describe('lireActivite', () => {
  it.each([
    [undefined, '/api/closer/activite'],
    [{ famille: null, avant: undefined, client: '' }, '/api/closer/activite'],
    [{ famille: 'paiement' }, '/api/closer/activite?famille=paiement'],
    [
      { client: '11111111-1111-4111-8111-111111111111', avant: '2026-09-17T12:34:56.123456+00:00', limite: 20 },
      '/api/closer/activite?client=11111111-1111-4111-8111-111111111111&avant=2026-09-17T12%3A34%3A56.123456%2B00%3A00&limite=20',
    ],
  ])('%o → %s', async (options, url) => {
    expect(await lireActivite(options)).toEqual({ evenements: [], suivant: null, resume: null })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [appele, init] = fetch.mock.calls[0]
    expect(appele).toBe(url)
    expect(init.method).toBe('GET')
    expect(init.headers.Authorization).toBe('Bearer jeton-a')
  })

  it('une erreur du serveur remonte avec son statut et son code', async () => {
    fetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'client_introuvable', message: 'Ce client ne vous est pas rattaché.' }) })
    await expect(lireActivite({ client: '11111111-1111-4111-8111-111111111111' }))
      .rejects.toMatchObject({ status: 404, code: 'client_introuvable', message: 'Ce client ne vous est pas rattaché.' })
  })
})
