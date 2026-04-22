import { withSentry } from '../lib/sentry.js'
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Internal only — fail closed if no secret is configured.
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (!internalSecret) {
    console.error('[referral/validate] INTERNAL_API_SECRET not set — refusing request');
    return res.status(500).json({ error: 'Server not configured' });
  }
  if (req.headers['x-internal-secret'] !== internalSecret) {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }

  const { referral_code, referee_client_id, stripe_customer_id } = req.body;

  if (!referral_code) {
    return res.status(400).json({ error: 'Code de parrainage manquant' });
  }

  // Reward amounts in EUR based on the referrer's current SaaS plan.
  // Mirrors src/lib/plans.js (monthly price). Free plan => no credit reward.
  const PLAN_MONTHLY_EUR = {
    free: 0,
    starter: 99,
    pro: 399,
    enterprise: 399, // fallback for enterprise (sur devis) — conservative
  };

  try {
    // Find the referrer client (include current plan to determine reward)
    const { data: referrer } = await supabase
      .from('clients')
      .select('id, brand_name, referral_code, plan')
      .eq('referral_code', referral_code.toUpperCase())
      .maybeSingle();

    if (!referrer) {
      return res.status(404).json({ error: 'Code de parrainage invalide' });
    }

    // Reward: 1 month Stripe credit = 1 month of the referrer's current plan.
    const referrerPlan = referrer.plan || 'free';
    const monthlyPrice = PLAN_MONTHLY_EUR[referrerPlan] ?? 0;
    const rewardCents = Math.round(monthlyPrice * 100);

    // Find/update the referral record
    const { data: referral } = await supabase
      .from('referrals')
      .select('*')
      .eq('referral_code', referral_code.toUpperCase())
      .in('status', ['clicked', 'signed_up', 'paid'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let referralId;
    if (referral) {
      referralId = referral.id;
    } else {
      // Create one if direct (no click tracked)
      const { data: newRef } = await supabase
        .from('referrals')
        .insert({
          referrer_client_id: referrer.id,
          referral_code: referral_code.toUpperCase(),
          status: 'paid',
          referral_link: `https://actero.fr/r/${referral_code.toUpperCase()}`,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      referralId = newRef.id;
    }

    // Apply Stripe credit to the referrer's customer account
    let stripeCreditId = null;
    try {
      // Find Stripe customer for the referrer
      const { data: referrerFunnel } = await supabase
        .from('funnel_clients')
        .select('stripe_customer_id')
        .eq('onboarded_client_id', referrer.id)
        .maybeSingle();

      const referrerStripeId = referrerFunnel?.stripe_customer_id;
      if (referrerStripeId && rewardCents > 0) {
        const balanceTx = await stripe.customers.createBalanceTransaction(referrerStripeId, {
          amount: -rewardCents, // Negative = credit
          currency: 'eur',
          description: `Parrainage Actero — ${rewardCents / 100}€ de crédit`,
        });
        stripeCreditId = balanceTx.id;
      }
    } catch (stripeErr) {
      console.error('Stripe credit error (non-blocking):', stripeErr.message);
    }

    // Update referral to rewarded
    await supabase
      .from('referrals')
      .update({
        status: 'rewarded',
        referee_client_id: referee_client_id || null,
        referrer_credit_amount: rewardCents,
        referrer_credit_applied: !!stripeCreditId,
        referee_first_month_free: true,
        paid_at: new Date().toISOString(),
        rewarded_at: new Date().toISOString(),
      })
      .eq('id', referralId);

    // Insert reward record
    await supabase
      .from('referral_rewards')
      .insert({
        referral_id: referralId,
        client_id: referrer.id,
        reward_type: 'stripe_credit',
        amount_cents: rewardCents,
        stripe_credit_note_id: stripeCreditId,
      });

    // Send reward email to referrer (best-effort). Skip if there is no credit
    // (e.g. referrer is on Free plan — the referee still gets their 1st month free).
    try {
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey && rewardCents > 0) {
        const { data: users } = await supabase
          .from('client_users')
          .select('user_id')
          .eq('client_id', referrer.id)
          .limit(1);

        if (users?.length) {
          const { data: { user } } = await supabase.auth.admin.getUserById(users[0].user_id);
          if (user?.email) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Actero <notifications@actero.fr>',
                to: user.email,
                subject: `Parrainage validé — 1 mois de crédit offert !`,
                html: `
                  <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                    <h2 style="color: #10b981;">Félicitations ! 🎉</h2>
                    <p>Votre parrainage a été validé. Vous recevez <strong>${rewardCents / 100}€ de crédit</strong> (1 mois) sur votre prochaine facture Actero.</p>
                    <p>Continuez à parrainer pour cumuler encore plus de crédits !</p>
                    <p style="margin-top: 20px;">
                      <a href="https://actero.fr/client" style="background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Voir mon tableau de bord</a>
                    </p>
                    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">— L'équipe Actero</p>
                  </div>
                `,
              }),
            });
          }
        }
      }
    } catch (emailErr) {
      console.error('Reward email error (non-blocking):', emailErr);
    }

    return res.status(200).json({
      success: true,
      reward_cents: rewardCents,
      stripe_credit_id: stripeCreditId,
      referral_id: referralId,
    });
  } catch (err) {
    console.error('Validate referral error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

export default withSentry(handler)
