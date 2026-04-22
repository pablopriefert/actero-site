import { withSentry } from './lib/sentry.js'
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from './lib/rate-limit.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 10 requests/min per IP
  const ip = getClientIp(req);
  const rl = checkRateLimit(`checkout:${ip}`, 10, 60_000);
  res.setHeader('X-RateLimit-Limit', '10');
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.ceil((rl.resetAt - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
  }

  const { client, referral_code } = req.body;

  if (!client) {
    return res.status(400).json({ error: 'Missing client parameter' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch funnel client data to get custom pricing
    const { data: funnelClient } = await supabase
      .from('funnel_clients')
      .select('setup_price, monthly_price, company_name, client_type')
      .eq('slug', client)
      .maybeSingle();

    const setupPrice = funnelClient?.setup_price ?? 800;
    const monthlyPrice = funnelClient?.monthly_price ?? 800;

    // Check if referral code is valid
    let hasValidReferral = false;
    let referrerClientId = null;

    if (referral_code) {
      const { data: referrer } = await supabase
        .from('clients')
        .select('id, referral_code')
        .eq('referral_code', referral_code.toUpperCase())
        .maybeSingle();

      if (referrer) {
        hasValidReferral = true;
        referrerClientId = referrer.id;
      }
    }

    // Build line items
    const lineItems = [];

    if (setupPrice > 0) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Actero — Setup',
            description: 'Frais de mise en place unique',
          },
          unit_amount: Math.round(setupPrice * 100),
        },
        quantity: 1,
      });
    }

    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: {
          name: 'Actero — Abonnement mensuel',
          description: 'Automatisation IA du support client',
        },
        unit_amount: Math.round(monthlyPrice * 100),
        recurring: {
          interval: 'month',
        },
      },
      quantity: 1,
    });

    // If valid referral, apply 1 month free trial (first month free for the referred person)
    const subscriptionData = {};
    if (hasValidReferral) {
      subscriptionData.trial_period_days = 30;
    }

    const metadata = {
      client,
      service: 'Actero',
    };

    if (hasValidReferral) {
      metadata.referral_code = referral_code.toUpperCase();
      metadata.referrer_client_id = referrerClientId;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      ...(subscriptionData.trial_period_days && { subscription_data: subscriptionData }),
      metadata,
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://actero.fr'}/success?client=${encodeURIComponent(client)}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://actero.fr'}/cancel?client=${encodeURIComponent(client)}`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error.message);
    return res.status(500).json({ error: 'Erreur lors de la création de la session de paiement.' });
  }
}

export default withSentry(handler)
