import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PRICES = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
  starter_annual: process.env.STRIPE_PRICE_STARTER_ANNUAL,
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
};

const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- Auth ---
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise.' });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise.' });

  const { client_id, target_plan, billing_period = 'monthly' } = req.body || {};

  if (!client_id || !target_plan) {
    return res.status(400).json({ error: 'Missing client_id or target_plan' });
  }

  if (!['monthly', 'annual'].includes(billing_period)) {
    return res.status(400).json({ error: 'billing_period must be monthly or annual' });
  }

  // --- Verify user belongs to client ---
  const isAdmin = user.app_metadata?.role === 'admin' || user.email?.endsWith('@actero.fr');
  if (!isAdmin) {
    const { data: link } = await supabaseAdmin
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('client_id', client_id)
      .maybeSingle();
    if (!link) return res.status(403).json({ error: 'Acces refuse.' });
  }

  try {
    // --- Load current client ---
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('id, plan, stripe_customer_id, contact_email, company_name, trial_ends_at')
      .eq('id', client_id)
      .single();

    if (clientErr || !client) {
      return res.status(404).json({ error: 'Client introuvable.' });
    }

    const currentPlan = client.plan || 'free';

    // --- Enterprise = contact sales ---
    if (target_plan === 'enterprise') {
      return res.status(400).json({
        error: 'enterprise_contact',
        message: 'Le plan Enterprise necessite un contact commercial.',
        calendly_url: 'https://calendly.com/actero/enterprise',
      });
    }

    // --- Validate upgrade (no downgrade) ---
    const currentIndex = PLAN_ORDER.indexOf(currentPlan);
    const targetIndex = PLAN_ORDER.indexOf(target_plan);
    if (targetIndex < 0) {
      return res.status(400).json({ error: 'Plan cible invalide.' });
    }
    if (targetIndex <= currentIndex) {
      return res.status(400).json({ error: 'Seuls les upgrades sont autorises. Pour un downgrade, contactez le support.' });
    }

    // --- Stripe failsafe ---
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({
        error: 'Stripe not configured',
        hint: 'Contact support at support@actero.fr',
      });
    }

    const priceKey = `${target_plan}_${billing_period}`;
    const priceId = PRICES[priceKey];
    if (!priceId) {
      return res.status(503).json({
        error: 'Stripe not configured',
        hint: `Price ID manquant pour ${priceKey}. Contactez le support.`,
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // --- Get or create Stripe customer ---
    let stripeCustomerId = client.stripe_customer_id;

    if (!stripeCustomerId) {
      // Also check funnel_clients
      const { data: funnel } = await supabaseAdmin
        .from('funnel_clients')
        .select('stripe_customer_id')
        .eq('onboarded_client_id', client_id)
        .not('stripe_customer_id', 'is', null)
        .limit(1)
        .maybeSingle();

      stripeCustomerId = funnel?.stripe_customer_id;
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: client.contact_email || user.email,
        name: client.company_name || undefined,
        metadata: { actero_client_id: client_id },
      });
      stripeCustomerId = customer.id;

      // Persist for future use
      await supabaseAdmin
        .from('clients')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', client_id);
    }

    // --- Determine trial eligibility (never had a trial before) ---
    const hadTrial = !!client.trial_ends_at;
    const trialDays = hadTrial ? undefined : 7;

    // --- Create Checkout Session ---
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      ...(trialDays ? { subscription_data: { trial_period_days: trialDays } } : {}),
      metadata: {
        actero_client_id: client_id,
        upgrade_from: currentPlan,
        upgrade_to: target_plan,
      },
      success_url: `${process.env.SITE_URL || 'https://actero.fr'}/client?tab=billing&upgrade=success`,
      cancel_url: `${process.env.SITE_URL || 'https://actero.fr'}/client?tab=billing&upgrade=cancel`,
    });

    return res.status(200).json({ checkout_url: session.url });
  } catch (error) {
    console.error('Billing upgrade error:', error);
    return res.status(500).json({ error: 'Erreur interne. Reessayez ou contactez le support.' });
  }
}
