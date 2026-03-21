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

  // 5. Look up client_id from funnel_clients using the slug cookie
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const clientSlug = cookies.actero_client ? decodeURIComponent(cookies.actero_client) : null;

  let onboardedClientId = null;

  if (clientSlug) {
    try {
      const lookupRes = await fetch(
        `${supabaseUrl}/rest/v1/funnel_clients?slug=eq.${encodeURIComponent(clientSlug)}&select=onboarded_client_id`,
        {
          headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
        }
      );
      const lookupData = await lookupRes.json();
      if (lookupData?.[0]?.onboarded_client_id) {
        onboardedClientId = lookupData[0].onboarded_client_id;
      }
    } catch (err) {
      console.error('Failed to look up client:', err);
    }
  }

  // 6. Save to Supabase (with client_id if found)
  const connectionData = {
    shop_domain: shop,
    access_token,
    scopes: scope,
    updated_at: new Date().toISOString(),
  };
  if (onboardedClientId) {
    connectionData.client_id = onboardedClientId;
  }

  const upsertResponse = await fetch(`${supabaseUrl}/rest/v1/client_shopify_connections`, {
    method: 'POST',
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(connectionData),
  });

  if (!upsertResponse.ok) {
    const errText = await upsertResponse.text();
    console.error('Supabase upsert error:', errText);
  }

  // 7. Clear cookies
  res.setHeader('Set-Cookie', [
    'shopify_nonce=; Path=/; HttpOnly; Secure; Max-Age=0',
    'actero_client=; Path=/; HttpOnly; Secure; Max-Age=0',
  ]);

  // 8. Redirect to Shopify success page (React route)
  const redirectUrl = onboardedClientId
    ? `/shopify-success?shop=${encodeURIComponent(shop)}&client_id=${encodeURIComponent(onboardedClientId)}`
    : `/shopify-success?shop=${encodeURIComponent(shop)}`;

  res.redirect(302, redirectUrl);
}

function parseCookies(cookieHeader) {
  const cookies = {};
  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) cookies[name] = rest.join('=');
  });
  return cookies;
}
