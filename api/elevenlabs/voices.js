import { createClient } from '@supabase/supabase-js';

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!ELEVENLABS_KEY) return res.status(500).json({ error: 'ELEVENLABS_API_KEY missing' });

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' });

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': ELEVENLABS_KEY },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const voices = (data.voices || []).map(v => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category,
      description: v.labels?.description || '',
      accent: v.labels?.accent || '',
      gender: v.labels?.gender || '',
      age: v.labels?.age || '',
      preview_url: v.preview_url,
    }));

    return res.status(200).json({ voices });
  } catch (error) {
    console.error('ElevenLabs voices error:', error);
    return res.status(500).json({ error: error.message });
  }
}
