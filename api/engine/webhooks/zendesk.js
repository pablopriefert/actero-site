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
import { createClient } from '@supabase/supabase-js'
import { processMessage } from '../process.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const clientId = req.query?.client_id
  if (!clientId) return res.status(400).json({ error: 'client_id query param required' })

  // Shared-secret authentication. Zendesk triggers can pass a custom header
  // or query param — our onboarding flow provisions one per app. Fail-closed
  // if the server-side secret is missing.
  const expected = process.env.ZENDESK_WEBHOOK_SECRET
  const providedSecret = req.query?.secret || req.headers['x-actero-webhook-secret']
  if (!expected || providedSecret !== expected) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const event = req.body

  // Zendesk webhook/trigger payload normalization
  // Zendesk can send various formats depending on trigger configuration
  let ticketId, customerEmail, customerName, subject, messageBody

  if (event?.ticket) {
    // Standard Zendesk trigger payload
    ticketId = String(event.ticket.id)
    customerEmail = event.ticket.requester?.email || event.ticket.via?.source?.from?.address
    customerName = event.ticket.requester?.name
    subject = event.ticket.subject || event.ticket.title
    // Latest comment
    messageBody = event.ticket.latest_comment?.body || event.ticket.description
  } else if (event?.id && event?.subject) {
    // Simplified payload (ticket object directly)
    ticketId = String(event.id)
    customerEmail = event.requester?.email || event.via?.source?.from?.address
    customerName = event.requester?.name
    subject = event.subject
    messageBody = event.latest_comment?.body || event.description
  } else {
    // Custom format — try to extract from flat structure
    ticketId = String(event?.ticket_id || event?.id || '')
    customerEmail = event?.requester_email || event?.customer_email
    customerName = event?.requester_name || event?.customer_name
    subject = event?.subject
    messageBody = event?.comment || event?.message || event?.body
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

  // Process
  try {
    const result = await processMessage(supabase, {
      messageId: engineMessage.id,
      clientId,
      source: 'zendesk',
      customerEmail,
      customerName,
      subject,
      messageBody: cleanMessage,
      externalTicketId: ticketId,
      metadata: {},
    })

    return res.status(200).json({
      message_id: engineMessage.id,
      status: result.escalated ? 'escalated' : 'processed',
      confidence: result.confidence,
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
