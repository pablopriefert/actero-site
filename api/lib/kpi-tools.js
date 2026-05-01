/**
 * Actero — shared KPI tools for any AI copilot (Slack, in-dashboard).
 *
 * Claude tool-use definitions + their implementations, all scoped by client_id
 * so tenant isolation is strict. Zero UI/channel dependencies — each copilot
 * caller just passes a supabase client + a client_id + a message, and gets
 * back a natural-language reply.
 *
 * NEW copilots (email, Discord, voice, etc.) should ONLY depend on this module.
 */
import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5'

// Lazy init — avoid throwing at module-load if env is missing
let _anthropic = null
function getAnthropic() {
  if (_anthropic) return _anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing')
  _anthropic = new Anthropic({ apiKey })
  return _anthropic
}

/* -------------------------------------------------------------------------- */
/*  Period helpers                                                            */
/* -------------------------------------------------------------------------- */

export function periodToDateRange(period) {
  const now = new Date()
  const end = now.toISOString()
  let start
  switch (period) {
    case 'today': {
      const d = new Date(now); d.setHours(0, 0, 0, 0)
      start = d.toISOString(); break
    }
    case 'yesterday': {
      const d = new Date(now); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0)
      const e = new Date(now); e.setHours(0, 0, 0, 0)
      return { start: d.toISOString(), end: e.toISOString() }
    }
    case 'week': {
      const d = new Date(now); d.setDate(d.getDate() - 7)
      start = d.toISOString(); break
    }
    case 'month': {
      const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0)
      start = d.toISOString(); break
    }
    case 'year': {
      const d = new Date(now); d.setMonth(0, 1); d.setHours(0, 0, 0, 0)
      start = d.toISOString(); break
    }
    default: {
      const d = new Date(now); d.setDate(d.getDate() - 7)
      start = d.toISOString()
    }
  }
  return { start, end }
}

export function formatPeriodFR(period) {
  const map = {
    today: "aujourd'hui",
    yesterday: 'hier',
    week: 'les 7 derniers jours',
    month: 'ce mois-ci',
    year: 'cette année',
  }
  return map[period] || 'les 7 derniers jours'
}

/* -------------------------------------------------------------------------- */
/*  Tool implementations — all receive (supabase, clientId, args)             */
/* -------------------------------------------------------------------------- */

async function getTicketsStats(supabase, clientId, { period = 'week' } = {}) {
  const { start, end } = periodToDateRange(period)
  // Real schema: automation_events.event_category = 'ticket_resolved' (auto)
  // or 'ticket_escalated' (manuel). No handled_by column.
  const [totalRes, autoRes, escalatedRes] = await Promise.all([
    supabase.from('automation_events').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).gte('created_at', start).lte('created_at', end)
      .in('event_category', ['ticket_resolved', 'ticket_escalated']),
    supabase.from('automation_events').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).gte('created_at', start).lte('created_at', end)
      .eq('event_category', 'ticket_resolved'),
    supabase.from('automation_events').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).gte('created_at', start).lte('created_at', end)
      .eq('event_category', 'ticket_escalated'),
  ])
  const total = totalRes.count || 0
  const auto = autoRes.count || 0
  const escalated = escalatedRes.count || 0
  const manual = escalated // tickets escalated = traités manuellement par l'humain
  return {
    period: formatPeriodFR(period),
    total,
    auto,
    manual,
    escalated,
    auto_rate_percent: total > 0 ? Math.round((auto / total) * 100) : 0,
    escalation_rate_percent: total > 0 ? Math.round((escalated / total) * 100) : 0,
  }
}

async function getPendingEscalations(supabase, clientId) {
  const { data, count } = await supabase.from('ai_conversations')
    .select('id, subject, customer_email, created_at', { count: 'exact' })
    .eq('client_id', clientId)
    .eq('status', 'escalated')
    .is('human_response', null)
    .order('created_at', { ascending: false })
    .limit(5)
  return {
    total_pending: count || 0,
    oldest: (data || []).map(d => ({
      id: d.id.slice(0, 6),
      subject: d.subject,
      customer: d.customer_email,
      age_hours: Math.round((Date.now() - new Date(d.created_at).getTime()) / 3600000),
    })),
  }
}

