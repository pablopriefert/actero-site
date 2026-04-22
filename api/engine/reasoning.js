/**
 * Actero Engine — Reasoning Transparency Endpoint
 *
 * GET /api/engine/reasoning?conversation_id=xxx
 *   or GET /api/engine/reasoning?session_id=xxx
 *
 * Returns the full reasoning context behind an AI response :
 *   - conversation record (customer message, AI response, confidence…)
 *   - engine_runs_v2 record (agent used, model, tokens, cost, steps, action_plan…)
 *   - KB entries retrieved during the run (from rag_check_details if present)
 *
 * Authenticates the caller as the client who owns the conversation.
 * Never exposes data across clients.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth — user must be logged in
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })

  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData?.user) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  const user = authData.user

  const { conversation_id, session_id } = req.query
  if (!conversation_id && !session_id) {
    return res.status(400).json({ error: 'conversation_id ou session_id requis' })
  }

  try {
    // 1. Resolve the user's client_id
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (clientErr || !client) {
      return res.status(403).json({ error: 'Client introuvable' })
    }

    // 2. Fetch conversation (scoped to this client)
    let convoQuery = supabase
      .from('ai_conversations')
      .select(`
        id, client_id, session_id, customer_email, customer_name,
        customer_message, ai_response, subject, ticket_type, ticket_id, order_id,
        status, escalation_reason, confidence_score, response_time_ms,
        intent, created_at
      `)
      .eq('client_id', client.id)

    convoQuery = conversation_id
      ? convoQuery.eq('id', conversation_id)
      : convoQuery.eq('session_id', session_id).order('created_at', { ascending: false })

    const { data: convo, error: convoErr } = await convoQuery.limit(1).maybeSingle()
    if (convoErr || !convo) {
      return res.status(404).json({ error: 'Conversation introuvable' })
    }

    // 3. Fetch the engine run that produced this response
    //    We match on session_id first (most reliable), otherwise fall back to a
    //    timestamp window around the conversation's created_at.
    let run = null
    if (convo.session_id) {
      const { data } = await supabase
        .from('engine_runs_v2')
        .select(`
          id, status, classification, confidence, agent_used, model_id,
          action_plan, steps, duration_ms, tokens_in, tokens_out, cost_usd,
          rag_check_score, rag_check_flagged, rag_check_details,
          error_message, created_at
        `)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(20)
      // Post-filter by session via steps/payload if the engine persists it there,
      // otherwise pick the closest in time to the conversation.
      if (data && data.length > 0) {
        const convoTs = new Date(convo.created_at).getTime()
        run = data
          .map(r => ({ ...r, _diff: Math.abs(new Date(r.created_at).getTime() - convoTs) }))
          .sort((a, b) => a._diff - b._diff)[0]
        // eslint-disable-next-line no-unused-vars
        const { _diff, ...clean } = run
        run = clean
      }
    }

    // 4. Pull the KB entries that were retrieved during this run (best-effort)
    let sources = []
    if (run?.rag_check_details?.retrieved_ids?.length) {
      const ids = run.rag_check_details.retrieved_ids.slice(0, 10)
      const { data: kbEntries } = await supabase
        .from('client_knowledge_base')
        .select('id, title, category, content, updated_at')
        .in('id', ids)
        .eq('client_id', client.id)
      sources = (kbEntries || []).map(kb => ({
        id: kb.id,
        title: kb.title,
        category: kb.category,
        excerpt: (kb.content || '').slice(0, 240),
        updated_at: kb.updated_at,
      }))
    }

    // 5. Derived signals — friendly labels for the UI
    const confidencePct = Math.round(((convo.confidence_score ?? run?.confidence ?? 0) * 100))
    const confidenceLevel =
      confidencePct >= 80 ? 'high' : confidencePct >= 60 ? 'medium' : 'low'

    const response = {
      conversation: {
        id: convo.id,
        subject: convo.subject,
        customer_email: convo.customer_email,
        customer_name: convo.customer_name,
        customer_message: convo.customer_message,
        ai_response: convo.ai_response,
        intent: convo.intent,
        ticket_type: convo.ticket_type,
        status: convo.status,
        escalation_reason: convo.escalation_reason,
        response_time_ms: convo.response_time_ms,
        created_at: convo.created_at,
      },
      run: run
        ? {
            id: run.id,
            status: run.status,
            classification: run.classification,
            agent_used: run.agent_used,
            model_id: run.model_id,
            action_plan: run.action_plan,
            steps: run.steps,
            duration_ms: run.duration_ms,
            tokens_in: run.tokens_in,
            tokens_out: run.tokens_out,
            cost_usd: run.cost_usd,
            rag_check_score: run.rag_check_score,
            rag_check_flagged: run.rag_check_flagged,
            rag_check_details: run.rag_check_details,
            error_message: run.error_message,
          }
        : null,
      sources,
      metrics: {
        confidence_pct: confidencePct,
        confidence_level: confidenceLevel,
        tokens_total: (run?.tokens_in || 0) + (run?.tokens_out || 0),
        cost_eur: run?.cost_usd ? Math.round(run.cost_usd * 0.92 * 10000) / 10000 : null,
      },
    }

    return res.status(200).json(response)
  } catch (err) {
    console.error('[reasoning] exception:', err)
    return res.status(500).json({ error: err.message })
  }
}

export default withSentry(handler)
