/**
 * Actero — WhatsApp AI Admin Copilot
 *
 * Natural language conversational admin via WhatsApp. When a whitelisted admin
 * phone sends a message that doesn't start with "/", this module takes over
 * and routes the question to Claude with tool-use. Claude picks the right
 * tool (tickets stats, revenue, integrations, KB search, etc.), executes it
 * against the client's Supabase data, and replies in natural French.
 *
 * Slash commands (legacy /help, /kb, /stats, etc.) still work via the older
 * whatsapp-admin-commands.js module — they're kept as power-user shortcuts.
 *
 * Contract (mirrors tryHandleAdminCommand):
 *   tryHandleAdminNL(supabase, { clientId, fromPhone, message })
 *     -> { reply: string } | null
 *   Returns null if the sender isn't an admin. Returns { reply } otherwise.
 */
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5'

/* -------------------------------------------------------------------------- */
/*  Normalize phone — strip whitespace/dashes/parens, drop "+" prefix         */
/* -------------------------------------------------------------------------- */
function normalizePhone(p) {
  if (!p) return ''
  return String(p).replace(/\s|-|\(|\)/g, '').replace(/^00/, '+').replace(/^\+/, '')
}

/* -------------------------------------------------------------------------- */
/*  Period helper                                                             */
/* -------------------------------------------------------------------------- */
function periodToDateRange(period) {
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

function formatPeriodFR(period) {
  const map = {
    today: 'aujourd\'hui',
    yesterday: 'hier',
    week: 'les 7 derniers jours',
    month: 'ce mois-ci',
    year: 'cette annee',
  }
  return map[period] || 'les 7 derniers jours'
}

/* -------------------------------------------------------------------------- */
/*  Tool implementations — all receive (supabase, clientId, args)             */
/* -------------------------------------------------------------------------- */

async function getTicketsStats(supabase, clientId, { period = 'week' } = {}) {
  const { start, end } = periodToDateRange(period)

  const [totalRes, autoRes] = await Promise.all([
    supabase.from('automation_events').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).gte('created_at', start).lte('created_at', end),
    supabase.from('automation_events').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).gte('created_at', start).lte('created_at', end)
      .eq('handled_by', 'ai'),
  ])

  const total = totalRes.count || 0
  const auto = autoRes.count || 0
  const manual = Math.max(total - auto, 0)
  const autoRate = total > 0 ? Math.round((auto / total) * 100) : 0

  return {
    period: formatPeriodFR(period),
    total,
    auto,
    manual,
    auto_rate_percent: autoRate,
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

async function getReviewQueue(supabase, clientId, { limit = 3 } = {}) {
  const { data } = await supabase.from('engine_reviews')
    .select('id, reason, created_at, proposed_action')
    .eq('client_id', clientId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 10))

  const { count } = await supabase.from('engine_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('status', 'pending')

  return {
    total_pending: count || 0,
    samples: (data || []).map(r => ({
      id: r.id.slice(0, 6),
      reason: r.reason,
      created_at: r.created_at,
      preview: typeof r.proposed_action === 'object'
        ? JSON.stringify(r.proposed_action).slice(0, 140)
        : String(r.proposed_action || '').slice(0, 140),
    })),
  }
}

async function getRevenueRecovered(supabase, clientId, { period = 'month' } = {}) {
  const { start, end } = periodToDateRange(period)

  // metrics_daily aggregates revenue_recovered_cents (abandoned cart + reviews)
  const { data } = await supabase.from('metrics_daily')
    .select('revenue_recovered_cents, carts_recovered, estimated_roi')
    .eq('client_id', clientId)
    .gte('day', start.slice(0, 10))
    .lte('day', end.slice(0, 10))

  const cents = (data || []).reduce((a, r) => a + (r.revenue_recovered_cents || 0), 0)
  const carts = (data || []).reduce((a, r) => a + (r.carts_recovered || 0), 0)
  const roi = (data || []).reduce((a, r) => a + (r.estimated_roi || 0), 0)

  return {
    period: formatPeriodFR(period),
    revenue_recovered_eur: Math.round(cents / 100),
    carts_recovered: carts,
    estimated_roi_eur: Math.round(roi),
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

async function addToKnowledgeBase(supabase, clientId, { title, content }) {
  if (!title || !content) return { ok: false, error: 'title et content requis' }
  const { data, error } = await supabase.from('client_knowledge_base').insert({
    client_id: clientId,
    title: title.slice(0, 200),
    content: content.slice(0, 2000),
    category: 'faq',
    source: 'whatsapp',
    is_active: true,
  }).select('id').single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, id: data.id.slice(0, 4) }
}

async function getClientInfo(supabase, clientId) {
  const { data } = await supabase.from('clients')
    .select('brand_name, plan, trial_ends_at, contact_email, website_url, industry')
    .eq('id', clientId).maybeSingle()
  return data || {}
}

async function getRecentConversations(supabase, clientId, { limit = 5 } = {}) {
  const { data } = await supabase.from('whatsapp_messages')
    .select('direction, customer_phone, body, created_at, status')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 15))
  return {
    messages: (data || []).map(m => ({
      direction: m.direction,
      phone: m.customer_phone,
      preview: (m.body || '').slice(0, 120),
      at: m.created_at,
      status: m.status,
    })),
  }
}

