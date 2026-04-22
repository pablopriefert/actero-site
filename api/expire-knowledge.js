import { withSentry } from './lib/sentry.js'
import { createClient } from '@supabase/supabase-js';
import { isActeroAdmin } from './lib/admin-auth.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Internal/cron-only endpoint
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (internalSecret && req.headers['x-internal-secret'] !== internalSecret) {
    // Also allow Vercel Cron (has x-vercel-cron-signature header) or admin JWT
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(403).json({ error: 'Accès refusé.' });
      const isAdmin = await isActeroAdmin(user, supabase);
      if (!isAdmin) return res.status(403).json({ error: 'Accès refusé.' });
    } else if (!req.headers['x-vercel-cron-signature']) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
  }

  try {
    const now = new Date().toISOString();

    // Find entries that have expired but are still active
    const { data: expiredEntries, error: fetchError } = await supabase
      .from('client_knowledge_base')
      .select('id, client_id')
      .eq('is_active', true)
      .not('expires_at', 'is', null)
      .lt('expires_at', now);

    if (fetchError) throw fetchError;

    if (!expiredEntries || expiredEntries.length === 0) {
      return res.status(200).json({ message: 'No expired entries', count: 0 });
    }

    // Deactivate expired entries
    const ids = expiredEntries.map(e => e.id);
    const { error: updateError } = await supabase
      .from('client_knowledge_base')
      .update({ is_active: false })
      .in('id', ids);

    if (updateError) throw updateError;

    // Get unique client IDs to sync
    const clientIds = [...new Set(expiredEntries.map(e => e.client_id))];

    // Sync brand context for each affected client
    const syncPromises = clientIds.map(clientId =>
      fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/sync-brand-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      }).catch(err => console.error(`Sync failed for ${clientId}:`, err))
    );

    await Promise.allSettled(syncPromises);

    return res.status(200).json({
      message: `Expired ${ids.length} entries for ${clientIds.length} clients`,
      count: ids.length,
      clients: clientIds.length,
    });
  } catch (error) {
    console.error('expire-knowledge error:', error);
    return res.status(500).json({ error: error.message });
  }
}

export default withSentry(handler)
