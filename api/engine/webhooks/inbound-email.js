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
import { withSentry } from '../../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { normalizeEvent } from '../lib/normalizer.js'
import { loadPlaybook } from '../lib/playbook-loader.js'
import { runBrain } from '../brain.js'
import { runExecutor } from '../executor.js'
import { logRun } from '../logger.js'
import { checkRateLimit } from '../lib/rate-limiter.js'
import { cleanEmailBody, isExcludedSender, shouldAutoReply } from '../../lib/email.js'
import { uploadToStorage } from '../../vision/lib/ingress.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth: require engine secret or internal secret
  const secret = req.headers['x-engine-secret'] || req.headers['x-internal-secret']
  const ENGINE_SECRET = process.env.ENGINE_WEBHOOK_SECRET
  const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET
  const isAuthed = (ENGINE_SECRET && secret === ENGINE_SECRET) || (INTERNAL_SECRET && secret === INTERNAL_SECRET)
  if (!isAuthed) return res.status(401).json({ error: 'Non autorise' })

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

  // Fetch client email-agent settings up-front (used for exclusions + auto-reply logic)
  const { data: clientSettings } = await supabase
    .from('client_settings')
    .select('email_agent_enabled, email_auto_reply_enabled, email_confidence_threshold, email_quiet_hours_start, email_quiet_hours_end, email_exclusions, email_signature, email_attach_voice, email_send_delay_seconds')
    .eq('client_id', resolvedClientId)
    .maybeSingle()

  // Sender exclusions (internal domains, no-reply, etc.)
  const exclusions = Array.isArray(clientSettings?.email_exclusions)
    ? clientSettings.email_exclusions
    : []
  if (isExcludedSender(fromEmail, exclusions)) {
    return res.status(200).json({ status: 'excluded_sender', from: fromEmail })
  }

  // Clean HTML if present + strip quoted history + signatures via shared util
  textBody = cleanEmailBody(
    textBody.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim(),
  )

  // Threading headers — preserve for in-thread replies later
  const messageId = body.message_id || body.messageId || null
  const inReplyTo = body.in_reply_to || body.inReplyTo || null
  const refs = body.references || null

  // Rate limit
  const rateCheck = await checkRateLimit(supabase, { clientId: resolvedClientId, customerEmail: fromEmail })
  if (!rateCheck.allowed) return res.status(429).json({ error: rateCheck.reason })

  const startTime = Date.now()

  // Extract image attachments (Resend / SendGrid shape)
  // attachments: [{ filename, content: base64|url, content_type, url? }, ...]
  let uploadedImages = []
  try {
    const rawAttachments = Array.isArray(body.attachments) ? body.attachments : []
    const imageAttachments = rawAttachments.filter(a => {
      const mime = a?.content_type || a?.contentType || a?.type || ''
      return typeof mime === 'string' && mime.startsWith('image/')
    })

    if (imageAttachments.length > 0) {
      const images = imageAttachments.map(a => {
        const mime = a.content_type || a.contentType || a.type
        const filename = a.filename || a.name || ''
        const ext = (filename.split('.').pop() || mime.split('/').pop() || 'bin').toLowerCase()
        // If it's a URL reference
        if (a.url && !a.content) return { url: a.url }
        if (typeof a.content === 'string' && /^https?:\/\//i.test(a.content)) {
          return { url: a.content }
        }
        // Otherwise treat content as base64
        if (typeof a.content === 'string') {
          try {
            const buffer = Buffer.from(a.content, 'base64')
            return { buffer, mime, ext }
          } catch {
            return null
          }
        }
        return null
      }).filter(Boolean)

      if (images.length > 0) {
        const ticketRef = messageId || `email-${Date.now()}`
        try {
          uploadedImages = await uploadToStorage({
            supabase,
            clientId: resolvedClientId,
            ticketId: ticketRef,
            images,
          })
        } catch (uploadErr) {
          console.warn('[inbound-email] uploadToStorage failed (non-fatal):', uploadErr.message)
          uploadedImages = []
        }
      }
    }
  } catch (attachErr) {
    console.warn('[inbound-email] attachment extraction failed (non-fatal):', attachErr.message)
  }

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
      images: uploadedImages,
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

    // Respect email agent settings — maybe escalate even if Brain is confident
    // (quiet hours, agent disabled, low confidence vs user's threshold, etc.)
    const autoReplyCheck = shouldAutoReply({
      confidence: brainResult.confidence,
      settings: clientSettings,
    })
    const shouldEscalateBySettings = !autoReplyCheck.reply && !brainResult.needsReview

    // Store the inbound conversation with threading headers so replies thread correctly
    try {
      await supabase.from('ai_conversations').insert({
        client_id: resolvedClientId,
        customer_email: fromEmail,
        customer_name: fromName,
        customer_message: textBody,
        subject,
        ai_response: brainResult.aiResponse || null,
        status: (brainResult.needsReview || shouldEscalateBySettings) ? 'escalated' : 'resolved',
        escalation_reason: shouldEscalateBySettings ? autoReplyCheck.reason : (brainResult.reviewReason || null),
        email_message_id: messageId,
        email_references: refs || inReplyTo,
      })
    } catch (convErr) {
      console.warn('[inbound-email] ai_conversations insert failed (non-fatal):', convErr.message)
    }

    // Execute or Review
    let runResult
    if (brainResult.needsReview || shouldEscalateBySettings) {
      runResult = await logRun(supabase, {
        clientId: resolvedClientId, eventId: event.id, playbookId: playbook.id,
        status: 'needs_review', classification: brainResult.classification,
        confidence: brainResult.confidence, actionPlan: brainResult.actionPlan,
        steps: [], durationMs: Date.now() - startTime,
        normalized, aiResponse: brainResult.aiResponse,
        agentUsed: brainResult.agentUsed || null,
        tokensIn: brainResult.usage?.tokensIn,
        tokensOut: brainResult.usage?.tokensOut,
        costUsd: brainResult.usage?.costUsd,
        modelId: brainResult.usage?.modelId,
        errorMessage: brainResult.errorMessage || null,
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
        normalized, aiResponse: brainResult.aiResponse,
        agentUsed: brainResult.agentUsed || null,
        tokensIn: brainResult.usage?.tokensIn,
        tokensOut: brainResult.usage?.tokensOut,
        costUsd: brainResult.usage?.costUsd,
        modelId: brainResult.usage?.modelId,
        errorMessage: executorResult.success
          ? null
          : (typeof executorResult.error === 'string'
              ? executorResult.error
              : executorResult.error?.message || null),
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

export default withSentry(handler)
