/**
 * Actero Engine — AI Processing Pipeline
 *
 * The core brain: loads client config, manages conversation context,
 * calls Claude, makes escalation decisions, and routes the response.
 */
import { loadClientConfig } from './lib/config-loader.js'
import { buildSystemPrompt, buildMessages } from './lib/prompt-builder.js'
import { callClaude } from './lib/claude-client.js'
import { findOrCreateThread, appendMessage, getConversationHistory, resolveThread, escalateThread } from './lib/conversation-manager.js'
import { routeResponse } from './respond.js'
import { lookupOrder } from './lib/shopify-client.js'

/**
 * Process a single customer message end-to-end.
 * Called by webhook.js or can be called directly for retries.
 */
export async function processMessage(supabase, {
  messageId,
  clientId,
  source,
  customerEmail,
  customerName,
  subject,
  messageBody,
  externalTicketId,
  orderId,
  metadata = {},
}) {
  const startTime = Date.now()

  // --- Update status to processing ---
  await supabase
    .from('engine_messages')
    .update({ status: 'processing' })
    .eq('id', messageId)

  // --- 1. Load client config ---
  const config = await loadClientConfig(supabase, clientId)

  // --- 2. Find or create conversation thread ---
  const thread = await findOrCreateThread(supabase, {
    clientId,
    customerEmail,
    externalTicketId,
    source,
  })

  // Append customer message to thread
  await appendMessage(supabase, thread.id, 'user', messageBody)

  // --- 3. Get conversation history ---
  const history = getConversationHistory(thread)

  // --- 3b. Shopify order lookup (if e-commerce client) ---
  let orderContext = ''
  if (config.client.client_type === 'ecommerce') {
    // Extract order reference from message (e.g., #4521, commande 4521)
    const orderMatch = messageBody.match(/#?\b(\d{3,8})\b/)
    const detectedOrderId = orderId || (orderMatch ? orderMatch[1] : null)

    const orders = await lookupOrder(supabase, {
      clientId,
      orderId: detectedOrderId,
      customerEmail,
    }).catch(() => null)

    if (orders && orders.length > 0) {
      orderContext = '\n\nDONNEES COMMANDE SHOPIFY (utilisez ces infos pour repondre precisement):\n'
        + orders.map(o => o.contextText).join('\n---\n')
    }
  }

  // --- 4. Build prompts ---
  // Inject order context into the config for prompt building
  if (orderContext) {
    config.knowledge = (config.knowledge || '') + orderContext
  }
  const systemPrompt = buildSystemPrompt(config)
  const messages = buildMessages(history, messageBody)

  // --- 5. Call Claude ---
  let aiResult
  try {
    aiResult = await callClaude({ systemPrompt, messages })
  } catch (err) {
    // Claude failed — escalate by default
    console.error('[engine/process] Claude error:', err.message)
    aiResult = {
      response: null,
      confidence: 0,
      should_escalate: true,
      escalation_reason: `Erreur IA: ${err.message}`,
      detected_intent: 'error',
      sentiment_score: 5,
      injection_detected: false,
      processingTimeMs: Date.now() - startTime,
    }
  }

  // --- 6. Decision logic ---
  const shouldEscalate =
    aiResult.should_escalate ||
    aiResult.confidence < config.confidenceThreshold ||
    aiResult.injection_detected ||
    aiResult.sentiment_score <= 2

  const escalationReason = shouldEscalate
    ? (aiResult.escalation_reason || (
        aiResult.injection_detected ? 'Injection detectee' :
        aiResult.sentiment_score <= 2 ? 'Sentiment tres negatif' :
        aiResult.confidence < config.confidenceThreshold ? 'Confiance insuffisante' :
        'Escalade demandee par l\'agent'
      ))
    : null

  // --- 7. Store in ai_conversations (existing table for dashboard compat) ---
  const { data: conversation } = await supabase
    .from('ai_conversations')
    .insert({
      client_id: clientId,
      customer_email: customerEmail,
      customer_name: customerName,
      subject: subject || aiResult.detected_intent,
      customer_message: messageBody,
      ai_response: aiResult.response || '',
      status: shouldEscalate ? 'escalated' : 'resolved',
      ticket_id: externalTicketId,
      order_id: orderId,
      confidence_score: aiResult.confidence,
      response_time_ms: aiResult.processingTimeMs || (Date.now() - startTime),
      escalation_reason: escalationReason,
    })
    .select('id')
    .single()

  // Update engine_messages with conversation link
  await supabase
    .from('engine_messages')
    .update({
      status: shouldEscalate ? 'escalated' : 'processed',
      conversation_id: conversation?.id,
      processed_at: new Date().toISOString(),
    })
    .eq('id', messageId)

  // Append AI response to thread
  if (aiResult.response && !shouldEscalate) {
    await appendMessage(supabase, thread.id, 'assistant', aiResult.response)
  }

  // --- 8. Route response ---
  const processingTimeMs = Date.now() - startTime

  await routeResponse(supabase, {
    messageId,
    clientId,
    conversationId: conversation?.id,
    threadId: thread.id,
    source,
    customerEmail,
    customerName,
    subject,
    response: aiResult.response,
    confidence: aiResult.confidence,
    shouldEscalate,
    escalationReason,
    detectedIntent: aiResult.detected_intent,
    sentimentScore: aiResult.sentiment_score,
    injectionDetected: aiResult.injection_detected,
    processingTimeMs,
    config,
  })

  // --- 9. Log to automation_events ---
  await supabase.from('automation_events').insert({
    client_id: clientId,
    event_category: shouldEscalate ? 'ticket_escalated' : 'ticket_resolved',
    event_type: source,
    ticket_type: aiResult.detected_intent || 'general',
    time_saved_seconds: shouldEscalate ? 0 : config.timeSavedPerTicket,
    description: shouldEscalate
      ? `Escalade: ${escalationReason} (${customerEmail})`
      : `Reponse auto: ${(aiResult.response || '').substring(0, 100)}`,
    metadata: {
      message_id: messageId,
      confidence: aiResult.confidence,
      sentiment: aiResult.sentiment_score,
      intent: aiResult.detected_intent,
      source,
      processing_time_ms: processingTimeMs,
    },
  })

  return {
    response: aiResult.response,
    confidence: aiResult.confidence,
    escalated: shouldEscalate,
    escalationReason,
    processingTimeMs,
    conversationId: conversation?.id,
    threadId: thread.id,
  }
}
