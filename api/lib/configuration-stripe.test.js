import { describe, it, expect } from 'vitest'
import { configurerFormules } from './configuration-stripe.js'
import { FORMULES } from './formules.js'

/** Un compte Stripe en mémoire : juste ce que configurerFormules utilise. */
function faux({ produits = [], prix = [], coupons = [] } = {}) {
  const etat = { produits: [...produits], prix: [...prix], coupons: [...coupons], appels: [] }
  let n = 0
  const id = (p) => `${p}_${++n}`
  etat.stripe = {
    products: {
      list: async () => ({ data: etat.produits.filter((p) => p.active !== false), has_more: false }),
      create: async (d) => { const p = { id: id('prod'), active: true, ...d }; etat.produits.push(p); etat.appels.push(['products.create', d]); return p },
    },
    prices: {
      list: async () => ({ data: etat.prix.filter((p) => p.active !== false), has_more: false }),
      create: async (d) => {
        if (d.transfer_lookup_key) for (const x of etat.prix) if (x.lookup_key === d.lookup_key) x.lookup_key = null
        const p = { id: id('price'), active: true, currency: 'eur', ...d }; etat.prix.push(p); etat.appels.push(['prices.create', d]); return p
      },
      update: async (pid, d) => {
        if (d.transfer_lookup_key) for (const x of etat.prix) if (x.id !== pid && x.lookup_key === d.lookup_key) x.lookup_key = null
        const p = etat.prix.find((x) => x.id === pid); Object.assign(p, d); etat.appels.push(['prices.update', pid, d]); return p
      },
    },
    coupons: {
      retrieve: async (cid) => {
        const c = etat.coupons.find((x) => x.id === cid)
        if (!c) { const e = new Error('No such coupon'); e.code = 'resource_missing'; throw e }
        return c
      },
      create: async (d) => { etat.coupons.push(d); etat.appels.push(['coupons.create', d]); return d },
    },
  }
  return etat
}

describe('configurerFormules', () => {
  it('compte vierge : crée les produits, les six prix avec leur clé, et les deux coupons', async () => {
    const e = faux()
    const r = await configurerFormules(e.stripe)
    expect(e.produits).toHaveLength(2)
    for (const f of FORMULES) {
      const p = e.prix.find((x) => x.lookup_key === f.lookupKey)
      expect(p, f.lookupKey).toBeTruthy()
      expect(p.unit_amount).toBe(f.montantCentimes)
      expect(p.recurring).toEqual(f.recurring)
    }
    expect(e.coupons.map((c) => c.id).sort()).toEqual(['actero-trimestriel-pro-19950', 'actero-trimestriel-starter-4950'])
    expect(e.coupons.find((c) => c.id === 'actero-trimestriel-pro-19950')).toMatchObject({ amount_off: 19950, currency: 'eur', duration: 'once' })
    expect(r.formules.every((x) => x.action === 'cree')).toBe(true)
    expect(r.anciensPrixDesactives).toEqual([])
  })

  it('reprend l’ancien prix mensuel sans doublon, et désactive l’ancien annuel à 948 €', async () => {
    const e = faux({
      produits: [{ id: 'prod_s', metadata: { actero_plan: 'starter' } }, { id: 'prod_p', metadata: { actero_plan: 'pro' } }],
      prix: [
        { id: 'price_sm', product: 'prod_s', unit_amount: 9900, currency: 'eur', recurring: { interval: 'month', interval_count: 1 }, lookup_key: null, active: true },
        { id: 'price_sa', product: 'prod_s', unit_amount: 94800, currency: 'eur', recurring: { interval: 'year', interval_count: 1 }, lookup_key: null, active: true },
      ],
    })
    const r = await configurerFormules(e.stripe)
    expect(e.prix.find((p) => p.id === 'price_sm').lookup_key).toBe('actero_starter_mensuel')
    expect(e.prix.filter((p) => p.unit_amount === 9900)).toHaveLength(1)
    expect(e.prix.find((p) => p.id === 'price_sa').active).toBe(false)
    expect(r.anciensPrixDesactives).toEqual(['price_sa'])
    expect(e.produits).toHaveLength(2)
  })

  it('un prix qui porte la clé mais plus le bon montant est remplacé, et la clé passe au nouveau prix', async () => {
    // Un prix Stripe ne change plus de montant une fois créé : quand le catalogue
    // change (l'annuel a changé deux fois le 14 septembre), il faut un nouveau prix.
    const e = faux({
      produits: [{ id: 'prod_s', metadata: { actero_plan: 'starter' } }, { id: 'prod_p', metadata: { actero_plan: 'pro' } }],
      prix: [
        { id: 'price_13mois', product: 'prod_s', unit_amount: 106920, currency: 'eur', recurring: { interval: 'month', interval_count: 13 }, lookup_key: 'actero_starter_annuel', active: true },
      ],
    })
    const r = await configurerFormules(e.stripe)
    const annuel = r.formules.find((x) => x.lookupKey === 'actero_starter_annuel')
    expect(annuel.action).toBe('remplace')
    expect(e.prix.find((p) => p.id === annuel.prixId)).toMatchObject({ unit_amount: 98010, lookup_key: 'actero_starter_annuel' })
    expect(e.prix.find((p) => p.id === 'price_13mois').lookup_key).toBeNull()
  })

  it('deuxième passage : rien n’est créé, et les nouveaux annuels restent actifs', async () => {
    const e = faux()
    await configurerFormules(e.stripe)
    const avant = e.appels.length
    const r = await configurerFormules(e.stripe)
    expect(e.appels.slice(avant).filter(([nom]) => nom.endsWith('.create'))).toEqual([])
    expect(r.formules.every((x) => x.action === 'existant')).toBe(true)
    expect(r.anciensPrixDesactives).toEqual([])
    const annuels = e.prix.filter((p) => p.lookup_key?.endsWith('_annuel'))
    expect(annuels).toHaveLength(2)
    expect(annuels.every((p) => p.active)).toBe(true)
  })
})
