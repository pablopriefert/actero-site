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
      .select('id, plan, stripe_customer_id, contact_email, brand_name, trial_ends_at')
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
        name: client.brand_name || undefined,
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

    // --- Check if client already has an active subscription (instant upgrade) ---
    const existingSubId = client.stripe_subscription_id;

    if (existingSubId) {
      // Client already paying — instant subscription update (no checkout needed)
      try {
        const subscription = await stripe.subscriptions.retrieve(existingSubId);
        if (subscription && subscription.status !== 'canceled') {
          // Switch the price item on the existing subscription
          const currentItem = subscription.items.data[0];
          if (currentItem) {
            await stripe.subscriptions.update(existingSubId, {
              items: [{
                id: currentItem.id,
                price: priceId,
              }],
              proration_behavior: 'create_prorations',
              metadata: {
                actero_client_id: client_id,
                upgrade_from: currentPlan,
                upgrade_to: target_plan,
              },
            });

            // Update plan in DB immediately
            await supabaseAdmin.from('clients').update({
              plan: target_plan,
              plan_updated_at: new Date().toISOString(),
            }).eq('id', client_id);

            return res.status(200).json({
              success: true,
              instant: true,
              message: `Plan mis a jour vers ${target_plan}. La proration sera appliquee sur votre prochaine facture.`,
            });
          }
        }
      } catch (subErr) {
        // Subscription retrieval failed — fall through to checkout
        console.warn('[billing/upgrade] Subscription update failed, falling back to checkout:', subErr.message);
      }
    }

    // --- No existing subscription or update failed — Create Checkout Session ---
    const siteUrl = process.env.SITE_URL || 'https://actero.fr';
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
      // Collect billing info
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_update: { name: 'auto', address: 'auto' },
      // Payment methods (Google Pay auto with card, Klarna not supported for subscriptions)
      payment_method_types: ['card', 'paypal', 'link'],
      // Custom fields for company info
      custom_fields: [
        {
          key: 'company_name',
          label: { type: 'custom', custom: 'Nom de l\'entreprise (optionnel)' },
          type: 'text',
          optional: true,
        },
        {
          key: 'siret',
          label: { type: 'custom', custom: 'SIRET / Numero d\'entreprise (optionnel)' },
          type: 'text',
          optional: true,
        },
      ],
      success_url: `${siteUrl}/client?tab=billing&upgrade=success`,
      cancel_url: `${siteUrl}/client?tab=billing&upgrade=cancel`,
    });

    return res.status(200).json({ checkout_url: session.url });
  } catch (error) {
    console.error('Billing upgrade error:', error);
    return res.status(500).json({ error: 'Erreur interne. Reessayez ou contactez le support.' });
  }
}
