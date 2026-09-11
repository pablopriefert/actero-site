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
  // Vrai quand le client a été résolu depuis un compte existant (slug ou jeton) :
  // dans ce cas il ne faut PAS émettre de jeton de rattachement.
  let resolvedFromAccount = false;

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
        resolvedFromAccount = true;
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
          resolvedFromAccount = true;
        } else {
          // Fallback: check clients.owner_user_id
          const ownerRes = await fetch(
            `${supabaseUrl}/rest/v1/clients?owner_user_id=eq.${userId}&select=id&limit=1`,
            { headers: { apikey: supabaseServiceKey, Authorization: `Bearer ${supabaseServiceKey}` } }
          );
          const ownerData = await ownerRes.json();
          if (ownerData?.[0]?.id) {
            onboardedClientId = ownerData[0].id;
            resolvedFromAccount = true;
          }
        }
      }
    } catch (err) {
      console.error('Failed to look up client by token:', err);
    }
  }

  // Method 3: App-Store-first install — the merchant discovered Actero on the
  // Shopify App Store and has no Actero account yet, so neither cookie above
  // resolved. Previously the connection was stored with client_id = null: the
  // shop was orphaned, unreachable and unbillable (Managed Pricing needs a
  // linked client). We now create the client here and mint a short-lived signed
  // claim token so the merchant can attach the shop to their account after
  // signing up. See api/shopify/claim.js.
  let claimToken = null;

  // Method 2c: la boutique est peut-être DÉJÀ connectée. Sans ce test, chaque
  // réinstallation sans compte fabriquait un nouveau client : shop_domain étant
  // UNIQUE, l'upsert plus bas repointait la connexion vers le nouveau client et
  // abandonnait l'ancien — sans propriétaire et sans boutique. C'est l'origine
  // du client orphelin observé le 8 septembre.
  if (!onboardedClientId) {
    try {
      const connRes = await fetch(
        `${supabaseUrl}/rest/v1/client_shopify_connections?shop_domain=eq.${encodeURIComponent(shop)}&select=client_id&limit=1`,
        { headers: { apikey: supabaseServiceKey, Authorization: `Bearer ${supabaseServiceKey}` } }
      );
      const connData = connRes.ok ? await connRes.json() : [];
      if (connData?.[0]?.client_id) {
        onboardedClientId = connData[0].client_id;
        console.log(`[shopify-callback] réinstallation de ${shop} — client existant ${onboardedClientId} réutilisé`);
      }
    } catch (err) {
      console.error('[shopify-callback] lookup connexion existante échoué:', err.message);
    }
  }

  if (!onboardedClientId) {
    // Best-effort: use the real shop name / owner email for the new client.
    let shopName = shop.replace(/\.myshopify\.com$/, '');
    let shopEmail = null;
    try {
      const shopResp = await fetch(`https://${shop}/admin/api/2025-01/graphql.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': access_token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query: '{ shop { name email } }' }),
      });
      const shopJson = await shopResp.json().catch(() => ({}));
      shopName = shopJson?.data?.shop?.name || shopName;
      shopEmail = shopJson?.data?.shop?.email || null;
    } catch (err) {
      // Cet échec n'est jamais anodin : si `{ shop { name } }` ne passe pas, le
      // token vient d'être refusé par Shopify et TOUT l'onboarding échouera
      // derrière. Le 8 septembre il était avalé en silence, et le client s'est
      // retrouvé nommé d'après son domaine avec un contact_email nul.
      console.error('[shopify-callback] shop lookup refusé par Shopify:', err.message);
      captureError(err, {
        endpoint: '/api/shopify/callback',
        step: 'shop_lookup',
        shop_domain: shop,
        hint: 'token probablement rejeté — onboarding condamné',
      });
    }

    try {
      const createResp = await fetch(`${supabaseUrl}/rest/v1/clients`, {
        method: 'POST',
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          brand_name: shopName,
          contact_email: shopEmail,
          plan: 'free',
          client_type: 'ecommerce',
        }),
      });
      const created = await createResp.json().catch(() => null);
      const newClientId = Array.isArray(created) ? created[0]?.id : created?.id;
      if (newClientId) {
        onboardedClientId = newClientId;
        // 30-day window to claim, authenticated via AES-GCM (server key only).
        claimToken = encryptToken(
          JSON.stringify({
            cid: newClientId,
            shop,
            exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
          }),
        );
        console.log(`[shopify-callback] created client ${newClientId} for App Store install ${shop}`);
      } else {
        console.error('[shopify-callback] client auto-create failed:', JSON.stringify(created));
      }
    } catch (err) {
      console.error('[shopify-callback] client auto-create error:', err.message);
    }
  }

  // Un jeton de rattachement est nécessaire dès que le client résolu n'a pas de
  // propriétaire — qu'on vienne de le créer OU qu'on ait réutilisé un orphelin.
  // Sans ce second cas, un marchand qui réinstalle une boutique orpheline
  // n'avait plus aucun moyen de se la rattacher.
  if (onboardedClientId && !resolvedFromAccount && !claimToken) {
    try {
      const ownerRes = await fetch(
        `${supabaseUrl}/rest/v1/clients?id=eq.${onboardedClientId}&select=owner_user_id&limit=1`,
        { headers: { apikey: supabaseServiceKey, Authorization: `Bearer ${supabaseServiceKey}` } }
      );
      const ownerRows = ownerRes.ok ? await ownerRes.json() : [];
      if (ownerRows?.[0] && !ownerRows[0].owner_user_id) {
        claimToken = encryptToken(
          JSON.stringify({
            cid: onboardedClientId,
            shop,
            exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
          }),
        );
      }
    } catch (err) {
      console.error('[shopify-callback] vérification propriétaire échouée:', err.message);
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

  // 6c. Register checkouts/create + app/uninstalled webhooks via the GraphQL
  // Admin API (App Store policy 2.2.4 — REST is not permitted for general
  // admin functionality in new public apps).
  //
  // These topics are also declared in shopify.app.actero.toml so that fresh
  // installs going through the managed install flow get them automatically.
  // We re-register here at OAuth callback time to cover re-installs and
  // pre-toml legacy merchants — belt and braces.
  //
  // The handlers verify HMAC-SHA256 on the raw body (same pattern as the
  // GDPR webhooks shipped under api/shopify/webhooks/).
  if (access_token) {
    const subscriptionsToRegister = [
      {
        topic: 'CHECKOUTS_CREATE',
        callbackUrl: 'https://actero.fr/api/engine/webhooks/shopify-cart',
      },
      {
        topic: 'APP_UNINSTALLED',
        callbackUrl: 'https://actero.fr/api/shopify/webhooks/app/uninstalled',
      },
    ];

    const WEBHOOK_SUBSCRIPTION_CREATE = `
      mutation WebhookSubscriptionCreate(
        $topic: WebhookSubscriptionTopic!
        $webhookSubscription: WebhookSubscriptionInput!
      ) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
          userErrors { field message }
          webhookSubscription { id }
        }
      }
    `;

    for (const sub of subscriptionsToRegister) {
      try {
        const resp = await fetch(`https://${shop}/admin/api/2025-01/graphql.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': access_token,
            Accept: 'application/json',
          },
          body: JSON.stringify({
            query: WEBHOOK_SUBSCRIPTION_CREATE,
            variables: {
              topic: sub.topic,
              webhookSubscription: { callbackUrl: sub.callbackUrl, format: 'JSON' },
            },
          }),
        });
        const json = await resp.json().catch(() => ({}));
        const userErrors = json?.data?.webhookSubscriptionCreate?.userErrors || [];
        if (userErrors.length) {
          // "Address has already been taken" means the subscription already exists
          // for this shop — typical on re-install, not an error.
          const isDuplicate = userErrors.some((e) =>
            String(e.message || '').toLowerCase().includes('already been taken'),
          );
          if (isDuplicate) {
            console.log(
              `[shopify-callback] ${sub.topic} webhook already registered (re-install)`,
            );
          } else {
            console.error(
              `[shopify-callback] ${sub.topic} webhook userErrors:`,
              JSON.stringify(userErrors),
            );
          }
        } else if (json?.errors?.length) {
          console.error(
            `[shopify-callback] ${sub.topic} webhook GraphQL errors:`,
            JSON.stringify(json.errors),
          );
        }
      } catch (err) {
        console.error(`Failed to register ${sub.topic} webhook:`, err.message);
      }
    }
  }

  // 6d. Spawn the heavy-lift onboarding job in an E2B sandbox.
  // The sandbox pulls products / customers / orders / historical convos and
  // builds the initial knowledge base. We do not block the OAuth response —
  // the dashboard polls /api/jobs/:id for live progress.
  let onboardingJobId = null;
  let onboardingSpawnFailed = false;
  if (onboardedClientId && !process.env.E2B_API_KEY) {
    // Sans la clé, le bloc ci-dessous était purement sauté et le drapeau restait
    // faux : la page de succès en concluait que l'onboarding était terminé, alors
    // qu'il n'avait jamais commencé.
    onboardingSpawnFailed = true;
    console.error('[shopify-callback] E2B_API_KEY absente — onboarding non lancé');
    captureError(new Error('E2B_API_KEY not configured'), {
      endpoint: '/api/shopify/callback',
      step: 'spawn_onboarding',
      client_id: onboardedClientId,
      shop_domain: shop,
    });
  }
  if (onboardedClientId && process.env.E2B_API_KEY) {
    try {
      const { jobId } = await spawnJob({
        jobType: 'shopify_onboard',
        clientId: onboardedClientId,
        scriptName: 'shopify_onboard.py',
        // 60 jours, pas 90 : sans le scope read_all_orders, Shopify refuse les
        // commandes plus anciennes. On demandait donc un mois de données qu'on
        // n'a pas le droit de lire. Demander read_all_orders serait l'autre
        // option, mais il faut le justifier à la review (exigence 3.2.1) et
        // l'agent SAV n'a pas besoin de l'historique long.
        payload: { shop_domain: shop, sync_range: '60d' },
        env: {
          SHOPIFY_ACCESS_TOKEN: access_token,
          SHOPIFY_SHOP_DOMAIN: shop,
        },
        timeoutMinutes: 30,
      });
      onboardingJobId = jobId;
    } catch (err) {
      // Don't block the OAuth callback — but flag the failure so the success
      // page surfaces a retry instead of pretending onboarding is done.
      // (Slack alerting is owned by markJobFailed in e2b-runner when the job
      // row exists; this flag covers the merchant-facing UX.)
      onboardingSpawnFailed = true;
      console.error('Failed to spawn onboarding job:', err.message);
      captureError(err, {
        endpoint: '/api/shopify/callback',
        step: 'spawn_onboarding',
        client_id: onboardedClientId,
        shop_domain: shop,
      });
    }
  }

  // 6e. Auto-activate the core SAV playbook so the agent is LIVE the moment
  // onboarding finishes — the merchant no longer has to hunt for a "Activer le
  // playbook" toggle. The KB is auto-built by the onboard job + storefront
  // crawl, the tone has a sane default, so activating sav_ecommerce here means
  // the only required setup step is the Shopify connection itself.
  //
  // Idempotent (checks for an existing row first) and fail-soft (never blocks
  // the OAuth response). Re-installs simply find the row already present.
  if (onboardedClientId) {
    try {
      // Resolve the globally-active sav_ecommerce playbook id.
      const pbRes = await fetch(
        `${supabaseUrl}/rest/v1/engine_playbooks?name=eq.sav_ecommerce&is_active=eq.true&select=id&limit=1`,
        { headers: { apikey: supabaseServiceKey, Authorization: `Bearer ${supabaseServiceKey}` } }
      );
      const pbRows = pbRes.ok ? await pbRes.json() : [];
      const playbookId = pbRows?.[0]?.id || null;

      if (playbookId) {
        // Only insert if the client hasn't already got this playbook linked.
        const existingRes = await fetch(
          `${supabaseUrl}/rest/v1/engine_client_playbooks?client_id=eq.${onboardedClientId}&playbook_id=eq.${playbookId}&select=id&limit=1`,
          { headers: { apikey: supabaseServiceKey, Authorization: `Bearer ${supabaseServiceKey}` } }
        );
        const existing = existingRes.ok ? await existingRes.json() : [];

        if (!existing?.[0]) {
          await fetch(`${supabaseUrl}/rest/v1/engine_client_playbooks`, {
            method: 'POST',
            headers: {
              apikey: supabaseServiceKey,
              Authorization: `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              client_id: onboardedClientId,
              playbook_id: playbookId,
              is_active: true,
              // 0.75 : l'agent ne répond seul que s'il est nettement sûr de son
              // classement. La valeur précédente, 0.4, le laissait répondre
              // alors qu'il avait plus de chances de se tromper que d'avoir
              // raison — et elle s'était propagée à tous les playbooks en base,
              // écrasant le 0.85 prévu par playbook-loader.js (ACT-8).
              custom_config: { confidence_threshold: 0.75 },
              activated_at: new Date().toISOString(),
            }),
          });
        }
      }
    } catch (err) {
      // Non-blocking — the merchant can still activate it manually if this fails.
      console.error('Failed to auto-activate SAV playbook:', err.message);
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
  if (onboardingSpawnFailed) params.set('onboarding_failed', '1');
  // Present only for App-Store-first installs: lets the merchant attach this
  // freshly created client to the account they are about to create.
  if (claimToken) params.set('claim', claimToken);
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
