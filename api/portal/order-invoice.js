import { withSentry } from '../lib/sentry.js'
import { getServiceRoleClient } from './lib/supabase.js';
import { requirePortalSession } from './lib/session.js';

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  let session;
  try { session = await requirePortalSession(req); }
  catch (e) { return res.status(e.status).json({ error: e.code }); }

  const supabase = getServiceRoleClient();
  const { data: integ } = await supabase
    .from('client_integrations')
    .select('access_token, extra_config')
    .eq('client_id', session.clientId)
    .eq('provider', 'shopify')
    .maybeSingle();

  if (!integ) return res.status(404).json({ error: 'no_shopify_integration' });

  const orderName = req.query?.orderName;
  if (!orderName) return res.status(400).json({ error: 'order_required' });

  const shopDomain = integ.extra_config?.shop_domain;
  const r = await fetch(
    `https://${shopDomain}/admin/api/2024-10/orders.json?name=${encodeURIComponent(orderName)}&status=any`,
    { headers: { 'X-Shopify-Access-Token': integ.access_token } }
  );
  const j = await r.json();
  const order = j.orders?.[0];
  if (!order) return res.status(404).json({ error: 'order_not_found' });

  await fetch(
    `https://${shopDomain}/admin/api/2024-10/orders/${order.id}/send_invoice.json`,
    {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': integ.access_token, 'content-type': 'application/json' },
      body: JSON.stringify({ invoice: { subject: 'Votre facture', custom_message: 'Voici votre facture.' } }),
    }
  );

  await supabase.from('portal_action_logs').insert({
    client_id: session.clientId,
    customer_email: session.customerEmail,
    action: 'invoice_download',
    target_id: orderName,
    metadata: { method: 'shopify_send_invoice' },
  });

  return res.status(200).json({ ok: true, sentTo: session.customerEmail });
}

export default withSentry(handler)
