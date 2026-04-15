// Server-side Gemini proxy — keeps API key out of the frontend bundle
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './lib/admin-auth.js';

const GEMINI_KEY = process.env.GEMINI_API_KEY;

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  // Admin-only endpoint
  const adminUser = await requireAdmin(req, res, supabase);
  if (!adminUser) return;

  const { prompt, temperature, maxOutputTokens } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  // Cap output tokens to prevent abuse
  const safeMaxTokens = Math.min(Number(maxOutputTokens) || 1500, 4096);
  const safeTemp = Math.max(0, Math.min(Number(temperature) || 0.7, 1.0));

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: safeTemp, maxOutputTokens: safeMaxTokens },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      throw new Error(`Gemini ${geminiRes.status}: ${err}`);
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return res.status(200).json({ text });
  } catch (error) {
    console.error('gemini-proxy error:', error);
    return res.status(500).json({ error: 'Erreur Gemini' });
  }
}