/* -------------------------------------------------------------------------- */
/*  Tool registry + schemas for Claude                                        */
/* -------------------------------------------------------------------------- */

const TOOLS = [
  {
    name: 'get_tickets_stats',
    description: "Renvoie les statistiques des tickets SAV traites par l'agent IA pour une periode donnee. Utilise-la quand l'utilisateur demande combien de tickets ont ete traites/resolus, le taux d'automatisation, etc.",
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'yesterday', 'week', 'month', 'year'], description: 'Periode. Defaut: week.' },
      },
    },
  },
  {
    name: 'get_engine_stats',
    description: "Renvoie les statistiques du moteur Actero: nombre de runs, taux de succes, confiance moyenne de l'IA, temps de traitement moyen.",
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'yesterday', 'week', 'month', 'year'] },
      },
    },
  },
  {
    name: 'get_integrations_status',
    description: "Renvoie l'etat des integrations connectees (Shopify, Gmail, Gorgias, etc.) et les erreurs eventuelles. Utilise-la quand l'utilisateur demande si Shopify marche, si Gmail est connecte, ou en cas de probleme d'integration.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_review_queue',
    description: "Renvoie le nombre de conversations en attente de validation humaine (Manual Review) et un apercu des dernieres.",
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Nombre d\'exemples a retourner (max 10, defaut 3)' },
      },
    },
  },
  {
    name: 'get_revenue_recovered',
    description: "Renvoie le chiffre d'affaires recupere (paniers abandonnes relances, reviews transformees) et le ROI estime pour une periode.",
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'yesterday', 'week', 'month', 'year'] },
      },
    },
  },
  {
    name: 'get_top_topics',
    description: "Renvoie le top des sujets/classifications les plus frequents dans les conversations SAV sur une periode.",
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'yesterday', 'week', 'month', 'year'] },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'search_knowledge_base',
    description: "Cherche dans la base de connaissances du client par mot-cle. Utile quand l'utilisateur demande ce qui est dans sa base ou veut verifier une info.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Mots-cles a rechercher' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'add_to_knowledge_base',
    description: "Ajoute une nouvelle entree a la base de connaissances du client. L'agent IA pourra ensuite l'utiliser pour repondre aux clients finaux.",
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'La question / titre' },
        content: { type: 'string', description: 'La reponse / contenu' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'get_client_info',
    description: "Renvoie les infos de compte du client: nom de marque, plan, fin d'essai, site web, industrie.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_recent_conversations',
    description: "Renvoie les derniers messages WhatsApp echanges (in/out) avec les clients finaux.",
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
  },
]

async function executeTool(supabase, clientId, name, args) {
  switch (name) {
    case 'get_tickets_stats': return getTicketsStats(supabase, clientId, args)
    case 'get_engine_stats': return getEngineStats(supabase, clientId, args)
    case 'get_integrations_status': return getIntegrationsStatus(supabase, clientId)
    case 'get_review_queue': return getReviewQueue(supabase, clientId, args)
    case 'get_revenue_recovered': return getRevenueRecovered(supabase, clientId, args)
    case 'get_top_topics': return getTopTopics(supabase, clientId, args)
    case 'search_knowledge_base': return searchKnowledgeBase(supabase, clientId, args)
    case 'add_to_knowledge_base': return addToKnowledgeBase(supabase, clientId, args)
    case 'get_client_info': return getClientInfo(supabase, clientId)
    case 'get_recent_conversations': return getRecentConversations(supabase, clientId, args)
    default: return { error: `Outil inconnu: ${name}` }
  }
}

/* -------------------------------------------------------------------------- */
/*  System prompt                                                             */
/* -------------------------------------------------------------------------- */

