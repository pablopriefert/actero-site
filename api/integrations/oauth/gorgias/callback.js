import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(302, '/client/integrations?error=gorgias_denied');
  }

  if (!code || !state) {
    return res.redirect(302, '/client/integrations?error=gorgias_missing_params');
  }

  const [nonce, userToken] = state.split(':');
  if (!userToken) {
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

    const tokenRes = await fetch('https://acme.gorgias.com/oauth/token', {
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
    if (tokenData.error) {
      return res.redirect(302, `/client/integrations?error=gorgias_token_failed`);
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
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        extra_config: {
          domain: tokenData.account_domain || null,
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
      return res.redirect(302, '/client/integrations?error=gorgias_db_error');
    }

    return res.redirect(302, '/client/integrations?success=gorgias');
  } catch (err) {
    return res.redirect(302, '/client/integrations?error=gorgias_exception');
  }
}
