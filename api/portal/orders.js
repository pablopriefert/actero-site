import { withSentry } from '../lib/sentry.js'
import { getServiceRoleClient } from './lib/supabase.js';
import { requirePortalSession } from './lib/session.js';
import { listOrdersByCustomerEmail } from './lib/shopify.js';

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  let session;
  try { session = await requirePortalSession(req); }
  catch (e) { return res.status(e.status).json({ error: e.code }); }

  const supabase = getServiceRoleClient();
  const { data: integ } = await supabase
    .from('client_integrations')
    .select('provider, access_token, extra_config')
    .eq('client_id', session.clientId)
    .eq('provider', 'shopify')
    .maybeSingle();

  if (!integ) return res.status(200).json({ orders: [], reason: 'no_shopify_integration' });

  try {
    const orders = await listOrdersByCustomerEmail({
      shopDomain: integ.extra_config?.shop_domain,
      accessToken: integ.access_token,
      email: session.customerEmail,
    });
    return res.status(200).json({ orders });
  } catch {
    return res.status(500).json({ error: 'shopify_query_failed' });
  }
}

export default withSentry(handler)