async function getTimeSavedAndSavings(supabase, clientId, { period = 'month' } = {}) {
  const { start, end } = periodToDateRange(period)
  // Auto-resolved tickets → each = ~3 min saved @ ~0.35€/ticket human cost
  const { count } = await supabase.from('automation_events').select('id', { count: 'exact', head: true })
    .eq('client_id', clientId).gte('created_at', start).lte('created_at', end)
    .eq('event_category', 'ticket_resolved')
  const autoTickets = count || 0
  const hoursSaved = Math.round((autoTickets * 3) / 60 * 10) / 10
  const euroSaved = Math.round(autoTickets * 0.35)
  return {
    period: formatPeriodFR(period),
    auto_tickets: autoTickets,
    hours_saved: hoursSaved,
    euro_saved: euroSaved,
  }
}

async function getEngineStats(supabase, clientId, { period = 'week' } = {}) {
  const { start, end } = periodToDateRange(period)
  const { data: runs } = await supabase.from('engine_runs_v2')
    .select('status, confidence, duration_ms')
    .eq('client_id', clientId)
    .gte('created_at', start).lte('created_at', end)
  if (!runs?.length) return { period: formatPeriodFR(period), runs: 0 }
  const completed = runs.filter(r => r.status === 'completed').length
  const failed = runs.filter(r => r.status === 'failed').length
  const needsReview = runs.filter(r => r.status === 'needs_review').length
  const confidences = runs.map(r => r.confidence).filter(c => typeof c === 'number')
  const durations = runs.map(r => r.duration_ms).filter(d => typeof d === 'number')
  const avgConf = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null
  const avgDur = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null
  return {
    period: formatPeriodFR(period),
    runs: runs.length,
    completed, failed, needs_review: needsReview,
    avg_confidence: avgConf != null ? Number(avgConf.toFixed(2)) : null,
    avg_duration_ms: avgDur,
  }
}

async function getTopTopics(supabase, clientId, { period = 'week', limit = 5 } = {}) {
  const { start, end } = periodToDateRange(period)
  const { data } = await supabase.from('engine_runs_v2')
    .select('classification')
    .eq('client_id', clientId)
    .gte('created_at', start).lte('created_at', end)
    .not('classification', 'is', null)
  const counts = {}
  for (const r of data || []) {
    const c = r.classification || 'autre'
    counts[c] = (counts[c] || 0) + 1
  }
  const sorted = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, Math.min(limit, 10))
    .map(([topic, count]) => ({ topic, count }))
  return { period: formatPeriodFR(period), topics: sorted }
}

async function getIntegrationsStatus(supabase, clientId) {
  const { data } = await supabase.from('client_integrations')
    .select('provider, status, provider_label, last_sync_at, last_error')
    .eq('client_id', clientId)
  const connected = (data || []).filter(i => i.status === 'active')
    .map(i => ({ provider: i.provider, label: i.provider_label, last_sync: i.last_sync_at }))
  const errored = (data || []).filter(i => i.status === 'error' || i.last_error)
    .map(i => ({ provider: i.provider, error: i.last_error }))
  return { connected, errored, total: (data || []).length }
}

async function searchKnowledgeBase(supabase, clientId, { query, limit = 3 } = {}) {
  if (!query) return { results: [] }
  const { data } = await supabase.from('client_knowledge_base')
    .select('id, title, content, category, source')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .limit(Math.min(limit, 10))
  return {
    results: (data || []).map(r => ({
      id: r.id.slice(0, 4),
      title: r.title,
      excerpt: (r.content || '').slice(0, 200),
      category: r.category,
      source: r.source,
    })),
  }
}

async function getClientInfo(supabase, clientId) {
  const { data } = await supabase.from('clients')
    .select('brand_name, plan, trial_ends_at, contact_email, website_url, industry')
    .eq('id', clientId).maybeSingle()
  return data || {}
}

