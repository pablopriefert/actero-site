import { createClient } from '@supabase/supabase-js';
import { encryptToken } from '../../../lib/crypto.js';

export default async function handler(req, res) {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(302, '/client/integrations?error=slack_denied');
  }

  if (!code || !state) {
    return res.redirect(302, '/client/integrations?error=slack_missing_params');
  }

  const [nonce, userToken] = state.split(':');
  if (!userToken) {
    return res.redirect(302, '/client/integrations?error=slack_invalid_state');
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Verify user
  const { data: { user }, error: authError } = await supabase.auth.getUser(userToken);
  if (authError || !user) {
    return res.redirect(302, '/client/integrations?error=slack_auth_failed');
  }

  try {
    // Exchange code for token
    const redirectUri = process.env.SLACK_REDIRECT_URI || 'https://actero.fr/api/integrations/oauth/slack/callback';
    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.ok) {
      return res.redirect(302, `/client/integrations?error=slack_token_failed&detail=${tokenData.error}`);
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
      return res.redirect(302, '/client/integrations?error=slack_no_client');
    }

    // Store in client_integrations
    const { error: dbError } = await supabase
      .from('client_integrations')
      .upsert({
        client_id: clientId,
        provider: 'slack',
        provider_label: 'Slack',
        auth_type: 'oauth',
        access_token: encryptToken(tokenData.access_token),
        extra_config: {
          team_id: tokenData.team?.id,
          team_name: tokenData.team?.name,
          channel: tokenData.incoming_webhook?.channel,
          webhook_url: tokenData.incoming_webhook?.url,
          bot_user_id: tokenData.bot_user_id,
        },
        scopes: tokenData.scope?.split(',') || [],
        status: 'active',
        connected_at: new Date().toISOString(),
        last_checked_at: new Date().toISOString(),
      }, { onConflict: 'client_id,provider' });

    if (dbError) {
      return res.redirect(302, `/client/integrations?error=slack_db_error`);
    }

    return res.redirect(302, '/client/integrations?success=slack');
  } catch (err) {
    return res.redirect(302, `/client/integrations?error=slack_exception`);
  }
}
