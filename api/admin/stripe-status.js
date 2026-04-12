/**
 * Actero Admin — Stripe Environment Variables Status
 *
 * GET /api/admin/stripe-status
 *
 * Returns which Stripe-related env vars are configured.
 * Auth: requires admin JWT (Bearer token)
 */
import { authenticateAdmin } from './_helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

  try {
    const auth = await authenticateAdmin(req, res)
    if (!auth) return

    const status = {
      stripe_secret_key: !!process.env.STRIPE_SECRET_KEY,
      stripe_webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET,
      stripe_price_starter_monthly: !!process.env.STRIPE_PRICE_STARTER_MONTHLY,
      stripe_price_starter_annual: !!process.env.STRIPE_PRICE_STARTER_ANNUAL,
      stripe_price_pro_monthly: !!process.env.STRIPE_PRICE_PRO_MONTHLY,
      stripe_price_pro_annual: !!process.env.STRIPE_PRICE_PRO_ANNUAL,
    }

    status.all_configured = Object.values(status).every(Boolean)

    return res.status(200).json(status)
  } catch (err) {
    console.error('[admin/stripe-status] Error:', err.message)
    return res.status(500).json({ error: 'Internal error', message: err.message })
  }
}
