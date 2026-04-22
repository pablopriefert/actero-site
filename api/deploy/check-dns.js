import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';

async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const db = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (!RESEND_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }

  // Admin/internal-only endpoint
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const { data: { user }, error: authErr } = await db.auth.getUser(token);
    if (authErr || !user) return res.status(403).json({ error: 'Accès refusé.' });
    const isAdmin = user.app_metadata?.role === 'admin' || user.email?.endsWith('@actero.fr');
    if (!isAdmin) return res.status(403).json({ error: 'Accès refusé.' });
  } else {
    const internalSecret = process.env.INTERNAL_API_SECRET;
    const isInternal = internalSecret && req.headers['x-internal-secret'] === internalSecret;
    if (!isInternal && !req.headers['x-vercel-cron-signature']) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
  }

  try {
    // Fetch all unverified domains
    const { data: pending, error } = await db
      .from('call_notes')
      .select('client_id, company_name, contact_email, support_email, resend_domain_id')
      .not('resend_domain_id', 'is', null)
      .eq('resend_domain_verified', false);

    if (error) throw error;

    const results = [];

    for (const record of (pending || [])) {
      try {
        const domainRes = await fetch(`https://api.resend.com/domains/${record.resend_domain_id}`, {
          headers: { 'Authorization': `Bearer ${RESEND_KEY}` },
        });

        if (!domainRes.ok) continue;
        const domainData = await domainRes.json();

        if (domainData.status === 'verified') {
          await db.from('call_notes').update({
            resend_domain_verified: true,
            resend_verified_at: new Date().toISOString(),
          }).eq('client_id', record.client_id);

          results.push({ client: record.company_name, status: 'verified' });
        } else if (domainData.status === 'failed') {
          results.push({ client: record.company_name, status: 'failed' });
        } else {
          results.push({ client: record.company_name, status: 'pending' });
        }
      } catch (err) {
        results.push({ client: record.company_name, status: 'error', error: err.message });
      }
    }

    return res.status(200).json({ checked: results.length, results });
  } catch (error) {
    console.error('check-dns error:', error);
    return res.status(500).json({ error: error.message });
  }
}

export default withSentry(handler)
