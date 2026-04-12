import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const STRIPE_PRICES = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
  starter_annual: process.env.STRIPE_PRICE_STARTER_ANNUAL,
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
};

function getStripePrice(plan, billing) {
  const key = `${plan}_${billing || 'monthly'}`;
  return STRIPE_PRICES[key] || null;
}

function isStripeConfigured() {
  return !!(process.env.STRIPE_SECRET_KEY && Object.values(STRIPE_PRICES).some(Boolean));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, brand_name, shopify_url, plan, billing } = req.body || {};

  // --- Validation ---
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email invalide.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }
  if (!brand_name || !brand_name.trim()) {
    return res.status(400).json({ error: 'Le nom de la boutique est requis.' });
  }

  const validPlans = ['free', 'starter', 'pro', 'enterprise'];
  const selectedPlan = validPlans.includes(plan) ? plan : 'free';
  const selectedBilling = billing === 'annual' ? 'annual' : 'monthly';
  const isPaid = selectedPlan === 'starter' || selectedPlan === 'pro';

  let userId = null;
  let clientId = null;

  try {
    // 1. Create user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { brand_name, plan: selectedPlan },
    });

    if (authError) {
      // User already exists
      if (authError.message?.includes('already') || authError.status === 422) {
        return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
      }
      console.error('[SIGNUP] Auth error:', authError);
      return res.status(500).json({ error: 'Erreur lors de la création du compte.' });
    }

    userId = authData.user.id;

    // 2. Create client row
    const trialEndsAt = isPaid
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert([{
        brand_name: brand_name.trim(),
        contact_email: email,
        owner_user_id: userId,
        plan: selectedPlan,
        status: 'active',
        ...(trialEndsAt && { trial_ends_at: trialEndsAt }),
        ...(shopify_url && { shopify_url: shopify_url.trim() }),
      }])
      .select()
      .single();

    if (clientError) {
      console.error('[SIGNUP] Client creation error:', clientError);
      throw new Error('Failed to create client');
    }

    clientId = client.id;

    // 3. Create client_settings
    const { error: settingsError } = await supabase
      .from('client_settings')
      .insert([{
        client_id: clientId,
        hourly_cost: 25,
      }]);

    if (settingsError) {
      console.error('[SIGNUP] Settings creation error:', settingsError);
    }

    // 4. Create client_users (owner)
    const { error: linkError } = await supabase
      .from('client_users')
      .insert([{
        client_id: clientId,
        user_id: userId,
        role: 'owner',
      }]);

    if (linkError) {
      console.error('[SIGNUP] Client-user link error:', linkError);
    }

    // 5. Stripe Checkout for paid plans
    if (isPaid && isStripeConfigured()) {
      const priceId = getStripePrice(selectedPlan, selectedBilling);

      if (!priceId) {
        // Price ID missing for this specific plan — fallback to free mode
        console.warn(`[SIGNUP] No Stripe price for ${selectedPlan}_${selectedBilling}, falling back to free`);
        return res.status(200).json({
          success: true,
          redirect: '/client/overview',
          message: `Votre essai ${selectedPlan === 'starter' ? 'Starter' : 'Pro'} sera activé sous peu — notre équipe vous contactera.`,
        });
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      // Create Stripe Customer
      const customer = await stripe.customers.create({
        email,
        name: brand_name.trim(),
        metadata: { client_id: clientId, plan: selectedPlan },
      });

      // Update client with stripe_customer_id
      await supabase
        .from('clients')
        .update({ stripe_customer_id: customer.id })
        .eq('id', clientId);

      // Create Checkout Session with trial
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://actero.fr';
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customer.id,
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          trial_period_days: 7,
          metadata: { client_id: clientId, plan: selectedPlan },
        },
        metadata: { client_id: clientId, plan: selectedPlan, kind: 'saas_signup' },
        success_url: `${siteUrl}/client/overview?welcome=true`,
        cancel_url: `${siteUrl}/signup?plan=${selectedPlan}`,
      });

      return res.status(200).json({
        success: true,
        checkout_url: session.url,
      });
    }

    // 6. Free plan or Stripe not configured — direct redirect
    if (isPaid && !isStripeConfigured()) {
      return res.status(200).json({
        success: true,
        redirect: '/client/overview',
        message: `Votre essai ${selectedPlan === 'starter' ? 'Starter' : 'Pro'} sera activé sous peu — notre équipe vous contactera.`,
      });
    }

    return res.status(200).json({
      success: true,
      redirect: '/client/overview',
    });

  } catch (err) {
    console.error('[SIGNUP] Unexpected error:', err);

    // Cleanup on failure
    try {
      if (clientId) {
        await supabase.from('client_users').delete().eq('client_id', clientId);
        await supabase.from('client_settings').delete().eq('client_id', clientId);
        await supabase.from('clients').delete().eq('id', clientId);
      }
      if (userId) {
        await supabase.auth.admin.deleteUser(userId);
      }
    } catch (cleanupErr) {
      console.error('[SIGNUP] Cleanup error:', cleanupErr);
    }

    return res.status(500).json({ error: 'Erreur interne. Veuillez réessayer.' });
  }
}
