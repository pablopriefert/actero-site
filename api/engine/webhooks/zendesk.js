/**
 * Actero Engine — Zendesk Webhook Receiver
 *
 * Receives ticket events from Zendesk (ticket created/updated with new comment)
 * and routes them to the processing pipeline.
 *
 * Setup in Zendesk: Admin → Webhooks → Create webhook
 * URL: https://actero.fr/api/engine/webhooks/zendesk?client_id=UUID
 * Or via Zendesk Triggers pointing to this endpoint.
 */
import { withSentry } from '../../lib/sentry.js'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { normalizeEvent } from '../lib/normalizer.js'
import { loadPlaybook } from '../lib/playbook-loader.js'
import { runBrain } from '../brain.js'
import { runExecutor } from '../executor.js'
import { logRun } from '../logger.js'
import { decryptToken } from '../../lib/crypto.js'
import { uploadToStorage } from '../../vision/lib/ingress.js'

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

  // Per-client secret — chaque Zendesk OAuth install génère un secret de
  // 32 bytes stocké dans client_integrations.extra_config.webhook_secret.
  // On le lit pour ce client-là et on compare au secret reçu. Fallback sur
  // le secret global ZENDESK_WEBHOOK_SECRET pour les integrations legacy
  // (setup manuel dans Zendesk Admin) — sera retiré quand tous les clients
  // auront re-OAuth'd.
  const { data: integ } = await supabase
    .from('client_integrations')
    .select('extra_config, access_token, webhook_secret_encrypted')
    .eq('client_id', clientId)
    .eq('provider', 'zendesk')
    .eq('status', 'active')
    .maybeSingle()

  // Le secret vit dans sa propre colonne, chiffrée et fermée au navigateur.
  // Le repli sur extra_config couvre les lignes écrites avant ACT-25 ;
  // decryptToken laisse passer une valeur encore en clair.
  const expectedSecret = decryptToken(integ?.webhook_secret_encrypted)
    || integ?.extra_config?.webhook_secret
    || process.env.ZENDESK_WEBHOOK_SECRET
  if (!expectedSecret || !timingSafeEqStr(providedSecret, expectedSecret)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const event = req.body

  // Zendesk webhook/trigger payload normalization
  // Zendesk can send various formats depending on trigger configuration
  let ticketId, customerEmail, customerName, subject, messageBody, rawAttachments = []

  if (event?.ticket) {
    // Standard Zendesk trigger payload
    ticketId = String(event.ticket.id)
    customerEmail = event.ticket.requester?.email || event.ticket.via?.source?.from?.address
    customerName = event.ticket.requester?.name
    subject = event.ticket.subject || event.ticket.title
    // Latest comment
    messageBody = event.ticket.latest_comment?.body || event.ticket.description
    rawAttachments = Array.isArray(event.ticket.latest_comment?.attachments)
      ? event.ticket.latest_comment.attachments
      : []
  } else if (event?.id && event?.subject) {
    // Simplified payload (ticket object directly)
    ticketId = String(event.id)
    customerEmail = event.requester?.email || event.via?.source?.from?.address
    customerName = event.requester?.name
    subject = event.subject
    messageBody = event.latest_comment?.body || event.description
    rawAttachments = Array.isArray(event.latest_comment?.attachments)
      ? event.latest_comment.attachments
      : []
  } else {
    // Custom format — try to extract from flat structure
    ticketId = String(event?.ticket_id || event?.id || '')
    customerEmail = event?.requester_email || event?.customer_email
    customerName = event?.requester_name || event?.customer_name
    subject = event?.subject
    messageBody = event?.comment || event?.message || event?.body
    rawAttachments = Array.isArray(event?.attachments) ? event.attachments : []
  }

  // Skip agent/internal comments
  if (event?.ticket?.latest_comment?.public === false || event?.latest_comment?.public === false) {
    return res.status(200).json({ skipped: true, reason: 'Internal note, not customer message' })
  }

  if (!messageBody) {
    return res.status(200).json({ skipped: true, reason: 'No message body found' })
  }

  // Clean message
  const cleanMessage = messageBody
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
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
      source: 'zendesk',
      external_ticket_id: ticketId,
      customer_email: customerEmail,
      customer_name: customerName,
      subject,
      message_body: cleanMessage,
      metadata: { zendesk_ticket_id: ticketId },
      status: 'received',
    })
    .select()
    .single()

  if (insertError) {
    console.error('[engine/webhooks/zendesk] Insert error:', insertError)
    return res.status(500).json({ error: 'Failed to store message' })
  }

  // Upload image attachments. Zendesk's content_url requires Bearer auth —
  // fetch the bytes ourselves and pass as buffer to uploadToStorage.
  let uploadedImages = []
  try {
    const imageAttachments = rawAttachments.filter(a => {
      const mime = a?.content_type || ''
      return typeof mime === 'string' && mime.startsWith('image/')
    })
    if (imageAttachments.length > 0) {
      const accessToken = decryptToken(integ?.access_token)
      const images = []
      for (const a of imageAttachments) {
        const url = a?.content_url || a?.url
        if (!url) continue
        try {
          const resp = await fetch(url, {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          })
          if (!resp.ok) continue
          const buffer = Buffer.from(await resp.arrayBuffer())
          const mime = a.content_type
          const ext = (a.file_name?.split('.').pop() || mime.split('/').pop() || 'bin').toLowerCase()
          images.push({ buffer, mime, ext })
        } catch { /* skip */ }
      }
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
    console.warn('[engine/webhooks/zendesk] image upload failed (non-fatal):', err.message)
  }

  // Process via le pipeline V2 (Brain -> Executor -> Logger), comme le widget
  // et l'email entrant : classification, routage vers un agent spécialisé,
  // garde-fous d'escalade (references inventees, demande d'humain...).
  //
  // On réutilise normalizeZendesk (api/engine/lib/normalizer.js) — écrit et
  // enregistré pour cette source mais encore jamais invoqué — sur l'event
  // brut Zendesk. Le parsing défensif ci-dessus gère en plus les formats
  // "payload simplifié" et "format plat personnalisé" ainsi que le skip des
  // notes internes ; on écrase donc les champs du normalisé avec cette
  // extraction déjà validée — même pattern que webhooks/widget.js qui
  // surcharge `normalized.first_message` / `normalized.customer_email`
  // après coup.
  try {
    const normalized = normalizeEvent('ticket_zendesk', event)
    normalized.customer_email = customerEmail
    normalized.customer_name = customerName
    normalized.subject = subject
    normalized.message = cleanMessage
    normalized.ticket_id = ticketId
    normalized.images = uploadedImages

    const playbook = await loadPlaybook(supabase, clientId, 'ticket_zendesk')
    if (!playbook) {
      return res.status(200).json({ message_id: engineMessage.id, status: 'no_playbook' })
    }

    const { data: engineEvent } = await supabase.from('engine_events').insert({
      client_id: clientId,
      event_type: 'ticket_zendesk',
      source: 'zendesk',
      payload: { ticket_id: ticketId, subject, message: cleanMessage },
      normalized,
      playbook_id: playbook.id,
      status: 'processing',
    }).select().single()

    const startTime = Date.now()

    const brainResult = await runBrain(supabase, {
      event: engineEvent || { id: engineMessage.id, source: 'zendesk' },
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
          console.error('[engine/webhooks/zendesk] engine_reviews_v2 insert error:', err.message)
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
    console.error('[engine/webhooks/zendesk] Processing error:', err)
    await supabase
      .from('engine_messages')
      .update({ status: 'failed', error_message: err.message })
      .eq('id', engineMessage.id)

    return res.status(500).json({ error: err.message })
  }
}

export default withSentry(handler)
