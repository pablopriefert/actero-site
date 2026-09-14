import { describe, it, expect } from 'vitest'
import { planUpdateFromSubscription } from './subscription-plan.js'

const PRICE_MAP = { price_pro_m: 'pro', price_starter_m: 'starter' }
const sub = (over = {}) => ({
  status: 'active',
  default_payment_method: 'pm_1',
  items: { data: [{ price: { id: 'price_pro_m' } }] },
  ...over,
})

describe('planUpdateFromSubscription', () => {
  it('does NOT grant a plan for a trialing sub with no payment method', () => {
    const u = planUpdateFromSubscription(sub({ status: 'trialing', default_payment_method: null }), PRICE_MAP)
    expect(u.plan).toBeUndefined()
    expect(u.status).toBeUndefined()
  })

  it('grants when trialing WITH a payment method', () => {
    const u = planUpdateFromSubscription(sub({ status: 'trialing', trial_end: 1893456000 }), PRICE_MAP)
    expect(u.plan).toBe('pro')
    expect(u.status).toBe('active')
    expect(u.trial_ends_at).toBeTruthy()
  })

  it('grants when active WITH a payment method', () => {
    expect(planUpdateFromSubscription(sub(), PRICE_MAP).plan).toBe('pro')
  })

  it('does NOT grant when active but no payment method', () => {
    expect(planUpdateFromSubscription(sub({ default_payment_method: null }), PRICE_MAP).plan).toBeUndefined()
  })

  it('does NOT grant for incomplete', () => {
    expect(planUpdateFromSubscription(sub({ status: 'incomplete', default_payment_method: null }), PRICE_MAP).plan).toBeUndefined()
  })

  it('downgrades to free on canceled/unpaid', () => {
    expect(planUpdateFromSubscription(sub({ status: 'canceled' }), PRICE_MAP).plan).toBe('free')
    expect(planUpdateFromSubscription(sub({ status: 'unpaid' }), PRICE_MAP).plan).toBe('free')
  })
})
