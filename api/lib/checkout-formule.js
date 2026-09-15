// @ts-check
/**
 * Les paramètres d'une session Stripe Checkout d'abonnement — calcul pur.
 *
 * Ne décide ni de l'essai ni du coupon : c'est `offreDeBienvenue`
 * (essai-gratuit.js) qui tranche, en amont, d'après l'historique Stripe du
 * client. Ce module traduit cette décision déjà prise en paramètres Stripe, et
 * arbitre entre code promo et coupon — Stripe refuse une session qui porte les
 * deux à la fois (voir plus bas, `discounts` / `allow_promotion_codes`).
 *
 * Testable sans Stripe, et lu par une seule route (api/billing/upgrade.js) :
 * deux chemins de paiement avaient fait dériver l'essai à 30, 7 ou 0 jours
 * selon le bouton (voir essai-gratuit.js) — cette centralisation évite que ça
 * se reproduise.
 */
import { FORMULES } from './formules.js'

/**
 * @param {{
 *   clientId: string,
 *   customer: string,
 *   prix: import('stripe').Stripe.Price,
 *   formule: import('./formules.js').Formule,
 *   offre: { essaiJours?: number, couponId?: string },
 *   promotionCodeId?: string|null,
 *   planActuel: string,
 *   parrainage?: { parrainId: string, code?: string|null } | null,
 *   promoCode?: string|null,
 *   siteUrl: string,
 * }} p
 * @returns {import('stripe').Stripe.Checkout.SessionCreateParams}
 */
export function parametresCheckout(p) {
  const { clientId, customer, prix, formule, offre, promotionCodeId, planActuel, parrainage, promoCode, siteUrl } = p

  if (!FORMULES.includes(formule)) {
    throw new TypeError('parametresCheckout : formule hors catalogue')
  }
  // Le webhook accorde le plan d'après `upgrade_to` (déduit de `formule`), pas
  // d'après le prix réellement facturé : un appelant qui se tromperait de prix
  // ferait payer une formule et en accorderait une autre.
  if (prix?.lookup_key !== formule.lookupKey) {
    throw new TypeError(`parametresCheckout : le prix ${prix?.id ?? prix} (lookup_key ${prix?.lookup_key ?? 'absent'}) ne correspond pas à la formule ${formule.lookupKey}`)
  }
  if (offre.essaiJours !== undefined && !(Number.isInteger(offre.essaiJours) && offre.essaiJours >= 1)) {
    throw new TypeError(`parametresCheckout : offre.essaiJours doit être un entier ≥ 1, reçu ${offre.essaiJours}`)
  }

  const cleFormule = `${formule.plan}_${formule.periode}`
  // Barre(s) finale(s) retirée(s) : sinon `${site}/client/...` double le slash
  // (https://actero.fr//client/...) dès que siteUrl est configurée avec une
  // barre de fin.
  const site = siteUrl.replace(/\/+$/, '')

  /** @type {import('stripe').Stripe.Checkout.SessionCreateParams.SubscriptionData} */
  const subscriptionData = {
    metadata: {
      // customer.subscription.updated retrouve le client par ce champ.
      client_id: clientId,
      actero_client_id: clientId,
      formule: cleFormule,
      ...(parrainage ? {
        referred_by_client_id: parrainage.parrainId,
        ...(parrainage.code ? { referral_code: parrainage.code } : {}),
        // Seulement si un mois est vraiment offert : sinon la récompense du
        // parrain (déclenchée par ce champ côté webhook) serait accordée pour
        // un parrainage qui n'a rien donné.
        ...(offre.essaiJours ? { referral_first_month_free: 'true' } : {}),
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
    line_items: [{ price: prix.id, quantity: 1 }],
    subscription_data: subscriptionData,
    // Stripe refuse une session qui porte à la fois `discounts` et
    // `allow_promotion_codes` : une réduction déjà appliquée (coupon ou code)
    // ferme la porte à la saisie d'un autre code sur la page Checkout.
    ...(remise ? { discounts: [remise] } : { allow_promotion_codes: true }),
    // Un moyen de paiement (carte, PayPal ou Link) est toujours demandé, mois
    // offert compris : plus d'abonnement d'essai sans moyen de paiement.
    // `always` est déjà le défaut de Stripe en mode `subscription` — posé ici
    // explicitement comme garde-fou, pour qu'un changement de défaut côté
    // Stripe ne passe pas inaperçu.
    payment_method_collection: 'always',
    metadata: {
      actero_client_id: clientId,
      upgrade_from: planActuel,
      upgrade_to: formule.plan,
      formule: cleFormule,
      ...(parrainage?.code ? { referral_code: parrainage.code } : {}),
      // Posé seulement si un code promo a vraiment été résolu et appliqué
      // (promotionCodeId) : sinon promoCode ne serait qu'une saisie jamais
      // vérifiée. Tronqué à 500 caractères — au-delà, Stripe refuse la session
      // entière et le marchand ne peut plus payer du tout.
      ...(promotionCodeId && promoCode ? { promo_code: promoCode.slice(0, 500) } : {}),
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
    success_url: `${site}/client/overview?upgrade=success&plan=${formule.plan}`,
    cancel_url: `${site}/client/billing?upgrade=cancel`,
  }
}
