import { describe, it, expect } from 'vitest'
import { checkTicketQuota } from './plan-limits.js'

// free plan limit = 50 tickets (PLAN_LIMITS.free.tickets)
function makeSupabase({ ticketsUsed = 0, balance = 0 } = {}) {
  return {
    from() {
      return {
        select: () => ({
          eq: () => ({
            // usage_counters → .eq().eq().maybeSingle()
            eq: () => ({ maybeSingle: async () => ({ data: { tickets_used: ticketsUsed } }) }),
            // client_credits → .eq().maybeSingle()
            maybeSingle: async () => ({ data: { balance } }),
          }),
        }),
      }
    },
  }
}

describe('checkTicketQuota (hard cap, credits escape)', () => {
  it('always allows during trial', async () => {
    const r = await checkTicketQuota(makeSupabase({ ticketsUsed: 9999 }), { clientId: 'c1', plan: 'free', inTrial: true })
    expect(r.allowed).toBe(true)
    expect(r.useCredits).toBe(false)
  })

  it('allows when under the limit', async () => {
    const r = await checkTicketQuota(makeSupabase({ ticketsUsed: 10 }), { clientId: 'c1', plan: 'free', inTrial: false })
    expect(r.allowed).toBe(true)
    expect(r.useCredits).toBe(false)
  })

  it('at the limit with credits → allowed via credits', async () => {
    const r = await checkTicketQuota(makeSupabase({ ticketsUsed: 50, balance: 5 }), { clientId: 'c1', plan: 'free', inTrial: false })
    expect(r.allowed).toBe(true)
    expect(r.useCredits).toBe(true)
  })

  it('over the limit with no credits → blocked (hard cap)', async () => {
    const r = await checkTicketQuota(makeSupabase({ ticketsUsed: 60, balance: 0 }), { clientId: 'c1', plan: 'free', inTrial: false })
    expect(r.allowed).toBe(false)
    expect(r.useCredits).toBe(false)
  })

  it('paid plan over limit, no credits → blocked (no overage)', async () => {
    // starter limit = 1000
    const r = await checkTicketQuota(makeSupabase({ ticketsUsed: 1000, balance: 0 }), { clientId: 'c1', plan: 'starter', inTrial: false })
    expect(r.allowed).toBe(false)
  })
})