async function getRecommendation(supabase, clientId) {
  // Heuristic recommendation engine — picks the most impactful next action
  const [kbCount, integrationsCount, pendingEscCount, recentStats] = await Promise.all([
    supabase.from('client_knowledge_base').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).eq('is_active', true).then(r => r.count || 0),
    supabase.from('client_integrations').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).eq('status', 'active').then(r => r.count || 0),
    supabase.from('ai_conversations').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).eq('status', 'escalated').is('human_response', null).then(r => r.count || 0),
    getTicketsStats(supabase, clientId, { period: 'week' }),
  ])

  const picks = []
  if (pendingEscCount >= 5) {
    picks.push({ priority: 1, action: `Traiter les ${pendingEscCount} escalades en attente dans l'onglet À traiter.` })
  }
  if (recentStats.escalation_rate_percent >= 30) {
    picks.push({ priority: 2, action: `Taux d'escalade élevé (${recentStats.escalation_rate_percent}%) — enrichir la base de connaissances.` })
  }
  if (kbCount < 10) {
    picks.push({ priority: 3, action: `Votre base n'a que ${kbCount} entrées. Les marchands avec 15+ entrées ont un taux d'auto-résolution 30% plus élevé.` })
  }
  if (integrationsCount < 3) {
    picks.push({ priority: 4, action: `Connecter plus d'outils (Shopify, Gmail, Gorgias) pour donner plus de contexte à l'agent.` })
  }
  if (picks.length === 0) {
    picks.push({ priority: 5, action: 'Tout est au vert. Surveille les heures de pic pour calibrer ta dispo humaine.' })
  }
  picks.sort((a, b) => a.priority - b.priority)
  return { recommendations: picks.slice(0, 3) }
}

/* -------------------------------------------------------------------------- */
/*  Tool registry for Claude                                                  */
/* -------------------------------------------------------------------------- */

export const KPI_TOOLS = [
  {
    name: 'get_tickets_stats',
    description: "Stats tickets SAV (total, auto, manuel, escalades, taux auto) pour une periode.",
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'yesterday', 'week', 'month', 'year'] },
      },
    },
  },
  {
    name: 'get_pending_escalations',
    description: 'Liste et nombre des escalades en attente d\'une reponse humaine.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_time_saved_and_savings',
    description: 'Temps economise (heures) et economies en euros generees par l\'IA sur une periode.',
    input_schema: {
      type: 'object',
      properties: { period: { type: 'string', enum: ['today', 'yesterday', 'week', 'month', 'year'] } },
    },
  },
  {
    name: 'get_engine_stats',
    description: 'Stats du moteur (runs, succes, confiance IA moyenne, temps de traitement).',
    input_schema: {
      type: 'object',
      properties: { period: { type: 'string', enum: ['today', 'yesterday', 'week', 'month', 'year'] } },
    },
  },
  {
    name: 'get_top_topics',
    description: 'Top des sujets / classifications les plus frequents des tickets.',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'yesterday', 'week', 'month', 'year'] },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'get_integrations_status',
    description: 'Etat des integrations (Shopify, Gmail, etc.) et les erreurs eventuelles.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'search_knowledge_base',
    description: 'Recherche dans la base de connaissances du client par mot-cle.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_client_info',
    description: 'Infos de compte : nom de marque, plan, industrie, site.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_recommendation',
    description: "Recommandations prioritaires pour ameliorer les KPIs (top 3 actions concretes).",
    input_schema: { type: 'object', properties: {} },
  },
]

export async function executeTool(supabase, clientId, name, args) {
  switch (name) {
    case 'get_tickets_stats': return getTicketsStats(supabase, clientId, args)
    case 'get_pending_escalations': return getPendingEscalations(supabase, clientId)
    case 'get_time_saved_and_savings': return getTimeSavedAndSavings(supabase, clientId, args)
    case 'get_engine_stats': return getEngineStats(supabase, clientId, args)
    case 'get_top_topics': return getTopTopics(supabase, clientId, args)
    case 'get_integrations_status': return getIntegrationsStatus(supabase, clientId)
    case 'search_knowledge_base': return searchKnowledgeBase(supabase, clientId, args)
    case 'get_client_info': return getClientInfo(supabase, clientId)
    case 'get_recommendation': return getRecommendation(supabase, clientId)
    default: return { error: `Outil inconnu: ${name}` }
  }
}

