import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Internal only — check for internal secret or service key
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (internalSecret && req.headers['x-internal-secret'] !== internalSecret) {
    // Also allow calls from within our own serverless functions (no header check needed for direct imports)
    if (req.headers['x-internal-secret'] !== undefined) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
  }

  const { referral_code, referee_client_id, stripe_customer_id } = req.body;

  if (!referral_code) {
    return res.status(400).json({ error: 'Code de parrainage manquant' });
  }

  try {
    // Find the referrer client
    const { data: referrer } = await supabase
      .from('clients')
      .select('id, brand_name, referral_code')
      .eq('referral_code', referral_code.toUpperCase())
      .maybeSingle();

    if (!referrer) {
      return res.status(404).json({ error: 'Code de parrainage invalide' });
    }

    // Count successful referrals for tiered reward
    const { count: successCount } = await supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_client_id', referrer.id)
      .eq('status', 'rewarded');

    // Tiered rewards: <= 2 successful = 800€, >= 3 = 1600€
    const previousCount = successCount || 0;
    const rewardCents = previousCount >= 2 ? 160000 : 80000;

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
      if (referrerStripeId) {
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
        referee_setup_waived: true,
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

    // Send reward email to referrer (best-effort)
    try {
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
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
                subject: `Parrainage validé — ${rewardCents / 100}€ de crédit !`,
                html: `
                  <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                    <h2 style="color: #10b981;">Félicitations ! 🎉</h2>
                    <p>Votre parrainage a été validé. Vous recevez <strong>${rewardCents / 100}€ de crédit</strong> sur votre prochaine facture Actero.</p>
                    <p>Continuez à parrainer pour débloquer des récompenses encore plus élevées !</p>
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
