import { describe, it, expect, vi } from 'vitest'
import { prixDeLaFormule, lireHistoriqueAbonnements, STATUTS_VIVANTS } from './formules-stripe.js'
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
})

describe('STATUTS_VIVANTS', () => {
  it('ce qu’un second abonnement viendrait doubler — sans incomplete', () => {
    expect(STATUTS_VIVANTS).toEqual(['active', 'past_due', 'unpaid', 'paused', 'trialing'])
    expect(() => STATUTS_VIVANTS.push('incomplete')).toThrow(TypeError)
  })
})

/** Un faux Stripe dont la liste ne rend que les abonnements du client demandé. */
function stripeAvec(abonnements, { hasMore = [] } = {}) {
  const list = vi.fn(async ({ customer }) => ({
    data: abonnements.filter((s) => s.customer === customer),
    has_more: hasMore.includes(customer),
  }))
  return { stripe: { subscriptions: { list } }, list }
}

describe('lireHistoriqueAbonnements — un seul relevé, sur tous les clients Stripe du compte', () => {
  it('lit chaque client Stripe une fois, sans les identifiants vides ni les doublons', async () => {
    const { stripe, list } = stripeAvec([])
    await lireHistoriqueAbonnements(stripe, [null, 'cus_1', '', 'cus_1', undefined, 'cus_ancien'])
    expect(list).toHaveBeenCalledTimes(2)
    expect(list).toHaveBeenCalledWith({ customer: 'cus_1', status: 'all', limit: 100 })
    expect(list).toHaveBeenCalledWith({ customer: 'cus_ancien', status: 'all', limit: 100 })
  })

  it('aucun identifiant exploitable : lève sans interroger Stripe', async () => {
    // Un « je ne sais pas » ne doit valoir ni « jamais abonné » ni « aucun
    // abonnement en cours » : la route ouvrirait Checkout sans rien vérifier.
    const { stripe, list } = stripeAvec([])
    for (const ids of [[], [null, '', undefined], undefined, null, 'cus_1']) {
      await expect(lireHistoriqueAbonnements(stripe, ids), JSON.stringify(ids)).rejects.toThrow(TypeError)
    }
    expect(list).not.toHaveBeenCalled()
  })

  it('un identifiant qui n’est pas une chaîne lève : il n’est pas « vide », il est illisible', async () => {
    // L'écarter en silence ferait sauter la lecture d'un client Stripe, et un
    // abonnement vivant chez lui passerait inaperçu.
    const { stripe, list } = stripeAvec([])
    for (const intrus of [42, { id: 'cus_2' }, true]) {
      await expect(lireHistoriqueAbonnements(stripe, ['cus_1', intrus]), String(intrus)).rejects.toThrow(TypeError)
    }
    expect(list).not.toHaveBeenCalled()
  })

  it('déjà abonné : un abonnement de n’importe quel client, quel que soit son statut, sauf incomplete_expired', async () => {
    let { stripe } = stripeAvec([{ id: 'sub_old', status: 'canceled', customer: 'cus_ancien' }])
    expect((await lireHistoriqueAbonnements(stripe, ['cus_1', 'cus_ancien'])).dejaAbonne).toBe(true)

    // Un formulaire de paiement ouvert puis abandonné laisse un
    // incomplete_expired sans qu'aucune facture n'ait été émise : il ne doit
    // pas coûter l'avantage de bienvenue.
    ;({ stripe } = stripeAvec([{ id: 'sub_x', status: 'incomplete_expired', customer: 'cus_1' }]))
    expect((await lireHistoriqueAbonnements(stripe, ['cus_1'])).dejaAbonne).toBe(false)

    ;({ stripe } = stripeAvec([]))
    expect(await lireHistoriqueAbonnements(stripe, ['cus_1', 'cus_ancien'])).toEqual({ dejaAbonne: false, vivants: [] })
  })

  it('vivants : les statuts de STATUTS_VIVANTS, chez tous les clients, sans doublon', async () => {
    const statuts = ['active', 'past_due', 'unpaid', 'paused', 'trialing', 'canceled', 'incomplete', 'incomplete_expired']
    const partage = { id: 'sub_partage', status: 'active', customer: 'cus_ancien' }
    const list = vi.fn(async ({ customer }) => ({
      data: customer === 'cus_1'
        ? statuts.map((status) => ({ id: `sub_${status}`, status, customer }))
        // Le même abonnement rendu deux fois ne doit compter qu'une fois.
        : [partage, partage],
      has_more: false,
    }))
    const { vivants, dejaAbonne } = await lireHistoriqueAbonnements({ subscriptions: { list } }, ['cus_1', 'cus_ancien'])
    expect(dejaAbonne).toBe(true)
    expect(vivants.map((s) => s.id)).toEqual(['sub_active', 'sub_past_due', 'sub_unpaid', 'sub_paused', 'sub_trialing', 'sub_partage'])
  })

  it('plus d’une page chez un seul des clients : lève, on ne peut pas conclure', async () => {
    const { stripe } = stripeAvec([{ id: 'sub_x', status: 'canceled', customer: 'cus_ancien' }], { hasMore: ['cus_ancien'] })
    await expect(lireHistoriqueAbonnements(stripe, ['cus_1', 'cus_ancien'])).rejects.toThrow(/cus_ancien/)
  })

  it('une erreur Stripe remonte, elle ne vaut ni « jamais abonné » ni « aucun abonnement en cours »', async () => {
    const list = vi.fn(async ({ customer }) => {
      if (customer === 'cus_ancien') throw new Error('réseau')
      return { data: [], has_more: false }
    })
    await expect(lireHistoriqueAbonnements({ subscriptions: { list } }, ['cus_1', 'cus_ancien'])).rejects.toThrow('réseau')
  })
})
