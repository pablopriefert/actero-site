import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock @supabase/supabase-js ──────────────────────────────────
// We define mutable state at module level so individual tests can configure it.
let mockUser = null
let mockClientLink = null
let mockClientRow = null
let mockUpdateError = null

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: () => ({
      auth: {
        getUser: async (_token) => {
          if (!mockUser) return { data: { user: null }, error: new Error('Invalid token') }
          return { data: { user: mockUser }, error: null }
        },
      },
      from: (table) => ({
        select: (cols) => ({
          eq: (col, val) => ({
            maybeSingle: async () => {
              if (table === 'client_users') {
                return { data: mockClientLink, error: null }
              }
              if (table === 'clients' && cols === 'id') {
                // owner fallback
                return { data: mockClientRow ? { id: mockClientRow.id } : null, error: null }
              }
              if (table === 'clients') {
                return { data: mockClientRow, error: null }
              }
              return { data: null, error: null }
            },
          }),
        }),
        update: (_payload) => ({
          eq: (_col, _val) => Promise.resolve({ error: mockUpdateError }),
        }),
      }),
    }),
  }
})

import handler from './update-portal-branding.js'

// ─── Helpers ─────────────────────────────────────────────────────
function makeReqRes(body, token = 'valid-token') {
  return {
    req: {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body,
    },
    res: {
      statusCode: 200,
      body: null,
      status(c) { this.statusCode = c; return this },
      json(b) { this.body = b; return this },
    },
  }
}

// ─── Tests ───────────────────────────────────────────────────────
describe('update-portal-branding', () => {
  beforeEach(() => {
    // Reset to a valid pro client by default
    mockUser = { id: 'user-1' }
    mockClientLink = { client_id: 'client-pro' }
    mockClientRow = { id: 'client-pro', plan: 'pro', trial_ends_at: null }
    mockUpdateError = null

    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  })

  // ── Happy path ────────────────────────────────────────────────

  it('happy path: pro client with valid input returns ok', async () => {
    const { req, res } = makeReqRes({
      portal_display_name: 'Horace · Service client',
      portal_logo_url: 'https://cdn.example.com/logo.png',
      portal_primary_color: '#0F5F35',
    })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.branding).toBeDefined()
  })

  it('happy path: enterprise client returns ok', async () => {
    mockClientRow = { id: 'client-ent', plan: 'enterprise', trial_ends_at: null }
    mockClientLink = { client_id: 'client-ent' }
    const { req, res } = makeReqRes({
      portal_display_name: 'BigCorp SAV',
      portal_primary_color: '#123456',
    })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('happy path: empty portal_logo_url nulls it out', async () => {
    const { req, res } = makeReqRes({
      portal_logo_url: '',
      portal_primary_color: '#aabbcc',
    })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.branding.portal_logo_url).toBeNull()
  })

  // ── Plan gating ───────────────────────────────────────────────

  it('rejects free plan client with 403', async () => {
    mockClientRow = { id: 'client-free', plan: 'free', trial_ends_at: null }
    mockClientLink = { client_id: 'client-free' }
    const { req, res } = makeReqRes({ portal_display_name: 'Test', portal_primary_color: '#aabbcc' })
    await handler(req, res)
    expect(res.statusCode).toBe(403)
    expect(res.body.error).toMatch(/Pro/)
  })

  it('rejects starter plan client with 403', async () => {
    mockClientRow = { id: 'client-starter', plan: 'starter', trial_ends_at: null }
    mockClientLink = { client_id: 'client-starter' }
    const { req, res } = makeReqRes({ portal_display_name: 'Test', portal_primary_color: '#aabbcc' })
    await handler(req, res)
    expect(res.statusCode).toBe(403)
  })

  // ── Validation ────────────────────────────────────────────────

  it('rejects portal_primary_color with invalid hex → 400', async () => {
    const { req, res } = makeReqRes({
      portal_primary_color: 'not-a-hex',
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/hex/)
  })

  it('rejects portal_primary_color with short hex → 400', async () => {
    const { req, res } = makeReqRes({
      portal_primary_color: '#FFF',
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
  })

  it('rejects portal_display_name over 60 chars → 400', async () => {
    const { req, res } = makeReqRes({
      portal_display_name: 'A'.repeat(61),
      portal_primary_color: '#aabbcc',
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/60/)
  })

  it('rejects non-HTTPS logo URL → 400', async () => {
    const { req, res } = makeReqRes({
      portal_logo_url: 'http://insecure.com/logo.png',
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/HTTPS/)
  })

  it('rejects non-URL logo → 400', async () => {
    const { req, res } = makeReqRes({
      portal_logo_url: 'not-a-url',
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
  })

  // ── Auth ──────────────────────────────────────────────────────

  it('rejects missing auth token with 401', async () => {
    const { req, res } = makeReqRes({ portal_primary_color: '#aabbcc' }, null)
    req.headers = {}
    await handler(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('rejects invalid token with 401', async () => {
    mockUser = null
    const { req, res } = makeReqRes({ portal_primary_color: '#aabbcc' }, 'bad-token')
    await handler(req, res)
    expect(res.statusCode).toBe(401)
  })

  // ── Method ───────────────────────────────────────────────────

  it('rejects GET with 405', async () => {
    const { req, res } = makeReqRes({})
    req.method = 'GET'
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })
})
