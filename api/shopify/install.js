import { withSentry } from '../lib/sentry.js'
import crypto from 'crypto';

function handler(req, res) {
  const { shop, client, token } = req.query;

  if (!shop) {
    return res.status(400).json({ error: 'Missing shop parameter. Use ?shop=store-name.myshopify.com' });
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI || 'https://actero.fr/api/shopify/callback';

  // Required scopes — every feature of the agent depends on these. Anything
  // here that the merchant declines will break install (Shopify enforces).
  //
  // - read_orders / read_fulfillments  → order tracking, shipping ETA replies
  // - read_customers                   → identify the customer asking
  // - read_products / read_inventory   → product Q&A, stock answers
  // - read_checkouts                   → abandoned-cart playbook
  // - read_returns                     → return-policy answers
  // - read_themes / write_themes       → automatic widget injection into
  //                                       the active theme via assets.json
  //                                       (see api/engine/shopify-widget.js)
  const requiredScopes = [
    'read_orders',
    'read_customers',
    'read_products',
    'read_fulfillments',
    'read_checkouts',
    'read_inventory',
    'read_returns',
    'read_themes',
    'write_themes',
  ].join(',');

  // Optional scopes — the merchant can decline these without breaking the
  // core agent. We request them so power features light up automatically:
  //
  // - write_orders       → agent-driven refunds / cancellations
  // - read_draft_orders  → upsell context in conversations
  // - read_shipping      → live shipping-rate answers
  const optionalScopes = [
    'write_orders',
    'read_draft_orders',
    'read_shipping',
  ].join(',');

  // Generate a random nonce for CSRF protection
  const nonce = crypto.randomBytes(16).toString('hex');

  // Store nonce + client slug + auth token in cookies for callback
  const cookies = [
    `shopify_nonce=${nonce}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  ];
  if (client) {
    cookies.push(`actero_client=${encodeURIComponent(client)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  }
  // Store user's auth token to identify client_id in callback
  if (token) {
    cookies.push(`actero_token=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  }
  res.setHeader('Set-Cookie', cookies);

  // Shopify accepts an `optional_scopes` query param alongside `scope`; scopes
  // declared as optional can be denied by the merchant without aborting the
  // install. Anything else stays in the required `scope` param.
  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${clientId}` +
    `&scope=${requiredScopes}` +
    `&optional_scopes=${optionalScopes}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${nonce}`;

  res.redirect(302, authUrl);
}

export default withSentry(handler)
