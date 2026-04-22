import { withSentry } from '../lib/sentry.js'
import { getServiceRoleClient } from './lib/supabase.js';
import { requirePortalSession } from './lib/session.js';

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  let session;
  try { session = await requirePortalSession(req); }
  catch (e) { return res.status(e.status).json({ error: e.code }); }

  const { ticketId, message } = req.body || {};
  if (!ticketId || !message?.trim()) return res.status(400).json({ error: 'invalid_input' });

  const supabase = getServiceRoleClient();
  const { data: ticket, error: ticketErr } = await supabase
    .from('ai_conversations')
    .select('id, client_id, customer_email')
    .eq('id', ticketId)
    .eq('client_id', session.clientId)
    .eq('customer_email', session.customerEmail)
    .maybeSingle();

  if (ticketErr || !ticket) return res.status(404).json({ error: 'ticket_not_found' });

  await supabase
    .from('ai_conversations')
    .update({ status: 'pending', customer_follow_up: message.trim() })
    .eq('id', ticketId);

  await supabase.from('portal_action_logs').insert({
    client_id: session.clientId,
    customer_email: session.customerEmail,
    action: 'ticket_reply',
    target_id: ticketId,
    metadata: { length: message.length },
    ip_inet: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null,
    user_agent: req.headers['user-agent'] || null,
  });

  return res.status(200).json({ ok: true });
}

export default withSentry(handler)
