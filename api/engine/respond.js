/**
 * Actero Engine — Response Router
 *
 * Routes AI responses to the appropriate delivery channel (email, Gorgias, Zendesk, etc.)
 * or triggers escalation alerts for human intervention.
 */
import { getConnector } from './lib/connector-registry.js'
import { sendViaSlack } from './connectors/slack.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'support@actero.fr'

/**
 * Route a response to the customer or escalate to the team.
 */
export async function routeResponse(supabase, {
  messageId,
  clientId,
  conversationId,
  threadId,
  source,
  customerEmail,
  customerName,
  subject,
  response,
  confidence,
  shouldEscalate,
  escalationReason,
  detectedIntent,
  sentimentScore,
  injectionDetected,
  processingTimeMs,
  config,
}) {
  if (shouldEscalate) {
    return await handleEscalation(supabase, {
      messageId, clientId, conversationId, threadId,
      customerEmail, customerName, subject,
      escalationReason, detectedIntent, sentimentScore,
      source, config, processingTimeMs,
    })
  }

  return await handleAutoReply(supabase, {
    messageId, clientId, conversationId, threadId,
    source, customerEmail, customerName, subject,
    response, confidence, detectedIntent, sentimentScore,
    injectionDetected, processingTimeMs, config,
  })
}

/**
 * Auto-reply: send response to the customer via the source channel.
 */
async function handleAutoReply(supabase, {
  messageId, clientId, conversationId, threadId,
  source, customerEmail, customerName, subject,
  response, confidence, detectedIntent, sentimentScore,
  injectionDetected, processingTimeMs, config,
}) {
  let deliveryStatus = 'pending'
  let deliveryError = null
  const deliveryChannel = source
  const brandName = config.client?.brand_name || 'Actero'

  try {
    // Get the appropriate connector for this source
    const connector = getConnector(source)

    if (connector) {
      // Fetch external_ticket_id from engine_messages — required by Gorgias/
      // Zendesk connectors which call providers' APIs using their native ticket
      // IDs (integer or string, not our internal Supabase UUID).
      // Previous bug : we passed `messageId` (UUID) → 404 on PUT /tickets/{id}.
      const { data: engineMsg } = await supabase
        .from('engine_messages')
        .select('external_ticket_id')
        .eq('id', messageId)
        .maybeSingle()
      const externalTicketId = engineMsg?.external_ticket_id || null

      const result = await connector(supabase, {
        clientId,
        ticketId: externalTicketId,
        messageId, // kept for logging/idempotency in connectors that may need it
        customerEmail,
        customerName,
        subject,
        response,
        brandName,
      })

      if (result.success) {
        deliveryStatus = 'sent'
      } else {
        throw new Error(result.error || 'Delivery failed')
      }
    } else {
      deliveryStatus = 'sent' // web_widget — response returned synchronously
    }

    // Also notify via Slack if integration is active (non-blocking)
    if (source !== 'slack' && config.activeIntegrations?.includes('slack')) {
      try {
        sendViaSlack(supabase, {
          clientId, response, customerEmail, customerName, subject, brandName,
          isEscalation: false,
        })
      } catch {} // Non-blocking
    }

  } catch (err) {
    console.error('[engine/respond] Delivery error:', err.message)
    deliveryStatus = 'failed'
    deliveryError = err.message
  }

  // Log response
  await supabase.from('engine_responses').insert({
    message_id: messageId,
    client_id: clientId,
    conversation_id: conversationId,
    response_text: response,
    confidence_score: confidence,
    was_escalated: false,
    detected_intent: detectedIntent,
    sentiment_score: sentimentScore,
    injection_detected: injectionDetected,
    delivery_channel: deliveryChannel,
    delivery_status: deliveryStatus,
    delivery_error: deliveryError,
    delivered_at: deliveryStatus === 'sent' ? new Date().toISOString() : null,
    processing_time_ms: processingTimeMs,
  })

  return { delivered: deliveryStatus === 'sent', channel: deliveryChannel }
}

