/**
 * Actero Admin — One-shot Stripe Products Setup
 *
 * Creates the 4 SaaS products + 8 prices (monthly + annual per plan)
 * in your Stripe account. Run ONCE then copy the Price IDs to Vercel env vars.
 *
 * GET /api/admin/setup-stripe-products?confirm=yes
 *
 * Auth: requires admin JWT (Bearer token)
 * Safety: only runs if confirm=yes query param is present
 */
import Stripe from 'stripe'
import { authenticateAdmin } from './_helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

  // Safety: require explicit confirmation
  if (req.query.confirm !== 'yes') {
    return res.status(200).json({
      warning: 'This will create 4 products + 8 prices in your Stripe account.',
      instruction: 'Add ?confirm=yes to the URL to proceed.',
      url: '/api/admin/setup-stripe-products?confirm=yes',
    })
  }

  // Auth: admin only
  const auth = await authenticateAdmin(req, res)
  if (!auth) return

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'STRIPE_SECRET_KEY missing in env' })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  try {
    // Check if products already exist (idempotent)
    const existingProducts = await stripe.products.list({ limit: 100 })
    const acteroProducts = existingProducts.data.filter(p => p.metadata?.actero_plan)

    if (acteroProducts.length >= 3) {
      // Products already created — fetch their prices
      const prices = await stripe.prices.list({ limit: 100, active: true })
      const acteroStarterMonthly = prices.data.find(p => p.metadata?.actero_plan === 'starter' && p.recurring?.interval === 'month')
      const acteroStarterAnnual = prices.data.find(p => p.metadata?.actero_plan === 'starter' && p.recurring?.interval === 'year')
      const acteroProMonthly = prices.data.find(p => p.metadata?.actero_plan === 'pro' && p.recurring?.interval === 'month')
      const acteroProAnnual = prices.data.find(p => p.metadata?.actero_plan === 'pro' && p.recurring?.interval === 'year')

      return res.status(200).json({
        status: 'already_exists',
        message: 'Stripe products already created. Here are the Price IDs to add to Vercel env vars:',
        env_vars: {
          STRIPE_PRICE_STARTER_MONTHLY: acteroStarterMonthly?.id || 'NOT_FOUND',
          STRIPE_PRICE_STARTER_ANNUAL: acteroStarterAnnual?.id || 'NOT_FOUND',
          STRIPE_PRICE_PRO_MONTHLY: acteroProMonthly?.id || 'NOT_FOUND',
          STRIPE_PRICE_PRO_ANNUAL: acteroProAnnual?.id || 'NOT_FOUND',
        },
      })
    }

    // Create products
    const starterProduct = await stripe.products.create({
      name: 'Actero Starter',
      description: 'Automatiser les premières tâches — 1 000 tickets/mois, 3 workflows, Shopify + 2 intégrations',
      metadata: { actero_plan: 'starter' },
    })

    const proProduct = await stripe.products.create({
      name: 'Actero Pro',
      description: 'Automatisation complète + agent vocal — 5 000 tickets/mois, workflows illimités, toutes intégrations',
      metadata: { actero_plan: 'pro' },
    })

    const enterpriseProduct = await stripe.products.create({
      name: 'Actero Enterprise',
      description: 'Sur mesure pour les grands comptes — tickets illimités, multi-boutiques, white-label',
      metadata: { actero_plan: 'enterprise' },
    })

    // Create prices (EUR)
    const starterMonthly = await stripe.prices.create({
      product: starterProduct.id,
      unit_amount: 9900, // 99.00 EUR in cents
      currency: 'eur',
      recurring: { interval: 'month' },
      metadata: { actero_plan: 'starter' },
    })

    const starterAnnual = await stripe.prices.create({
      product: starterProduct.id,
      unit_amount: 94800, // 948.00 EUR/year = 79 EUR/month
      currency: 'eur',
      recurring: { interval: 'year' },
      metadata: { actero_plan: 'starter' },
    })

    const proMonthly = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 39900, // 399.00 EUR in cents
      currency: 'eur',
      recurring: { interval: 'month' },
      metadata: { actero_plan: 'pro' },
    })

    const proAnnual = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 382800, // 3828.00 EUR/year = 319 EUR/month
      currency: 'eur',
      recurring: { interval: 'year' },
      metadata: { actero_plan: 'pro' },
    })

    return res.status(200).json({
      status: 'created',
      message: 'Stripe products + prices created successfully! Copy the Price IDs below to your Vercel env vars.',
      products: {
        starter: starterProduct.id,
        pro: proProduct.id,
        enterprise: enterpriseProduct.id,
      },
      env_vars: {
        STRIPE_PRICE_STARTER_MONTHLY: starterMonthly.id,
        STRIPE_PRICE_STARTER_ANNUAL: starterAnnual.id,
        STRIPE_PRICE_PRO_MONTHLY: proMonthly.id,
        STRIPE_PRICE_PRO_ANNUAL: proAnnual.id,
      },
      next_steps: [
        '1. Copie les 4 Price IDs ci-dessus',
        '2. Va sur Vercel → Settings → Environment Variables',
        '3. Ajoute les 4 variables (STRIPE_PRICE_STARTER_MONTHLY, etc.)',
        '4. Redéploie',
        '5. Le signup self-service avec trial 14j est prêt',
      ],
    })
  } catch (err) {
    console.error('[setup-stripe-products] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
