// Marketplace — list the current user's own templates.
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' });

  try {
    // Collect every client_id this user can see (owner + linked)
    const { data: ownedRows } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_user_id', user.id);
    const { data: linkedRows } = await supabase
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id);

    const clientIds = new Set([
      ...(ownedRows || []).map((r) => r.id),
      ...(linkedRows || []).map((r) => r.client_id),
    ]);
    if (clientIds.size === 0) {
      return res.status(200).json({ templates: [] });
    }

    const { data: templates, error } = await supabase
      .from('marketplace_templates')
      .select('id, name, slug, description, category, industry, price, is_published, install_count, rating, rating_count, preview_image, created_at, creator_client_id')
      .in('creator_client_id', Array.from(clientIds))
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return res.status(200).json({ templates: templates || [] });
  } catch (err) {
    console.error('[marketplace/mine] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler)
