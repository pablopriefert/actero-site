import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================
// Pricing logic (server-side mirror of src/lib/upsell-pricing.js)
// ============================================================

const PRICING = {
  email_sequences_customerio: (m) => {
    const base = 149;
    const vol = (m?.tasks_executed || 0) > 500 ? 50 : 0;
    const roi = (m?.estimated_roi || 0) > 2000 ? 30 : 0;
    return base + vol + roi;
  },
  reporting_premium_ecom: (m) => {
    const base = 99;
    const aut = (m?.active_automations || 0) > 3 ? 30 : 0;
    const roi = (m?.estimated_roi || 0) > 1500 ? 20 : 0;
    return base + aut + roi;
  },
  sms_relance_leads: (m) => {
    const base = 129;
    const vol = (m?.tasks_executed || 0) > 200 ? 40 : 0;
    const time = (m?.time_saved_minutes || 0) > 600 ? 20 : 0;
    return base + vol + time;
  },
  prise_rdv_auto: (m) => {
    const base = 179;
    const vol = (m?.tasks_executed || 0) > 300 ? 50 : 0;
    const roi = (m?.estimated_roi || 0) > 1500 ? 30 : 0;
    return base + vol + roi;
  },
  scoring_leads: (m) => {
    const base = 119;
    const aut = (m?.active_automations || 0) > 3 ? 30 : 0;
    const vol = (m?.tasks_executed || 0) > 200 ? 20 : 0;
    return base + aut + vol;
  },
  reporting_premium_immo: (m) => {
    const base = 99;
    const aut = (m?.active_automations || 0) > 3 ? 30 : 0;
    const roi = (m?.estimated_roi || 0) > 1500 ? 20 : 0;
    return base + aut + roi;
  },
};

const UPSELL_NAMES = {
  email_sequences_customerio: 'Séquences email avancées — Customer.io',
  reporting_premium_ecom: 'Reporting premium — Insights e-commerce',
  sms_relance_leads: 'Relance SMS des leads entrants',
  prise_rdv_auto: 'Prise de rendez-vous automatisée',
  scoring_leads: 'Scoring avancé des leads',
  reporting_premium_immo: 'Reporting premium — Performance agence',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { client_id, upsell_type, vertical } = req.body;

  if (!client_id || !upsell_type) {
    return res.status(400).json({ error: 'Missing client_id or upsell_type' });
  }

  // Validate upsell type
  if (!PRICING[upsell_type]) {
    return res.status(400).json({ error: 'Invalid upsell_type' });
  }

  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://actero.fr';

  try {
    // 1. Fetch client
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, brand_name, client_type')
      .eq('id', client_id)
      .single();

    if (clientErr || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // 2. Check if upsell already active
    const { data: existing } = await supabase
      .from('client_upsells')
      .select('id, status')
      .eq('client_id', client_id)
      .eq('upsell_type', upsell_type)
      .in('status', ['active', 'pending'])
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'Cet upsell est déjà actif ou en cours d\'activation.' });
    }

    // 3. Fetch latest metrics for pricing
    const { data: latestMetrics } = await supabase
      .from('metrics_daily')
      .select('tasks_executed, estimated_roi, active_automations, time_saved_minutes')
      .eq('client_id', client_id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4. Calculate price server-side
    const calculatedPrice = PRICING[upsell_type](latestMetrics);
    const upsellName = UPSELL_NAMES[upsell_type] || upsell_type;

    // 5. Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Actero — ${upsellName}`,
              description: `Abonnement mensuel pour ${client.brand_name}`,
            },
            unit_amount: calculatedPrice * 100,
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        client_id: client.id,
        vertical: client.client_type || vertical,
        upsell_type,
        calculated_price: String(calculatedPrice),
        service: 'Actero Upsell',
      },
      success_url: `${siteUrl}/client?upsell_success=${upsell_type}`,
      cancel_url: `${siteUrl}/client?upsell_cancel=${upsell_type}`,
    });

    // 6. Create pending record in client_upsells
    await supabase.from('client_upsells').insert({
      client_id: client.id,
      upsell_type,
      vertical: client.client_type || vertical,
      status: 'pending',
      calculated_price: calculatedPrice,
      stripe_checkout_session_id: session.id,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Upsell checkout error:', error.message);
    return res.status(500).json({ error: 'Erreur lors de la création du checkout.' });
  }
}
