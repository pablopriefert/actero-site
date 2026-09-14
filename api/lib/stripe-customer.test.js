import { describe, it, expect, vi } from 'vitest'
import { getOrCreateStripeCustomer } from './stripe-customer.js'

function makeSupabase() {
  const updates = []
  return {
    _updates: updates,
    from: () => ({ update: (row) => ({ eq: (_c, id) => { updates.push({ row, id }); return Promise.resolve({ error: null }) } }) }),
  }
}

describe('getOrCreateStripeCustomer', () => {
  it('returns the stored id when the customer still exists', async () => {
    const stripe = {
      customers: {
        retrieve: vi.fn(async () => ({ id: 'cus_ok', deleted: false })),
        create: vi.fn(),
      },
    }
    const sb = makeSupabase()
    const id = await getOrCreateStripeCustomer(stripe, sb, { clientId: 'c1', currentId: 'cus_ok' })
    expect(id).toBe('cus_ok')
    expect(stripe.customers.create).not.toHaveBeenCalled()
  })

  it('recreates when the stored customer is missing (wrong key/mode)', async () => {
    const stripe = {
      customers: {
        retrieve: vi.fn(async () => { const e = new Error('No such customer'); e.code = 'resource_missing'; throw e }),
        create: vi.fn(async () => ({ id: 'cus_new' })),
      },
    }
    const sb = makeSupabase()
    const id = await getOrCreateStripeCustomer(stripe, sb, { clientId: 'c1', currentId: 'cus_dead', email: 'a@b.com' })
    expect(id).toBe('cus_new')
    expect(sb._updates[0]).toEqual({ row: { stripe_customer_id: 'cus_new' }, id: 'c1' })
  })

  it('recreates when the stored customer was deleted', async () => {
    const stripe = {
      customers: {
        retrieve: vi.fn(async () => ({ id: 'cus_x', deleted: true })),
        create: vi.fn(async () => ({ id: 'cus_new' })),
      },
    }
    const id = await getOrCreateStripeCustomer(stripe, makeSupabase(), { clientId: 'c1', currentId: 'cus_x' })
    expect(id).toBe('cus_new')
  })

  it('creates fresh when no id stored', async () => {
    const stripe = { customers: { retrieve: vi.fn(), create: vi.fn(async () => ({ id: 'cus_fresh' })) } }
    const id = await getOrCreateStripeCustomer(stripe, makeSupabase(), { clientId: 'c1', currentId: null })
    expect(id).toBe('cus_fresh')
    expect(stripe.customers.retrieve).not.toHaveBeenCalled()
  })

  it('bubbles up non-recoverable errors (e.g. auth)', async () => {
    const stripe = {
      customers: {
        retrieve: vi.fn(async () => { const e = new Error('bad key'); e.code = 'authentication_error'; throw e }),
        create: vi.fn(),
      },
    }
    await expect(getOrCreateStripeCustomer(stripe, makeSupabase(), { clientId: 'c1', currentId: 'cus_x' })).rejects.toThrow('bad key')
  })
})
