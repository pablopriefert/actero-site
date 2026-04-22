// Marketplace — update metadata for a template you own.
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_CATEGORIES = ['sav', 'ecom', 'immo', 'compta', 'voice', 'other'];

async function userCanEditClient(userId, clientId) {
  const { data: client } = await supabase
    .from('clients')
    .select('id, owner_user_id')
    .eq('id', clientId)
    .maybeSingle();
  if (!client) return false;
  if (client.owner_user_id === userId) return true;
  const { data: linked } = await supabase
    .from('client_users')
    .select('role')
    .eq('client_id', clientId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!linked;
}

async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' });

  try {
    const {
      template_id,
      name,
      description,
      short_description,
      long_description,
      category,
      industry,
      price,
      price_eur,
      preview_image,
      is_published,
    } = req.body || {};

    if (!template_id) return res.status(400).json({ error: 'template_id requis' });

    const { data: template } = await supabase
      .from('marketplace_templates')
      .select('id, creator_client_id')
      .eq('id', template_id)
      .maybeSingle();
    if (!template) return res.status(404).json({ error: 'Template introuvable' });

    const allowed = await userCanEditClient(user.id, template.creator_client_id);
    if (!allowed) return res.status(403).json({ error: 'Acces refuse' });

    const patch = { updated_at: new Date().toISOString() };
    if (name != null) patch.name = String(name);
    if (description != null) patch.description = description;
    if (short_description != null) patch.short_description = short_description;
    if (long_description != null) patch.long_description = long_description;
    if (category != null) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: `category invalide (${VALID_CATEGORIES.join(', ')})` });
      }
      patch.category = category;
    }
    if (industry != null) patch.industry = industry;
    if (preview_image != null) patch.preview_image = preview_image;
    if (typeof is_published === 'boolean') patch.is_published = is_published;

    const priceInput = price_eur != null ? price_eur : price;
    if (priceInput != null) {
      const priceNum = Math.max(0, Number(priceInput) || 0);
      patch.price = priceNum;
    }

    const { data: updated, error } = await supabase
      .from('marketplace_templates')
      .update(patch)
      .eq('id', template_id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    return res.status(200).json({ template: updated });
  } catch (err) {
    console.error('[marketplace/update] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler)
