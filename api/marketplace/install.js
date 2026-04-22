// Marketplace — install a template for a client
// Free templates install immediately. Paid templates create a Stripe Checkout session;
// the webhook then finalizes the install on checkout.session.completed.
import { withSentry } from '../lib/sentry.js'
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const COMMISSION_RATE = 0.2;

export async function applyTemplateToClient(template, client_id) {
  const content = template.content || {};

  // 1. Upsert client_settings with prompt_config + example_responses
  const promptConfig = content.prompt_config || {};
  const settingsPatch = {
    client_id,
    updated_at: new Date().toISOString(),
  };
  if (promptConfig.brand_tone != null) settingsPatch.brand_tone = promptConfig.brand_tone;
  if (promptConfig.brand_language != null) settingsPatch.brand_language = promptConfig.brand_language;
  if (promptConfig.brand_identity != null) settingsPatch.brand_identity = promptConfig.brand_identity;
  if (promptConfig.tone_style != null) settingsPatch.tone_style = promptConfig.tone_style;
  if (promptConfig.return_policy != null) settingsPatch.return_policy = promptConfig.return_policy;
  if (promptConfig.excluded_products != null) settingsPatch.excluded_products = promptConfig.excluded_products;
  if (promptConfig.custom_instructions != null) settingsPatch.custom_instructions = promptConfig.custom_instructions;
  if (promptConfig.greeting_template != null) settingsPatch.greeting_template = promptConfig.greeting_template;
  if (promptConfig.product_recommendations_enabled != null) {
    settingsPatch.product_recommendations_enabled = promptConfig.product_recommendations_enabled;
  }
  if (content.example_responses != null) {
    settingsPatch.example_responses = content.example_responses;
  }

  const { error: settingsErr } = await supabase
    .from('client_settings')
    .upsert(settingsPatch, { onConflict: 'client_id' });
  if (settingsErr) throw new Error(`client_settings: ${settingsErr.message}`);

  // 2. Insert guardrails (append to existing)
  if (Array.isArray(content.guardrails) && content.guardrails.length > 0) {
    const rows = content.guardrails.map((g) => ({
      client_id,
      rule_text: g.rule_text,
      is_enabled: g.is_enabled !== false,
      priority: g.priority ?? 0,
    }));
    const { error: guardErr } = await supabase.from('client_guardrails').insert(rows);
    if (guardErr) throw new Error(`client_guardrails: ${guardErr.message}`);
  }

  // 3. Insert knowledge base entries (append to existing)
  if (Array.isArray(content.kb_entries) && content.kb_entries.length > 0) {
    const rows = content.kb_entries.map((k) => ({
      client_id,
      category: k.category || 'faq',
      title: k.title,
      content: k.content,
      sort_order: k.sort_order ?? 0,
      is_active: k.is_active !== false,
    }));
    const { error: kbErr } = await supabase.from('client_knowledge_base').insert(rows);
    if (kbErr) throw new Error(`client_knowledge_base: ${kbErr.message}`);
  }
}

export async function finalizeInstall({ template, client_id, paid_amount = 0 }) {
  await applyTemplateToClient(template, client_id);

  const commission = Number((Number(paid_amount) * COMMISSION_RATE).toFixed(2));

  const { data: install, error: installErr } = await supabase
    .from('marketplace_installs')
    .insert([
      {
        template_id: template.id,
        client_id,
        paid_amount,
        commission_amount: commission,
        status: 'active',
      },
    ])
    .select()
    .single();
  if (installErr) throw new Error(`marketplace_installs: ${installErr.message}`);

  // Increment install_count
  await supabase
    .from('marketplace_templates')
    .update({ install_count: (template.install_count || 0) + 1 })
    .eq('id', template.id);

  return install;
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
    const { template_id, client_id } = req.body || {};
    if (!template_id) return res.status(400).json({ error: 'template_id requis' });
    if (!client_id) return res.status(400).json({ error: 'client_id requis' });

    // Verify ownership of buyer client
    const { data: client } = await supabase
      .from('clients')
      .select('id, owner_user_id, brand_name, contact_email')
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

    // Fetch template
    const { data: template, error: tplErr } = await supabase
      .from('marketplace_templates')
      .select('*')
      .eq('id', template_id)
      .eq('is_published', true)
      .maybeSingle();
    if (tplErr) throw new Error(tplErr.message);
    if (!template) return res.status(404).json({ error: 'Template introuvable' });

    // Prevent reinstalling if already active
    const { data: existing } = await supabase
      .from('marketplace_installs')
      .select('id, status')
      .eq('template_id', template_id)
      .eq('client_id', client_id)
      .eq('status', 'active')
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ error: 'Template deja installe', install_id: existing.id });
    }

    const price = Number(template.price) || 0;

    // Free template — install immediately
    if (price <= 0) {
      const install = await finalizeInstall({ template, client_id, paid_amount: 0 });
      return res.status(200).json({
        status: 'installed',
        install,
        template: { id: template.id, name: template.name, slug: template.slug },
      });
    }

    // Paid template — create Stripe Checkout session
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe non configure' });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://actero.fr';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Marketplace — ${template.name}`,
              description: template.description || `Playbook Actero par ${template.name}`,
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: client.contact_email || undefined,
      metadata: {
        service: 'Actero Marketplace',
        template_id: template.id,
        template_slug: template.slug,
        buyer_client_id: client_id,
        creator_client_id: template.creator_client_id || '',
      },
      success_url: `${siteUrl}/marketplace/${template.slug}?install=success`,
      cancel_url: `${siteUrl}/marketplace/${template.slug}?install=cancel`,
    });

    return res.status(200).json({
      status: 'checkout_required',
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (err) {
    console.error('[marketplace/install] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler)
