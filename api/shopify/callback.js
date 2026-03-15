import crypto from 'crypto';

export default async function handler(req, res) {
  const { shop, code, state, hmac } = req.query;

  // 1. Validate required params
  if (!shop || !code || !hmac) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // 2. Verify HMAC signature from Shopify
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  const queryParams = { ...req.query };
  delete queryParams.hmac;
  delete queryParams.signature;

  const sortedParams = Object.keys(queryParams)
    .sort()
    .map((key) => `${key}=${queryParams[key]}`)
    .join('&');

  const generatedHmac = crypto
    .createHmac('sha256', secret)
    .update(sortedParams)
    .digest('hex');

  if (generatedHmac !== hmac) {
    return res.status(401).json({ error: 'HMAC validation failed' });
  }

  // 3. Verify nonce (CSRF protection)
  const cookies = parseCookies(req.headers.cookie || '');
  if (cookies.shopify_nonce && cookies.shopify_nonce !== state) {
    return res.status(401).json({ error: 'Invalid state/nonce' });
  }

  // 4. Exchange code for permanent access token
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: secret,
      code,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    return res.status(500).json({ error: 'Token exchange failed', details: errorText });
  }

  const { access_token, scope } = await tokenResponse.json();

  // 5. Save to Supabase
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const upsertResponse = await fetch(`${supabaseUrl}/rest/v1/client_shopify_connections`, {
    method: 'POST',
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      shop_domain: shop,
      access_token,
      scopes: scope,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!upsertResponse.ok) {
    const errText = await upsertResponse.text();
    console.error('Supabase upsert error:', errText);
    // Don't block — token was obtained, we just failed to save
  }

  // 6. Clear nonce cookie
  res.setHeader('Set-Cookie', 'shopify_nonce=; Path=/; HttpOnly; Secure; Max-Age=0');

  // 7. Redirect to success page
  res.redirect(302, `/api/shopify/success?shop=${encodeURIComponent(shop)}`);
}

function parseCookies(cookieHeader) {
  const cookies = {};
  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) cookies[name] = rest.join('=');
  });
  return cookies;
}
