/**
 * Vercel Cron — Improvement Loop (weekly)
 *
 * For each active client: gather the last 30 days of cases the agent did NOT
 * auto-resolve (escalated / negative feedback) + the current KB, ask the LLM to
 * cluster recurring themes and draft a ready-to-use KB entry per theme, and
 * upsert each as a pending `ai_recommendations` row (category='kb_gap', deduped
 * by fingerprint). The merchant approves in the dashboard (see
 * api/client/apply-recommendation.js).
 *
 * Auth: Vercel Cron header OR Authorization: Bearer <CRON_SECRET>
 */
import { createClient } from '@supabase/supabase-js'
import { withCronMonitor } from '../lib/cron-monitor.js'
import { chatComplete } from '../lib/llm.js'
import { buildMinerPrompt, parseSuggestions, computeFingerprint } from '../lib/improvement-loop-core.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export const maxDuration = 60

const MIN_OCCURRENCES = 3
const LOOKBACK_DAYS = 30
const RECO_TTL_DAYS = 14

async function gatherCases(clientId, sinceIso) {
  // Escalated + negatively-rated events. The customer question lives in
  // metadata.customer_message when present, else the event_title snippet.
  const { data: events } = await supabase
    .from('automation_events')
    .select('event_category, event_title, metadata, created_at')
    .eq('client_id', clientId)
    .or('event_category.eq.ticket_escalated,feedback.eq.negative')
    .gte('created_at', sinceIso)
    .limit(200)

  return (events || [])
    .map((e) => ({
      question: e.metadata?.customer_message || e.event_title || '',
      humanReply: e.metadata?.human_reply || '',
      id: e.metadata?.event_id || null,
    }))
    .filter((c) => c.question)
}

async function processClient(client, sinceIso) {
  const cases = await gatherCases(client.id, sinceIso)
  if (cases.length < MIN_OCCURRENCES) return { client_id: client.id, skipped: 'not_enough_cases' }

  const { data: kb } = await supabase
    .from('client_knowledge_base')
    .select('title')
    .eq('client_id', client.id)
    .eq('is_active', true)
    .limit(200)
  const existingTitles = (kb || []).map((k) => k.title).filter(Boolean)

  const { text } = await chatComplete({
    system: buildMinerPrompt({ cases, existingTitles }),
    messages: [{ role: 'user', content: 'Analyse les demandes ci-dessus et renvoie les suggestions en JSON.' }],
    maxTokens: 1500,
    json: true,
  })
  const suggestions = parseSuggestions(text).filter((s) => s.occurrences >= MIN_OCCURRENCES)

  const expiresAt = new Date(Date.now() + RECO_TTL_DAYS * 86400_000).toISOString()
  let upserted = 0
  for (const s of suggestions) {
    const fingerprint = computeFingerprint(s.theme)
    // Skip if an open or already-implemented reco exists for this theme.
    const { data: existing } = await supabase
      .from('ai_recommendations')
      .select('id, status')
      .eq('client_id', client.id)
      .eq('fingerprint', fingerprint)
      .in('status', ['pending', 'implemented'])
      .maybeSingle()
    if (existing) continue

    const { error } = await supabase.from('ai_recommendations').insert({
      client_id: client.id,
      category: 'kb_gap',
      title: s.kb_title,
      description: `${s.occurrences} demandes similaires que l'agent n'a pas su traiter — voici l'entrée à ajouter à ta base.`,
      impact_score: Math.min(100, s.occurrences * 10),
      estimated_time_gain_minutes: s.estimated_time_gain_minutes,
      evidence: {
        kb_title: s.kb_title,
        kb_content: s.kb_content,
        occurrences: s.occurrences,
        conversation_ids: s.evidence_conversation_ids,
      },
      status: 'pending',
      fingerprint,
      expires_at: expiresAt,
      source_version: 'improvement-loop-v1',
    })
    if (!error) upserted++
  }
  return { client_id: client.id, cases: cases.length, suggestions: suggestions.length, upserted }
}

async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  const provided = req.headers['authorization']?.replace('Bearer ', '') || req.query?.secret
  const isVercelCron = req.headers['x-vercel-cron']
  if (!isVercelCron && cronSecret && provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString()
  const { data: clients } = await supabase.from('clients').select('id').limit(500)

  const results = []
  for (const client of clients || []) {
    try {
      results.push(await processClient(client, sinceIso))
    } catch (err) {
      results.push({ client_id: client.id, error: err.message })
    }
  }
  return res.status(200).json({ ok: true, processed: results.length, results })
}

export default withCronMonitor('cron-improvement-loop', '0 6 * * 1', handler)
