import { withSentry } from '../../../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';
import { encryptToken } from '../../../lib/crypto.js';

async function handler(req, res) {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(302, '/client/integrations?integration=gmail&status=error&message=denied');
  }

  if (!code || !state) {
    return res.redirect(302, '/client/integrations?integration=gmail&status=error&message=missing_params');
  }

  const parts = state.split(':');
  const userToken = parts.slice(1).join(':');
  if (!userToken) {
    return res.redirect(302, '/client/integrations?integration=gmail&status=error&message=invalid_state');
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(userToken);
  if (authError || !user) {
    return res.redirect(302, '/client/integrations?integration=gmail&status=error&message=auth_failed');
  }

  try {
    const redirectUri = process.env.GMAIL_REDIRECT_URI || 'https://actero.fr/api/integrations/oauth/gmail/callback';

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      return res.redirect(302, '/client/integrations?integration=gmail&status=error&message=token_failed');
    }

    // Get user email
    let userEmail = null;
    try {
      const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
      });
      const info = await infoRes.json();
      userEmail = info.email;
    } catch {}

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
      return res.redirect(302, '/client/integrations?integration=gmail&status=error&message=no_client');
    }

    const { error: dbError } = await supabase
      .from('client_integrations')
      .upsert({
        client_id: clientId,
        provider: 'gmail',
        provider_label: 'Gmail',
        auth_type: 'oauth',
        access_token: encryptToken(tokenData.access_token),
        refresh_token: encryptToken(tokenData.refresh_token),
        extra_config: {
          email: userEmail,
          token_type: tokenData.token_type,
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
      return res.redirect(302, '/client/integrations?integration=gmail&status=error&message=db_error');
    }

    return res.redirect(302, '/client/integrations?integration=gmail&status=success');
  } catch (err) {
    return res.redirect(302, '/client/integrations?integration=gmail&status=error&message=exception');
  }
}

export default withSentry(handler)
