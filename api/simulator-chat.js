import { createClient } from '@supabase/supabase-js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  // Auth check — any authenticated user (not admin-only)
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifie' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non authentifie' });

  const { prompt, systemPrompt, history } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  try {
    // Build messages array from history
    const messages = [];
    if (history && Array.isArray(history)) {
      history.forEach(msg => {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      });
    }
    messages.push({ role: 'user', content: prompt });

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt || 'Tu es un agent de support client IA professionnel et chaleureux.',
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      console.error('Anthropic API error:', err);
      throw new Error(`Anthropic ${anthropicRes.status}`);
    }

    const data = await anthropicRes.json();
    const text = data?.content?.[0]?.text || '';

    return res.status(200).json({ text });
  } catch (error) {
    console.error('simulator-chat error:', error);
    return res.status(500).json({ error: 'Erreur generation IA' });
  }
}
