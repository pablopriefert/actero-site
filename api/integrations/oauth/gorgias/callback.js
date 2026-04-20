import { createClient } from '@supabase/supabase-js';
import { encryptToken } from '../../../lib/crypto.js';
import { provisionGorgiasIntegration } from '../../lib/webhook-provisioner.js';

/**
 * Gorgias OAuth — callback.
 *
 * Lit le state `nonce|subdomain|userToken` posé par install.js, exchange le
 * code sur le subdomain du client, et stocke le subdomain dans
 * extra_config.subdomain (pas .domain — le connector lit .subdomain).
 *
 * Anciens bugs corrigés :
 *   — `extra_config.domain` stocké mais `connectors/gorgias.js` lit
 *     `extra_config.subdomain` → clé mismatch, subdomain toujours undefined,
 *     le connector return « Gorgias subdomain not configured ».
 *   — Token exchange sur `login.gorgias.com/oauth/token` : fonctionne mais
 *     certaines instances retournent un 404 — on bascule sur
 *     `<subdomain>.gorgias.com/oauth/token` qui est l'endpoint canonique.
 */
export default async function handler(req, res) {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(302, '/client/integrations?error=gorgias_denied');
  }

  if (!code || !state) {
    return res.redirect(302, '/client/integrations?error=gorgias_missing_params');
  }

  // state format : nonce|subdomain|userToken (cf. install.js)
  const parts = String(state).split('|');
  if (parts.length < 3) {
    return res.redirect(302, '/client/integrations?error=gorgias_invalid_state');
  }
  const [, subdomain, ...tokenParts] = parts;
  const userToken = tokenParts.join('|');
  if (!subdomain || !userToken) {
    return res.redirect(302, '/client/integrations?error=gorgias_invalid_state');
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(userToken);
  if (authError || !user) {
    return res.redirect(302, '/client/integrations?error=gorgias_auth_failed');
  }

  try {
    const redirectUri = process.env.GORGIAS_REDIRECT_URI || 'https://actero.fr/api/integrations/oauth/gorgias/callback';

    // Token exchange sur le subdomain du client (endpoint canonique Gorgias).
    const tokenRes = await fetch(`https://${subdomain}.gorgias.com/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.GORGIAS_CLIENT_ID,
        client_secret: process.env.GORGIAS_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) {
      console.error('[gorgias/callback] token exchange failed:', tokenData);
      return res.redirect(302, '/client/integrations?error=gorgias_token_failed');
    }

    // Find client_id
    const { data: clientUser } = await supabase
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: ownedClient } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_user_id', user.id)
      .maybeSingle();

    const clientId = clientUser?.client_id || ownedClient?.id;
    if (!clientId) {
      return res.redirect(302, '/client/integrations?error=gorgias_no_client');
    }

    const { error: dbError } = await supabase
      .from('client_integrations')
      .upsert({
        client_id: clientId,
        provider: 'gorgias',
        provider_label: 'Gorgias',
        auth_type: 'oauth',
        access_token: encryptToken(tokenData.access_token),
        refresh_token: tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
        extra_config: {
          subdomain,                              // ⬅ utilisé par connectors/gorgias.js
          account_domain: tokenData.account_domain || null,
        },
        scopes: tokenData.scope?.split(' ') || [],
        status: 'active',
        connected_at: new Date().toISOString(),
        last_checked_at: new Date().toISOString(),
        expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
      }, { onConflict: 'client_id,provider' });

    if (dbError) {
      console.error('[gorgias/callback] db error:', dbError);
      return res.redirect(302, '/client/integrations?error=gorgias_db_error');
    }

    // Provisionne automatiquement l'HTTP integration Gorgias (trigger
    // message_created) — aucune configuration manuelle côté client.
    const provision = await provisionGorgiasIntegration(supabase, clientId);
    if (!provision.success) {
      console.warn('[gorgias/callback] integration auto-provisioning failed:', provision.error);
      return res.redirect(302, '/client/integrations?success=gorgias&webhook_pending=1');
    }

    return res.redirect(302, '/client/integrations?success=gorgias');
  } catch (err) {
    console.error('[gorgias/callback] exception:', err);
    return res.redirect(302, '/client/integrations?error=gorgias_exception');
  }
}
