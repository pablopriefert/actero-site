import { withSentry } from './lib/sentry.js'
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check: user must be authenticated and belong to the client
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé.' });
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorisé.' });

  const { client_id } = req.body;
  if (!client_id) {
    return res.status(400).json({ error: 'Missing client_id' });
  }

  // Verify user belongs to this client or is admin (app_metadata authoritative).
  // Owners may not have a client_users row (legacy / best-effort insert), so we
  // also accept clients.owner_user_id — mirrors the sibling client endpoints.
  const isAdmin = user.app_metadata?.role === 'admin';
  if (!isAdmin) {
    const { data: link } = await supabaseAdmin
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('client_id', client_id)
      .maybeSingle();
    if (!link) {
      const { data: owned } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .eq('owner_user_id', user.id)
        .maybeSingle();
      if (!owned) return res.status(403).json({ error: 'Accès refusé.' });
    }
  }

  try {
    // The Stripe customer id lives on clients.stripe_customer_id (set by the
    // billing flow). Fall back to funnel_clients for legacy funnel signups.
    let stripeCustomerId = null;
    const { data: clientRow } = await supabaseAdmin
      .from('clients')
      .select('stripe_customer_id')
      .eq('id', client_id)
      .maybeSingle();
    stripeCustomerId = clientRow?.stripe_customer_id || null;

    if (!stripeCustomerId) {
      const { data: funnel } = await supabaseAdmin
        .from('funnel_clients')
        .select('stripe_customer_id')
        .eq('onboarded_client_id', client_id)
        .not('stripe_customer_id', 'is', null)
        .limit(1)
        .maybeSingle();
      stripeCustomerId = funnel?.stripe_customer_id || null;
    }

    if (!stripeCustomerId) {
      return res.status(404).json({ error: 'No Stripe customer found for this client' });
    }

    // Create a Stripe Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.SITE_URL || 'https://actero.fr'}/client/profile`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Portal session error:', error);
    return res.status(500).json({ error: 'Impossible d\'ouvrir le portail de facturation.' });
  }
}

export default withSentry(handler)
