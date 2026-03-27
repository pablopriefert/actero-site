import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check — admin only
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non authentifié' });

  const isAdmin = user.app_metadata?.role === 'admin' || user.email?.endsWith('@actero.fr');
  if (!isAdmin) return res.status(403).json({ error: 'Accès refusé' });

  const { email, company_name, install_url } = req.body;

  if (!email || !company_name || !install_url) {
    return res.status(400).json({ error: 'Champs requis : email, company_name, install_url' });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Actero <onboarding@resend.dev>',
      to: [email],
      subject: 'Actero — Installez notre application Shopify',
      html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f8f8;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <tr><td style="padding:40px 40px 0 40px;">
          <div style="font-size:22px;font-weight:700;color:#000;letter-spacing:-0.5px;">Actero</div>
        </td></tr>

        <tr><td style="padding:32px 40px;">
          <h1 style="font-size:24px;font-weight:700;color:#000;margin:0 0 20px 0;line-height:1.3;">
            Connectez votre boutique Shopify
          </h1>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 16px 0;">
            Bonjour ${company_name},
          </p>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 24px 0;">
            Pour activer vos agents IA Actero sur votre boutique, il vous suffit d'installer notre application Shopify en un clic. C'est rapide, sécurisé, et aucune donnée sensible n'est partagée.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:4px 0 32px 0;">
              <a href="${install_url}" style="display:inline-block;background-color:#008060;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:12px;letter-spacing:-0.2px;">
                Installer l'app Shopify
              </a>
            </td></tr>
          </table>

          <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px;margin:0 0 24px 0;">
            <p style="font-size:13px;color:#166534;line-height:1.6;margin:0;">
              <strong>Ce que fait l'application :</strong><br>
              ✓ Lecture des commandes et clients pour le support automatisé<br>
              ✓ Suivi des paniers abandonnés pour la relance<br>
              ✓ Aucune modification de votre boutique
            </p>
          </div>
        </td></tr>

        <tr><td style="padding:0 40px 40px 40px;">
          <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 4px 0;">
            Si vous avez la moindre question, répondez simplement à cet email.
          </p>
          <p style="font-size:14px;color:#444;line-height:1.7;margin:0;">À très vite,</p>
          <p style="font-size:14px;font-weight:700;color:#000;margin:8px 0 0 0;">L'équipe Actero</p>
        </td></tr>

        <tr><td style="padding:20px 40px;background-color:#fafafa;border-top:1px solid #eee;">
          <p style="font-size:11px;color:#aaa;margin:0;text-align:center;line-height:1.5;">
            Cet email a été envoyé par Actero · actero.fr
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`,
    });

    if (error) {
      console.error('[RESEND] Shopify install email error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, id: data?.id });
  } catch (err) {
    console.error('[RESEND] Shopify install email error:', err);
    return res.status(500).json({ error: 'Erreur lors de l\'envoi.' });
  }
}
