import { withSentry, captureError } from '../lib/sentry.js'
import crypto from 'crypto';
import { encryptToken } from '../lib/crypto.js';
import { spawnJob } from '../lib/e2b-runner.js';

async function handler(req, res) {
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

  // Constant-time comparison — `!==` is timing-attack-prone.
  const generatedBuf = Buffer.from(generatedHmac, 'utf8');
  const providedBuf = Buffer.from(String(hmac), 'utf8');
  if (
    generatedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(generatedBuf, providedBuf)
  ) {
    return res.status(401).json({ error: 'HMAC validation failed' });
  }

  // 3. Verify nonce (CSRF protection) — same constant-time comparison.
  const cookies = parseCookies(req.headers.cookie || '');
  if (cookies.shopify_nonce) {
    const nonceBuf = Buffer.from(cookies.shopify_nonce, 'utf8');
    const stateBuf = Buffer.from(String(state || ''), 'utf8');
    if (
      nonceBuf.length !== stateBuf.length ||
      !crypto.timingSafeEqual(nonceBuf, stateBuf)
    ) {
      return res.status(401).json({ error: 'Invalid state/nonce' });
    }
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

  // 5. Look up client_id — try multiple methods
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const clientSlug = cookies.actero_client ? decodeURIComponent(cookies.actero_client) : null;
  const authToken = cookies.actero_token ? decodeURIComponent(cookies.actero_token) : null;

  let onboardedClientId = null;

  // Method 1: From funnel_clients slug cookie
  if (clientSlug && !onboardedClientId) {
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
      console.error('Failed to look up client by slug:', err);
    }
  }

  // Method 2: From auth token — find user, then find their client
  if (authToken && !onboardedClientId) {
    try {
      // Get user from token
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${authToken}`,
        },
      });
      const userData = await userRes.json();
      const userId = userData?.id;

      if (userId) {
        // Check client_users table first
        const linkRes = await fetch(
          `${supabaseUrl}/rest/v1/client_users?user_id=eq.${userId}&select=client_id&limit=1`,
          { headers: { apikey: supabaseServiceKey, Authorization: `Bearer ${supabaseServiceKey}` } }
        );
        const linkData = await linkRes.json();
        if (linkData?.[0]?.client_id) {
          onboardedClientId = linkData[0].client_id;
        } else {
          // Fallback: check clients.owner_user_id
          const ownerRes = await fetch(
            `${supabaseUrl}/rest/v1/clients?owner_user_id=eq.${userId}&select=id&limit=1`,
            { headers: { apikey: supabaseServiceKey, Authorization: `Bearer ${supabaseServiceKey}` } }
          );
          const ownerData = await ownerRes.json();
          if (ownerData?.[0]?.id) {
            onboardedClientId = ownerData[0].id;
          }
        }
      }
    } catch (err) {
      console.error('Failed to look up client by token:', err);
    }
  }

  // 6. Save to Supabase (with client_id if found) — encrypt access_token at rest.
  const connectionData = {
    shop_domain: shop,
    access_token: encryptToken(access_token),
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

  // 6c. Register abandoned cart webhook (checkouts/create)
  if (access_token) {
    try {
      const webhookRes = await fetch(`https://${shop}/admin/api/2025-01/webhooks.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': access_token,
        },
        body: JSON.stringify({
          webhook: {
            topic: 'checkouts/create',
            address: 'https://actero.fr/api/engine/webhooks/shopify-cart',
            format: 'json',
          },
        }),
      });
      if (!webhookRes.ok) {
        const whErr = await webhookRes.text();
        console.error('Webhook registration failed:', whErr);
      }
    } catch (err) {
      console.error('Failed to register abandoned cart webhook:', err.message);
    }
  }

  // 6d. Spawn the heavy-lift onboarding job in an E2B sandbox.
  // The sandbox pulls products / customers / orders / historical convos and
  // builds the initial knowledge base. We do not block the OAuth response —
  // the dashboard polls /api/jobs/:id for live progress.
  let onboardingJobId = null;
  if (onboardedClientId && process.env.E2B_API_KEY) {
    try {
      const { jobId } = await spawnJob({
        jobType: 'shopify_onboard',
        clientId: onboardedClientId,
        scriptName: 'shopify_onboard.py',
        payload: { shop_domain: shop, sync_range: '90d' },
        env: {
          SHOPIFY_ACCESS_TOKEN: access_token,
          SHOPIFY_SHOP_DOMAIN: shop,
        },
        timeoutMinutes: 30,
      });
      onboardingJobId = jobId;
    } catch (err) {
      // Don't block the OAuth callback — the dashboard will let the merchant
      // re-trigger onboarding manually if the spawn failed.
      console.error('Failed to spawn onboarding job:', err.message);
      captureError(err, {
        endpoint: '/api/shopify/callback',
        step: 'spawn_onboarding',
        client_id: onboardedClientId,
        shop_domain: shop,
      });
    }
  }

  // 7. Clear cookies
  res.setHeader('Set-Cookie', [
    'shopify_nonce=; Path=/; HttpOnly; Secure; Max-Age=0',
    'actero_client=; Path=/; HttpOnly; Secure; Max-Age=0',
    'actero_token=; Path=/; HttpOnly; Secure; Max-Age=0',
  ]);

  // 8. Redirect to Shopify success page (React route)
  const params = new URLSearchParams({ shop });
  if (onboardedClientId) params.set('client_id', onboardedClientId);
  if (onboardingJobId) params.set('onboarding_job', onboardingJobId);
  const redirectUrl = `/shopify-success?${params.toString()}`;

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

export default withSentry(handler)
