import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(302, '/client/integrations?error=zendesk_denied');
  }

  if (!code || !state) {
    return res.redirect(302, '/client/integrations?error=zendesk_missing_params');
  }

  const parts = state.split(':');
  const userToken = parts.slice(1).join(':');
  if (!userToken) {
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

    // Zendesk needs the subdomain for token exchange — extract from referrer or use a generic endpoint
    // We'll try the global endpoint first
    const tokenRes = await fetch('https://actero.zendesk.com/oauth/tokens', {
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
    if (tokenData.error) {
      return res.redirect(302, `/client/integrations?error=zendesk_token_failed`);
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
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        extra_config: {
          token_type: tokenData.token_type,
          scope: tokenData.scope,
        },
        scopes: tokenData.scope?.split(' ') || [],
        status: 'active',
        connected_at: new Date().toISOString(),
        last_checked_at: new Date().toISOString(),
      }, { onConflict: 'client_id,provider' });

    if (dbError) {
      return res.redirect(302, '/client/integrations?error=zendesk_db_error');
    }

    return res.redirect(302, '/client/integrations?success=zendesk');
  } catch (err) {
    return res.redirect(302, '/client/integrations?error=zendesk_exception');
  }
}
