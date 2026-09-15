import { describe, it, expect, vi } from 'vitest'
import { getOrCreateStripeCustomer, resolveCustomerCard, OPTIONS_REQUETE_COURTE } from './stripe-customer.js'

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

describe('resolveCustomerCard', () => {
  it('strict + customers.retrieve échoue : la promesse est rejetée', async () => {
    const stripe = {
      customers: { retrieve: vi.fn(async () => { throw new Error('retrieve KO') }) },
      paymentMethods: { list: vi.fn() },
    }
    await expect(resolveCustomerCard(stripe, {}, 'cus_1', { strict: true })).rejects.toThrow('retrieve KO')
    // En mode strict, on ne tente pas la liste après une panne : on relance direct.
    expect(stripe.paymentMethods.list).not.toHaveBeenCalled()
  })

  it('strict + paymentMethods.list échoue : la promesse est rejetée', async () => {
    const stripe = {
      customers: { retrieve: vi.fn(async () => ({ invoice_settings: {} })) },
      paymentMethods: { list: vi.fn(async () => { throw new Error('list KO') }) },
    }
    await expect(resolveCustomerCard(stripe, {}, 'cus_1', { strict: true })).rejects.toThrow('list KO')
  })

  it('sans le mode strict, customers.retrieve en échec retombe sur la liste (comportement inchangé)', async () => {
    const stripe = {
      customers: { retrieve: vi.fn(async () => { throw new Error('retrieve KO') }) },
      paymentMethods: { list: vi.fn(async () => ({ data: [{ id: 'pm_repli' }] })) },
    }
    await expect(resolveCustomerCard(stripe, {}, 'cus_1')).resolves.toBe('pm_repli')
  })

  it('sans le mode strict, paymentMethods.list en échec renvoie null (comportement inchangé)', async () => {
    const stripe = {
      customers: { retrieve: vi.fn(async () => ({ invoice_settings: {} })) },
      paymentMethods: { list: vi.fn(async () => { throw new Error('list KO') }) },
    }
    await expect(resolveCustomerCard(stripe, {}, 'cus_1')).resolves.toBeNull()
  })

  it('en mode strict, les deux appels Stripe reçoivent OPTIONS_REQUETE_COURTE', async () => {
    // Sans ce plafond par requête, le SDK Stripe (jusqu'à 80 s par tentative,
    // 2 réessais) peut dépasser les 60 s de la fonction Vercel : elle est
    // tuée avant que le `catch` ne s'exécute, et la réservation dans
    // `webhook_events_processed` reste posée pour rien — voir stripe-customer.js.
    const stripe = {
      customers: { retrieve: vi.fn(async () => ({ invoice_settings: {} })) },
      paymentMethods: { list: vi.fn(async () => ({ data: [{ id: 'pm_strict' }] })) },
    }
    await expect(resolveCustomerCard(stripe, {}, 'cus_1', { strict: true })).resolves.toBe('pm_strict')
    expect(stripe.customers.retrieve).toHaveBeenCalledWith('cus_1', {}, OPTIONS_REQUETE_COURTE)
    expect(stripe.paymentMethods.list).toHaveBeenCalledWith(
      { customer: 'cus_1', type: 'card', limit: 1 },
      OPTIONS_REQUETE_COURTE,
    )
  })

  it('sans le mode strict, les deux appels sont inchangés — mêmes arguments qu’avant', async () => {
    const stripe = {
      customers: { retrieve: vi.fn(async () => ({ invoice_settings: {} })) },
      paymentMethods: { list: vi.fn(async () => ({ data: [{ id: 'pm_repli' }] })) },
    }
    await expect(resolveCustomerCard(stripe, {}, 'cus_1')).resolves.toBe('pm_repli')
    // Un seul argument chacun : pas d'options ajoutées hors du mode strict.
    expect(stripe.customers.retrieve).toHaveBeenCalledWith('cus_1')
    expect(stripe.paymentMethods.list).toHaveBeenCalledWith({ customer: 'cus_1', type: 'card', limit: 1 })
  })
})
