import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';
const CACHE_HOURS = 6;

// ============================================================
// UPSELL DEFINITIONS PER VERTICAL
// ============================================================
const UPSELLS = {
  ecommerce: [
    { type: 'email_sequences_customerio', name: 'Séquences email avancées (Customer.io)', cta: 'Activer les séquences email' },
    { type: 'reporting_premium_ecom', name: 'Reporting premium e-commerce', cta: 'Activer le reporting premium' },
  ],
  immobilier: [
    { type: 'sms_relance_leads', name: 'Relance SMS des leads', cta: 'Activer la relance SMS' },
    { type: 'prise_rdv_auto', name: 'Prise de rendez-vous automatisée', cta: 'Activer la prise de RDV' },
    { type: 'scoring_leads', name: 'Scoring avancé des leads', cta: 'Activer le scoring leads' },
    { type: 'reporting_premium_immo', name: 'Reporting premium agence', cta: 'Activer le reporting premium' },
  ],
};

// ============================================================
// BUILD GEMINI PROMPT
// ============================================================
function buildPrompt(client, vertical, metrics, activeUpsells) {
  const activeUpsellTypes = (activeUpsells || []).map(u => u.upsell_type);
  const availableUpsells = (UPSELLS[vertical] || []).filter(u => !activeUpsellTypes.includes(u.type));

  const dataBlock = `
CLIENT: ${client.brand_name}
VERTICALE: ${vertical}
MÉTRIQUES DU MOIS:
- Temps économisé: ${metrics.time_saved_minutes || 0} minutes (${Math.round((metrics.time_saved_minutes || 0) / 60)}h)
- ROI généré: ${metrics.estimated_roi || 0}€
- Actions IA exécutées: ${metrics.tasks_executed || 0}
- Automations actives: ${metrics.active_automations || 0}
UPSELLS DÉJÀ ACTIFS: ${activeUpsellTypes.length > 0 ? activeUpsellTypes.join(', ') : 'Aucun'}
UPSELLS DISPONIBLES: ${availableUpsells.map(u => `${u.type} ("${u.name}")`).join(', ') || 'Aucun'}
`.trim();

  const systemPrompt = `Tu es Actero Copilot, un conseiller expert en croissance business spécialisé dans l'automatisation pour les entreprises ${vertical === 'immobilier' ? 'immobilières' : 'e-commerce'}.

Tu analyses les données réelles d'un client et identifies des opportunités de croissance concrètes.

RÈGLES STRICTES:
- 2 à 4 recommandations maximum
- Chaque recommandation doit être concrète, actionnable, orientée ROI
- Pas de jargon technique, pas de blabla, pas de phrases vagues
- Si un upsell Actero disponible correspond à ta recommandation, indique-le dans upsellType et propose un ctaLabel
- Les priorityScore vont de 1 à 100 (100 = le plus urgent)
- Les impactLevel sont: "high", "medium" ou "low"
- Ne recommande JAMAIS un upsell déjà actif
- Focus sur: revenus, conversion, efficacité, gain de temps, croissance
- Le résumé doit être 1-2 phrases max, direct et percutant
- Adapte tes recommandations à la verticale ${vertical}

${vertical === 'immobilier' ? `
CONTEXTE IMMOBILIER:
- Les leads = demandes d'acquéreurs/locataires
- Le temps de réponse est critique (< 5 min idéal)
- Les visites planifiées = indicateur clé de conversion
- Le scoring permet de prioriser les meilleurs prospects
- La relance SMS a un taux de réponse 5x supérieur à l'email
` : `
CONTEXTE E-COMMERCE:
- Les emails automatisés (nurturing, post-achat, win-back) augmentent la LTV de 20-40%
- Le reporting avancé permet d'identifier les leviers de croissance cachés
- La rétention coûte 5x moins cher que l'acquisition
- Les séquences email avancées récupèrent 10-15% de revenus perdus
`}

RÉPONDS UNIQUEMENT EN JSON VALIDE avec cette structure exacte:
{
  "summary": "Résumé global en 1-2 phrases",
  "recommendations": [
    {
      "title": "Titre court et percutant",
      "problem": "Problème ou opportunité détecté(e)",
      "recommendation": "Action recommandée concrète",
      "impact": "Impact business estimé (chiffré si possible)",
      "priorityScore": 85,
      "impactLevel": "high",
      "upsellType": "type_or_null",
      "ctaLabel": "Label du bouton ou null"
    }
  ]
}`;

  return { systemPrompt, dataBlock };
}

