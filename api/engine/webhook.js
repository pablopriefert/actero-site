/**
 * Actero Engine — Universal Webhook Receiver
 *
 * Receives customer messages from any source and routes them to the processing pipeline.
 *
 * Authentication: one of:
 * - x-engine-secret header matching ENGINE_WEBHOOK_SECRET
 * - x-internal-secret header matching INTERNAL_API_SECRET
 * - api_key query parameter matching a client's webhook secret
 */
import { createClient } from '@supabase/supabase-js'
import { processMessage } from './process.js'
import { checkRateLimit } from './lib/rate-limiter.js'

const ENGINE_SECRET = process.env.ENGINE_WEBHOOK_SECRET
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // --- Authentication ---
  const engineSecret = req.headers['x-engine-secret']
  const internalSecret = req.headers['x-internal-secret']

  const isAuthenticated =
    (ENGINE_SECRET && engineSecret === ENGINE_SECRET) ||
    (INTERNAL_SECRET && internalSecret === INTERNAL_SECRET)

  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Non autorise. Header x-engine-secret requis.' })
  }

  // --- Parse body ---
  const {
    client_id,
    source = 'email',
    customer_email,
    customer_name,
    subject,
    message,
    ticket_id,
    order_id,
    metadata = {},
  } = req.body || {}

  // --- Validation ---
  if (!client_id) return res.status(400).json({ error: 'client_id requis' })
  if (!message) return res.status(400).json({ error: 'message requis' })
  if (!customer_email) return res.status(400).json({ error: 'customer_email requis' })

  // --- Verify client exists and is active ---
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, status, brand_name')
    .eq('id', client_id)
    .single()

  if (clientError || !client) {
    return res.status(404).json({ error: 'Client non trouve' })
  }

  // --- Rate limiting ---
  const rateCheck = await checkRateLimit(supabase, { clientId: client_id, customerEmail: customer_email })
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: rateCheck.reason })
  }

  // --- Insert message into queue ---
  const { data: engineMessage, error: insertError } = await supabase
    .from('engine_messages')
    .insert({
      client_id,
      source,
      external_ticket_id: ticket_id || null,
      customer_email,
      customer_name: customer_name || null,
      subject: subject || null,
      message_body: message,
      metadata: { ...metadata, order_id: order_id || null },
      status: 'received',
    })
    .select()
    .single()

  if (insertError) {
    console.error('[engine/webhook] Insert error:', insertError)
    return res.status(500).json({ error: 'Erreur enregistrement message' })
  }

  // --- Process message (inline, synchronous) ---
  try {
    const result = await processMessage(supabase, {
      messageId: engineMessage.id,
      clientId: client_id,
      source,
      customerEmail: customer_email,
      customerName: customer_name,
      subject,
      messageBody: message,
      externalTicketId: ticket_id,
      orderId: order_id,
      metadata,
    })

    return res.status(200).json({
      message_id: engineMessage.id,
      status: result.escalated ? 'escalated' : 'processed',
      response: result.escalated ? null : result.response,
      confidence: result.confidence,
      escalated: result.escalated,
      escalation_reason: result.escalationReason,
      processing_time_ms: result.processingTimeMs,
    })

  } catch (err) {
    console.error('[engine/webhook] Processing error:', err)

    // Mark message as failed
    await supabase
      .from('engine_messages')
      .update({ status: 'failed', error_message: err.message })
      .eq('id', engineMessage.id)

    return res.status(500).json({
      message_id: engineMessage.id,
      status: 'failed',
      error: err.message,
    })
  }
}
