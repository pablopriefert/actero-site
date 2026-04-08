import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';

// ============================================================
// BUILD SYSTEM PROMPT WITH CLIENT DATA
// ============================================================
function buildSystemPrompt(client, vertical, metrics) {
  return `Tu es Actero Copilot, le conseiller de croissance IA intégré à la plateforme Actero.

Tu parles au client "${client.brand_name}" qui est dans la verticale ${vertical === 'immobilier' ? 'immobilière' : 'e-commerce'}.

DONNÉES EN TEMPS RÉEL DU CLIENT (mois en cours) :
- Temps économisé : ${metrics.time_saved_minutes || 0} minutes (${Math.round((metrics.time_saved_minutes || 0) / 60)}h)
- ROI généré : ${metrics.estimated_roi || 0}€
- Actions IA exécutées : ${metrics.tasks_executed || 0}
- Automations actives : ${metrics.active_automations || 0}

RÈGLES :
- Réponds toujours en français
- Sois concret, direct, orienté business et ROI
- Utilise les données réelles du client pour personnaliser tes réponses
- Pas de jargon technique inutile, pas de blabla
- Propose des actions concrètes et mesurables
- Quand tu cites des chiffres du client, sois précis
- Si le client demande quelque chose hors de tes compétences, redirige-le poliment
- Tu peux recommander d'améliorer les automatisations, d'optimiser les process, d'analyser les tendances
- Tes réponses doivent faire max 200 mots sauf si le client demande plus de détails
- Ne dis jamais que tu es un chatbot ou une IA générique — tu es Actero Copilot, le conseiller intégré

${vertical === 'immobilier' ? `
CONTEXTE IMMOBILIER :
- Les leads = demandes d'acquéreurs/locataires via portails (SeLoger, LeBonCoin, etc.)
- Le temps de réponse est critique (< 5 min = +50% de conversion)
- Les visites planifiées sont un KPI clé
- La qualification IA et le scoring permettent de prioriser les meilleurs leads
- La relance SMS a un taux de réponse 5x supérieur à l'email
` : `
CONTEXTE E-COMMERCE :
- Les emails automatisés (nurturing, post-achat, win-back) augmentent la LTV de 20-40%
- La rétention coûte 5x moins cher que l'acquisition
- Le SAV automatisé réduit le temps de traitement de 60-80%
- Les séquences email avancées récupèrent 10-15% de revenus perdus
- Le reporting avancé identifie les leviers de croissance cachés
`}`;
}

// ============================================================
// CALL GEMINI
// ============================================================
async function callGemini(systemPrompt, history, userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  // Build conversation contents
  const contents = [];

  // Add history
  for (const msg of history) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  // Add current user message
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
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

  return text;
}

// ============================================================
// HANDLER
// ============================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: requires authenticated user
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' });

  const { client_id, message, history = [] } = req.body;

  if (!client_id || !message) {
    return res.status(400).json({ error: 'Missing client_id or message' });
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

    // 2. Fetch aggregated metrics (current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: monthRows } = await supabase
      .from('metrics_daily')
      .select('tasks_executed, estimated_roi, active_automations, time_saved_minutes')
      .eq('client_id', client_id)
      .gte('date', startOfMonth);

    const metrics = (monthRows || []).reduce((acc, row) => ({
      tasks_executed: acc.tasks_executed + (Number(row.tasks_executed) || 0),
      estimated_roi: acc.estimated_roi + (Number(row.estimated_roi) || 0),
      time_saved_minutes: acc.time_saved_minutes + (Number(row.time_saved_minutes) || 0),
      active_automations: Math.max(acc.active_automations, Number(row.active_automations) || 0),
    }), { tasks_executed: 0, estimated_roi: 0, time_saved_minutes: 0, active_automations: 0 });

    // 3. Build prompt & call Gemini
    const systemPrompt = buildSystemPrompt(client, vertical, metrics);
    const responseText = await callGemini(systemPrompt, history, message);

    return res.status(200).json({ response: responseText });

  } catch (error) {
    console.error('[COPILOT-CHAT] Error:', error.message);
    return res.status(500).json({
      error: 'Erreur lors de la réponse Copilot',
    });
  }
}
