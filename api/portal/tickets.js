import { withSentry } from '../lib/sentry.js'
import { getServiceRoleClient } from './lib/supabase.js';
import { requirePortalSession } from './lib/session.js';

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  let session;
  try { session = await requirePortalSession(req); }
  catch (e) { return res.status(e.status).json({ error: e.code }); }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, subject, status, ai_response, human_response, customer_name, customer_message, intent, confidence_score, rating, escalation_reason, customer_follow_up, customer_follow_up_at, created_at, human_responded_at')
    .eq('client_id', session.clientId)
    .eq('customer_email', session.customerEmail)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: 'query_failed' });
  return res.status(200).json({ tickets: data });
}

export default withSentry(handler)
