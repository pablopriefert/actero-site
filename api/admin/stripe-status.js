/**
 * Actero Admin — état de la configuration Stripe.
 *
 * GET /api/admin/stripe-status
 *
 * Clés secrètes présentes, et, dans le compte Stripe : les six prix des formules
 * (par lookup_key, au montant du catalogue) et les deux coupons du trimestriel.
 * Auth : admin (Bearer).
 */
import { withSentry } from '../lib/sentry.js'
import Stripe from 'stripe'
import { authenticateAdmin } from './_helpers.js'
import { FORMULES, prixConforme } from '../lib/formules.js'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

  try {
    const auth = await authenticateAdmin(req, res)
    if (!auth) return

    const status = {
      stripe_secret_key: !!process.env.STRIPE_SECRET_KEY,
      stripe_webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET,
      formules: [],
      coupons: [],
      all_configured: false,
    }

    if (status.stripe_secret_key) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
      const { data } = await stripe.prices.list({ lookup_keys: FORMULES.map((f) => f.lookupKey), active: true, limit: 10 })
      // Configurée : un prix porte la clé ET facture exactement le catalogue.
      status.formules = FORMULES.map((f) => ({
        lookupKey: f.lookupKey,
        plan: f.plan,
        periode: f.periode,
        configuree: data.some((p) => p.lookup_key === f.lookupKey && prixConforme(f, p)),
      }))
      for (const f of FORMULES) {
        if (!f.coupon) continue
        let configure = false
        try {
          await stripe.coupons.retrieve(f.coupon.id)
          configure = true
        } catch {
          configure = false
        }
        status.coupons.push({ id: f.coupon.id, configure })
      }
    }

    status.all_configured = status.stripe_secret_key
      && status.stripe_webhook_secret
      && status.formules.length === FORMULES.length
      && status.formules.every((f) => f.configuree)
      && status.coupons.every((c) => c.configure)

    return res.status(200).json(status)
  } catch (err) {
    console.error('[admin/stripe-status] Error:', err.message)
    return res.status(500).json({ error: 'Internal error', message: err.message })
  }
}

export default withSentry(handler)
