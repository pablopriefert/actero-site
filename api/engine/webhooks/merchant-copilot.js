// Renamed from whatsapp-copilot.js — this is an internal merchant KPI assistant, unrelated to WhatsApp Business API.
/**
 * Actero Engine — Merchant Copilot
 *
 * An AI assistant for the CLIENT (not the end customer).
 * The client asks questions about their Actero data
 * and gets real-time answers based on their KPIs, escalations, etc.
 *
 * POST /api/engine/webhooks/merchant-copilot
 */
import { withSentry } from '../../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { client_id, message } = req.body
  if (!client_id || !message) return res.status(400).json({ error: 'client_id and message required' })

  // Auth: engine/internal secret (fail-closed on missing env) OR bearer token
  // with explicit client membership check to prevent IDOR.
  const secret = req.headers['x-engine-secret'] || req.headers['x-internal-secret']
  const ENGINE_SECRET = process.env.ENGINE_WEBHOOK_SECRET
  const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET
  const hasValidServerSecret =
    (ENGINE_SECRET && secret === ENGINE_SECRET) ||
    (INTERNAL_SECRET && secret === INTERNAL_SECRET)

  if (!hasValidServerSecret) {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Non autorise' })
    const { data: { user } = {}, error } = await supabase.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'Non autorise' })

    // Anti-IDOR: the caller must belong to the requested client
    const { data: membership } = await supabase
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('client_id', client_id)
      .maybeSingle()
    if (!membership) return res.status(403).json({ error: 'Acces refuse' })
  }

  try {
    // Gather all client data for context
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [clientRes, metricsRes, eventsRes, conversationsRes, engineMessagesRes, engineResponsesRes] = await Promise.all([
      supabase.from('clients').select('brand_name, client_type').eq('id', client_id).maybeSingle(),
      supabase.from('metrics_daily').select('*').eq('client_id', client_id).gte('date', thirtyDaysAgo).order('date', { ascending: false }),
      supabase.from('automation_events').select('event_category, time_saved_seconds, revenue_amount, created_at').eq('client_id', client_id).gte('created_at', sevenDaysAgo),
      supabase.from('ai_conversations').select('status, confidence_score, created_at').eq('client_id', client_id).gte('created_at', thirtyDaysAgo),
      supabase.from('engine_messages').select('source, status, created_at').eq('client_id', client_id).gte('created_at', thirtyDaysAgo),
      supabase.from('engine_responses').select('confidence_score, was_escalated, processing_time_ms, created_at').eq('client_id', client_id).gte('created_at', sevenDaysAgo),
    ])

    const client = clientRes.data
    const metrics = metricsRes.data || []
    const events = eventsRes.data || []
    const conversations = conversationsRes.data || []
    const engineMessages = engineMessagesRes.data || []
    const engineResponses = engineResponsesRes.data || []

    // Compute stats
    const totalEvents = events.length
    const resolved = events.filter(e => e.event_category === 'ticket_resolved').length
    const escalated = events.filter(e => e.event_category === 'ticket_escalated').length
    const timeSaved = events.reduce((s, e) => s + (e.time_saved_seconds || 0), 0)
    const revenue = events.reduce((s, e) => s + (e.revenue_amount || 0), 0)
    const autoResolveRate = (resolved + escalated) > 0 ? Math.round((resolved / (resolved + escalated)) * 100) : 0
    const avgConfidence = engineResponses.length > 0
      ? (engineResponses.reduce((s, r) => s + (r.confidence_score || 0), 0) / engineResponses.length).toFixed(2)
      : 'N/A'
    const avgProcessingMs = engineResponses.length > 0
      ? Math.round(engineResponses.reduce((s, r) => s + (r.processing_time_ms || 0), 0) / engineResponses.length)
      : 'N/A'

    // Build context
    const dataContext = `
DONNEES ACTERO POUR "${client?.brand_name || 'Client'}" (${client?.client_type || 'ecommerce'}):

Periode: 7 derniers jours
- Evenements total: ${totalEvents}
- Tickets resolus automatiquement: ${resolved}
- Tickets escalades: ${escalated}
- Taux de resolution auto: ${autoResolveRate}%
- Temps economise: ${Math.round(timeSaved / 60)} minutes (${Math.round(timeSaved / 3600)} heures)
- Revenus generes: ${revenue.toFixed(2)}€
- Confiance moyenne IA: ${avgConfidence}
- Temps de traitement moyen: ${avgProcessingMs}ms

Messages engine (30 jours): ${engineMessages.length}
Conversations IA (30 jours): ${conversations.length}
- Resolues: ${conversations.filter(c => c.status === 'resolved').length}
- Escaladees: ${conversations.filter(c => c.status === 'escalated').length}

Metriques quotidiennes recentes:
${metrics.slice(0, 7).map(m => `${m.date}: ${m.conversations_handled || 0} conversations, ${m.resolution_rate || 0}% resolution, ${m.time_saved_minutes || 0}min economisees`).join('\n')}
`

    // Call Claude
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: `Tu es l'assistant Actero du client "${client?.brand_name}". Tu as acces a toutes ses donnees de performance IA. Reponds de maniere concise et utile. Pas de markdown, pas d'emoji excessif. Reponds en francais. Si tu ne sais pas, dis-le.

${dataContext}`,
        messages: [{ role: 'user', content: message }],
      }),
    })

    if (!claudeRes.ok) throw new Error(`Claude ${claudeRes.status}`)
    const data = await claudeRes.json()
    const response = data?.content?.[0]?.text || 'Desole, je n\'ai pas pu generer une reponse.'

    return res.status(200).json({ response })
  } catch (err) {
    console.error('[merchant-copilot] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}

export default withSentry(handler)
