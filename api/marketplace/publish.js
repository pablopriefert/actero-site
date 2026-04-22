// Marketplace — publish a template from current client config
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_CATEGORIES = ['sav', 'ecom', 'immo', 'compta', 'voice', 'other'];

function slugify(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

async function buildUniqueSlug(base) {
  let slug = base || `template-${Date.now()}`;
  let suffix = 0;
  // Try up to 10 times
  for (let i = 0; i < 10; i++) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const { data } = await supabase
      .from('marketplace_templates')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (!data) return candidate;
    suffix += 1;
  }
  return `${slug}-${Date.now()}`;
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' });

  try {
    const {
      client_id,
      name,
      description,
      long_description,
      category,
      industry,
      price = 0,
      preview_image = null,
      is_published = true,
    } = req.body || {};

    if (!client_id) return res.status(400).json({ error: 'client_id requis' });
    if (!name) return res.status(400).json({ error: 'name requis' });
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category invalide (${VALID_CATEGORIES.join(', ')})` });
    }

    // Verify ownership of client
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, owner_user_id, brand_name')
      .eq('id', client_id)
      .maybeSingle();
    if (clientErr) throw new Error(clientErr.message);
    if (!client) return res.status(404).json({ error: 'Client introuvable' });
    if (client.owner_user_id !== user.id) {
      // Fallback: verify via client_users
      const { data: linked } = await supabase
        .from('client_users')
        .select('role')
        .eq('client_id', client_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!linked) return res.status(403).json({ error: 'Acces refuse' });
    }

    // Snapshot current config into content JSONB
    const [settingsRes, guardrailsRes, kbRes] = await Promise.all([
      supabase.from('client_settings').select('*').eq('client_id', client_id).maybeSingle(),
      supabase.from('client_guardrails').select('rule_text, is_enabled, priority').eq('client_id', client_id),
      supabase
        .from('client_knowledge_base')
        .select('category, title, content, sort_order, is_active')
        .eq('client_id', client_id),
    ]);

    const settings = settingsRes.data || {};
    const guardrails = guardrailsRes.data || [];
    const kbEntries = kbRes.data || [];

    const promptConfig = {
      brand_tone: settings.brand_tone || null,
      brand_language: settings.brand_language || null,
      brand_identity: settings.brand_identity || null,
      tone_style: settings.tone_style || null,
      return_policy: settings.return_policy || null,
      excluded_products: settings.excluded_products || null,
      custom_instructions: settings.custom_instructions || null,
      greeting_template: settings.greeting_template || null,
      product_recommendations_enabled: settings.product_recommendations_enabled ?? null,
    };

    const exampleResponses = Array.isArray(settings.example_responses)
      ? settings.example_responses
      : settings.example_responses || [];

    const content = {
      version: 1,
      prompt_config: promptConfig,
      guardrails: guardrails.map((g) => ({
        rule_text: g.rule_text,
        is_enabled: g.is_enabled !== false,
        priority: g.priority ?? 0,
      })),
      kb_entries: kbEntries.map((k) => ({
        category: k.category,
        title: k.title,
        content: k.content,
        sort_order: k.sort_order ?? 0,
        is_active: k.is_active !== false,
      })),
      example_responses: exampleResponses,
      playbook_config: {
        category,
        industry: industry || null,
      },
    };

    const priceNum = Math.max(0, Number(price) || 0);
    const slug = await buildUniqueSlug(slugify(name));

    const { data: template, error: insertErr } = await supabase
      .from('marketplace_templates')
      .insert([
        {
          creator_client_id: client_id,
          name,
          slug,
          description: description || null,
          long_description: long_description || null,
          category,
          industry: industry || null,
          preview_image,
          price: priceNum,
          is_published: !!is_published,
          content,
        },
      ])
      .select()
      .single();

    if (insertErr) throw new Error(insertErr.message);

    return res.status(200).json({ template });
  } catch (err) {
    console.error('[marketplace/publish] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler)
