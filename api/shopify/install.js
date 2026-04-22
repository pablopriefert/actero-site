import { withSentry } from '../lib/sentry.js'
import crypto from 'crypto';

function handler(req, res) {
  const { shop, client, token } = req.query;

  if (!shop) {
    return res.status(400).json({ error: 'Missing shop parameter. Use ?shop=store-name.myshopify.com' });
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI || 'https://actero.fr/api/shopify/callback';
  const scopes = 'read_orders,write_orders,read_customers,read_products,read_fulfillments,read_checkouts,read_draft_orders,read_inventory,read_shipping,read_returns,read_themes,write_themes';

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

  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`;

  res.redirect(302, authUrl);
}

export default withSentry(handler)
