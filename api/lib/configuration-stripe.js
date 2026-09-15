// @ts-check
import { FORMULES, prixConforme } from './formules.js'

/**
 * Crée ou retrouve, dans le compte Stripe, tout ce que les formules exigent.
 * Idempotent : on peut le relancer autant de fois qu'on veut.
 *
 *   - les produits Starter et Pro (metadata.actero_plan), réutilisés s'ils
 *     existent : les fonctionnalités Stripe Entitlements vivent sur le produit ;
 *   - les six prix, retrouvés par leur clé, sinon par leurs caractéristiques
 *     (produit, montant, périodicité) — ils reçoivent alors leur clé —, sinon
 *     créés. Un prix qui porte la clé mais ne facture plus le montant du
 *     catalogue (prixConforme) est remplacé : la clé passe au nouveau prix, et
 *     les abonnés existants gardent l'ancien ;
 *   - les deux coupons du trimestriel, à identifiant fixe ;
 *   - les ANCIENS prix annuels désactivés (948 € et 3 828 € avant le
 *     14 septembre) : tout prix annuel d'un produit Actero qui n'est pas celui
 *     d'une formule. Réactivables.
 *
 * L'ancien script reconnaissait « le mensuel » à `interval === 'month'`, ce que
 * le trimestriel vérifie aussi.
 *
 * @param {any} stripe
 */
export async function configurerFormules(stripe) {
  const rapport = {
    /** @type {{ lookupKey: string, prixId: string, action: 'existant'|'cle_posee'|'cree'|'remplace' }[]} */
    formules: [],
    /** @type {{ id: string, action: 'existant'|'cree' }[]} */
    coupons: [],
    /** @type {string[]} */
    anciensPrixDesactives: [],
  }

  const produits = await produitsParPlan(stripe)
  const prixActifs = await tousLesPrixActifs(stripe)

  for (const f of FORMULES) {
    const metadata = { actero_plan: f.plan, actero_periode: f.periode }
    const parCle = prixActifs.find((p) => p.lookup_key === f.lookupKey)
    if (parCle && prixConforme(f, parCle)) {
      rapport.formules.push({ lookupKey: f.lookupKey, prixId: parCle.id, action: 'existant' })
      continue
    }
    const semblable = prixActifs.find((p) => p.product === produits[f.plan] && prixConforme(f, p))
    if (semblable) {
      await stripe.prices.update(semblable.id, { lookup_key: f.lookupKey, transfer_lookup_key: true, metadata })
      rapport.formules.push({ lookupKey: f.lookupKey, prixId: semblable.id, action: 'cle_posee' })
      continue
    }
    const cree = await stripe.prices.create({
      product: produits[f.plan],
      unit_amount: f.montantCentimes,
      currency: 'eur',
      recurring: f.recurring,
      lookup_key: f.lookupKey,
      // La clé portée par un prix au mauvais montant passe au nouveau prix.
      ...(parCle ? { transfer_lookup_key: true } : {}),
      metadata,
    })
    rapport.formules.push({ lookupKey: f.lookupKey, prixId: cree.id, action: parCle ? 'remplace' : 'cree' })
  }

  for (const f of FORMULES) {
    if (!f.coupon) continue
    try {
      await stripe.coupons.retrieve(f.coupon.id)
      rapport.coupons.push({ id: f.coupon.id, action: 'existant' })
    } catch (err) {
      if (err?.code !== 'resource_missing' && err?.statusCode !== 404) throw err
      await stripe.coupons.create({
        id: f.coupon.id,
        name: `Trimestriel ${f.plan === 'pro' ? 'Pro' : 'Starter'} — premier mois à −50 %`,
        amount_off: f.coupon.montantCentimes,
        currency: 'eur',
        duration: 'once',
        applies_to: { products: [produits[f.plan]] },
      })
      rapport.coupons.push({ id: f.coupon.id, action: 'cree' })
    }
  }

  // Les prix des formules (existants ou clé posée) ne sont JAMAIS désactivés :
  // l'annuel du catalogue est lui aussi `interval: 'year'`.
  const prixDesFormules = new Set(rapport.formules.map((f) => f.prixId))
  const produitsActero = new Set(Object.values(produits))
  for (const p of prixActifs) {
    if (p.recurring?.interval === 'year' && produitsActero.has(p.product) && !prixDesFormules.has(p.id)) {
      await stripe.prices.update(p.id, { active: false })
      rapport.anciensPrixDesactives.push(p.id)
    }
  }

  return rapport
}

/** @param {any} stripe @returns {Promise<Record<'starter'|'pro', string>>} */
async function produitsParPlan(stripe) {
  const { data } = await stripe.products.list({ limit: 100, active: true })
  /** @type {Record<string, string>} */
  const produits = {}
  for (const plan of ['starter', 'pro']) {
    const existant = data.find((p) => p.metadata?.actero_plan === plan)
    produits[plan] = existant
      ? existant.id
      : (await stripe.products.create({ name: plan === 'pro' ? 'Actero Pro' : 'Actero Starter', metadata: { actero_plan: plan } })).id
  }
  return /** @type {Record<'starter'|'pro', string>} */ (produits)
}

/** @param {any} stripe @returns {Promise<any[]>} */
async function tousLesPrixActifs(stripe) {
  const tous = []
  let apres
  do {
    const page = await stripe.prices.list({ active: true, limit: 100, ...(apres ? { starting_after: apres } : {}) })
    tous.push(...page.data)
    apres = page.has_more ? page.data[page.data.length - 1]?.id : undefined
  } while (apres)
  return tous
}
