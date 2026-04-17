import { Resend } from 'resend';
import { getServiceRoleClient } from './lib/supabase.js';
import { generateMagicLinkToken, hashToken } from './lib/auth.js';
import { checkMagicLinkRateLimit } from './lib/rate-limit.js';

const MAGIC_LINK_TTL_MINUTES = 15;

function buildMagicLinkEmailHtml({ url, merchantName }) {
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

          <tr>
            <td style="padding:40px 40px 0 40px;">
              <div style="font-size:22px;font-weight:700;color:#000000;letter-spacing:-0.5px;">Actero</div>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 40px 8px 40px;">
              <h1 style="font-size:24px;font-weight:700;color:#000000;margin:0 0 16px 0;line-height:1.3;letter-spacing:-0.5px;">
                Votre lien de connexion
              </h1>
              <p style="font-size:15px;color:#444444;line-height:1.7;margin:0 0 20px 0;">
                Cliquez sur le bouton ci-dessous pour accéder à votre espace SAV pour <strong>${merchantName}</strong>.
              </p>
              <p style="font-size:14px;color:#666666;line-height:1.6;margin:0 0 24px 0;">
                Ce lien est valable <strong>15 minutes</strong> et utilisable une seule fois.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:4px 0 28px 0;">
                    <a href="${url}" style="display:inline-block;background-color:#000000;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:12px;letter-spacing:-0.2px;">
                      Accéder à mon espace
                    </a>
                  </td>
                </tr>
              </table>

              <div style="border-top:1px solid #eee;padding-top:20px;">
                <p style="font-size:13px;color:#888;margin:0 0 8px 0;">
                  Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
                </p>
                <p style="font-size:12px;color:#555;word-break:break-all;margin:0;">
                  <a href="${url}" style="color:#555;text-decoration:underline;">${url}</a>
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px 28px 40px;background-color:#fafafa;border-top:1px solid #eee;">
              <p style="font-size:12px;color:#888;margin:0 0 6px 0;">
                Si vous n'avez pas demandé ce lien, ignorez simplement cet email.
              </p>
              <p style="font-size:11px;color:#aaa;margin:0;letter-spacing:0.2px;">
                <a href="https://actero.fr" style="color:#aaa;text-decoration:none;">Actero</a> · Support client automatisé
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { clientId, email, slug } = req.body || {};
  if (!clientId || !email || !slug) return res.status(400).json({ error: 'invalid_input' });

  const normalizedEmail = email.trim().toLowerCase();
  const supabase = getServiceRoleClient();

  const rate = await checkMagicLinkRateLimit(supabase, clientId, normalizedEmail);
  if (!rate.allowed) return res.status(429).json({ error: 'rate_limited', retryAfter: rate.retryAfterSeconds });

  const { data: client } = await supabase
    .from('clients')
    .select('brand_name')
    .eq('id', clientId)
    .maybeSingle();

  const merchantName = client?.brand_name || 'votre boutique';

  const raw = generateMagicLinkToken();
  const hash = await hashToken(raw);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000).toISOString();

  const { error } = await supabase.from('portal_sessions').insert({
    client_id: clientId,
    customer_email: normalizedEmail,
    token_hash: hash,
    purpose: 'magic_link',
    expires_at: expiresAt,
    ip_inet: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null,
    user_agent: req.headers['user-agent'] || null,
  });
  if (error) return res.status(500).json({ error: 'db_insert_failed' });

  const baseDomain = process.env.PORTAL_BASE_DOMAIN || 'portal.actero.fr';
  const url = `https://${slug}.${baseDomain}/portal/verify?token=${raw}`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.PORTAL_EMAIL_FROM || 'noreply@actero.fr',
    to: normalizedEmail,
    subject: `Votre lien de connexion · Actero`,
    html: buildMagicLinkEmailHtml({ url, merchantName }),
  });

  return res.status(200).json({ ok: true });
}
