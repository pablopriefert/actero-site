import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = {}
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }) },
    from: (table) => {
      if (table === 'ai_recommendations') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.reco, error: null }) }) }) }
      }
      if (table === 'client_users') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.membership, error: null }) }) }) }) }
      }
      if (table === 'clients') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) }
      }
      if (table === 'client_knowledge_base') {
        return { insert: (row) => { state.kbInsert = row; return Promise.resolve({ error: null }) } }
      }
      if (table === 'automation_events') {
        return { insert: () => ({ then: (cb) => { cb(); return { catch: () => {} } } }) }
      }
      return {}
    },
    rpc: (name, args) => { state.rpc = { name, args }; return Promise.resolve({ error: null }) },
  }),
}))

const { default: handler } = await import('./apply-recommendation.js')

function mockRes() {
  return { statusCode: 200, body: null, status(c) { this.statusCode = c; return this }, json(b) { this.body = b; return this }, end() { return this } }
}

beforeEach(() => {
  state.reco = { id: 'reco-1', client_id: 'client-1', status: 'pending', evidence: { kb_title: 'Assurance', kb_content: 'Assurés.' } }
  state.membership = { client_id: 'client-1' }
  state.kbInsert = null
  state.rpc = null
})

describe('apply-recommendation', () => {
  it('applies: inserts the KB entry and marks the reco implemented', async () => {
    const res = mockRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { reco_id: 'reco-1', action: 'apply' } }, res)
    expect(res.statusCode).toBe(200)
    expect(state.kbInsert.title).toBe('Assurance')
    expect(state.kbInsert.source).toBe('improvement_loop')
    expect(state.rpc).toEqual({ name: 'mark_ai_recommendation', args: { p_id: 'reco-1', p_status: 'implemented' } })
  })

  it('uses the merchant-edited title/content when provided', async () => {
    const res = mockRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { reco_id: 'reco-1', action: 'apply', title: 'Titre édité', content: 'Contenu édité' } }, res)
    expect(state.kbInsert.title).toBe('Titre édité')
    expect(state.kbInsert.content).toBe('Contenu édité')
  })

  it('dismiss: marks dismissed and does NOT touch the KB', async () => {
    const res = mockRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { reco_id: 'reco-1', action: 'dismiss' } }, res)
    expect(state.kbInsert).toBeNull()
    expect(state.rpc.args.p_status).toBe('dismissed')
  })

  it('403 when the caller does not own the client', async () => {
    state.membership = null
    const res = mockRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { reco_id: 'reco-1', action: 'apply' } }, res)
    expect(res.statusCode).toBe(403)
    expect(state.kbInsert).toBeNull()
  })
})
