// Marketplace — submit or update a rating + review
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function recomputeRating(template_id) {
  const { data, error } = await supabase
    .from('marketplace_ratings')
    .select('rating')
    .eq('template_id', template_id);
  if (error) throw new Error(error.message);

  const count = data?.length || 0;
  const avg = count > 0 ? data.reduce((s, r) => s + Number(r.rating || 0), 0) / count : 0;

  await supabase
    .from('marketplace_templates')
    .update({
      rating: Number(avg.toFixed(2)),
      rating_count: count,
      updated_at: new Date().toISOString(),
    })
    .eq('id', template_id);
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' });

  try {
    const { template_id, client_id, rating, review } = req.body || {};
    if (!template_id) return res.status(400).json({ error: 'template_id requis' });
    if (!client_id) return res.status(400).json({ error: 'client_id requis' });
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'rating doit etre entre 1 et 5' });
    }

    // Verify ownership of buyer client
    const { data: client } = await supabase
      .from('clients')
      .select('id, owner_user_id')
      .eq('id', client_id)
      .maybeSingle();
    if (!client) return res.status(404).json({ error: 'Client introuvable' });
    if (client.owner_user_id !== user.id) {
      const { data: linked } = await supabase
        .from('client_users')
        .select('role')
        .eq('client_id', client_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!linked) return res.status(403).json({ error: 'Acces refuse' });
    }

    // Ensure client has installed the template (optional safety)
    const { data: install } = await supabase
      .from('marketplace_installs')
      .select('id')
      .eq('template_id', template_id)
      .eq('client_id', client_id)
      .maybeSingle();
    if (!install) {
      return res.status(403).json({ error: 'Vous devez installer ce template avant de le noter' });
    }

    // Upsert rating
    const { data: existing } = await supabase
      .from('marketplace_ratings')
      .select('id')
      .eq('template_id', template_id)
      .eq('client_id', client_id)
      .maybeSingle();

    if (existing) {
      const { error: updErr } = await supabase
        .from('marketplace_ratings')
        .update({ rating: ratingNum, review: review || null })
        .eq('id', existing.id);
      if (updErr) throw new Error(updErr.message);
    } else {
      const { error: insErr } = await supabase
        .from('marketplace_ratings')
        .insert([{ template_id, client_id, rating: ratingNum, review: review || null }]);
      if (insErr) throw new Error(insErr.message);
    }

    await recomputeRating(template_id);

    // Return fresh aggregates
    const { data: tpl } = await supabase
      .from('marketplace_templates')
      .select('rating, rating_count')
      .eq('id', template_id)
      .maybeSingle();

    return res.status(200).json({
      ok: true,
      rating: tpl?.rating ?? 0,
      rating_count: tpl?.rating_count ?? 0,
    });
  } catch (err) {
    console.error('[marketplace/rate] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler)
