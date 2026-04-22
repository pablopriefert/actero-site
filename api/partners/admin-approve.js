import { withSentry } from '../lib/sentry.js'
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '../lib/admin-auth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CERTIFICATION_PRICE_EUR = 500;

/**
 * POST /api/partners/admin-approve
 * Body: { application_id }
 * Admin-only. Marks the application as 'approved', creates a Stripe Checkout
 * session for the 500€ certification fee, returns the checkout URL, and
 * stores the session id on the application row so the webhook can find it.
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const adminUser = await requireAdmin(req, res, supabase);
  if (!adminUser) return;

  const { application_id } = req.body || {};
  if (!application_id) {
    return res.status(400).json({ error: 'application_id is required' });
  }

  try {
    const { data: application, error: fetchError } = await supabase
      .from('partner_applications')
      .select('*')
      .eq('id', application_id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.status === 'certified') {
      return res.status(400).json({ error: 'Application already certified' });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://actero.fr';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: application.email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Actero Partners — Certification',
              description:
                'Certification officielle Actero Partner. Inclut le badge, le profil public et l accès au programme de commissions 20%.',
            },
            unit_amount: CERTIFICATION_PRICE_EUR * 100,
          },
          quantity: 1,
        },
      ],
      metadata: {
        kind: 'partner_certification',
        application_id: application.id,
        email: application.email,
      },
      success_url: `${siteUrl}/partners/apply?certified=1`,
      cancel_url: `${siteUrl}/partners/apply?canceled=1`,
    });

    const { error: updateError } = await supabase
      .from('partner_applications')
      .update({
        status: 'approved',
        stripe_session_id: session.id,
      })
      .eq('id', application_id);

    if (updateError) throw updateError;

    return res.status(200).json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (err) {
    console.error('[partners/admin-approve] error:', err);
    return res
      .status(500)
      .json({ error: err.message || 'Server error creating checkout.' });
  }
}

export default withSentry(handler)
