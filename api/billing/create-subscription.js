import { withSentry } from '../lib/sentry.js'
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { isActeroAdmin } from '../lib/admin-auth.js'

/**
 * POST /api/billing/create-subscription
 *
 * On-site payment (Stripe Payment Element) counterpart of upgrade.js. Instead
 * of a hosted Checkout redirect, it creates the subscription server-side in
 * `default_incomplete` mode and returns a client_secret the front confirms with
 * <PaymentElement> — the merchant pays without leaving actero.fr.
 *
 * Plan activation happens through the existing `customer.subscription.updated`
 * webhook, which maps priceId → plan and reads `subscription.metadata.client_id`.
 * We therefore MUST stamp `client_id` on the subscription metadata below.
 *
 * Response:
 *   { mode: 'payment'|'setup', client_secret, subscription_id }  → confirm on front
 *   { instant: true, ... }                                       → nothing to confirm
 */

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

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- Auth ---
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise.' });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise.' });

  const { client_id, target_plan, billing_period = 'monthly', promo_code } = req.body || {};

  if (!client_id || !target_plan) {
    return res.status(400).json({ error: 'Missing client_id or target_plan' });
  }
  if (!['monthly', 'annual'].includes(billing_period)) {
    return res.status(400).json({ error: 'billing_period must be monthly or annual' });
  }

  // --- Verify user belongs to client ---
  const isAdmin = await isActeroAdmin(user, supabaseAdmin);
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
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('id, plan, stripe_customer_id, stripe_subscription_id, contact_email, brand_name, trial_ends_at, referral_first_month_free, referred_by_client_id')
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
      return res.status(503).json({ error: 'Stripe not configured', hint: 'Contact support at support@actero.fr' });
    }

    const priceKey = `${target_plan}_${billing_period}`;
    const priceId = PRICES[priceKey];
    if (!priceId) {
      return res.status(503).json({ error: 'Stripe not configured', hint: `Price ID manquant pour ${priceKey}.` });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // --- Get or create Stripe customer ---
    let stripeCustomerId = client.stripe_customer_id;
    if (!stripeCustomerId) {
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
      await supabaseAdmin.from('clients').update({ stripe_customer_id: stripeCustomerId }).eq('id', client_id);
    }

    // --- Existing active subscription → instant price swap (no card needed) ---
    const existingSubId = client.stripe_subscription_id;
    if (existingSubId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(existingSubId);
        const swappable = subscription
          && !['canceled', 'incomplete_expired'].includes(subscription.status);
        const currentItem = subscription?.items?.data?.[0];
        if (swappable && currentItem) {
          await stripe.subscriptions.update(existingSubId, {
            items: [{ id: currentItem.id, price: priceId }],
            proration_behavior: 'create_prorations',
            metadata: { client_id, actero_client_id: client_id, upgrade_from: currentPlan, upgrade_to: target_plan },
          });
          await supabaseAdmin.from('clients')
            .update({ plan: target_plan, plan_updated_at: new Date().toISOString() })
            .eq('id', client_id);
          return res.status(200).json({ instant: true, message: `Plan mis a jour vers ${target_plan}.` });
        }
      } catch (subErr) {
        console.warn('[billing/create-subscription] existing sub swap failed, creating new:', subErr.message);
      }
    }

    // --- Trial eligibility (referral 30d > first-time 7d) ---
    const hadTrial = !!client.trial_ends_at;
    const trialDays = client.referral_first_month_free ? 30 : (hadTrial ? undefined : 7);

    // Resolve the referrer's referral_code for webhook reward attribution.
    let referrerCode = null;
    if (client.referral_first_month_free && client.referred_by_client_id) {
      const { data: referrerRow } = await supabaseAdmin
        .from('clients')
        .select('referral_code')
        .eq('id', client.referred_by_client_id)
        .maybeSingle();
      referrerCode = referrerRow?.referral_code || null;
    }

    // Resolve promo code → Stripe promotion_code id.
    let discounts;
    if (promo_code) {
      try {
        const promoList = await stripe.promotionCodes.list({ code: promo_code, active: true, limit: 1 });
        if (promoList.data.length > 0) discounts = [{ promotion_code: promoList.data[0].id }];
      } catch (e) {
        console.warn('[billing/create-subscription] promo resolve failed', promo_code, e.message);
      }
    }

    const subscriptionParams = {
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
      metadata: {
        client_id, // ← webhook customer.subscription.updated maps the plan off THIS
        actero_client_id: client_id,
        upgrade_from: currentPlan,
        upgrade_to: target_plan,
        ...(referrerCode ? { referral_code: referrerCode } : {}),
        ...(promo_code ? { promo_code } : {}),
      },
    };
    if (trialDays) subscriptionParams.trial_period_days = trialDays;
    if (discounts) subscriptionParams.discounts = discounts;

    const subscription = await stripe.subscriptions.create(subscriptionParams);

    // Persist the subscription id so future upgrades hit the instant-swap path.
    await supabaseAdmin.from('clients').update({ stripe_subscription_id: subscription.id }).eq('id', client_id);

    // Consume the one-shot referral perk so it can't be reused.
    if (client.referral_first_month_free) {
      await supabaseAdmin.from('clients').update({ referral_first_month_free: false }).eq('id', client_id);
    }

    // --- Pick the secret the front confirms ---
    //   trial → pending_setup_intent (collect card for later, $0 now)
    //   paid  → latest_invoice.payment_intent (charge now)
    let mode;
    let clientSecret;
    if (subscription.pending_setup_intent?.client_secret) {
      mode = 'setup';
      clientSecret = subscription.pending_setup_intent.client_secret;
    } else if (subscription.latest_invoice?.payment_intent?.client_secret) {
      mode = 'payment';
      clientSecret = subscription.latest_invoice.payment_intent.client_secret;
    }

    // Fully-discounted or otherwise nothing-to-confirm → activate immediately.
    if (!clientSecret) {
      await supabaseAdmin.from('clients')
        .update({ plan: target_plan, plan_updated_at: new Date().toISOString() })
        .eq('id', client_id);
      return res.status(200).json({ instant: true, subscription_id: subscription.id, message: `Plan ${target_plan} active.` });
    }

    return res.status(200).json({ subscription_id: subscription.id, mode, client_secret: clientSecret });
  } catch (error) {
    console.error('create-subscription error:', error);
    return res.status(500).json({ error: 'Erreur interne. Reessayez ou contactez le support.' });
  }
}

export default withSentry(handler)
