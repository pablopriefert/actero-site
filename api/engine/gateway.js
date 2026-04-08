/**
 * Actero Engine V2 — Event Gateway
 *
 * Point d'entrée unique du moteur. Reçoit tous les événements,
 * les normalise, les stocke, et lance le pipeline Brain → Executor.
 *
 * POST /api/engine/gateway
 */
import { createClient } from '@supabase/supabase-js'
import { normalizeEvent } from './lib/normalizer.js'
import { loadPlaybook } from './lib/playbook-loader.js'
import { runBrain } from './brain.js'
import { runExecutor } from './executor.js'
import { logRun } from './logger.js'
import { checkRateLimit } from './lib/rate-limiter.js'

const ENGINE_SECRET = process.env.ENGINE_WEBHOOK_SECRET
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // --- Auth ---
  const secret = req.headers['x-engine-secret'] || req.headers['x-internal-secret']
  const apiKey = req.query?.api_key
  if (secret !== ENGINE_SECRET && secret !== INTERNAL_SECRET && !apiKey) {
    return res.status(401).json({ error: 'Non autorise' })
  }

  const { client_id, event_type, source, ...payload } = req.body || {}
  if (!client_id) return res.status(400).json({ error: 'client_id requis' })

  const eventType = event_type || source || 'api_direct'
  const eventSource = source || 'api_direct'

  // --- Rate limit ---
  const rateCheck = await checkRateLimit(supabase, { clientId: client_id, customerEmail: payload.customer_email })
  if (!rateCheck.allowed) return res.status(429).json({ error: rateCheck.reason })

  // --- Verify client ---
  const { data: client } = await supabase.from('clients').select('id, brand_name, client_type').eq('id', client_id).single()
  if (!client) return res.status(404).json({ error: 'Client non trouve' })

  const startTime = Date.now()

  try {
    // --- 1. Normalize ---
    const normalized = normalizeEvent(eventType, payload)

    // --- 2. Find playbook ---
    const playbook = await loadPlaybook(supabase, client_id, eventType)
    if (!playbook) {
      return res.status(200).json({
        status: 'no_playbook',
        message: `Aucun playbook actif pour le type "${eventType}". Activez un playbook dans votre dashboard.`,
      })
    }

    // --- 3. Store event ---
    const { data: event, error: eventError } = await supabase
      .from('engine_events')
      .insert({
        client_id,
        event_type: eventType,
        source: eventSource,
        payload,
        normalized,
        playbook_id: playbook.id,
        status: 'processing',
      })
      .select()
      .single()

    if (eventError) throw new Error(`Event insert failed: ${eventError.message}`)

    // --- 4. Run Brain ---
    const brainResult = await runBrain(supabase, {
      event,
      playbook,
      clientId: client_id,
      normalized,
    })

    // --- 5. Execute or Review ---
    let runResult
    if (brainResult.needsReview) {
      // Manual Review
      runResult = await logRun(supabase, {
        clientId: client_id,
        eventId: event.id,
        playbookId: playbook.id,
        status: 'needs_review',
        classification: brainResult.classification,
        confidence: brainResult.confidence,
        actionPlan: brainResult.actionPlan,
        steps: [],
        durationMs: Date.now() - startTime,
      })

      // Create review entry
      await supabase.from('engine_reviews_v2').insert({
        run_id: runResult.id,
        client_id,
        event_id: event.id,
        proposed_action: { classification: brainResult.classification, action_plan: brainResult.actionPlan, ai_response: brainResult.aiResponse },
        reason: brainResult.reviewReason,
        status: 'pending',
      })

      // Update event status
      await supabase.from('engine_events').update({ status: 'needs_review', processed_at: new Date().toISOString() }).eq('id', event.id)

    } else {
      // Execute action plan
      const executorResult = await runExecutor(supabase, {
        event,
        playbook,
        clientId: client_id,
        normalized,
        brainResult,
      })

      // Log the run
      runResult = await logRun(supabase, {
        clientId: client_id,
        eventId: event.id,
        playbookId: playbook.id,
        status: executorResult.success ? 'completed' : 'failed',
        classification: brainResult.classification,
        confidence: brainResult.confidence,
        actionPlan: brainResult.actionPlan,
        steps: executorResult.steps,
        durationMs: Date.now() - startTime,
        error: executorResult.error,
      })

      // Update event status
      await supabase.from('engine_events').update({
        status: executorResult.success ? 'completed' : 'failed',
        processed_at: new Date().toISOString(),
      }).eq('id', event.id)

      // Update playbook stats
      await supabase.from('engine_client_playbooks')
        .update({ runs_count: playbook.runs_count ? playbook.runs_count + 1 : 1, last_run_at: new Date().toISOString() })
        .eq('client_id', client_id)
        .eq('playbook_id', playbook.id)
    }

    return res.status(200).json({
      event_id: event.id,
      run_id: runResult?.id,
      status: brainResult.needsReview ? 'needs_review' : 'completed',
      classification: brainResult.classification,
      confidence: brainResult.confidence,
      response: brainResult.aiResponse,
      steps_executed: brainResult.needsReview ? 0 : (brainResult.actionPlan || []).length,
      duration_ms: Date.now() - startTime,
    })

  } catch (err) {
    console.error('[engine/gateway] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
