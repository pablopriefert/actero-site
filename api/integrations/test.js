import { createClient } from '@supabase/supabase-js';

const PROVIDER_TEST_ENDPOINTS = {
  gorgias: {
    method: 'GET',
    url: (c) => `https://${c.domain}/api/account`,
    headers: (c) => ({
      'Authorization': `Basic ${Buffer.from(`${c.email || ''}:${c.api_key}`).toString('base64')}`,
    }),
  },
  freshdesk: {
    method: 'GET',
    url: (c) => `https://${c.domain}/api/v2/agents/me`,
    headers: (c) => ({
      'Authorization': `Basic ${Buffer.from(`${c.api_key}:X`).toString('base64')}`,
    }),
  },
  slack: {
    // For OAuth Slack, test the bot token
    method: 'POST',
    url: () => 'https://slack.com/api/auth.test',
    headers: (c) => ({
      'Authorization': `Bearer ${c.access_token}`,
    }),
  },
  calendly: {
    method: 'GET',
    url: () => 'https://api.calendly.com/users/me',
    headers: (c) => ({ 'Authorization': `Bearer ${c.api_key}` }),
  },
  gmail: {
    method: 'GET',
    url: () => 'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    headers: (c) => ({ 'Authorization': `Bearer ${c.access_token}` }),
  },
  zendesk: {
    method: 'GET',
    url: (c) => c.subdomain
      ? `https://${c.subdomain}.zendesk.com/api/v2/users/me.json`
      : 'https://actero.zendesk.com/api/v2/users/me.json',
    headers: (c) => ({ 'Authorization': `Bearer ${c.access_token}` }),
  },
  aftership: {
    method: 'GET',
    url: () => 'https://api.aftership.com/tracking/2024-10/couriers',
    headers: (c) => ({ 'as-api-key': c.api_key, 'Accept': 'application/json' }),
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifie' });

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non authentifie' });

  const { integration_id, provider, credentials } = req.body;

  // Mode 1: Test an existing integration by ID (fetch credentials from DB)
  if (integration_id) {
    try {
      const { data: integration, error: fetchErr } = await supabase
        .from('client_integrations')
        .select('*')
        .eq('id', integration_id)
        .single();

      if (fetchErr || !integration) {
        return res.status(404).json({ ok: false, message: 'Integration introuvable' });
      }

      // Build credentials object from stored data
      const creds = {
        api_key: integration.api_key,
        access_token: integration.access_token,
        ...(integration.extra_config || {}),
      };

      const result = await testProvider(integration.provider, creds);

      // Update status in DB
      await supabase
        .from('client_integrations')
        .update({
          status: result.ok ? 'active' : 'error',
          status_message: result.message,
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', integration_id);

      return res.status(200).json(result);
    } catch (err) {
      return res.status(200).json({ ok: false, message: err.message });
    }
  }

  // Mode 2: Test with provided credentials (before saving)
  if (!provider || !credentials) {
    return res.status(400).json({ error: 'integration_id ou provider+credentials requis' });
  }

  const result = await testProvider(provider, credentials);
  return res.status(200).json(result);
}

async function testProvider(provider, credentials) {
  const config = PROVIDER_TEST_ENDPOINTS[provider];
  if (!config) {
    return { ok: true, message: 'Pas de test disponible pour ce provider' };
  }

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

    if (resp.ok) {
      return { ok: true, message: 'Connexion active' };
    }
    return { ok: false, message: `Erreur ${resp.status} — connexion echouee` };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return { ok: false, message: 'Timeout — le serveur ne repond pas' };
    }
    return { ok: false, message: err.message };
  }
}
