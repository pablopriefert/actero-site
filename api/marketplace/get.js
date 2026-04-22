// Marketplace — get single template by slug (public)
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

  const { slug } = req.query;
  if (!slug) {
    return res.status(400).json({ error: 'slug requis' });
  }

  try {
    const { data: template, error } = await supabase
      .from('marketplace_templates')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!template) return res.status(404).json({ error: 'Template introuvable' });

    // Fetch creator display name (brand_name)
    let creator = null;
    if (template.creator_client_id) {
      const { data: creatorRow } = await supabase
        .from('clients')
        .select('id, brand_name')
        .eq('id', template.creator_client_id)
        .maybeSingle();
      creator = creatorRow;
    }

    // Fetch recent ratings
    const { data: ratings } = await supabase
      .from('marketplace_ratings')
      .select('id, rating, review, created_at, client_id')
      .eq('template_id', template.id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Resolve reviewer brand names
    let reviews = [];
    if (ratings && ratings.length > 0) {
      const clientIds = [...new Set(ratings.map((r) => r.client_id).filter(Boolean))];
      let clientsMap = {};
      if (clientIds.length > 0) {
        const { data: clientRows } = await supabase
          .from('clients')
          .select('id, brand_name')
          .in('id', clientIds);
        clientsMap = Object.fromEntries((clientRows || []).map((c) => [c.id, c.brand_name]));
      }
      reviews = ratings.map((r) => ({
        id: r.id,
        rating: r.rating,
        review: r.review,
        created_at: r.created_at,
        reviewer: clientsMap[r.client_id] || 'Anonyme',
      }));
    }

    return res.status(200).json({
      template: {
        ...template,
        creator,
      },
      reviews,
    });
  } catch (err) {
    console.error('[marketplace/get] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler)
