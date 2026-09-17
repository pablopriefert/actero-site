import { describe, it, expect, vi } from 'vitest'
import { resolveOrCreateClientId } from './resolve-client.js'

function makeSupabase({ link = null, owned = null, insertId = 'c_new' } = {}) {
  const inserts = []
  function from(table) {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (table === 'client_users') return { data: link ? { client_id: link } : null }
            if (table === 'clients') return { data: owned ? { id: owned } : null }
            return { data: null }
          },
        }),
      }),
      insert: (row) => {
        inserts.push({ table, row })
        return { select: () => ({ single: async () => ({ data: { id: insertId }, error: null }) }) }
      },
    }
  }
  return { _inserts: inserts, from }
}

const session = { user: { id: 'u1', email: 'shop@ex.com', user_metadata: {} } }

describe('resolveOrCreateClientId', () => {
  it('returns the client_users link when present', async () => {
    const sb = makeSupabase({ link: 'c_link' })
    expect(await resolveOrCreateClientId(sb, session)).toBe('c_link')
    expect(sb._inserts).toHaveLength(0)
  })

  it('falls back to owner_user_id', async () => {
    const sb = makeSupabase({ owned: 'c_owned' })
    expect(await resolveOrCreateClientId(sb, session)).toBe('c_owned')
    expect(sb._inserts).toHaveLength(0)
  })

  it('creates client + link + settings when none exists', async () => {
    const sb = makeSupabase({ insertId: 'c_fresh' })
    const id = await resolveOrCreateClientId(sb, session)
    expect(id).toBe('c_fresh')
    const tables = sb._inserts.map((i) => i.table)
    expect(tables).toEqual(['clients', 'client_users', 'client_settings'])
    expect(sb._inserts[0].row.owner_user_id).toBe('u1')
  })

  it('un compte closer sans boutique : aucune création', async () => {
    // La séparation des espaces (spec closers) : /api/closer/moi rend la fiche.
    globalThis.fetch = vi.fn(async () => ({ status: 200, json: async () => ({ fiche: { code: 'ACT-AAAAA' } }) }))
    const sb = makeSupabase()
    await expect(resolveOrCreateClientId(sb, { ...session, access_token: 'jeton-closer' })).rejects.toThrow('compte_closer')
    expect(sb._inserts).toHaveLength(0)
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/closer/moi', { headers: { Authorization: 'Bearer jeton-closer' } })
  })

  it('un compte sans fiche closer (404), ou une API closer en panne : la boutique est créée', async () => {
    for (const reponse of [async () => ({ status: 404 }), async () => ({ status: 503 }), async () => { throw new TypeError('Failed to fetch') }]) {
      globalThis.fetch = vi.fn(reponse)
      const sb = makeSupabase({ insertId: 'c_marchand' })
      expect(await resolveOrCreateClientId(sb, { ...session, access_token: 'jeton' })).toBe('c_marchand')
      expect(sb._inserts.map((i) => i.table)).toEqual(['clients', 'client_users', 'client_settings'])
    }
  })

  it('throws without a session', async () => {
    await expect(resolveOrCreateClientId(makeSupabase(), {})).rejects.toThrow()
  })
})
