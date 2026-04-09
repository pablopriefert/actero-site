/**
 * Actero Engine — Inbound Email Webhook
 *
 * Receives forwarded emails and sends them to the Engine Gateway.
 * Compatible with:
 * - Resend Inbound Webhooks
 * - SendGrid Inbound Parse
 * - Custom email forwarding
 * - Manual POST
 *
 * POST /api/engine/webhooks/inbound-email?client_id=UUID
 */
import { createClient } from '@supabase/supabase-js'
import { normalizeEvent } from '../lib/normalizer.js'
import { loadPlaybook } from '../lib/playbook-loader.js'
import { runBrain } from '../brain.js'
import { runExecutor } from '../executor.js'
import { logRun } from '../logger.js'
import { checkRateLimit } from '../lib/rate-limiter.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const clientId = req.query?.client_id

  // Try to identify client from email address if no client_id
  let resolvedClientId = clientId

  if (!resolvedClientId) {
    // Try to match by the "to" email address against SMTP integrations
    const toEmail = req.body?.to || req.body?.headers?.to || req.body?.envelope?.to?.[0]
    if (toEmail) {
      const { data: integration } = await supabase
        .from('client_integrations')
        .select('client_id')
        .eq('provider', 'smtp_imap')
        .eq('status', 'active')
        .limit(10)

      if (integration) {
        for (const int of integration) {
          const { data: config } = await supabase
            .from('client_integrations')
            .select('extra_config')
            .eq('client_id', int.client_id)
            .eq('provider', 'smtp_imap')
            .single()
          if (config?.extra_config?.email === toEmail) {
            resolvedClientId = int.client_id
            break
          }
        }
      }
    }
  }

  if (!resolvedClientId) {
    return res.status(400).json({ error: 'client_id requis (query param ou email reconnu)' })
  }

  // Parse email from various formats
  const body = req.body || {}
  let fromEmail, fromName, subject, textBody

  // Resend inbound format
  if (body.from || body.sender) {
    fromEmail = body.from?.email || body.from || body.sender
    fromName = body.from?.name || ''
    subject = body.subject || ''
    textBody = body.text || body.body || body.html?.replace(/<[^>]*>/g, '') || ''
  }
  // SendGrid inbound parse format
  else if (body.envelope) {
    fromEmail = body.envelope?.from || body.from
    fromName = ''
    subject = body.subject || ''
    textBody = body.text || body.html?.replace(/<[^>]*>/g, '') || ''
  }
  // Generic format
  else {
    fromEmail = body.customer_email || body.email || body.from_email || body.from
    fromName = body.customer_name || body.from_name || ''
    subject = body.subject || ''
    textBody = body.message || body.text || body.body || ''
  }

  if (!textBody || !fromEmail) {
    return res.status(400).json({ error: 'Email vide ou expediteur manquant' })
  }

  // Clean HTML if present
  textBody = textBody.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

  // Rate limit
  const rateCheck = await checkRateLimit(supabase, { clientId: resolvedClientId, customerEmail: fromEmail })
  if (!rateCheck.allowed) return res.status(429).json({ error: rateCheck.reason })

  const startTime = Date.now()

  try {
    // Normalize
    const normalized = normalizeEvent('email_inbound', {
      from: fromEmail,
      from_name: fromName,
      subject,
      body: textBody,
      customer_email: fromEmail,
      customer_name: fromName,
      message: textBody,
    })

    // Find playbook
    const playbook = await loadPlaybook(supabase, resolvedClientId, 'email_inbound')
    if (!playbook) {
      return res.status(200).json({ status: 'no_playbook', message: 'Aucun playbook email actif pour ce client' })
    }

    // Store event
    const { data: event } = await supabase.from('engine_events').insert({
      client_id: resolvedClientId,
      event_type: 'email_inbound',
      source: 'inbound_email',
      payload: { from: fromEmail, subject, body: textBody.substring(0, 5000) },
      normalized,
      playbook_id: playbook.id,
      status: 'processing',
    }).select().single()

    // Run Brain
    const brainResult = await runBrain(supabase, {
      event, playbook, clientId: resolvedClientId, normalized,
    })

    // Execute or Review
    let runResult
    if (brainResult.needsReview) {
      runResult = await logRun(supabase, {
        clientId: resolvedClientId, eventId: event.id, playbookId: playbook.id,
        status: 'needs_review', classification: brainResult.classification,
        confidence: brainResult.confidence, actionPlan: brainResult.actionPlan,
        steps: [], durationMs: Date.now() - startTime,
      })

      await supabase.from('engine_reviews_v2').insert({
        run_id: runResult.id, client_id: resolvedClientId, event_id: event.id,
        proposed_action: { classification: brainResult.classification, action_plan: brainResult.actionPlan, ai_response: brainResult.aiResponse },
        reason: brainResult.reviewReason, status: 'pending',
      })

      await supabase.from('engine_events').update({ status: 'needs_review', processed_at: new Date().toISOString() }).eq('id', event.id)
    } else {
      const executorResult = await runExecutor(supabase, {
        event, playbook, clientId: resolvedClientId, normalized, brainResult,
      })

      runResult = await logRun(supabase, {
        clientId: resolvedClientId, eventId: event.id, playbookId: playbook.id,
        status: executorResult.success ? 'completed' : 'failed',
        classification: brainResult.classification, confidence: brainResult.confidence,
        actionPlan: brainResult.actionPlan, steps: executorResult.steps,
        durationMs: Date.now() - startTime, error: executorResult.error,
      })

      await supabase.from('engine_events').update({
        status: executorResult.success ? 'completed' : 'failed',
        processed_at: new Date().toISOString(),
      }).eq('id', event.id)
    }

    return res.status(200).json({
      status: brainResult.needsReview ? 'needs_review' : 'processed',
      classification: brainResult.classification,
      confidence: brainResult.confidence,
      from: fromEmail,
      subject,
      duration_ms: Date.now() - startTime,
    })

  } catch (err) {
    console.error('[inbound-email] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
