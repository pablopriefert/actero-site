import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY missing' });

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' });

  const { message, client_id, customer_name } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing message' });

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        system: `Tu es un analyseur de sentiment pour un service client. Analyse le message et reponds UNIQUEMENT en JSON valide:
{
  "score": 1-10 (1=tres negatif, 10=tres positif),
  "category": "tres_positif" | "positif" | "neutre" | "negatif" | "tres_negatif",
  "trigger": "raison courte en francais",
  "excerpt": "extrait pertinent du message (max 100 chars)"
}`,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!anthropicRes.ok) throw new Error(`Claude ${anthropicRes.status}`);
    const data = await anthropicRes.json();
    const text = data?.content?.[0]?.text || '{}';

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = { score: 5, category: 'neutre', trigger: 'Analyse impossible', excerpt: '' };
    }

    // Log sentiment
    if (client_id) {
      await supabase.from('sentiment_logs').insert({
        client_id,
        customer_name: customer_name || null,
        message: message.substring(0, 1000),
        score: result.score,
        category: result.category,
        trigger: result.trigger,
        excerpt: result.excerpt,
      }).then(() => {}).catch(err => console.error('Log sentiment error:', err));
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('sentiment analyze error:', error);
    return res.status(500).json({ error: error.message });
  }
}

export default withSentry(handler)
