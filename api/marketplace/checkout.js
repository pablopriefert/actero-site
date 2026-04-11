// Marketplace — checkout (paid templates)
// Thin alias over install.js which already branches on price.
// Frontend MarketplaceTemplatePage.jsx calls this for paid templates
// with body { template_id, slug } and expects { url }.
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' });

  try {
    const { template_id, slug, client_id } = req.body || {};
    if (!template_id && !slug) {
      return res.status(400).json({ error: 'template_id ou slug requis' });
    }

    // Resolve buyer client_id: use provided one, or fall back to the user's first owned client
    let buyerClientId = client_id;
    if (!buyerClientId) {
      const { data: owned } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_user_id', user.id)
        .limit(1)
        .maybeSingle();
      buyerClientId = owned?.id || null;
    }
    if (!buyerClientId) {
      const { data: linked } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      buyerClientId = linked?.client_id || null;
    }
    if (!buyerClientId) {
      return res.status(400).json({ error: 'Aucun client associe a cet utilisateur' });
    }

    // Load template
    let query = supabase
      .from('marketplace_templates')
      .select('*')
      .eq('is_published', true);
    query = template_id ? query.eq('id', template_id) : query.eq('slug', slug);
    const { data: template, error: tplErr } = await query.maybeSingle();
    if (tplErr) throw new Error(tplErr.message);
    if (!template) return res.status(404).json({ error: 'Template introuvable' });

    // Idempotency: already installed?
    const { data: existing } = await supabase
      .from('marketplace_installs')
      .select('id')
      .eq('template_id', template.id)
      .eq('client_id', buyerClientId)
      .eq('status', 'active')
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ error: 'Template deja installe', install_id: existing.id });
    }

    const price = Number(template.price) || 0;
    if (price <= 0) {
      return res.status(400).json({ error: 'Template gratuit — utilisez /api/marketplace/install' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe non configure' });
    }

    // Buyer email
    const { data: client } = await supabase
      .from('clients')
      .select('contact_email')
      .eq('id', buyerClientId)
      .maybeSingle();

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://actero.fr';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Marketplace — ${template.name}`,
              description: template.description || 'Playbook Actero',
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: client?.contact_email || user.email || undefined,
      metadata: {
        service: 'Actero Marketplace',
        template_id: template.id,
        template_slug: template.slug,
        buyer_client_id: buyerClientId,
        creator_client_id: template.creator_client_id || '',
      },
      success_url: `${siteUrl}/marketplace/${template.slug}?install=success`,
      cancel_url: `${siteUrl}/marketplace/${template.slug}?install=cancel`,
    });

    return res.status(200).json({ url: session.url, session_id: session.id });
  } catch (err) {
    console.error('[marketplace/checkout] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
