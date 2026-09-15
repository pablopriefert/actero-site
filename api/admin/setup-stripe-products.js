/**
 * Actero Admin — configure les formules dans Stripe.
 *
 * GET /api/admin/setup-stripe-products?confirm=yes
 *
 * Crée ou retrouve les six prix (avec leur lookup_key) et les deux coupons du
 * trimestriel, puis désactive les anciens prix annuels. Idempotent. Plus aucun
 * identifiant à copier dans Vercel : le serveur retrouve chaque prix par sa clé.
 *
 * Auth : admin (Bearer). Sécurité : ne fait rien sans `confirm=yes`.
 */
import { withSentry } from '../lib/sentry.js'
import Stripe from 'stripe'
import { authenticateAdmin } from './_helpers.js'
import { configurerFormules } from '../lib/configuration-stripe.js'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

  if (req.query.confirm !== 'yes') {
    return res.status(200).json({
      warning: 'Crée ou retrouve les 6 prix et les 2 coupons des formules Actero dans Stripe.',
      instruction: 'Ajoutez ?confirm=yes pour lancer.',
      url: '/api/admin/setup-stripe-products?confirm=yes',
    })
  }

  const auth = await authenticateAdmin(req, res)
  if (!auth) return

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'STRIPE_SECRET_KEY missing in env' })
  }

  try {
    const rapport = await configurerFormules(new Stripe(process.env.STRIPE_SECRET_KEY))
    return res.status(200).json({ status: 'ok', ...rapport })
  } catch (err) {
    console.error('[setup-stripe-products] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

export default withSentry(handler)
