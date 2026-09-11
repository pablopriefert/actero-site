/**
 * Qui se facture chez Shopify, qui se facture chez Stripe — décidé côté serveur.
 *
 * LA RÈGLE
 *
 * App Store 1.2.1 : une app publique doit facturer **exclusivement** via
 * Shopify (Managed Pricing ou Billing API). Facturer un marchand venu de
 * l'App Store par Stripe est un motif de refus, et de retrait après coup.
 *
 * CE QUI MANQUAIT
 *
 * La règle existait, mais uniquement dans le navigateur
 * (`src/lib/billing-router.js`). Les trois routes de facturation Stripe —
 * `billing/upgrade`, `billing/create-subscription`, `create-checkout-session` —
 * ne vérifiaient rien : elles facturaient qui les appelait.
 *
 * C'est le défaut de la semaine dans sa forme la plus coûteuse : une garde
 * posée là où elle se voit, pas là où elle s'applique.
 *
 * TROIS ÉTATS, PAS DEUX
 *
 * `shopify-billing.js` lisait la connexion en ignorant l'erreur de requête :
 *
 *     const { data: connection } = await supabase.from(...)   // error jetée
 *     if (!connection?.shop_domain) return 409                // → Stripe
 *
 * Une base indisponible devenait donc « ce marchand n'a pas de Shopify », donc
 * « facturez-le chez Stripe ». Pas une attaque : un chemin d'erreur ordinaire,
 * qui produit exactement la violation qu'on veut éviter.
 *
 * D'où le troisième état. « Je ne sais pas » n'autorise personne — ni Shopify,
 * ni Stripe. Mieux vaut un paiement qui échoue et qu'on réessaie qu'un
 * marchand facturé sur le mauvais rail.
 */

/** @typedef {{ statut: 'shopify'|'direct'|'indetermine', shopDomain?: string, raison?: string }} Verdict */

/**
 * Ce client a-t-il une boutique Shopify connectée ?
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase — service-role
 * @param {string} clientId
 * @returns {Promise<Verdict>}
 */
export async function origineDeFacturation(supabase, clientId) {
  if (!clientId) return { statut: 'indetermine', raison: 'client_id manquant' }

  const { data, error } = await supabase
    .from('client_shopify_connections')
    .select('shop_domain')
    .eq('client_id', clientId)
    .maybeSingle()

  // L'erreur n'est PAS une absence de connexion. C'est tout l'enjeu.
  if (error) return { statut: 'indetermine', raison: error.message }

  if (data?.shop_domain) return { statut: 'shopify', shopDomain: data.shop_domain }
  return { statut: 'direct' }
}

/**
 * L'URL de sélection de formule hébergée par Shopify, pour ce domaine.
 * Même construction que dans api/billing/shopify-billing.js — une seule
 * définition, pour qu'elles ne divergent pas.
 */
export function urlManagedPricing(shopDomain) {
  const handle = process.env.SHOPIFY_APP_HANDLE || 'actero'
  const boutique = String(shopDomain).replace(/\.myshopify\.com$/, '')
  return `https://admin.shopify.com/store/${encodeURIComponent(boutique)}`
    + `/charges/${encodeURIComponent(handle)}/pricing_plans`
}

/**
 * Garde à poser en tête de toute route qui crée une facturation Stripe.
 *
 * @returns {Promise<boolean>} `true` si la réponse a été envoyée et que
 *   l'appelant doit s'arrêter là.
 */
export async function refuserFacturationStripe(supabase, clientId, res) {
  const verdict = await origineDeFacturation(supabase, clientId)

  if (verdict.statut === 'shopify') {
    console.warn(
      `[facturation] Stripe refusé pour ${clientId} : boutique Shopify connectée `
      + `(${verdict.shopDomain}) — App Store 1.2.1`,
    )
    res.status(409).json({
      error: 'shopify_billing_required',
      message: 'Votre abonnement se gère depuis Shopify.',
      confirmation_url: urlManagedPricing(verdict.shopDomain),
    })
    return true
  }

  if (verdict.statut === 'indetermine') {
    console.error(`[facturation] origine indéterminée pour ${clientId} : ${verdict.raison}`)
    res.status(503).json({
      error: 'billing_origin_unknown',
      message: 'Paiement momentanément indisponible. Réessayez dans un instant.',
    })
    return true
  }

  return false
}
