import { describe, it, expect } from 'vitest'
import { parametresCheckout } from './checkout-formule.js'
import { formulePour } from './formules.js'

/** Le prix Stripe qui facture exactement cette formule — celui que Checkout doit recevoir. */
const prixDe = (formule) => ({ id: 'price_1', lookup_key: formule.lookupKey })

const base = {
  clientId: 'c1', customer: 'cus_1', planActuel: 'free',
  siteUrl: 'https://actero.fr', promotionCodeId: null, parrainage: null, promoCode: null,
}
const params = (plan, periode, extra = {}) => {
  const formule = formulePour(plan, periode)
  return parametresCheckout({ ...base, formule, prix: prixDe(formule), offre: {}, ...extra })
}

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

  it('discounts et allow_promotion_codes ne coexistent jamais (clés exclusives)', () => {
    for (const periode of ['mensuel', 'trimestriel', 'annuel']) {
      for (const offre of [{}, { essaiJours: 30 }, { couponId: 'actero-trimestriel-pro-19950' }]) {
        for (const promotionCodeId of [null, 'promo_1']) {
          const p = params('pro', periode, { offre, promotionCodeId })
          expect('discounts' in p && 'allow_promotion_codes' in p, `${periode} ${JSON.stringify(offre)} ${promotionCodeId}`).toBe(false)
        }
      }
    }
  })

  it('la carte est toujours demandée, mois offert compris', () => {
    expect(params('pro', 'mensuel', { offre: { essaiJours: 30 } }).payment_method_collection).toBe('always')
  })

  it('la session porte ce que la branche upgrade du webhook lit', () => {
    const p = params('pro', 'annuel', { planActuel: 'starter' })
    expect(p.metadata).toMatchObject({ actero_client_id: 'c1', upgrade_from: 'starter', upgrade_to: 'pro' })
    expect(p.line_items).toEqual([{ price: 'price_1', quantity: 1 }])
    expect(p.mode).toBe('subscription')
    expect(p.customer).toBe('cus_1')
  })

  it('collecte de la TVA et mise à jour du client vont ensemble (couple exigé par Stripe)', () => {
    const p = params('pro', 'mensuel')
    expect(p.tax_id_collection.enabled).toBe(true)
    expect(p.customer_update.name).toBe('auto')
    expect(p.customer).toBe('cus_1')
  })

  describe('garde-fous', () => {
    it('formule hors catalogue : lève', () => {
      // Copie superficielle : mêmes champs, mais absente de FORMULES puisque
      // FORMULES.includes compare par référence — le cas d'une formule
      // reconstruite à la main plutôt que lue dans le catalogue.
      const formule = { ...formulePour('starter', 'mensuel') }
      expect(() => parametresCheckout({ ...base, formule, prix: prixDe(formule), offre: {} })).toThrow(TypeError)
    })

    it('un prix d’une autre formule que celle demandée : lève', () => {
      const formule = formulePour('starter', 'mensuel')
      const prix = prixDe(formulePour('pro', 'annuel'))
      expect(() => parametresCheckout({ ...base, formule, prix, offre: {} })).toThrow(TypeError)
    })

    it.each([-5, 1.5])('essaiJours %s : lève', (essaiJours) => {
      expect(() => params('starter', 'mensuel', { offre: { essaiJours } })).toThrow(TypeError)
    })
  })

  describe('parrainage', () => {
    it('un code de parrainage est posé en session et sur l’abonnement', () => {
      const p = params('starter', 'mensuel', { parrainage: { parrainId: 'c0', code: 'PARRAIN1' } })
      expect(p.subscription_data.metadata.referred_by_client_id).toBe('c0')
      expect(p.subscription_data.metadata.referral_code).toBe('PARRAIN1')
      expect(p.metadata.referral_code).toBe('PARRAIN1')
    })

    it('referral_code absent sans parrainage', () => {
      const p = params('starter', 'mensuel', { parrainage: null })
      expect('referral_code' in p.subscription_data.metadata).toBe(false)
      expect('referral_code' in p.metadata).toBe(false)
    })

    it('referral_code absent quand le parrainage n’a pas de code', () => {
      const p = params('starter', 'mensuel', { parrainage: { parrainId: 'c0', code: null } })
      expect('referral_code' in p.subscription_data.metadata).toBe(false)
      expect('referral_code' in p.metadata).toBe(false)
      // Le lien vers le parrain, lui, reste posé : ce n'est pas le même champ.
      expect(p.subscription_data.metadata.referred_by_client_id).toBe('c0')
    })

    it('referral_first_month_free : absent sans mois offert, présent avec', () => {
      const sansEssai = params('starter', 'mensuel', { parrainage: { parrainId: 'c0', code: 'PARRAIN1' }, offre: {} })
      expect('referral_first_month_free' in sansEssai.subscription_data.metadata).toBe(false)

      const avecEssai = params('starter', 'mensuel', { parrainage: { parrainId: 'c0', code: 'PARRAIN1' }, offre: { essaiJours: 30 } })
      expect(avecEssai.subscription_data.metadata.referral_first_month_free).toBe('true')
    })
  })

  describe('promo_code', () => {
    it('absent sans promotionCodeId', () => {
      const p = params('starter', 'mensuel', { promoCode: 'CODE', promotionCodeId: null })
      expect('promo_code' in p.metadata).toBe(false)
    })

    it('tronqué à 500 caractères', () => {
      const long = 'X'.repeat(600)
      const p = params('starter', 'mensuel', { promotionCodeId: 'promo_1', promoCode: long })
      expect(p.metadata.promo_code).toBe('X'.repeat(500))
      expect(p.metadata.promo_code).toHaveLength(500)
    })
  })

  describe('URLs de retour', () => {
    it('success_url et cancel_url exacts', () => {
      const p = params('pro', 'mensuel')
      expect(p.success_url).toBe('https://actero.fr/client/overview?upgrade=success&plan=pro')
      expect(p.cancel_url).toBe('https://actero.fr/client/billing?upgrade=cancel')
    })

    it('siteUrl terminé par une barre oblique : pas de double slash', () => {
      const p = params('pro', 'mensuel', { siteUrl: 'https://actero.fr/' })
      expect(p.success_url).toBe('https://actero.fr/client/overview?upgrade=success&plan=pro')
      expect(p.cancel_url).toBe('https://actero.fr/client/billing?upgrade=cancel')
    })
  })
})