/* -------------------------------------------------------------------------- */
/*  Ask — main entry point. Channel-agnostic.                                 */
/* -------------------------------------------------------------------------- */

const SYSTEM_PROMPTS = {
  slack: (brand) => `Tu es Actero Copilot, l'assistant de "${brand}" dans Slack.

STYLE (important pour Slack):
- Reponse courte et scannable. 3-6 lignes max.
- Utilise des puces " -  " (tiret espace) pour les listes (Slack supporte).
- Titres en *gras* (avec asterisques simples cote Slack).
- Pas de Markdown lourd, pas de tableaux ASCII.
- Pas d'emojis superflus, 1-2 max si pertinent.

STRUCTURE IDEALE:
*Titre clair*
 - fait 1
 - fait 2
 - fait 3

*Insight* (si pertinent)
Une ligne qui explique le "pourquoi".

*Recommandation* (si pertinent)
Une ligne actionnable.

REGLES:
- Utilise toujours les outils pour obtenir les chiffres. N'invente rien.
- Si plusieurs metriques sont demandees, appelle plusieurs outils en parallele.
- Si la question est ambigue sur la periode, choisis "aujourd'hui" par defaut pour les tickets, "ce mois" pour les economies.
- Reponds en francais.
- Jamais d'info sur d'autres clients Actero, jamais de donnees sensibles (tokens, cles API).`,

  default: (brand) => `Tu es Actero Copilot, l'assistant de "${brand}". Tu reponds en francais, concis, avec les donnees reelles via les outils.`,
}

/**
 * askCopilot — main Claude tool-use loop. Channel-agnostic.
 *
 * @param {object} supabase - Supabase admin client
 * @param {object} opts
 *   - clientId: UUID of the Actero tenant
 *   - message: user question (string)
 *   - brandName: display name for the system prompt
 *   - channel: 'slack' | 'default' — picks the style prompt
 *   - maxLoops: max tool-use iterations (default 4)
 * @returns {Promise<{ reply: string, toolCalls: string[] }>}
 */
export async function askCopilot(supabase, {
  clientId,
  message,
  brandName = 'votre boutique',
  channel = 'default',
  maxLoops = 4,
}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { reply: 'Le Copilot IA n\'est pas configure (ANTHROPIC_API_KEY manquant).', toolCalls: [] }
  }

  const systemFn = SYSTEM_PROMPTS[channel] || SYSTEM_PROMPTS.default
  const system = systemFn(brandName)
  const messages = [{ role: 'user', content: message }]
  const toolCalls = []

  let loop = 0
  while (loop++ < maxLoops) {
    const resp = await getAnthropic().messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      tools: KPI_TOOLS,
      messages,
    })

    const toolUses = (resp.content || []).filter(b => b.type === 'tool_use')

    if (toolUses.length === 0) {
      const textBlocks = (resp.content || []).filter(b => b.type === 'text')
      const reply = textBlocks.map(b => b.text).join('\n').trim()
      return { reply: reply || 'Ok.', toolCalls }
    }

    messages.push({ role: 'assistant', content: resp.content })

    const toolResults = await Promise.all(
      toolUses.map(async (tu) => {
        toolCalls.push(tu.name)
        try {
          const result = await executeTool(supabase, clientId, tu.name, tu.input || {})
          return { type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) }
        } catch (err) {
          return {
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify({ error: err.message || 'tool failed' }),
            is_error: true,
          }
        }
      }),
    )
    messages.push({ role: 'user', content: toolResults })
  }

  return { reply: 'Desole, je n\'ai pas pu aboutir a une reponse (limite d\'outils).', toolCalls }
}
