/**
 * Actero Engine — Gorgias Webhook Receiver
 *
 * Receives ticket events from Gorgias (ticket-created, ticket-message-created)
 * and routes them to the processing pipeline.
 *
 * Setup in Gorgias: Settings → Integrations → HTTP Integration
 * URL: https://actero.fr/api/engine/webhooks/gorgias?client_id=UUID
 */
import { withSentry } from '../../lib/sentry.js'
import { decryptToken } from '../../lib/crypto.js'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { normalizeEvent } from '../lib/normalizer.js'
import { loadPlaybook } from '../lib/playbook-loader.js'
import { runBrain } from '../brain.js'
import { runExecutor } from '../executor.js'
import { logRun } from '../logger.js'
import { uploadToStorage } from '../../vision/lib/ingress.js'

// Constant-time secret comparison to prevent timing-attack token recovery.
function timingSafeEqStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const clientId = req.query?.client_id
  if (!clientId) return res.status(400).json({ error: 'client_id query param required' })

  // Header only — query strings leak into Vercel/proxy/Sentry logs.
  const providedSecret = req.headers['x-actero-webhook-secret']
  if (!providedSecret) return res.status(401).json({ error: 'Missing webhook secret' })

  // Per-client secret — chaque Gorgias OAuth install génère un secret de
  // 32 octets, stockés chiffrés dans client_integrations.webhook_secret_encrypted
  // (ACT-25 — ils vivaient dans extra_config, que le navigateur peut lire).
  // Repli sur GORGIAS_WEBHOOK_SECRET pour les installations historiques.
  const { data: integ } = await supabase
    .from('client_integrations')
    .select('extra_config, webhook_secret_encrypted')
    .eq('client_id', clientId)
    .eq('provider', 'gorgias')
    .eq('status', 'active')
    .maybeSingle()

  // Le secret vit dans sa propre colonne, chiffrée et fermée au navigateur.
  // Le repli sur extra_config couvre les lignes écrites avant ACT-25 ;
  // decryptToken laisse passer une valeur encore en clair.
  const expectedSecret = decryptToken(integ?.webhook_secret_encrypted)
    || integ?.extra_config?.webhook_secret
    || process.env.GORGIAS_WEBHOOK_SECRET
  if (!expectedSecret || !timingSafeEqStr(providedSecret, expectedSecret)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Gorgias sends different event types
  const event = req.body
  const eventType = event?.type || event?.event

  // We only care about customer messages (not agent replies)
  // Gorgias webhook payload varies, normalize it:
  let ticketId, customerEmail, customerName, subject, messageBody, rawAttachments = []

  if (event?.ticket) {
    // Ticket-level event
    ticketId = String(event.ticket.id)
    customerEmail = event.ticket.customer?.email
    customerName = event.ticket.customer?.name
    subject = event.ticket.subject
    // Get the latest customer message
    const lastCustomerMsg = event.ticket.messages
      ?.filter(m => m.source?.type === 'email' && !m.from_agent)
      ?.pop()
    messageBody = lastCustomerMsg?.body_text || lastCustomerMsg?.stripped_text || event.ticket.messages?.[0]?.body_text
    rawAttachments = Array.isArray(lastCustomerMsg?.attachments) ? lastCustomerMsg.attachments : []
  } else if (event?.message) {
    // Message-level event
    ticketId = String(event.message.ticket_id || event.ticket_id)
    customerEmail = event.message.sender?.email
    customerName = event.message.sender?.name
    messageBody = event.message.body_text || event.message.stripped_text
    subject = event.message.subject
    rawAttachments = Array.isArray(event.message.attachments) ? event.message.attachments : []
  }

  // Skip if it's an agent reply (not a customer message)
  if (event?.message?.from_agent === true) {
    return res.status(200).json({ skipped: true, reason: 'Agent message, not customer' })
  }

  if (!messageBody) {
    return res.status(200).json({ skipped: true, reason: 'No message body found' })
  }

  // Strip HTML from message body
  const cleanMessage = messageBody
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleanMessage) {
    return res.status(200).json({ skipped: true, reason: 'Empty message after cleaning' })
  }

  // Insert into engine_messages
  const { data: engineMessage, error: insertError } = await supabase
    .from('engine_messages')
    .insert({
      client_id: clientId,
      source: 'gorgias',
      external_ticket_id: ticketId,
      customer_email: customerEmail,
      customer_name: customerName,
      subject,
      message_body: cleanMessage,
      metadata: { gorgias_event_type: eventType, raw_ticket_id: ticketId },
      status: 'received',
    })
    .select()
    .single()

  if (insertError) {
    console.error('[engine/webhooks/gorgias] Insert error:', insertError)
    return res.status(500).json({ error: 'Failed to store message' })
  }

  // Upload image attachments (URL-based from Gorgias)
  let uploadedImages = []
  try {
    const imageAttachments = rawAttachments.filter(a => {
      const mime = a?.content_type || a?.contentType || ''
      return typeof mime === 'string' && mime.startsWith('image/')
    })
    if (imageAttachments.length > 0) {
      const images = imageAttachments
        .map(a => (a.url ? { url: a.url } : null))
        .filter(Boolean)
      if (images.length > 0) {
        uploadedImages = await uploadToStorage({
          supabase,
          clientId,
          ticketId,
          images,
        })
      }
    }
  } catch (err) {
    console.warn('[engine/webhooks/gorgias] image upload failed (non-fatal):', err.message)
  }

  // Process via le pipeline V2 (Brain -> Executor -> Logger), comme le widget
  // et l'email entrant : classification, routage vers un agent spécialisé,
  // garde-fous d'escalade (references inventees, demande d'humain...).
  //
  // On réutilise normalizeGorgias (api/engine/lib/normalizer.js) — écrit et
  // enregistré pour cette source mais encore jamais invoqué — sur l'event
  // brut Gorgias. Il ne couvre que la forme "ticket complet"
  // (payload.ticket.messages[...]) ; le parsing défensif ci-dessus gère en
  // plus la forme "message seul" (event.message), l'agent-reply skip et le
  // nettoyage HTML. On écrase donc les champs du normalisé avec cette
  // extraction déjà validée — même pattern que webhooks/widget.js qui
  // surcharge `normalized.first_message` / `normalized.customer_email`
  // après coup.
  try {
    const normalized = normalizeEvent('ticket_gorgias', event)
    normalized.customer_email = customerEmail
    normalized.customer_name = customerName
    normalized.subject = subject
    normalized.message = cleanMessage
    normalized.ticket_id = ticketId
    normalized.images = uploadedImages

    const playbook = await loadPlaybook(supabase, clientId, 'ticket_gorgias')
    if (!playbook) {
      return res.status(200).json({ message_id: engineMessage.id, status: 'no_playbook' })
    }

    const { data: engineEvent } = await supabase.from('engine_events').insert({
      client_id: clientId,
      event_type: 'ticket_gorgias',
      source: 'gorgias',
      payload: { ticket_id: ticketId, subject, message: cleanMessage, gorgias_event_type: eventType },
      normalized,
      playbook_id: playbook.id,
      status: 'processing',
    }).select().single()

    const startTime = Date.now()

    const brainResult = await runBrain(supabase, {
      event: engineEvent || { id: engineMessage.id, source: 'gorgias' },
      playbook,
      clientId,
      normalized,
    })

    let executorResult = { success: true, steps: [], error: null }

    if (!brainResult.needsReview) {
      executorResult = await runExecutor(supabase, {
        event: engineEvent || engineMessage,
        playbook,
        clientId,
        normalized,
        brainResult,
      })

      await logRun(supabase, {
        clientId,
        eventId: engineEvent?.id,
        playbookId: playbook.id,
        status: executorResult.success ? 'completed' : 'failed',
        classification: brainResult.classification,
        confidence: brainResult.confidence,
        actionPlan: brainResult.actionPlan,
        steps: executorResult.steps,
        durationMs: Date.now() - startTime,
        error: executorResult.error,
        normalized,
        aiResponse: brainResult.aiResponse,
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

      if (engineEvent) {
        await supabase.from('engine_events').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('id', engineEvent.id)
      }
    } else {
      const runResult = await logRun(supabase, {
        clientId,
        eventId: engineEvent?.id,
        playbookId: playbook.id,
        status: 'needs_review',
        classification: brainResult.classification,
        confidence: brainResult.confidence,
        actionPlan: brainResult.actionPlan,
        steps: [],
        durationMs: Date.now() - startTime,
        normalized,
        aiResponse: brainResult.aiResponse,
        agentUsed: brainResult.agentUsed || null,
        tokensIn: brainResult.usage?.tokensIn,
        tokensOut: brainResult.usage?.tokensOut,
        costUsd: brainResult.usage?.costUsd,
        modelId: brainResult.usage?.modelId,
        errorMessage: brainResult.errorMessage || null,
      })

      if (runResult?.id) {
        try {
          await supabase.from('engine_reviews_v2').insert({
            run_id: runResult.id,
            client_id: clientId,
            event_id: engineEvent?.id,
            proposed_action: { classification: brainResult.classification, action_plan: brainResult.actionPlan, ai_response: brainResult.aiResponse },
            reason: brainResult.reviewReason || 'aggressive',
            status: 'pending',
          })
        } catch (err) {
          console.error('[engine/webhooks/gorgias] engine_reviews_v2 insert error:', err.message)
        }
      }

      if (engineEvent) {
        await supabase.from('engine_events').update({ status: 'needs_review', processed_at: new Date().toISOString() }).eq('id', engineEvent.id)
      }
    }

    return res.status(200).json({
      message_id: engineMessage.id,
      status: brainResult.needsReview ? 'escalated' : (executorResult.success ? 'processed' : 'failed'),
      confidence: brainResult.confidence,
    })
  } catch (err) {
    console.error('[engine/webhooks/gorgias] Processing error:', err)
    await supabase
      .from('engine_messages')
      .update({ status: 'failed', error_message: err.message })
      .eq('id', engineMessage.id)

    return res.status(500).json({ error: err.message })
  }
}

export default withSentry(handler)
