import { withSentry } from './lib/sentry.js'
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function buildDeploymentEmailHtml({ company_name }) {
  const dashboardLink = `${process.env.SITE_URL || 'https://actero.fr'}/login`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f8f8;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding:40px 40px 0 40px;">
              <div style="font-size:22px;font-weight:700;color:#000000;letter-spacing:-0.5px;">Actero</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <div style="width:64px;height:64px;background-color:#d1fae5;border-radius:50%;margin:0 auto 24px auto;text-align:center;line-height:64px;font-size:28px;">
                &#10003;
              </div>

              <h1 style="font-size:24px;font-weight:700;color:#000000;margin:0 0 20px 0;line-height:1.3;text-align:center;">
                Vos automations sont actives !
              </h1>

              <p style="font-size:15px;color:#444444;line-height:1.7;margin:0 0 16px 0;">
                Bonjour ${company_name},
              </p>

              <p style="font-size:15px;color:#444444;line-height:1.7;margin:0 0 16px 0;">
                Bonne nouvelle — votre infrastructure IA est maintenant opérationnelle. Vos automations tournent en continu à partir de maintenant.
              </p>

              <!-- What's active -->
              <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:0 0 24px 0;">
                <div style="font-size:13px;color:#166534;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin:0 0 12px 0;">Automations actives</div>
                <table cellpadding="0" cellspacing="0" style="width:100%;">
                  <tr><td style="padding:6px 0;font-size:14px;color:#166534;"><span style="margin-right:8px;">&#9889;</span> Support client IA — triage et réponse automatique</td></tr>
                  <tr><td style="padding:6px 0;font-size:14px;color:#166534;"><span style="margin-right:8px;">&#128722;</span> Relance paniers abandonnés — emails automatiques</td></tr>
                </table>
              </div>

              <p style="font-size:15px;color:#444444;line-height:1.7;margin:0 0 24px 0;">
                Vous pouvez suivre toutes les actions de votre agent IA en temps réel depuis votre dashboard.
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:4px 0 28px 0;">
                    <a href="${dashboardLink}" style="display:inline-block;background-color:#000000;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:12px;letter-spacing:-0.2px;">
                      Accéder à mon dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <!-- What to expect -->
              <div style="border-top:1px solid #eee;padding-top:24px;">
                <p style="font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin:0 0 16px 0;">
                  Ce qui se passe maintenant
                </p>
                <table cellpadding="0" cellspacing="0" style="width:100%;">
                  <tr><td style="padding:6px 0;font-size:14px;color:#444;"><span style="color:#10b981;margin-right:8px;">&#10003;</span> Chaque ticket client est analysé et traité automatiquement</td></tr>
                  <tr><td style="padding:6px 0;font-size:14px;color:#444;"><span style="color:#10b981;margin-right:8px;">&#10003;</span> Les paniers abandonnés sont relancés par email</td></tr>
                  <tr><td style="padding:6px 0;font-size:14px;color:#444;"><span style="color:#10b981;margin-right:8px;">&#10003;</span> Toutes les métriques remontent dans votre dashboard</td></tr>
                  <tr><td style="padding:6px 0;font-size:14px;color:#444;"><span style="color:#10b981;margin-right:8px;">&#10003;</span> Notre équipe optimise en continu vos résultats</td></tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 40px 40px 40px;">
              <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 4px 0;">
                Si vous avez la moindre question, n'hésitez pas à nous contacter.
              </p>
              <p style="font-size:14px;color:#444;line-height:1.7;margin:0;">
                À très vite,
              </p>
              <p style="font-size:14px;font-weight:700;color:#000;margin:8px 0 0 0;">
                L'équipe Actero
              </p>
            </td>
          </tr>

          <!-- Legal -->
          <tr>
            <td style="padding:20px 40px;background-color:#fafafa;border-top:1px solid #eee;">
              <p style="font-size:11px;color:#aaa;margin:0;text-align:center;line-height:1.5;">
                Cet email a été envoyé par Actero · actero.fr
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: internal secret only
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return res.status(401).json({ error: 'Non autorise' });
  }

  const { email, company_name } = req.body;

  if (!email || !company_name) {
    return res.status(400).json({ error: 'Missing required fields: email, company_name' });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Actero <onboarding@resend.dev>',
      to: [email],
      subject: `${company_name}, vos automations IA sont actives !`,
      html: buildDeploymentEmailHtml({ company_name }),
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, id: data?.id });
  } catch (error) {
    console.error('Email send error:', error);
    return res.status(500).json({ error: "Erreur lors de l'envoi de l'email." });
  }
}

export default withSentry(handler)
