import { getServiceRoleClient } from './lib/supabase.js';
import { verifyTokenAgainstHash, issueSessionJwt } from './lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { token, clientId } = req.body || {};
  if (!token || !clientId) return res.status(400).json({ error: 'invalid_input' });

  const supabase = getServiceRoleClient();

  const { data: row, error } = await supabase
    .from('portal_sessions')
    .select('id, client_id, customer_email, token_hash, purpose, expires_at, used_at')
    .eq('client_id', clientId)
    .eq('purpose', 'magic_link')
    .is('used_at', null)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !row) return res.status(401).json({ error: 'invalid_or_expired' });

  const ok = await verifyTokenAgainstHash(token, row.token_hash);
  if (!ok) return res.status(401).json({ error: 'invalid_or_expired' });

  await supabase.from('portal_sessions').update({ used_at: new Date().toISOString() }).eq('id', row.id);

  const jwt = await issueSessionJwt({ clientId: row.client_id, customerEmail: row.customer_email });

  const cookie = [
    `portal_session=${jwt}`, 'Path=/', `Max-Age=${30 * 24 * 60 * 60}`,
    'HttpOnly', 'Secure', 'SameSite=Lax',
  ].join('; ');
  res.setHeader('Set-Cookie', cookie);

  await supabase.from('portal_action_logs').insert({
    client_id: row.client_id,
    customer_email: row.customer_email,
    action: 'login',
    metadata: { session_id: row.id },
    ip_inet: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null,
    user_agent: req.headers['user-agent'] || null,
  });

  return res.status(200).json({ ok: true });
}
