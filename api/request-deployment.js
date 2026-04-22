/**
 * POST /api/request-deployment
 * Creates a deployment request for the admin to review.
 * Body: { client_id: string, shop_domain: string }
 */
import { withSentry } from './lib/sentry.js'
import { createClient } from '@supabase/supabase-js';
const _supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: requires authenticated user
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise' });
  const { error: authErr } = await _supabase.auth.getUser(token);
  if (authErr) return res.status(401).json({ error: 'Non autorise' });

  const { client_id, shop_domain } = req.body;

  if (!client_id) {
    return res.status(400).json({ error: 'Missing client_id' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase configuration missing' });
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/deployment_requests`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        client_id,
        shop_domain: shop_domain || null,
        status: 'pending',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'Failed to create request', details: errText });
    }

    const data = await response.json();
    return res.status(200).json({ success: true, request_id: data[0]?.id });
  } catch (err) {
    console.error('Request deployment error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler)
