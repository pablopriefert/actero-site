import crypto from 'crypto';

export default function handler(req, res) {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).json({ error: 'Missing shop parameter. Use ?shop=store-name.myshopify.com' });
  }

  // Validate shop domain format
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
    return res.status(400).json({ error: 'Invalid shop domain format' });
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'Shopify client ID not configured' });
  }

  const redirectUri = process.env.SHOPIFY_REDIRECT_URI;
  if (!redirectUri) {
    return res.status(500).json({ error: 'Redirect URI not configured' });
  }
  const scopes = 'read_orders,write_orders,read_customers,read_products,read_fulfillments,read_checkouts,read_draft_orders,read_inventory,read_shipping,read_returns';

  // Generate a random nonce for CSRF protection
  const nonce = crypto.randomBytes(16).toString('hex');

  // Store nonce in a cookie for verification
  res.setHeader('Set-Cookie', `shopify_nonce=${nonce}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);

  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`;

  res.redirect(302, authUrl);
}
