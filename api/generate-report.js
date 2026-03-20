import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { client_id } = req.body;

  if (!client_id) {
    return res.status(400).json({ error: 'Missing client_id' });
  }

  try {
    // 1. Fetch client
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, brand_name, client_type')
      .eq('id', client_id)
      .single();

    if (clientErr || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const vertical = client.client_type || 'ecommerce';

    // 2. Fetch current month metrics
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

    const [{ data: currentRows }, { data: prevRows }, { data: recentEvents }] = await Promise.all([
      supabase
        .from('metrics_daily')
        .select('tasks_executed, estimated_roi, active_automations, time_saved_minutes')
        .eq('client_id', client_id)
        .gte('date', startOfMonth),
      supabase
        .from('metrics_daily')
        .select('tasks_executed, estimated_roi, active_automations, time_saved_minutes')
        .eq('client_id', client_id)
        .gte('date', startOfPrevMonth)
        .lte('date', endOfPrevMonth),
      supabase
        .from('automation_events')
        .select('event_category, event_description, metadata, created_at')
        .eq('client_id', client_id)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    const aggregate = (rows) => (rows || []).reduce((acc, row) => ({
      tasks_executed: acc.tasks_executed + (Number(row.tasks_executed) || 0),
      estimated_roi: acc.estimated_roi + (Number(row.estimated_roi) || 0),
      time_saved_minutes: acc.time_saved_minutes + (Number(row.time_saved_minutes) || 0),
      active_automations: Math.max(acc.active_automations, Number(row.active_automations) || 0),
    }), { tasks_executed: 0, estimated_roi: 0, time_saved_minutes: 0, active_automations: 0 });

    const current = aggregate(currentRows);
    const previous = aggregate(prevRows);

    // Event breakdown
    const eventBreakdown = {};
    (recentEvents || []).forEach(e => {
      eventBreakdown[e.event_category] = (eventBreakdown[e.event_category] || 0) + 1;
    });

    // 3. Build prompt
    const monthName = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const roiVar = previous.estimated_roi > 0
      ? Math.round(((current.estimated_roi - previous.estimated_roi) / previous.estimated_roi) * 100)
      : (current.estimated_roi > 0 ? 100 : 0);

    const systemPrompt = `Tu es un analyste de performance IA senior chez Actero.
Tu dois générer un rapport de performance mensuel pour le client "${client.brand_name}" (verticale: ${vertical === 'immobilier' ? 'immobilier' : 'e-commerce'}).

DONNÉES DU MOIS EN COURS (${monthName}) :
- Actions IA exécutées : ${current.tasks_executed}
- ROI généré : ${current.estimated_roi}€
- Temps économisé : ${Math.round(current.time_saved_minutes / 60)}h (${current.time_saved_minutes} min)
- Automations actives : ${current.active_automations}
- Variation ROI vs mois dernier : ${roiVar > 0 ? '+' : ''}${roiVar}%

DONNÉES DU MOIS PRÉCÉDENT :
- Actions IA exécutées : ${previous.tasks_executed}
- ROI généré : ${previous.estimated_roi}€
- Temps économisé : ${Math.round(previous.time_saved_minutes / 60)}h

RÉPARTITION DES ÉVÉNEMENTS RÉCENTS :
${Object.entries(eventBreakdown).map(([cat, count]) => `- ${cat}: ${count}`).join('\n') || '- Aucun événement récent'}

RÈGLES :
- Réponds UNIQUEMENT en JSON valide, rien d'autre
- Le JSON doit contenir exactement ces champs :
  {
    "executive_summary": "string (3-5 phrases, résumé global des performances)",
    "key_insights": ["string", "string", "string"] (exactement 4 insights clés basés sur les données),
    "recommendations": ["string", "string", "string"] (exactement 3 recommandations actionnables),
    "outlook": "string (2-3 phrases sur les perspectives du mois prochain)"
  }
- Sois précis avec les chiffres du client
- Ton professionnel mais accessible
- Chaque insight et recommandation doit faire 1-2 phrases max
- Utilise les données réelles, ne fabrique pas de chiffres`;

    // 4. Call Gemini
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: `Génère le rapport de performance pour ${monthName}.` }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty Gemini response');

    // Parse JSON from Gemini
    let report;
    try {
      report = JSON.parse(text);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        report = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Invalid JSON from Gemini');
      }
    }

    // Add metadata
    report.generated_at = new Date().toISOString();
    report.client_id = client_id;
    report.period = monthName;

    return res.status(200).json(report);

  } catch (error) {
    console.error('[GENERATE-REPORT] Error:', error.message);
    return res.status(500).json({
      error: 'Erreur lors de la génération du rapport',
    });
  }
}
