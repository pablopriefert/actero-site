/**
 * Actero Engine — Web Widget Endpoint
 *
 * Handles messages from the embeddable chat widget.
 * Returns AI response synchronously (not via email).
 *
 * Widget authenticates via api_key query param which maps to a client.
 */
import { createClient } from '@supabase/supabase-js'
import { processMessage } from '../process.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // CORS for widget embed
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = req.query?.api_key
  if (!apiKey) return res.status(401).json({ error: 'api_key required' })

  // Look up client by API key (stored in client_settings or a dedicated field)
  const { data: client } = await supabase
    .from('clients')
    .select('id, brand_name, client_type')
    .eq('widget_api_key', apiKey)
    .maybeSingle()

  // Fallback: check if api_key is the client_id itself (simpler setup)
  let clientId = client?.id
  if (!clientId) {
    const { data: fallback } = await supabase
      .from('clients')
      .select('id, brand_name')
      .eq('id', apiKey)
      .maybeSingle()
    clientId = fallback?.id
  }

  if (!clientId) return res.status(404).json({ error: 'Client not found for this API key' })

  const { message, email, name, session_id } = req.body || {}
  if (!message) return res.status(400).json({ error: 'message required' })

  const customerEmail = email || `widget-${session_id || Date.now()}@anonymous.actero.fr`

  // Insert message
  const { data: engineMessage, error: insertError } = await supabase
    .from('engine_messages')
    .insert({
      client_id: clientId,
      source: 'web_widget',
      external_ticket_id: session_id || null,
      customer_email: customerEmail,
      customer_name: name || null,
      message_body: message,
      metadata: { session_id, user_agent: req.headers['user-agent'] },
      status: 'received',
    })
    .select()
    .single()

  if (insertError) {
    return res.status(500).json({ error: 'Failed to store message' })
  }

  try {
    const result = await processMessage(supabase, {
      messageId: engineMessage.id,
      clientId,
      source: 'web_widget',
      customerEmail,
      customerName: name,
      messageBody: message,
      externalTicketId: session_id,
      metadata: {},
    })

    // Widget gets the response directly (synchronous)
    return res.status(200).json({
      response: result.response || 'Un membre de notre equipe va vous repondre rapidement.',
      escalated: result.escalated,
      confidence: result.confidence,
      thread_id: result.threadId,
    })
  } catch (err) {
    console.error('[engine/webhooks/widget] Error:', err)
    return res.status(200).json({
      response: 'Merci pour votre message. Un membre de notre equipe va vous repondre rapidement.',
      escalated: true,
      error: true,
    })
  }
}
