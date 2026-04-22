import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';
import { encryptToken } from '../lib/crypto.js';

const PROVIDER_TEST_ENDPOINTS = {
  gorgias: {
    method: 'GET',
    url: (c) => `https://${c.domain}/api/account`,
    headers: (c) => ({
      'Authorization': `Basic ${Buffer.from(`${c.email || ''}:${c.api_key}`).toString('base64')}`,
    }),
  },
  zendesk: {
    method: 'GET',
    url: (c) => `https://${c.subdomain}.zendesk.com/api/v2/users/me.json`,
    headers: (c) => ({
      'Authorization': `Basic ${Buffer.from(`${c.email}/token:${c.api_key}`).toString('base64')}`,
    }),
  },
  resend: {
    method: 'GET',
    url: () => 'https://api.resend.com/api-keys',
    headers: (c) => ({
      'Authorization': `Bearer ${c.api_key}`,
    }),
  },
  slack: {
    method: 'POST',
    url: (c) => c.webhook_url,
    body: { text: '✅ Actero est connecté à votre Slack !' },
  },
  apimo: {
    method: 'GET',
    url: () => 'https://api.apimo.pro/agencies',
    headers: (c) => ({
      'Authorization': `Bearer ${c.api_key}`,
    }),
  },
  axonaut: {
    method: 'GET',
    url: () => 'https://axonaut.com/api/v2/companies?limit=1',
    headers: (c) => ({
      'userApiKey': c.api_key,
    }),
  },
  pennylane: {
    method: 'GET',
    url: () => 'https://app.pennylane.com/api/external/v1/me',
    headers: (c) => ({
      'Authorization': `Bearer ${c.api_key}`,
    }),
  },
  ipaidthat: {
    method: 'GET',
    url: () => 'https://app.ipaidthat.io/api/v2/me',
    headers: (c) => ({
      'Authorization': `Bearer ${c.api_key}`,
    }),
  },
};

async function testProvider(provider, credentials) {
  const config = PROVIDER_TEST_ENDPOINTS[provider];
  if (!config) return { ok: true, message: 'Pas de test disponible pour ce provider' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const fetchOptions = {
      method: config.method,
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers ? config.headers(credentials) : {}),
      },
      signal: controller.signal,
    };
    if (config.body) fetchOptions.body = JSON.stringify(config.body);

    const resp = await fetch(config.url(credentials), fetchOptions);
    clearTimeout(timeout);

    if (resp.ok || resp.status === 200 || resp.status === 201) {
      return { ok: true, message: 'Connexion réussie' };
    }
    return { ok: false, message: `Erreur ${resp.status} — vérifiez vos identifiants` };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return { ok: false, message: 'Timeout — le serveur ne répond pas' };
    }
    return { ok: false, message: err.message };
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non authentifié' });

  const { provider, provider_label, credentials } = req.body;
  if (!provider || !credentials) {
    return res.status(400).json({ error: 'Provider et credentials requis' });
  }

  try {
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
    if (!clientId) return res.status(404).json({ error: 'Client introuvable' });

    // Test the connection first
    const testResult = await testProvider(provider, credentials);
    if (!testResult.ok) {
      return res.status(400).json({ error: testResult.message, test_failed: true });
    }

    // Store credentials — separate api_key from extra config, encrypt api_key at rest
    const apiKey = credentials.api_key || null;
    const extraConfig = { ...credentials };
    delete extraConfig.api_key;

    const { data, error } = await supabase
      .from('client_integrations')
      .upsert({
        client_id: clientId,
        provider,
        provider_label: provider_label || provider,
        auth_type: 'api_key',
        api_key: apiKey ? encryptToken(apiKey) : null,
        extra_config: Object.keys(extraConfig).length > 0 ? extraConfig : {},
        status: 'active',
        status_message: null,
        connected_at: new Date().toISOString(),
        last_checked_at: new Date().toISOString(),
      }, { onConflict: 'client_id,provider' })
      .select('id, provider, status, connected_at')
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, integration: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler)
