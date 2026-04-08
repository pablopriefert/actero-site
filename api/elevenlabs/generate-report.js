import { createClient } from '@supabase/supabase-js';

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!ELEVENLABS_KEY) return res.status(500).json({ error: 'ELEVENLABS_API_KEY missing' });
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY missing' });

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' });

  const { client_id, voice_id, content_types } = req.body;
  if (!client_id) return res.status(400).json({ error: 'Missing client_id' });

  try {
    // 1. Fetch metrics for the past 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [metricsRes, eventsRes, escalationsRes] = await Promise.all([
      supabase.from('metrics_daily').select('*').eq('client_id', client_id).gte('date', sevenDaysAgo).order('date'),
      supabase.from('automation_events').select('event_category').eq('client_id', client_id).gte('created_at', sevenDaysAgo),
      supabase.from('escalation_tickets').select('id, status').eq('client_id', client_id).gte('created_at', sevenDaysAgo),
    ]);

    const metrics = metricsRes.data || [];
    const events = eventsRes.data || [];
    const escalations = escalationsRes.data || [];

    const totalConversations = metrics.reduce((s, m) => s + (m.conversations_handled || 0), 0);
    const avgResolution = metrics.length > 0
      ? (metrics.reduce((s, m) => s + (m.resolution_rate || 0), 0) / metrics.length).toFixed(1)
      : 0;
    const totalEscalations = escalations.length;
    const resolvedEscalations = escalations.filter(e => e.status === 'resolved').length;

    // Build sections based on content_types
    const sections = [];
    const types = content_types || ['metrics', 'trends', 'alerts', 'recommendations'];

    if (types.includes('metrics')) {
      sections.push(`Metriques cles: ${totalConversations} conversations traitees cette semaine, taux de resolution moyen de ${avgResolution}%.`);
    }
    if (types.includes('alerts')) {
      sections.push(`Alertes: ${totalEscalations} escalades cette semaine, dont ${resolvedEscalations} resolues.`);
    }
    if (types.includes('trends')) {
      const eventCounts = {};
      events.forEach(e => { eventCounts[e.event_category] = (eventCounts[e.event_category] || 0) + 1; });
      const topCategory = Object.entries(eventCounts).sort((a, b) => b[1] - a[1])[0];
      sections.push(`Tendances: La categorie la plus active est ${topCategory ? topCategory[0] : 'aucune'} avec ${topCategory ? topCategory[1] : 0} evenements.`);
    }

    // 2. Ask Claude to write a natural spoken report script
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: 'Tu es un assistant qui redige des rapports vocaux hebdomadaires pour une plateforme de support client IA. Ecris un script naturel et oral de 90 secondes maximum (environ 200 mots). Pas de markdown, pas de bullet points. Utilise un ton professionnel mais chaleureux. Commence par "Bonjour, voici votre rapport hebdomadaire Actero."',
        messages: [{ role: 'user', content: `Voici les donnees de la semaine:\n${sections.join('\n')}\n\n${types.includes('recommendations') ? 'Inclus aussi 1-2 recommandations basees sur ces donnees.' : ''}` }],
      }),
    });

    if (!anthropicRes.ok) throw new Error(`Claude ${anthropicRes.status}`);
    const claudeData = await anthropicRes.json();
    const reportText = claudeData?.content?.[0]?.text || '';

    // 3. Generate audio via ElevenLabs
    const selectedVoiceId = voice_id || '21m00Tcm4TlvDq8ikWAM';
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: reportText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
      }),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      throw new Error(`ElevenLabs TTS ${ttsRes.status}: ${errText}`);
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    // 4. Store report in DB
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() - 6); // Monday of current week
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const { data: report, error: insertError } = await supabase.from('voice_reports').insert({
      client_id,
      week_start: weekStart.toISOString().split('T')[0],
      week_end: weekEnd.toISOString().split('T')[0],
      report_text: reportText,
      voice_id: selectedVoiceId,
      audio_base64: audioBase64,
      generated_at: now.toISOString(),
    }).select().single();

    if (insertError) console.error('Insert voice_report error:', insertError);

    return res.status(200).json({
      report_text: reportText,
      audio_base64: audioBase64,
      report_id: report?.id,
      generated_at: now.toISOString(),
    });
  } catch (error) {
    console.error('generate-report error:', error);
    return res.status(500).json({ error: error.message });
  }
}
