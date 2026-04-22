// Marketplace — list templates (public, paginated, filterable)
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

  try {
    const {
      category,
      industry,
      price, // "free" | "paid" | "all"
      search,
      page = '1',
      limit = '20',
      sort = 'popular', // popular | recent | rating | price_asc | price_desc
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from('marketplace_templates')
      .select(
        'id, creator_client_id, name, slug, description, category, industry, preview_image, price, rating, rating_count, install_count, created_at',
        { count: 'exact' }
      )
      .eq('is_published', true);

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    if (industry && industry !== 'all') {
      query = query.eq('industry', industry);
    }
    if (price === 'free') {
      query = query.eq('price', 0);
    } else if (price === 'paid') {
      query = query.gt('price', 0);
    }
    if (search && search.trim()) {
      const term = search.trim().replace(/[%_]/g, '\\$&');
      query = query.or(
        `name.ilike.%${term}%,description.ilike.%${term}%`
      );
    }

    switch (sort) {
      case 'recent':
        query = query.order('created_at', { ascending: false });
        break;
      case 'rating':
        query = query.order('rating', { ascending: false }).order('rating_count', { ascending: false });
        break;
      case 'price_asc':
        query = query.order('price', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('price', { ascending: false });
        break;
      case 'popular':
      default:
        query = query.order('install_count', { ascending: false }).order('rating', { ascending: false });
        break;
    }

    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return res.status(200).json({
      templates: data || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count ?? 0,
        total_pages: count ? Math.ceil(count / limitNum) : 0,
      },
    });
  } catch (err) {
    console.error('[marketplace/list] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler)
