import { describe, it, expect, vi, beforeEach } from 'vitest'

const sent = []
vi.mock('./notify.js', () => ({
  notifyClient: vi.fn(async (_sb, p) => { sent.push({ via: 'notify', eventKey: p.eventKey }) }),
  sendClientEmail: vi.fn(async (_sb, _c, p) => { sent.push({ via: 'email', title: p.title }) }),
}))

import { maybeAlertQuota } from './quota-alerts.js'

/**
 * usage: { tickets_used, alerted_80_at, alerted_100_at }
 * claimWins: whether the conditional UPDATE ... IS NULL returns a row.
 */
function makeSupabase({ plan = 'free', trialEndsAt = null, usage, claimWins = true }) {
  const updates = []
  return {
    _updates: updates,
    from(table) {
      if (table === 'clients') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { plan, trial_ends_at: trialEndsAt } }) }) }) }
      }
      if (table === 'usage_counters') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: usage }) }) }) }),
          update: (row) => {
            updates.push(row)
            return { eq: () => ({ eq: () => ({ is: () => ({ select: async () => ({ data: claimWins ? [{ id: 'u1' }] : [], error: null }) }) }) }) }
          },
        }
      }
      // client_notifications_log
      return { insert: async () => ({ error: null }) }
    },
  }
}

beforeEach(() => { sent.length = 0 })

describe('maybeAlertQuota', () => {
  it('alerts at 100% and marks alerted_100_at', async () => {
    const sb = makeSupabase({ usage: { tickets_used: 50, alerted_80_at: null, alerted_100_at: null } })
    const r = await maybeAlertQuota(sb, { clientId: 'c1' })
    expect(r.alerted).toBe('100')
    expect(Object.keys(sb._updates[0])[0]).toBe('alerted_100_at')
    // both the opt-in channel and the guaranteed email fire
    expect(sent.map(s => s.via).sort()).toEqual(['email', 'notify'])
  })

  it('alerts at 80% (not 100) when between thresholds', async () => {
    const sb = makeSupabase({ usage: { tickets_used: 40, alerted_80_at: null, alerted_100_at: null } })
    const r = await maybeAlertQuota(sb, { clientId: 'c1' })
    expect(r.alerted).toBe('80')
    expect(Object.keys(sb._updates[0])[0]).toBe('alerted_80_at')
  })

  it('does not re-alert when already alerted (idempotent)', async () => {
    const sb = makeSupabase({ usage: { tickets_used: 60, alerted_80_at: 'x', alerted_100_at: 'x' } })
    const r = await maybeAlertQuota(sb, { clientId: 'c1' })
    expect(r.alerted).toBeNull()
    expect(sent).toHaveLength(0)
  })

  it('sends nothing when another concurrent caller won the claim', async () => {
    const sb = makeSupabase({ usage: { tickets_used: 50, alerted_80_at: null, alerted_100_at: null }, claimWins: false })
    const r = await maybeAlertQuota(sb, { clientId: 'c1' })
    expect(r.alerted).toBeNull()
    expect(sent).toHaveLength(0)
  })

  it('stays silent below 80%', async () => {
    const sb = makeSupabase({ usage: { tickets_used: 10, alerted_80_at: null, alerted_100_at: null } })
    expect((await maybeAlertQuota(sb, { clientId: 'c1' })).alerted).toBeNull()
    expect(sent).toHaveLength(0)
  })

  it('stays silent during a trial', async () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const sb = makeSupabase({ trialEndsAt: future, usage: { tickets_used: 999, alerted_80_at: null, alerted_100_at: null } })
    expect((await maybeAlertQuota(sb, { clientId: 'c1' })).alerted).toBeNull()
  })

  it('stays silent on unlimited plans', async () => {
    const sb = makeSupabase({ plan: 'enterprise', usage: { tickets_used: 99999, alerted_80_at: null, alerted_100_at: null } })
    expect((await maybeAlertQuota(sb, { clientId: 'c1' })).alerted).toBeNull()
  })
})
