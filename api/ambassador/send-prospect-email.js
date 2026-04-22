import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorisé' });

  const { prospect_name, prospect_email, company_name, ambassador_code } = req.body || {};

  if (!prospect_email || !prospect_name || !company_name) {
    return res.status(400).json({ error: 'Nom, email et entreprise requis.' });
  }

  // Get ambassador info
  const { data: ambassador } = await supabase
    .from('ambassadors')
    .select('first_name, last_name, ambassador_code')
    .eq('user_id', user.id)
    .single();

  if (!ambassador) {
    return res.status(404).json({ error: 'Ambassadeur non trouvé.' });
  }

  const code = ambassador.ambassador_code;
  const ambassadorFullName = `${ambassador.first_name} ${ambassador.last_name}`;
  const auditLink = `https://actero.fr/audit?ref=${code}`;

  // Send email to prospect
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Actero <notifications@actero.fr>';

  if (!resendKey) {
    return res.status(500).json({ error: 'Email non configuré.' });
  }

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: prospect_email,
        subject: `${ambassadorFullName} vous recommande Actero — automatisez votre business`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #fff; padding: 40px; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: #10b981; color: #000; font-weight: bold; font-size: 13px; padding: 5px 14px; border-radius: 20px; letter-spacing: 1px;">RECOMMANDATION</div>
            </div>

            <h1 style="color: #fff; text-align: center; margin-bottom: 8px; font-size: 26px; line-height: 1.3;">
              ${prospect_name.split(' ')[0]}, vous avez été recommandé
            </h1>
            <p style="color: #9ca3af; text-align: center; margin-bottom: 32px; font-size: 15px; line-height: 1.6;">
              <strong style="color: #10b981;">${ambassadorFullName}</strong> pense qu'Actero pourrait transformer votre business.
            </p>

            <div style="background: #111; border: 1px solid #222; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
              <h3 style="color: #fff; margin: 0 0 12px 0; font-size: 16px;">Ce qu'Actero fait pour vous :</h3>
              <ul style="color: #d1d5db; margin: 0; padding-left: 20px; line-height: 2;">
                <li>Automatise votre SAV avec l'IA (tickets résolus 24/7)</li>
                <li>Récupère vos paniers abandonnés automatiquement</li>
                <li>Vous fait gagner 20h+/mois et des milliers d'euros</li>
              </ul>
            </div>

            <p style="color: #d1d5db; text-align: center; margin-bottom: 24px; font-size: 15px;">
              Réservez un audit stratégie <strong>100% gratuit</strong> de 15 minutes :
            </p>

            <div style="text-align: center; margin-bottom: 32px;">
              <a href="${auditLink}" style="display: inline-block; background: #10b981; color: #000; font-weight: bold; font-size: 16px; padding: 14px 40px; border-radius: 12px; text-decoration: none;">
                Réserver mon audit gratuit
              </a>
            </div>

            <div style="border-top: 1px solid #222; padding-top: 20px;">
              <p style="color: #6b7280; font-size: 12px; text-align: center; line-height: 1.6;">
                Cet email vous a été envoyé car ${ambassadorFullName} vous a recommandé à Actero.<br/>
                Aucun engagement. Aucune obligation.
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Erreur envoi email.' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Send prospect email error:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

export default withSentry(handler)