// ============================================================
// CALL GEMINI API
// ============================================================
async function callGemini(systemPrompt, userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');

  return JSON.parse(text);
}

// ============================================================
// PARSE & VALIDATE GEMINI OUTPUT
// ============================================================
function validateOutput(raw) {
  const fallback = {
    summary: "Analyse en cours — les données sont insuffisantes pour générer des recommandations précises.",
    recommendations: [],
  };

  if (!raw || typeof raw !== 'object') return fallback;

  const summary = typeof raw.summary === 'string' ? raw.summary : fallback.summary;
  let recommendations = Array.isArray(raw.recommendations) ? raw.recommendations : [];

  recommendations = recommendations
    .filter(r => r && r.title && r.recommendation)
    .map(r => ({
      title: String(r.title || ''),
      problem: String(r.problem || ''),
      recommendation: String(r.recommendation || ''),
      impact: String(r.impact || ''),
      priorityScore: Math.max(1, Math.min(100, Number(r.priorityScore) || 50)),
      impactLevel: ['high', 'medium', 'low'].includes(r.impactLevel) ? r.impactLevel : 'medium',
      upsellType: r.upsellType && r.upsellType !== 'null' ? String(r.upsellType) : null,
      ctaLabel: r.ctaLabel && r.ctaLabel !== 'null' ? String(r.ctaLabel) : null,
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 4);

  return { summary, recommendations };
}

// ============================================================
// HANDLER
// ============================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { client_id, force_refresh } = req.body;
  if (!client_id) {
    return res.status(400).json({ error: 'Missing client_id' });
  }

  try {
    // 1. Check cache (unless force refresh)
    if (!force_refresh) {
      const cacheThreshold = new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000).toISOString();
      const { data: cached } = await supabase
        .from('copilot_analyses')
        .select('*')
        .eq('client_id', client_id)
        .gte('generated_at', cacheThreshold)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        return res.status(200).json({
          summary: cached.summary,
          recommendations: cached.recommendations_json,
          generated_at: cached.generated_at,
          cached: true,
        });
      }
    }

    // 2. Fetch client data
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, brand_name, client_type')
      .eq('id', client_id)
      .single();

    if (clientErr || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const vertical = client.client_type || 'ecommerce';

    // 3. Fetch aggregated metrics (current month)
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

    // 4. Fetch active upsells
    const { data: activeUpsells } = await supabase
      .from('client_upsells')
      .select('upsell_type, status')
      .eq('client_id', client_id)
      .eq('status', 'active');

    // 5. Build prompt & call Gemini
    const { systemPrompt, dataBlock } = buildPrompt(client, vertical, metrics, activeUpsells);
    const rawOutput = await callGemini(systemPrompt, `Analyse ces données client et génère tes recommandations:\n\n${dataBlock}`);
    const result = validateOutput(rawOutput);

    // 6. Store in cache
    const generatedAt = new Date().toISOString();
    await supabase.from('copilot_analyses').upsert({
      client_id,
      vertical,
      summary: result.summary,
      recommendations_json: result.recommendations,
      generated_at: generatedAt,
      updated_at: generatedAt,
    }, { onConflict: 'client_id' });

    return res.status(200).json({
      summary: result.summary,
      recommendations: result.recommendations,
      generated_at: generatedAt,
      cached: false,
    });

  } catch (error) {
    console.error('[COPILOT] Error:', error.message);
    return res.status(500).json({
      error: 'Erreur lors de l\'analyse Copilot',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
