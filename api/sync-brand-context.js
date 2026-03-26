import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CATEGORY_LABELS = {
  policy: 'POLITIQUES',
  faq: 'FAQ',
  product: 'PRODUITS',
  tone: 'TON ET STYLE',
  temporary: 'INFORMATIONS TEMPORAIRES',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check: internal or authenticated user
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const isInternal = internalSecret && req.headers['x-internal-secret'] === internalSecret;
  if (!isInternal) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Non autorisé.' });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Non autorisé.' });
  }

  const { client_id } = req.body || {};
  if (!client_id) {
    return res.status(400).json({ error: 'Missing client_id' });
  }

  try {
    // 1. Fetch all active, non-expired KB entries
    const { data: entries, error: fetchError } = await supabase
      .from('client_knowledge_base')
      .select('*')
      .eq('client_id', client_id)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('category')
      .order('sort_order', { ascending: true });

    if (fetchError) throw fetchError;

    // 2. Compile into structured text
    const byCategory = {};
    (entries || []).forEach(entry => {
      if (!byCategory[entry.category]) byCategory[entry.category] = [];
      byCategory[entry.category].push(entry);
    });

    let compiledText = '';
    for (const [category, label] of Object.entries(CATEGORY_LABELS)) {
      const items = byCategory[category];
      if (!items || items.length === 0) continue;

      compiledText += `=== ${label} ===\n`;
      items.forEach(item => {
        if (category === 'faq') {
          compiledText += `Q: ${item.title}\nR: ${item.content}\n\n`;
        } else if (category === 'temporary' && item.expires_at) {
          const expDate = new Date(item.expires_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
          compiledText += `[Valide jusqu'au ${expDate}] ${item.content}\n\n`;
        } else if (category === 'tone') {
          // Tone can be JSON structured
          try {
            const parsed = JSON.parse(item.content);
            compiledText += `${parsed.tutoiement ? 'Tutoiement' : 'Vouvoiement'}, ton ${parsed.tone || 'professionnel'}.\n`;
            if (parsed.signature) compiledText += `Toujours signer : "${parsed.signature}"\n`;
            if (parsed.forbidden) compiledText += `Phrases interdites : ${parsed.forbidden}\n`;
            if (parsed.instructions) compiledText += `Instructions : ${parsed.instructions}\n`;
          } catch {
            compiledText += `${item.content}\n`;
          }
          compiledText += '\n';
        } else {
          compiledText += `[${item.title}]\n${item.content}\n\n`;
        }
      });
    }

    // 3. Determine which field to update based on client_type
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('client_type')
      .eq('id', client_id)
      .single();

    if (clientError) throw clientError;

    const field = client.client_type === 'immobilier' ? 'agency_context' : 'brand_context';

    const { error: updateError } = await supabase
      .from('clients')
      .update({ [field]: compiledText.trim(), updated_at: new Date().toISOString() })
      .eq('id', client_id);

    if (updateError) throw updateError;

    return res.status(200).json({ success: true, field, length: compiledText.length });
  } catch (error) {
    console.error('sync-brand-context error:', error);
    return res.status(500).json({ error: error.message });
  }
}
