import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { planUpdateFromSubscription } from './subscription-plan.js'

const PRO_MENSUEL = { id: 'price_pm', lookup_key: 'actero_pro_mensuel' }
const sub = (over = {}, price = PRO_MENSUEL) => ({ status: 'active', items: { data: [{ price }] }, ...over })
const CARTE = { aUneCarte: true }
const SANS_CARTE = { aUneCarte: false }

function sansCommentaires(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('planUpdateFromSubscription', () => {
  it('n’accorde rien à un essai sans carte', () => {
    const u = planUpdateFromSubscription(sub({ status: 'trialing' }), SANS_CARTE)
    expect(u.plan).toBeUndefined()
    expect(u.status).toBeUndefined()
  })

  it('accorde en essai avec une carte', () => {
    const u = planUpdateFromSubscription(sub({ status: 'trialing', trial_end: 1893456000 }), CARTE)
    expect(u.plan).toBe('pro')
    expect(u.status).toBe('active')
    expect(u.trial_ends_at).toBeTruthy()
  })

  it('accorde un abonnement actif avec une carte', () => {
    expect(planUpdateFromSubscription(sub(), CARTE).plan).toBe('pro')
  })

  it('n’accorde rien sans carte', () => {
    expect(planUpdateFromSubscription(sub(), SANS_CARTE).plan).toBeUndefined()
  })

  it('sans information de carte, n’accorde rien', () => {
    expect(planUpdateFromSubscription(sub()).plan).toBeUndefined()
  })

  it('n’accorde rien pour incomplete', () => {
    expect(planUpdateFromSubscription(sub({ status: 'incomplete' }), CARTE).plan).toBeUndefined()
  })

  it('rétrograde en free sur canceled / unpaid, carte ou pas', () => {
    expect(planUpdateFromSubscription(sub({ status: 'canceled' }), SANS_CARTE).plan).toBe('free')
    expect(planUpdateFromSubscription(sub({ status: 'unpaid' }), CARTE).plan).toBe('free')
  })

  it('un prix trimestriel et un prix annuel donnent leur plan, sans variable d’environnement', () => {
    expect(planUpdateFromSubscription(sub({}, { id: 'p1', lookup_key: 'actero_starter_trimestriel' }), CARTE))
      .toMatchObject({ plan: 'starter', status: 'active', billing_period: 'quarterly', billing_provider: 'stripe' })
    expect(planUpdateFromSubscription(sub({}, { id: 'p2', lookup_key: 'actero_pro_annuel' }), CARTE))
      .toMatchObject({ plan: 'pro', billing_period: 'annual' })
  })

  it('un prix hors catalogue n’accorde aucun plan', () => {
    expect(planUpdateFromSubscription(sub({}, { id: 'price_sur_mesure', lookup_key: null }), CARTE).plan).toBeUndefined()
  })
})

describe('le webhook s’en sert comme prévu', () => {
  const webhook = sansCommentaires(readFileSync('api/stripe-webhook.js', 'utf8'))

  it('plus aucune table de prix construite depuis STRIPE_PRICE_*', () => {
    expect(webhook).not.toMatch(/STRIPE_PRICE_/)
  })

  it('la carte est résolue avant de décider du plan', () => {
    // Seul `subscription.default_payment_method` comptait : une carte rangée
    // sur le client Stripe n'accordait jamais le plan.
    const bloc = webhook.slice(webhook.indexOf("case 'customer.subscription.updated'"))
    expect(bloc).toMatch(/resolveCustomerCard\(/)
    expect(bloc).toMatch(/planUpdateFromSubscription\(subscription,\s*\{\s*aUneCarte/)
  })

  it('un abonnement payé hors catalogue laisse une trace', () => {
    // Offre sur mesure ou clé mal posée : aucun plan n'est accordé, et sans
    // trace, personne ne le verrait.
    const bloc = webhook.slice(webhook.indexOf("case 'customer.subscription.updated'"))
    expect(bloc).toMatch(/hors catalogue/)
  })
})
