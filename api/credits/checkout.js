/**
 * Credits — Create Stripe Checkout session for a credit purchase.
 *
 * POST /api/credits/checkout
 * Body: { amount: number } // number of credits to buy (100-50000)
 *
 * Returns: { checkout_url } — Stripe-hosted checkout URL
 *
 * On successful payment, stripe-webhook.js will credit the client's balance.
 */
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

const SITE_URL = process.env.PUBLIC_API_URL || 'https://actero.fr'

// Pricing tiers (matches src/lib/credits-pricing.js)
const TIERS = [
  { min: 10000, rate_cents: 5.5 },
  { min: 5000, rate_cents: 6.0 },
  { min: 1000, rate_cents: 6.9 },
  { min: 1, rate_cents: 9.0 },
]

function priceForAmount(amount) {
  const tier = TIERS.find((t) => amount >= t.min) || TIERS[TIERS.length - 1]
  return Math.round(amount * tier.rate_cents)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!stripe) return res.status(500).json({ error: 'Stripe non configuré' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })

  const { data: link } = await supabase
    .from('client_users')
    .select('client_id, clients:client_id(id, brand_name, contact_email, stripe_customer_id)')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!link?.clients) return res.status(403).json({ error: 'Aucun client associé' })

  const amount = Math.floor(Number(req.body?.amount) || 0)
  if (amount < 100 || amount > 50000) {
    return res.status(400).json({ error: 'Montant invalide (100 à 50 000 crédits)' })
  }

  const price_cents = priceForAmount(amount)
  if (price_cents < 50) return res.status(400).json({ error: 'Montant trop faible' })

  try {
    // Use existing customer or create one
    let customerId = link.clients.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: link.clients.contact_email,
        name: link.clients.brand_name,
        metadata: { client_id: link.clients.id },
      })
      customerId = customer.id
      await supabase.from('clients').update({ stripe_customer_id: customerId }).eq('id', link.clients.id)
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${amount.toLocaleString('fr-FR')} crédits Actero`,
            description: '1 crédit = 1 ticket IA. Crédits valables sans limite de durée.',
          },
          unit_amount: price_cents,
        },
        quantity: 1,
      }],
      metadata: {
        type: 'credit_purchase',
        client_id: link.clients.id,
        credits: String(amount),
      },
      payment_intent_data: {
        metadata: {
          type: 'credit_purchase',
          client_id: link.clients.id,
          credits: String(amount),
        },
      },
      success_url: `${SITE_URL}/client/billing?credits_success=1&amount=${amount}`,
      cancel_url: `${SITE_URL}/client/billing?credits_cancel=1`,
    })

    return res.status(200).json({ checkout_url: session.url, session_id: session.id })
  } catch (err) {
    console.error('[credits/checkout]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
