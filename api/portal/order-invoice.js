import { withSentry } from '../lib/sentry.js'
import { getServiceRoleClient } from './lib/supabase.js';
import { requirePortalSession } from './lib/session.js';

// Shopify GraphQL Admin API — required by App Store policy 2.2.4 for all
// non-Theme/Asset endpoints in new public apps.
const GRAPHQL_API_VERSION = '2025-01';

const ORDER_BY_NAME_QUERY = `
  query OrderByName($query: String!) {
    orders(first: 1, query: $query) {
      edges { node { id name } }
    }
  }
`;

const SEND_INVOICE_MUTATION = `
  mutation OrderInvoiceSend($id: ID!, $email: EmailInput) {
    orderInvoiceSend(orderId: $id, email: $email) {
      order { id }
      userErrors { field message }
    }
  }
`;

async function shopifyGraphql(shopDomain, token, query, variables) {
  const resp = await fetch(
    `https://${shopDomain}/admin/api/${GRAPHQL_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  if (!resp.ok) {
    return { ok: false, status: resp.status, data: null, errors: null };
  }
  const json = await resp.json();
  return {
    ok: !json?.errors?.length,
    status: 200,
    data: json?.data || null,
    errors: json?.errors || null,
  };
}

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
  // Order names are "#1042" / "1042". Reject anything else so the value can't
  // inject Shopify search operators into the `name:${orderName}` filter below
  // (e.g. "1 OR email:someone@else.com" to reach another customer's order).
  if (!/^#?\d{1,15}$/.test(String(orderName))) {
    return res.status(400).json({ error: 'invalid_order' });
  }

  const shopDomain = integ.extra_config?.shop_domain;

  // 1. Resolve order GID from its merchant-facing name (e.g. "#1042").
  const lookup = await shopifyGraphql(
    shopDomain,
    integ.access_token,
    ORDER_BY_NAME_QUERY,
    { query: `name:${orderName}` },
  );
  if (!lookup.ok) {
    return res.status(502).json({ error: 'shopify_lookup_failed' });
  }
  const orderId = lookup.data?.orders?.edges?.[0]?.node?.id || null;
  if (!orderId) return res.status(404).json({ error: 'order_not_found' });

  // 2. Trigger Shopify's native invoice email to the portal user.
  const send = await shopifyGraphql(
    shopDomain,
    integ.access_token,
    SEND_INVOICE_MUTATION,
    {
      id: orderId,
      email: {
        to: session.customerEmail,
        subject: 'Votre facture',
        customMessage: 'Voici votre facture.',
      },
    },
  );
  const userErrors = send.data?.orderInvoiceSend?.userErrors || [];
  if (!send.ok || userErrors.length) {
    console.warn(
      '[portal/order-invoice] orderInvoiceSend failed:',
      JSON.stringify(userErrors || send.errors),
    );
    return res.status(502).json({ error: 'shopify_send_failed' });
  }

  await supabase.from('portal_action_logs').insert({
    client_id: session.clientId,
    customer_email: session.customerEmail,
    action: 'invoice_download',
    target_id: orderName,
    metadata: { method: 'shopify_order_invoice_send' },
  });

  return res.status(200).json({ ok: true, sentTo: session.customerEmail });
}

export default withSentry(handler)
