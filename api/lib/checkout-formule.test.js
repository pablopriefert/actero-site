import { describe, it, expect } from 'vitest'
import { parametresCheckout } from './checkout-formule.js'
import { formulePour } from './formules.js'

const base = {
  clientId: 'c1', customer: 'cus_1', priceId: 'price_1', planActuel: 'free',
  siteUrl: 'https://actero.fr', promotionCodeId: null, parrainage: null, promoCode: null,
}
const params = (plan, periode, extra = {}) =>
  parametresCheckout({ ...base, formule: formulePour(plan, periode), offre: {}, ...extra })

describe('parametresCheckout', () => {
  it('pose toujours client_id sur l’abonnement', () => {
    // customer.subscription.updated retrouve le client par ce champ : sans lui,
    // un impayé ne ferait jamais repasser le compte en Free.
    for (const periode of ['mensuel', 'trimestriel', 'annuel']) {
      const p = params('pro', periode)
      expect(p.subscription_data.metadata.client_id, periode).toBe('c1')
      expect(p.subscription_data.metadata.formule).toBe(`pro_${periode}`)
    }
  })

  it('mensuel sans avantage : ni essai, ni remise, le champ code promo ouvert', () => {
    const p = params('starter', 'mensuel')
    expect(p.subscription_data.trial_period_days).toBeUndefined()
    expect(p.discounts).toBeUndefined()
    expect(p.allow_promotion_codes).toBe(true)
  })

  it('mensuel avec mois offert : l’essai accordé par le serveur', () => {
    expect(params('starter', 'mensuel', { offre: { essaiJours: 30 } }).subscription_data.trial_period_days).toBe(30)
  })

  it('trimestriel éligible : le coupon du plan, aucun essai', () => {
    const p = params('pro', 'trimestriel', { offre: { couponId: 'actero-trimestriel-pro-19950' } })
    expect(p.discounts).toEqual([{ coupon: 'actero-trimestriel-pro-19950' }])
    expect(p.subscription_data.trial_period_days).toBeUndefined()
    expect(p.allow_promotion_codes).toBeUndefined()
  })

  it('annuel : ni essai ni remise', () => {
    const p = params('starter', 'annuel')
    expect(p.subscription_data.trial_period_days).toBeUndefined()
    expect(p.discounts).toBeUndefined()
  })

  it('un code promo remplace le coupon du trimestriel', () => {
    const p = params('starter', 'trimestriel', { offre: { couponId: 'actero-trimestriel-starter-4950' }, promotionCodeId: 'promo_1' })
    expect(p.discounts).toEqual([{ promotion_code: 'promo_1' }])
  })

  it('discounts et allow_promotion_codes ne coexistent jamais', () => {
    for (const periode of ['mensuel', 'trimestriel', 'annuel']) {
      for (const offre of [{}, { essaiJours: 30 }, { couponId: 'actero-trimestriel-pro-19950' }]) {
        for (const promotionCodeId of [null, 'promo_1']) {
          const p = params('pro', periode, { offre, promotionCodeId })
          expect(!!p.discounts && !!p.allow_promotion_codes, `${periode} ${JSON.stringify(offre)} ${promotionCodeId}`).toBe(false)
        }
      }
    }
  })

  it('la carte est toujours demandée, mois offert compris', () => {
    expect(params('pro', 'mensuel', { offre: { essaiJours: 30 } }).payment_method_collection).toBe('always')
  })

  it('la session porte ce que la branche upgrade du webhook lit', () => {
    const p = params('pro', 'annuel', { planActuel: 'starter', promoCode: 'CODE' })
    expect(p.metadata).toMatchObject({ actero_client_id: 'c1', upgrade_from: 'starter', upgrade_to: 'pro', promo_code: 'CODE' })
    expect(p.line_items).toEqual([{ price: 'price_1', quantity: 1 }])
    expect(p.mode).toBe('subscription')
    expect(p.customer).toBe('cus_1')
  })

  it('parrainage : les métadonnées que le webhook et la récompense du parrain lisent', () => {
    const p = params('starter', 'mensuel', { parrainage: { parrainId: 'c0', code: 'PARRAIN1' } })
    expect(p.subscription_data.metadata).toMatchObject({ referral_first_month_free: 'true', referred_by_client_id: 'c0', referral_code: 'PARRAIN1' })
    expect(p.metadata.referral_code).toBe('PARRAIN1')
  })
})