function buildSystemPrompt(clientName) {
  return `Tu es Actero Copilot, l'assistant IA du dirigeant de "${clientName}". Tu reponds sur WhatsApp, en francais, en langage naturel.

ROLE:
- Tu aides le dirigeant a piloter son agent SAV Actero et ses integrations depuis son WhatsApp.
- Tu repond aux questions metier: combien de tickets, quel ROI, l'integration Shopify marche, etc.
- Tu peux ajouter des entrees a la base de connaissances si demande.

STYLE (tres important pour WhatsApp):
- Tres concis. Pas de bullet points longs. Pas de markdown lourd.
- Ton amical mais pro (tutoiement OK).
- Messages courts (3-6 lignes max idealement). Va droit au but.
- Utilise des emojis simples avec parcimonie (📊 ✅ ⚠️ 🎯).
- Jamais de "Je vais chercher" ou "Un instant" — tu utilises directement les outils.

OUTILS:
- Utilise toujours les outils pour donner des chiffres precis (jamais d'invention).
- Si la question couvre plusieurs metriques, appelle plusieurs outils en parallele.
- Si l'outil renvoie 0 ou vide, explique-le plutot que d'inventer.

INTERPRETATION:
- "Aujourd'hui" = today. "Hier" = yesterday. "Cette semaine" = week. "Ce mois" = month.
- Si periode non precisee, demande ou choisis week par defaut.
- "Commandes" dans le contexte Actero = tickets SAV (pas des commandes e-commerce).

EXEMPLES DE REPONSES IDEALES:
Question: "Ca va le SAV cette semaine ?"
Reponse: "47 tickets traites, 38 automatiquement par l'IA (81% 🎯). Temps moyen 2 min 15s. 3 conversations en attente de validation."

Question: "Shopify marche ?"
Reponse: "Oui ✅ Shopify est connectee, derniere sync il y a 4 min. Rien a signaler."

Question: "Ajoute dans la base: delais de livraison 3-5 jours"
Reponse apres outil: "Ajoute ✅ (ref abcd). L'agent l'utilisera pour repondre aux clients."

JAMAIS:
- Pas de tokens, pas de cles API, pas de donnees sensibles dans la reponse.
- Pas d'info sur d'autres clients Actero.
- Pas de conseil juridique ou financier.`
}

/* -------------------------------------------------------------------------- */
/*  Main handler — to be called from webhook                                  */
/* -------------------------------------------------------------------------- */

export async function tryHandleAdminNL(supabase, { clientId, fromPhone, message }) {
  const text = (message || '').trim()
  if (!text) return null
  // Slash commands are handled by the legacy module — skip here.
  if (text.startsWith('/')) return null

  // Admin whitelist check (same logic as tryHandleAdminCommand).
  const { data: settings } = await supabase
    .from('client_settings')
    .select('whatsapp_admin_phones')
    .eq('client_id', clientId)
    .maybeSingle()

  const admins = Array.isArray(settings?.whatsapp_admin_phones) ? settings.whatsapp_admin_phones : []
  const normFrom = normalizePhone(fromPhone)
  const isAdmin = admins.some((p) => normalizePhone(p) === normFrom)
  if (!isAdmin) return null

  // Fetch client brand name for the system prompt.
  const { data: client } = await supabase
    .from('clients')
    .select('brand_name')
    .eq('id', clientId)
    .maybeSingle()
  const brandName = client?.brand_name || 'votre boutique'

  if (!process.env.ANTHROPIC_API_KEY) {
    return { reply: 'Le Copilot IA n\'est pas configure (ANTHROPIC_API_KEY manquant). Utilise /help pour voir les commandes classiques.' }
  }

  try {
    const messages = [{ role: 'user', content: text }]
    let loop = 0
    const MAX_LOOPS = 4 // Claude can call tools up to 4 times per request

    while (loop++ < MAX_LOOPS) {
      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: buildSystemPrompt(brandName),
        tools: TOOLS,
        messages,
      })

      // Collect tool_use blocks
      const toolUses = (resp.content || []).filter(b => b.type === 'tool_use')

      if (toolUses.length === 0) {
        // Final text response
        const textBlocks = (resp.content || []).filter(b => b.type === 'text')
        const reply = textBlocks.map(b => b.text).join('\n').trim()
        return { reply: reply || 'Ok.' }
      }

      // Append assistant turn (with all content blocks) and execute tools
      messages.push({ role: 'assistant', content: resp.content })

      const toolResults = await Promise.all(
        toolUses.map(async (tu) => {
          try {
            const result = await executeTool(supabase, clientId, tu.name, tu.input || {})
            return {
              type: 'tool_result',
              tool_use_id: tu.id,
              content: JSON.stringify(result),
            }
          } catch (err) {
            return {
              type: 'tool_result',
              tool_use_id: tu.id,
              content: JSON.stringify({ error: err.message || 'tool execution failed' }),
              is_error: true,
            }
          }
        }),
      )

      messages.push({ role: 'user', content: toolResults })
    }

    return { reply: 'Desole, je n\'ai pas pu aboutir a une reponse (limite d\'outils atteinte).' }
  } catch (err) {
    console.error('[whatsapp-ai-admin] error:', err.message)
    return { reply: `Desole, erreur cote IA: ${err.message.slice(0, 120)}` }
  }
}