/**
 * Escalation: notify the client team via email and/or Slack.
 */
async function handleEscalation(supabase, {
  messageId, clientId, conversationId, threadId,
  customerEmail, customerName, subject,
  escalationReason, detectedIntent, sentimentScore,
  source, config, processingTimeMs,
}) {
  // 1. Create escalation ticket
  try {
    await supabase.from('escalation_tickets').insert({ client_id: clientId, status: 'pending' })
  } catch {} // Non-critical

  // 2. Send escalation alert email to client
  const { data: notifPrefs } = await supabase
    .from('client_notification_preferences')
    .select('escalation_alert')
    .eq('client_id', clientId)
    .maybeSingle()

  if (RESEND_API_KEY && (notifPrefs?.escalation_alert !== false)) {
    const contactEmail = config.client?.contact_email
    if (contactEmail) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `Actero <${RESEND_FROM}>`,
            to: [contactEmail],
            subject: `⚠️ Escalade — ${escalationReason}`,
            html: buildEscalationEmailHtml({
              customerEmail, customerName, escalationReason,
              detectedIntent, sentimentScore, source,
            }),
          }),
        })
      } catch (err) {
        console.error('[engine/respond] Escalation email error:', err.message)
      }
    }
  }

  // 2b. Send Slack notification if connected
  if (config.activeIntegrations?.includes('slack')) {
    try {
      sendViaSlack(supabase, {
        clientId, customerEmail, customerName, subject,
        brandName: config.client?.brand_name || 'Actero',
        isEscalation: true, escalationReason,
      })
    } catch {} // Non-blocking
  }

  // 3. Log escalation response
  await supabase.from('engine_responses').insert({
    message_id: messageId,
    client_id: clientId,
    conversation_id: conversationId,
    response_text: '',
    confidence_score: 0,
    was_escalated: true,
    escalation_reason: escalationReason,
    detected_intent: detectedIntent,
    sentiment_score: sentimentScore,
    delivery_channel: 'email',
    delivery_status: 'sent',
    processing_time_ms: processingTimeMs,
  })

  return { delivered: true, channel: 'escalation' }
}

/**
 * Build HTML email for auto-reply.
 */
function buildEmailHtml(response, brandName, customerName) {
  const greeting = customerName ? `Bonjour ${customerName},` : 'Bonjour,'
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p style="color: #262626; font-size: 15px; line-height: 1.6;">${greeting}</p>
      <p style="color: #262626; font-size: 15px; line-height: 1.6;">${response.replace(/\n/g, '<br/>')}</p>
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
      <p style="color: #999; font-size: 12px;">
        ${brandName} — Service client assiste par IA<br/>
        Si vous avez besoin d'une aide supplementaire, repondez directement a cet email.
      </p>
    </div>
  `
}

/**
 * Build HTML email for escalation alert.
 */
function buildEscalationEmailHtml({ customerEmail, customerName, escalationReason, detectedIntent, sentimentScore, source }) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #dc2626; font-size: 18px; margin-bottom: 16px;">⚠️ Ticket escalade</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 8px 0; color: #666;">Client</td><td style="padding: 8px 0; color: #262626; font-weight: bold;">${customerName || customerEmail}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Email</td><td style="padding: 8px 0; color: #262626;">${customerEmail}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Raison</td><td style="padding: 8px 0; color: #dc2626; font-weight: bold;">${escalationReason}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Intent</td><td style="padding: 8px 0; color: #262626;">${detectedIntent || 'N/A'}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Sentiment</td><td style="padding: 8px 0; color: #262626;">${sentimentScore || 'N/A'}/10</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Source</td><td style="padding: 8px 0; color: #262626;">${source}</td></tr>
      </table>
      <p style="margin-top: 20px;">
        <a href="https://actero.fr/client/escalations" style="display: inline-block; padding: 10px 20px; background: #0E653A; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Voir dans le dashboard
        </a>
      </p>
    </div>
  `
}
