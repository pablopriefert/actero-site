/**
 * POST /api/engine/backtest-classify  — DRY-RUN side-effect firewall.
 *
 * Internal server-to-server endpoint. The E2B ticket-backtest sandbox calls
 * this once per historical ticket to ask: "would Actero's brain have resolved
 * this message?". It runs ONLY inference (runBrain) — it NEVER invokes the
 * executor, never sends email/Slack, never writes to Shopify, and never
 * mutates ai_conversations or logs an actionable run. Pure read + classify.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} (same pattern as
 * api/cron/process-e2b-jobs.js — internal callers only).
 *
 * Body: { client_id, message }
 * Returns: { would_resolve, confidence, classification }
 *
 * `would_resolve` mirrors the live widget's "auto-resolved" definition
 * (api/engine/webhooks/widget.js): the widget executes the action only when
 * `!brainResult.needsReview`. So would_resolve = !needsReview AND a
 * classification was produced.
 */

import { createClient } from '@supabase/supabase-js'
import { withSentry } from '../lib/sentry.js'
import { normalizeEvent } from './lib/normalizer.js'
import { loadPlaybook } from './lib/playbook-loader.js'
import { runBrain } from './brain.js'

export const maxDuration = 60

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

function isAuthorised(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace(/^Bearer\s+/, '')
  return token && token === process.env.CRON_SECRET
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!isAuthorised(req)) {
    return res.status(401).json({ error: 'Unauthorised' })
  }

  const { client_id: clientId, message, provider, model } = req.body || {}
  if (!clientId || !message || typeof message !== 'string') {
    return res.status(400).json({ error: 'client_id and message are required' })
  }
  // Optional per-request LLM override so a backtest can compare providers
  // (e.g. Claude vs GPT-5.4-mini) on the exact same brain path.
  const llmOverride = (provider || model) ? { provider, model } : undefined

  try {
    // Same loader the live widget uses for inbound widget messages.
    const playbook = await loadPlaybook(supabase, clientId, 'widget_message')
    if (!playbook) {
      // No playbook → the live widget escalates to a human, so this would
      // NOT have been auto-resolved.
      return res.status(200).json({
        would_resolve: false,
        confidence: 0,
        classification: null,
      })
    }

    const normalized = normalizeEvent('widget_message', {
      customer_email: `backtest-${clientId}@dry-run.actero.fr`,
      customer_name: null,
      message,
      session_id: null,
      images: [],
    })
    // Mark as a test event so the brain skips product-recommendation lookups
    // and any test-gated side paths — pure classification only.
    normalized._is_test = true

    // ONLY inference. No engine_events row, no executor, no logRun, no review
    // insert, no engine_messages write. runBrain is pure inference + token
    // usage accounting (it never calls runExecutor / sends anything).
    const brainResult = await runBrain(supabase, {
      event: { id: null, source: 'web_widget' },
      playbook,
      clientId,
      normalized,
      conversationHistory: [],
      llmOverride,
    })

    // Mirror widget.js: the widget runs the executor (auto-resolves) only in
    // the `if (!brainResult.needsReview)` branch; otherwise it escalates.
    const wouldResolve =
      brainResult.needsReview !== true && !!brainResult.classification

    return res.status(200).json({
      would_resolve: wouldResolve,
      confidence: typeof brainResult.confidence === 'number' ? brainResult.confidence : null,
      classification: brainResult.classification || null,
    })
  } catch (err) {
    console.error('[backtest-classify] error:', err)
    // Fail closed: an inference error means we cannot claim a resolution.
    return res.status(200).json({
      would_resolve: false,
      confidence: 0,
      classification: null,
      error: err.message || 'classification_failed',
    })
  }
}

export default withSentry(handler)
