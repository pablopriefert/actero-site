import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  FORMULES, PERIODES, PERIODE_API, PERIODE_DEPUIS_API,
  formulePour, formuleDuPrix, mensualiteCentimes, premierPaiementCentimes, libellePeriodeStripe,
} from './formules.js'
import { PLANS } from '../../src/lib/plans.js'

/**
 * Le catalogue est la seule définition des formules payantes.
 *
 * Il remplace quatre variables d'environnement STRIPE_PRICE_* qu'il fallait
 * copier à la main dans Vercel, et plusieurs lectures de `recurring.interval`
 * qui confondaient « facturé au mois » et « un mois de service » : un prix
 * « tous les 13 mois » a lui aussi `interval: 'month'`.
 */
describe('le catalogue des formules', () => {
  it('six formules payantes : deux plans, trois périodes', () => {
    expect(FORMULES).toHaveLength(6)
    for (const plan of ['starter', 'pro']) {
      for (const periode of PERIODES) {
        expect(formulePour(plan, periode), `${plan} ${periode}`).not.toBeNull()
      }
    }
    expect(formulePour('enterprise', 'mensuel')).toBeNull()
  })

  it('le mensuel est le prix affiché des plans', () => {
    expect(formulePour('starter', 'mensuel').montantCentimes).toBe(PLANS.starter.price.monthly * 100)
    expect(formulePour('pro', 'mensuel').montantCentimes).toBe(PLANS.pro.price.monthly * 100)
  })

  it('le trimestriel vaut trois mensualités, et son coupon la moitié d’une', () => {
    for (const plan of ['starter', 'pro']) {
      const mensuel = formulePour(plan, 'mensuel').montantCentimes
      const trimestriel = formulePour(plan, 'trimestriel')
      expect(trimestriel.montantCentimes).toBe(3 * mensuel)
      expect(trimestriel.recurring).toEqual({ interval: 'month', interval_count: 3 })
      expect(trimestriel.coupon.montantCentimes).toBe(mensuel / 2)
    }
  })

  it('l’annuel vaut douze mensualités moins 10 %, facturées tous les 13 mois', () => {
    for (const plan of ['starter', 'pro']) {
      const mensuel = formulePour(plan, 'mensuel').montantCentimes
      const annuel = formulePour(plan, 'annuel')
      expect(annuel.montantCentimes).toBe(Math.round(12 * mensuel * 0.9))
      expect(annuel.recurring).toEqual({ interval: 'month', interval_count: 13 })
      expect(annuel.mois).toBe(13)
      expect(annuel.coupon).toBeUndefined()
    }
  })

  it('les montants validés par Pablo le 14 septembre', () => {
    expect(premierPaiementCentimes(formulePour('starter', 'trimestriel'))).toBe(24750)
    expect(premierPaiementCentimes(formulePour('pro', 'trimestriel'))).toBe(99750)
    expect(formulePour('starter', 'annuel').montantCentimes).toBe(106920)
    expect(formulePour('pro', 'annuel').montantCentimes).toBe(430920)
    expect(premierPaiementCentimes(formulePour('pro', 'mensuel'))).toBe(39900)
  })

  it('clés de recherche et identifiants de coupon sont uniques', () => {
    const cles = FORMULES.map((f) => f.lookupKey)
    expect(new Set(cles).size).toBe(cles.length)
    const coupons = FORMULES.filter((f) => f.coupon).map((f) => f.coupon.id)
    expect(new Set(coupons).size).toBe(2)
  })

  it('un prix Stripe retrouve sa formule par sa clé, et seulement par elle', () => {
    expect(formuleDuPrix({ id: 'price_x', lookup_key: 'actero_pro_trimestriel' }))
      .toMatchObject({ plan: 'pro', periode: 'trimestriel' })
    expect(formuleDuPrix({ id: 'price_sur_mesure', lookup_key: null })).toBeNull()
    expect(formuleDuPrix({ lookup_key: 'autre_chose' })).toBeNull()
    expect(formuleDuPrix(null)).toBeNull()
  })

  it('la mensualité d’un prix Stripe tient compte du nombre de mois', () => {
    expect(mensualiteCentimes({ unit_amount: 9900, recurring: { interval: 'month', interval_count: 1 } })).toBe(9900)
    expect(mensualiteCentimes({ unit_amount: 29700, recurring: { interval: 'month', interval_count: 3 } })).toBe(9900)
    expect(mensualiteCentimes({ unit_amount: 106920, recurring: { interval: 'month', interval_count: 13 } })).toBe(8225)
    expect(mensualiteCentimes({ unit_amount: 94800, recurring: { interval: 'year', interval_count: 1 } })).toBe(7900)
    expect(mensualiteCentimes({ unit_amount: 500, recurring: { interval: 'week', interval_count: 1 } })).toBe(0)
    expect(mensualiteCentimes({ unit_amount: null, recurring: { interval: 'month' } })).toBe(0)
  })

  it('un libellé de période lisible', () => {
    expect(libellePeriodeStripe({ interval: 'month', interval_count: 1 })).toBe('mois')
    expect(libellePeriodeStripe({ interval: 'month', interval_count: 3 })).toBe('3 mois')
    expect(libellePeriodeStripe({ interval: 'month', interval_count: 13 })).toBe('13 mois')
    expect(libellePeriodeStripe({ interval: 'year', interval_count: 1 })).toBe('an')
  })

  it('périodes de l’API (anglais, historique) ↔ périodes du catalogue', () => {
    expect(PERIODE_API).toEqual({ mensuel: 'monthly', trimestriel: 'quarterly', annuel: 'annual' })
    expect(PERIODE_DEPUIS_API).toEqual({ monthly: 'mensuel', quarterly: 'trimestriel', annual: 'annuel' })
  })

  it('le catalogue reste importable par le navigateur', () => {
    // La page tarifs et la facturation l'importent : aucune dépendance Node.
    const src = readFileSync('api/lib/formules.js', 'utf8')
    expect(src).not.toMatch(/from ['"](node:|stripe|@supabase)/)
  })
})
