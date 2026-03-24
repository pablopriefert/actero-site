import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { client, referral_code } = req.body;

  if (!client) {
    return res.status(400).json({ error: 'Missing client parameter' });
  }

  try {
    // Check if referral code is valid
    let hasValidReferral = false;
    let referrerClientId = null;

    if (referral_code && supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
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

    // Build line items — remove setup fee if referral is valid
    const lineItems = [];

    if (!hasValidReferral) {
      lineItems.push({
        // Setup fee (one-time) added to the first invoice
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Actero — Setup',
            description: 'Frais de mise en place unique',
          },
          unit_amount: 80000, // 800€ in cents
        },
        quantity: 1,
      });
    }

    lineItems.push({
      // Monthly subscription
      price_data: {
        currency: 'eur',
        product_data: {
          name: 'Actero — Abonnement mensuel',
          description: 'Automatisation IA du support client',
        },
        unit_amount: 80000, // 800€/month in cents
        recurring: {
          interval: 'month',
        },
      },
      quantity: 1,
    });

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
