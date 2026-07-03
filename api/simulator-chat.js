import { withSentry } from './lib/sentry.js'
import { chatComplete } from './lib/llm.js'
import { createClient } from '@supabase/supabase-js';

// Cap lambda runtime: LLM calls can hang and burn money otherwise.
export const maxDuration = 60

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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

    const { text } = await chatComplete({
      system: systemPrompt || 'Tu es un agent de support client IA professionnel et chaleureux.',
      messages,
      maxTokens: 1024,
    });

    return res.status(200).json({ text });
  } catch (error) {
    console.error('simulator-chat error:', error);
    return res.status(500).json({ error: 'Erreur generation IA' });
  }
}

export default withSentry(handler)
