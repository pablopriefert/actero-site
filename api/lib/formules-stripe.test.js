import { describe, it, expect, vi } from 'vitest'
import { prixDeLaFormule, aDejaEuUnAbonnement } from './formules-stripe.js'
import { formulePour } from './formules.js'

describe('lectures Stripe des formules', () => {
  it('retrouve le prix actif d’une formule par sa clé', async () => {
    const list = vi.fn(async () => ({ data: [{ id: 'price_pa', lookup_key: 'actero_pro_annuel', unit_amount: 395010, currency: 'eur', recurring: { interval: 'year', interval_count: 1 } }] }))
    const prix = await prixDeLaFormule({ prices: { list } }, formulePour('pro', 'annuel'))
    expect(prix.id).toBe('price_pa')
    expect(list).toHaveBeenCalledWith({ lookup_keys: ['actero_pro_annuel'], active: true, limit: 1 })
  })

  it('renvoie null quand le prix n’existe pas', async () => {
    const stripe = { prices: { list: async () => ({ data: [] }) } }
    expect(await prixDeLaFormule(stripe, formulePour('starter', 'mensuel'))).toBeNull()
  })

  it('un prix qui ne facture plus le montant du catalogue n’est pas utilisé', async () => {
    const ancien = { id: 'price_ancien', lookup_key: 'actero_pro_annuel', unit_amount: 382800, currency: 'eur', recurring: { interval: 'year', interval_count: 1 } }
    const stripe = { prices: { list: async () => ({ data: [ancien] }) } }
    expect(await prixDeLaFormule(stripe, formulePour('pro', 'annuel'))).toBeNull()
  })

  it('« déjà abonné » regarde tous les statuts', async () => {
    const list = vi.fn(async () => ({ data: [{ id: 'sub_old', status: 'canceled' }] }))
    expect(await aDejaEuUnAbonnement({ subscriptions: { list } }, 'cus_1')).toBe(true)
    expect(list).toHaveBeenCalledWith({ customer: 'cus_1', status: 'all', limit: 1 })
  })

  it('un client Stripe sans abonnement n’a jamais été abonné', async () => {
    expect(await aDejaEuUnAbonnement({ subscriptions: { list: async () => ({ data: [] }) } }, 'cus_1')).toBe(false)
  })

  it('une erreur Stripe remonte, elle ne vaut pas « jamais abonné »', async () => {
    const stripe = { subscriptions: { list: async () => { throw new Error('réseau') } } }
    await expect(aDejaEuUnAbonnement(stripe, 'cus_1')).rejects.toThrow('réseau')
  })
})
