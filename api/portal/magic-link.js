import { Resend } from 'resend';
import { getServiceRoleClient } from './lib/supabase.js';
import { generateMagicLinkToken, hashToken } from './lib/auth.js';
import { checkMagicLinkRateLimit } from './lib/rate-limit.js';

const MAGIC_LINK_TTL_MINUTES = 15;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { clientId, email, slug } = req.body || {};
  if (!clientId || !email || !slug) return res.status(400).json({ error: 'invalid_input' });

  const normalizedEmail = email.trim().toLowerCase();
  const supabase = getServiceRoleClient();

  const rate = await checkMagicLinkRateLimit(supabase, clientId, normalizedEmail);
  if (!rate.allowed) return res.status(429).json({ error: 'rate_limited', retryAfter: rate.retryAfterSeconds });

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
    subject: 'Votre lien de connexion',
    html: `<p>Bonjour,</p><p>Cliquez pour vous connecter à votre espace SAV :</p><p><a href="${url}">${url}</a></p><p>Ce lien expire dans 15 minutes.</p>`,
  });

  return res.status(200).json({ ok: true });
}
