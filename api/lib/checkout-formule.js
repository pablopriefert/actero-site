// @ts-check
/**
 * Les paramètres d'une session Stripe Checkout d'abonnement — calcul pur.
 *
 * Seul endroit qui décide de l'essai, du coupon, des métadonnées et des champs
 * de la page Stripe. Testable sans Stripe, et lu par une seule route
 * (api/billing/upgrade.js) : deux chemins de paiement avaient fait dériver
 * l'essai à 30, 7 ou 0 jours selon le bouton (voir essai-gratuit.js).
 *
 * @param {{
 *   clientId: string,
 *   customer: string,
 *   priceId: string,
 *   formule: import('./formules.js').Formule,
 *   offre: { essaiJours?: number, couponId?: string },
 *   promotionCodeId?: string|null,
 *   planActuel: string,
 *   parrainage?: { parrainId: string, code?: string|null } | null,
 *   promoCode?: string|null,
 *   siteUrl: string,
 * }} p
 */
export function parametresCheckout(p) {
  const { clientId, customer, priceId, formule, offre, promotionCodeId, planActuel, parrainage, promoCode, siteUrl } = p
  const cleFormule = `${formule.plan}_${formule.periode}`

  /** @type {Record<string, any>} */
  const subscriptionData = {
    metadata: {
      // customer.subscription.updated retrouve le client par ce champ.
      client_id: clientId,
      actero_client_id: clientId,
      formule: cleFormule,
      ...(parrainage ? {
        referral_first_month_free: 'true',
        referred_by_client_id: parrainage.parrainId,
        ...(parrainage.code ? { referral_code: parrainage.code } : {}),
      } : {}),
    },
  }
  if (offre.essaiJours) subscriptionData.trial_period_days = offre.essaiJours

  // Stripe n'accepte qu'une réduction : un code promo remplace le coupon.
  const remise = promotionCodeId
    ? { promotion_code: promotionCodeId }
    : (offre.couponId ? { coupon: offre.couponId } : null)

  return {
    mode: 'subscription',
    customer,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: subscriptionData,
    ...(remise ? { discounts: [remise] } : { allow_promotion_codes: true }),
    // La carte est toujours demandée, mois offert compris : plus d'abonnement
    // d'essai sans moyen de paiement.
    payment_method_collection: 'always',
    metadata: {
      actero_client_id: clientId,
      upgrade_from: planActuel,
      upgrade_to: formule.plan,
      formule: cleFormule,
      ...(parrainage?.code ? { referral_code: parrainage.code } : {}),
      ...(promoCode ? { promo_code: promoCode } : {}),
    },
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    customer_update: { name: 'auto', address: 'auto' },
    payment_method_types: ['card', 'paypal', 'link'],
    custom_fields: [
      {
        key: 'company_name',
        label: { type: 'custom', custom: 'Nom de l\'entreprise (optionnel)' },
        type: 'text',
        optional: true,
      },
      {
        key: 'siret',
        label: { type: 'custom', custom: 'SIRET / Numero d\'entreprise (optionnel)' },
        type: 'text',
        optional: true,
      },
    ],
    success_url: `${siteUrl}/client/overview?upgrade=success&plan=${formule.plan}`,
    cancel_url: `${siteUrl}/client/billing?upgrade=cancel`,
  }
}
