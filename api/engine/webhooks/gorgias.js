/**
 * Actero Engine — Gorgias Webhook Receiver
 *
 * Receives ticket events from Gorgias (ticket-created, ticket-message-created)
 * and routes them to the processing pipeline.
 *
 * Setup in Gorgias: Settings → Integrations → HTTP Integration
 * URL: https://actero.fr/api/engine/webhooks/gorgias?client_id=UUID
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

  const providedSecret = req.query?.secret || req.headers['x-actero-webhook-secret']
  if (!providedSecret) return res.status(401).json({ error: 'Missing webhook secret' })

  // Per-client secret — chaque Gorgias OAuth install génère un secret de
  // 32 bytes stocké dans client_integrations.extra_config.webhook_secret.
  // Fallback sur GORGIAS_WEBHOOK_SECRET pour les setups legacy.
  const { data: integ } = await supabase
    .from('client_integrations')
    .select('extra_config')
    .eq('client_id', clientId)
    .eq('provider', 'gorgias')
    .eq('status', 'active')
    .maybeSingle()

  const expectedSecret = integ?.extra_config?.webhook_secret
    || process.env.GORGIAS_WEBHOOK_SECRET
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Gorgias sends different event types
  const event = req.body
  const eventType = event?.type || event?.event

  // We only care about customer messages (not agent replies)
  // Gorgias webhook payload varies, normalize it:
  let ticketId, customerEmail, customerName, subject, messageBody

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
  } else if (event?.message) {
    // Message-level event
    ticketId = String(event.message.ticket_id || event.ticket_id)
    customerEmail = event.message.sender?.email
    customerName = event.message.sender?.name
    messageBody = event.message.body_text || event.message.stripped_text
    subject = event.message.subject
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

  // Process
  try {
    const result = await processMessage(supabase, {
      messageId: engineMessage.id,
      clientId,
      source: 'gorgias',
      customerEmail,
      customerName,
      subject,
      messageBody: cleanMessage,
      externalTicketId: ticketId,
      metadata: { gorgias_event_type: eventType },
    })

    return res.status(200).json({
      message_id: engineMessage.id,
      status: result.escalated ? 'escalated' : 'processed',
      confidence: result.confidence,
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
