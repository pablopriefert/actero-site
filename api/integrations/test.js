import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
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

  const { provider, credentials } = req.body;
  if (!provider || !credentials) {
    return res.status(400).json({ error: 'Provider et credentials requis' });
  }

  // Import test logic from connect endpoint
  const { testProvider } = await import('./connect.js').catch(() => ({}));

  // Inline test if import fails
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
    klaviyo: {
      method: 'GET',
      url: () => 'https://a.klaviyo.com/api/accounts/',
      headers: (c) => ({
        'Authorization': `Klaviyo-API-Key ${c.api_key}`,
        'revision': '2024-02-15',
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
      method: 'POST',
      url: (c) => c.webhook_url,
      body: { text: '🔄 Test de connexion Actero — tout est OK !' },
    },
    calendly: {
      method: 'GET',
      url: () => 'https://api.calendly.com/users/me',
      headers: (c) => ({ 'Authorization': `Bearer ${c.api_key}` }),
    },
  };

  try {
    const config = PROVIDER_TEST_ENDPOINTS[provider];
    if (!config) {
      return res.status(200).json({ ok: true, message: 'Pas de test disponible pour ce provider' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

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
      return res.status(200).json({ ok: true, message: 'Connexion réussie' });
    }
    return res.status(200).json({ ok: false, message: `Erreur ${resp.status} — vérifiez vos identifiants` });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(200).json({ ok: false, message: 'Timeout — le serveur ne répond pas' });
    }
    return res.status(200).json({ ok: false, message: err.message });
  }
}
