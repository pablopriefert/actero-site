import { describe, it, expect, vi } from 'vitest'
import { prixDeLaFormule, aDejaEuUnAbonnement, abonnementsVivants } from './formules-stripe.js'
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

  it('customerId vide ou non chaîne : lève', async () => {
    // Un « je ne sais pas » ne doit jamais valoir « jamais abonné » — la docstring
    // le promet, donc aucun appel Stripe ne doit être tenté avec un identifiant
    // inexploitable.
    const stripe = { subscriptions: { list: async () => { throw new Error('ne doit jamais être appelé') } } }
    await expect(aDejaEuUnAbonnement(stripe, '')).rejects.toThrow(TypeError)
    await expect(aDejaEuUnAbonnement(stripe, null)).rejects.toThrow(TypeError)
    await expect(aDejaEuUnAbonnement(stripe, undefined)).rejects.toThrow(TypeError)
    await expect(aDejaEuUnAbonnement(stripe, 42)).rejects.toThrow(TypeError)
  })

  it('« déjà abonné » regarde tous les statuts', async () => {
    const list = vi.fn(async () => ({ data: [{ id: 'sub_old', status: 'canceled' }] }))
    expect(await aDejaEuUnAbonnement({ subscriptions: { list } }, 'cus_1')).toBe(true)
    expect(list).toHaveBeenCalledWith({ customer: 'cus_1', status: 'all', limit: 100 })
  })

  it('un client Stripe sans abonnement n’a jamais été abonné', async () => {
    expect(await aDejaEuUnAbonnement({ subscriptions: { list: async () => ({ data: [] }) } }, 'cus_1')).toBe(false)
  })

  it('seulement incomplete_expired : jamais rien facturé, pas déjà abonné', async () => {
    // Un formulaire de paiement ouvert puis abandonné crée cet abonnement sans
    // qu'aucune facture n'ait jamais été émise — il ne doit pas coûter
    // l'avantage de bienvenue.
    const list = vi.fn(async () => ({ data: [{ id: 'sub_x', status: 'incomplete_expired' }], has_more: false }))
    expect(await aDejaEuUnAbonnement({ subscriptions: { list } }, 'cus_1')).toBe(false)
  })

  it('incomplete_expired avec d’autres pages possibles : prudence, compte comme déjà abonné', async () => {
    // has_more: true veut dire qu'une page suivante existe et qu'on ne sait pas
    // ce qu'elle contient — on ne peut pas affirmer « jamais abonné ».
    const list = vi.fn(async () => ({ data: [{ id: 'sub_x', status: 'incomplete_expired' }], has_more: true }))
    expect(await aDejaEuUnAbonnement({ subscriptions: { list } }, 'cus_1')).toBe(true)
  })

  it('une erreur Stripe remonte, elle ne vaut pas « jamais abonné »', async () => {
    const stripe = { subscriptions: { list: async () => { throw new Error('réseau') } } }
    await expect(aDejaEuUnAbonnement(stripe, 'cus_1')).rejects.toThrow('réseau')
  })
})

describe('abonnementsVivants — ce qu’un second abonnement viendrait doubler', () => {
  it('customerId vide ou non chaîne : lève sans interroger Stripe', async () => {
    // Un identifiant inexploitable ne doit jamais valoir « aucun abonnement en
    // cours » : la route ouvrirait Checkout par-dessus un abonnement vivant.
    const stripe = { subscriptions: { list: async () => { throw new Error('ne doit jamais être appelé') } } }
    for (const id of ['', null, undefined, 42]) {
      await expect(abonnementsVivants(stripe, id), String(id)).rejects.toThrow(TypeError)
    }
  })

  it('ne garde que les abonnements qui facturent encore, ou peuvent reprendre', async () => {
    const statuts = ['active', 'past_due', 'unpaid', 'paused', 'trialing', 'canceled', 'incomplete', 'incomplete_expired']
    const list = vi.fn(async () => ({ data: statuts.map((status) => ({ id: `sub_${status}`, status })), has_more: false }))
    const vivants = await abonnementsVivants({ subscriptions: { list } }, 'cus_1')
    expect(list).toHaveBeenCalledWith({ customer: 'cus_1', status: 'all', limit: 100 })
    expect(vivants.map((s) => s.id)).toEqual(['sub_active', 'sub_past_due', 'sub_unpaid', 'sub_paused', 'sub_trialing'])
  })

  it('un client Stripe sans abonnement n’en a aucun de vivant', async () => {
    const stripe = { subscriptions: { list: async () => ({ data: [], has_more: false }) } }
    expect(await abonnementsVivants(stripe, 'cus_1')).toEqual([])
  })

  it('une erreur Stripe remonte, elle ne vaut pas « aucun abonnement en cours »', async () => {
    const stripe = { subscriptions: { list: async () => { throw new Error('réseau') } } }
    await expect(abonnementsVivants(stripe, 'cus_1')).rejects.toThrow('réseau')
  })

  it('plus d’une page d’abonnements : lève plutôt que d’affirmer qu’il n’y en a pas d’autre', async () => {
    // Même prudence que aDejaEuUnAbonnement : un abonnement vivant peut se
    // trouver sur la page qu'on n'a pas lue.
    const stripe = { subscriptions: { list: async () => ({ data: [{ id: 'sub_x', status: 'canceled' }], has_more: true }) } }
    await expect(abonnementsVivants(stripe, 'cus_1')).rejects.toThrow(/page/)
  })
})
