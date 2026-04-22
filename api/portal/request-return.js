import { withSentry } from '../lib/sentry.js'
import { getServiceRoleClient } from './lib/supabase.js';
import { requirePortalSession } from './lib/session.js';

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  let session;
  try { session = await requirePortalSession(req); }
  catch (e) { return res.status(e.status).json({ error: e.code }); }

  const { orderName, reason, items } = req.body || {};
  if (!orderName) return res.status(400).json({ error: 'order_required' });

  const supabase = getServiceRoleClient();

  const { data: conv, error: convErr } = await supabase.from('ai_conversations').insert({
    client_id: session.clientId,
    customer_email: session.customerEmail,
    subject: `Demande de retour ${orderName}`,
    status: 'pending',
    intent: 'return',
    order_id: orderName,
    customer_message: `Demande retour depuis portal. Raison: ${reason || 'non précisée'}`,
    metadata: { reason, items, source: 'portal' },
  }).select().single();

  if (convErr) return res.status(500).json({ error: 'create_failed' });

  await supabase.from('portal_action_logs').insert({
    client_id: session.clientId,
    customer_email: session.customerEmail,
    action: 'return_request',
    target_id: orderName,
    metadata: { conversation_id: conv.id, reason, items },
  });

  const engineUrl = process.env.PORTAL_ENGINE_TRIGGER_URL;
  if (engineUrl) {
    fetch(engineUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-token': process.env.INTERNAL_TRIGGER_TOKEN || '' },
      body: JSON.stringify({ conversationId: conv.id }),
    }).catch(() => {});
  }

  return res.status(200).json({ ok: true, conversationId: conv.id });
}

export default withSentry(handler)
