import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function buildEmailHtml({ company_name, slug, setup_price, monthly_price, message }) {
  const link = `${process.env.SITE_URL || 'https://actero.fr'}/start/${slug}`;

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
              <h1 style="font-size:24px;font-weight:700;color:#000000;margin:0 0 20px 0;line-height:1.3;">
                Bonjour ${company_name},
              </h1>

              <p style="font-size:15px;color:#444444;line-height:1.7;margin:0 0 16px 0;">
                Suite à notre échange, voici votre accès pour démarrer avec Actero.
              </p>

              <p style="font-size:15px;color:#444444;line-height:1.7;margin:0 0 24px 0;">
                Nous avons préparé une configuration adaptée à votre activité.
              </p>

              ${message ? `
              <div style="background-color:#f8f8f8;border-radius:12px;padding:16px 20px;margin:0 0 24px 0;">
                <p style="font-size:14px;color:#555555;line-height:1.6;margin:0;font-style:italic;">
                  "${message}"
                </p>
              </div>
              ` : ''}

              <!-- Pricing -->
              <div style="background-color:#fafafa;border:1px solid #eee;border-radius:12px;padding:20px;margin:0 0 28px 0;">
                <div style="font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin:0 0 12px 0;">Votre offre</div>
                <div style="font-size:15px;color:#222;margin:0 0 6px 0;">Setup : <strong>${setup_price}€</strong> (une fois)</div>
                <div style="font-size:15px;color:#222;">Abonnement : <strong>${monthly_price}€</strong>/mois</div>
              </div>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:4px 0 28px 0;">
                    <a href="${link}" style="display:inline-block;background-color:#000000;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:12px;letter-spacing:-0.2px;">
                      Démarrer maintenant
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Benefits -->
              <div style="border-top:1px solid #eee;padding-top:24px;">
                <p style="font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin:0 0 16px 0;">
                  Ce que vous allez mettre en place
                </p>
                <table cellpadding="0" cellspacing="0" style="width:100%;">
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:#444;">
                      <span style="color:#10b981;margin-right:8px;">&#10003;</span> Automatisation du support client
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:#444;">
                      <span style="color:#10b981;margin-right:8px;">&#10003;</span> Récupération des ventes perdues
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:#444;">
                      <span style="color:#10b981;margin-right:8px;">&#10003;</span> Système IA personnalisé
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 40px 40px 40px;">
              <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 4px 0;">
                Si vous avez la moindre question, je reste disponible.
              </p>
              <p style="font-size:14px;color:#444;line-height:1.7;margin:0;">
                À très vite,
              </p>
              <p style="font-size:14px;font-weight:700;color:#000;margin:8px 0 0 0;">
                Actero
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, company_name, slug, setup_price, monthly_price, message } = req.body;

  if (!email || !company_name || !slug) {
    return res.status(400).json({ error: 'Missing required fields: email, company_name, slug' });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Actero <onboarding@resend.dev>',
      to: [email],
      subject: 'Votre accès Actero',
      html: buildEmailHtml({ company_name, slug, setup_price, monthly_price, message }),
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, id: data?.id });
  } catch (error) {
    console.error('Email send error:', error);
    return res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email.' });
  }
}
