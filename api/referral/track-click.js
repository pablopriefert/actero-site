import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Code manquant' });
  }

  try {
    // Find the referrer client
    const { data: referrer, error: referrerError } = await supabase
      .from('clients')
      .select('id, brand_name, referral_code')
      .eq('referral_code', code.toUpperCase())
      .maybeSingle();

    if (referrerError || !referrer) {
      return res.status(404).json({ error: 'Code de parrainage invalide' });
    }

    // Check for existing clicked referral with this code (within last hour, to avoid spam)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from('referrals')
      .select('id')
      .eq('referral_code', code.toUpperCase())
      .eq('status', 'clicked')
      .gte('clicked_at', oneHourAgo)
      .maybeSingle();

    if (recent) {
      return res.status(200).json({
        referral_id: recent.id,
        referrer_name: referrer.brand_name,
      });
    }

    // Create referral entry
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: referral, error: insertError } = await supabase
      .from('referrals')
      .insert({
        referrer_client_id: referrer.id,
        referral_code: code.toUpperCase(),
        status: 'clicked',
        clicked_at: new Date().toISOString(),
        expires_at: expiresAt,
        referral_link: `https://actero.fr/r/${code.toUpperCase()}`,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert referral error:', insertError);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    // Send email notification to referrer (best-effort)
    try {
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        // Get referrer email
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
                subject: 'Quelqu\'un a cliqué sur votre lien de parrainage !',
                html: `
                  <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                    <h2 style="color: #10b981;">Bonne nouvelle ! 🎉</h2>
                    <p>Quelqu'un vient de cliquer sur votre lien de parrainage Actero.</p>
                    <p>Si cette personne souscrit un abonnement, vous recevrez un crédit sur votre prochaine facture.</p>
                    <p style="color: #6b7280; font-size: 14px;">— L'équipe Actero</p>
                  </div>
                `,
              }),
            });
          }
        }
      }
    } catch (emailErr) {
      console.error('Email notification error (non-blocking):', emailErr);
    }

    return res.status(200).json({
      referral_id: referral.id,
      referrer_name: referrer.brand_name,
    });
  } catch (err) {
    console.error('Track click error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
