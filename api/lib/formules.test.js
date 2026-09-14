import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  FORMULES, PERIODES, PERIODE_API, PERIODE_DEPUIS_API,
  formulePour, formuleDuPrix, mensualiteCentimes, premierPaiementCentimes, libellePeriodeStripe,
  periodeDepuisApi, prixConforme,
} from './formules.js'
import { PLANS } from '../../src/lib/plans.js'

/**
 * Le catalogue est la seule définition des formules payantes.
 *
 * Il remplace quatre variables d'environnement STRIPE_PRICE_* qu'il fallait
 * copier à la main dans Vercel, et plusieurs lectures de `recurring.interval`
 * qui confondaient « facturé au mois » et « un mois de service » : un prix
 * trimestriel a lui aussi `interval: 'month'`.
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

  it('l’annuel vaut onze mensualités moins 10 %, pour 12 mois facturés chaque année', () => {
    // Révision du 14 septembre : « 12 mois pour le prix de 11, à −10 % ».
    for (const plan of ['starter', 'pro']) {
      const mensuel = formulePour(plan, 'mensuel').montantCentimes
      const annuel = formulePour(plan, 'annuel')
      expect(annuel.montantCentimes).toBe(Math.round(11 * mensuel * 0.9))
      expect(annuel.recurring).toEqual({ interval: 'year', interval_count: 1 })
      expect(annuel.mois).toBe(12)
      expect(annuel.coupon).toBeUndefined()
    }
  })

  it('les montants validés par Pablo le 14 septembre', () => {
    expect(premierPaiementCentimes(formulePour('starter', 'trimestriel'))).toBe(24750)
    expect(premierPaiementCentimes(formulePour('pro', 'trimestriel'))).toBe(99750)
    expect(formulePour('starter', 'annuel').montantCentimes).toBe(98010)
    expect(formulePour('pro', 'annuel').montantCentimes).toBe(395010)
    expect(premierPaiementCentimes(formulePour('pro', 'mensuel'))).toBe(39900)
  })

  it('chaque formule est cohérente avec elle-même', () => {
    const MOIS = { mensuel: 1, trimestriel: 3, annuel: 12 }
    for (const f of FORMULES) {
      // La clé est un contrat avec Stripe : le webhook en déduit le plan.
      expect(f.lookupKey).toBe(`actero_${f.plan}_${f.periode}`)
      expect(f.mois, f.lookupKey).toBe(MOIS[f.periode])
      // `mois` (affichage) et `recurring` (Stripe, MRR) disent la même durée.
      expect(mensualiteCentimes({ unit_amount: f.mois * 100, recurring: f.recurring }), f.lookupKey).toBe(100)
      // Stripe refuse un unit_amount ou un amount_off non entier.
      for (const m of [f.montantCentimes, f.coupon?.montantCentimes ?? 1]) {
        expect(Number.isInteger(m) && m > 0, f.lookupKey).toBe(true)
      }
      expect(premierPaiementCentimes(f), f.lookupKey).toBeGreaterThan(0)
      // Un coupon Stripe ne change plus de montant une fois créé : son
      // identifiant porte le sien, pour qu'un nouveau montant crée un nouveau coupon.
      if (f.coupon) expect(f.coupon.id).toBe(`actero-trimestriel-${f.plan}-${f.coupon.montantCentimes}`)
    }
  })

  it('clés de recherche et identifiants de coupon sont uniques', () => {
    const cles = FORMULES.map((f) => f.lookupKey)
    expect(new Set(cles).size).toBe(cles.length)
    const coupons = FORMULES.filter((f) => f.coupon).map((f) => f.coupon.id)
    expect(coupons).toHaveLength(2)
    expect(new Set(coupons).size).toBe(coupons.length)
  })

  it('le catalogue est figé : une modification lève une erreur au lieu de le corrompre', () => {
    // Il est partagé par toutes les requêtes d'une instance Vercel et par toute
    // la session du navigateur.
    expect(() => { formulePour('starter', 'trimestriel').coupon.montantCentimes = 0 }).toThrow(TypeError)
    expect(() => { FORMULES.push({}) }).toThrow(TypeError)
    expect(() => { PERIODE_API.mensuel = 'weekly' }).toThrow(TypeError)
    expect(() => { PERIODES.push('semestriel') }).toThrow(TypeError)
    expect(() => { PERIODE_DEPUIS_API.monthly = 'annuel' }).toThrow(TypeError)
    expect(formulePour('starter', 'trimestriel').coupon.montantCentimes).toBe(4950)
  })

  it('un prix Stripe retrouve sa formule par sa clé, et seulement par elle', () => {
    expect(formuleDuPrix({ id: 'price_x', lookup_key: 'actero_pro_trimestriel' }))
      .toMatchObject({ plan: 'pro', periode: 'trimestriel' })
    expect(formuleDuPrix({ id: 'price_sur_mesure', lookup_key: null })).toBeNull()
    expect(formuleDuPrix({ lookup_key: 'autre_chose' })).toBeNull()
    expect(formuleDuPrix(null)).toBeNull()
  })

  it('un prix Stripe n’est conforme que s’il facture exactement la formule', () => {
    // Un prix Stripe ne change plus de montant : si le catalogue évolue, la
    // configuration doit le voir, sinon le site affiche un montant et Checkout
    // en facture un autre.
    const f = formulePour('pro', 'annuel')
    const prix = { unit_amount: 395010, currency: 'eur', recurring: { interval: 'year', interval_count: 1 } }
    expect(prixConforme(f, prix)).toBe(true)
    expect(prixConforme(f, { ...prix, unit_amount: 382800 })).toBe(false)
    expect(prixConforme(f, { ...prix, currency: 'usd' })).toBe(false)
    expect(prixConforme(f, { ...prix, recurring: { interval: 'month', interval_count: 12 } })).toBe(false)
    expect(prixConforme(f, { unit_amount: 395010, currency: 'eur' })).toBe(false)
    expect(prixConforme(f, null)).toBe(false)
    // Même intervalle, autre fréquence : 297 € par mois ne sont pas le trimestriel.
    expect(prixConforme(formulePour('starter', 'trimestriel'), { unit_amount: 29700, currency: 'eur', recurring: { interval: 'month', interval_count: 1 } })).toBe(false)
  })

  it('la mensualité d’un prix Stripe tient compte du nombre de mois', () => {
    expect(mensualiteCentimes({ unit_amount: 9900, recurring: { interval: 'month', interval_count: 1 } })).toBe(9900)
    expect(mensualiteCentimes({ unit_amount: 29700, recurring: { interval: 'month', interval_count: 3 } })).toBe(9900)
    expect(mensualiteCentimes({ unit_amount: 98010, recurring: { interval: 'year', interval_count: 1 } })).toBe(8168)
    expect(mensualiteCentimes({ unit_amount: 94800, recurring: { interval: 'year', interval_count: 1 } })).toBe(7900)
    expect(mensualiteCentimes({ unit_amount: 500, recurring: { interval: 'week', interval_count: 1 } })).toBe(0)
    expect(mensualiteCentimes({ unit_amount: null, recurring: { interval: 'month' } })).toBe(0)
  })

  it('les cas limites que lisent le webhook et le MRR', () => {
    // Un paiement ponctuel ou un prix absent ne comptent pas dans le MRR.
    expect(mensualiteCentimes({ unit_amount: 5000 })).toBe(0)
    expect(mensualiteCentimes(null)).toBe(0)
    // Stripe envoie toujours interval_count ; absent, il vaut 1.
    expect(mensualiteCentimes({ unit_amount: 9900, recurring: { interval: 'month' } })).toBe(9900)
    // Aucune formule n'est facturée à la journée.
    expect(mensualiteCentimes({ unit_amount: 100, recurring: { interval: 'day', interval_count: 1 } })).toBe(0)
    // Le vocabulaire de l'API n'est pas celui du catalogue.
    expect(formulePour('starter', 'monthly')).toBeNull()
    // Un prix non développé (simple identifiant) ou absent : aucune formule.
    expect(formuleDuPrix(undefined)).toBeNull()
    expect(formuleDuPrix('price_123')).toBeNull()
  })

  it('un libellé de période lisible', () => {
    expect(libellePeriodeStripe({ interval: 'month', interval_count: 1 })).toBe('mois')
    expect(libellePeriodeStripe({ interval: 'month', interval_count: 3 })).toBe('3 mois')
    expect(libellePeriodeStripe({ interval: 'month', interval_count: 6 })).toBe('6 mois')
    expect(libellePeriodeStripe({ interval: 'year', interval_count: 1 })).toBe('an')
  })

  it('périodes de l’API (anglais, historique) ↔ périodes du catalogue', () => {
    expect(PERIODE_API).toEqual({ mensuel: 'monthly', trimestriel: 'quarterly', annuel: 'annual' })
    expect(PERIODE_DEPUIS_API).toEqual({ monthly: 'mensuel', quarterly: 'trimestriel', annual: 'annuel' })
  })

  it('une période reçue de l’API est validée, sans se laisser tromper par les clés héritées', () => {
    expect(periodeDepuisApi('quarterly')).toBe('trimestriel')
    expect(periodeDepuisApi('toString')).toBeNull()
    expect(periodeDepuisApi('__proto__')).toBeNull()
    expect(periodeDepuisApi(undefined)).toBeNull()
    expect(periodeDepuisApi(42)).toBeNull()
  })

  it('le catalogue reste importable par le navigateur', () => {
    // La page tarifs et la facturation l'importent : aucune dépendance, et rien
    // qui vaudrait autre chose côté navigateur (Vite remplace process.env par {}).
    const src = readFileSync('api/lib/formules.js', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(src).not.toMatch(/^\s*import\s|\bimport\(|\bimport\.meta\b|^\s*export\s[^\n]*\sfrom\s|\brequire\(|\bprocess\.|\bBuffer\b/m)
  })
})
