import { withSentry } from '../../../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';
import { encryptToken } from '../../../lib/crypto.js';
import { provisionZendeskWebhook } from '../../lib/webhook-provisioner.js';

/**
 * Zendesk OAuth — callback.
 *
 * Lit le state `nonce|subdomain|userToken` posé par install.js, exchange le
 * code contre un access_token auprès du SUBDOMAIN DU CLIENT
 * (`<subdomain>.zendesk.com/oauth/tokens`, pas un endpoint global), et stocke
 * le subdomain dans extra_config pour que le connector sortant (respond.js →
 * connectors/zendesk.js) puisse construire l'URL API du client.
 *
 * Anciens bugs corrigés :
 *   — URL hardcodée `actero.zendesk.com/oauth/tokens` → failait pour tout
 *     client avec son propre subdomain. Maintenant dynamique.
 *   — `extra_config.subdomain` pas stocké → connector return
 *     « Zendesk subdomain not configured ». Maintenant persisté.
 */
async function handler(req, res) {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(302, '/client/integrations?error=zendesk_denied');
  }

  if (!code || !state) {
    return res.redirect(302, '/client/integrations?error=zendesk_missing_params');
  }

  // state format : nonce|subdomain|userToken (cf. install.js)
  const parts = String(state).split('|');
  if (parts.length < 3) {
    return res.redirect(302, '/client/integrations?error=zendesk_invalid_state');
  }
  const [, subdomain, ...tokenParts] = parts;
  const userToken = tokenParts.join('|'); // au cas où le token contient |
  if (!subdomain || !userToken) {
    return res.redirect(302, '/client/integrations?error=zendesk_invalid_state');
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(userToken);
  if (authError || !user) {
    return res.redirect(302, '/client/integrations?error=zendesk_auth_failed');
  }

  try {
    const redirectUri = process.env.ZENDESK_REDIRECT_URI || 'https://actero.fr/api/integrations/oauth/zendesk/callback';

    // Token exchange sur LE SUBDOMAIN DU CLIENT — Zendesk exige l'appel
    // sur le même subdomain que l'authorization request.
    const tokenRes = await fetch(`https://${subdomain}.zendesk.com/oauth/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.ZENDESK_CLIENT_ID,
        client_secret: process.env.ZENDESK_CLIENT_SECRET,
        redirect_uri: redirectUri,
        scope: 'read write',
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) {
      console.error('[zendesk/callback] token exchange failed:', tokenData);
      return res.redirect(302, '/client/integrations?error=zendesk_token_failed');
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
      return res.redirect(302, '/client/integrations?error=zendesk_no_client');
    }

    const { error: dbError } = await supabase
      .from('client_integrations')
      .upsert({
        client_id: clientId,
        provider: 'zendesk',
        provider_label: 'Zendesk',
        auth_type: 'oauth',
        access_token: encryptToken(tokenData.access_token),
        refresh_token: tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
        extra_config: {
          subdomain,                                   // ⬅ utilisé par connectors/zendesk.js
          token_type: tokenData.token_type,
          scope: tokenData.scope,
        },
        scopes: tokenData.scope?.split(' ') || [],
        status: 'active',
        connected_at: new Date().toISOString(),
        last_checked_at: new Date().toISOString(),
      }, { onConflict: 'client_id,provider' });

    if (dbError) {
      console.error('[zendesk/callback] db error:', dbError);
      return res.redirect(302, '/client/integrations?error=zendesk_db_error');
    }

    // Provisionne automatiquement le webhook Zendesk (subscription
    // ticket.comment_added) — aucune configuration manuelle côté client.
    // Non-bloquant si l'appel rate : l'intégration reste active, l'user
    // peut re-trigger depuis /integrations. Mais on log en console pour
    // diagnostiquer.
    const provision = await provisionZendeskWebhook(supabase, clientId);
    if (!provision.success) {
      console.warn('[zendesk/callback] webhook auto-provisioning failed:', provision.error);
      return res.redirect(302, '/client/integrations?success=zendesk&webhook_pending=1');
    }

    return res.redirect(302, '/client/integrations?success=zendesk');
  } catch (err) {
    console.error('[zendesk/callback] exception:', err);
    return res.redirect(302, '/client/integrations?error=zendesk_exception');
  }
}

export default withSentry(handler)
