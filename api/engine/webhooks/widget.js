/**
 * Actero Engine — Web Widget Endpoint
 *
 * Handles messages from the embeddable chat widget.
 * Returns AI response synchronously (not via email).
 *
 * Widget authenticates via api_key query param which maps to a client.
 */
import { withSentry } from '../../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { normalizeEvent } from '../lib/normalizer.js'
import { loadPlaybook } from '../lib/playbook-loader.js'
import { runBrain } from '../brain.js'
import { runExecutor } from '../executor.js'
import { logRun } from '../logger.js'
import { uploadToStorage } from '../../vision/lib/ingress.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  // CORS for widget embed
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = req.query?.api_key
  if (!apiKey) return res.status(401).json({ error: 'api_key required' })

  // Look up client by API key (stored in clients.widget_api_key).
  // SECURITY: previously fell back to matching `api_key` against clients.id.
  // That meant any leaked client UUID (frequently exposed in dashboard URLs,
  // support tickets, screenshots) granted unlimited chat-bot access. Removed.
  const { data: client } = await supabase
    .from('clients')
    .select('id, brand_name, client_type')
    .eq('widget_api_key', apiKey)
    .maybeSingle()

  const clientId = client?.id
  if (!clientId) return res.status(401).json({ error: 'Invalid API key' })

  const {
    message, email, name, session_id, history, images: widgetImages,
    amplitude_device_id, amplitude_session_id,
  } = req.body || {}
  if (!message) return res.status(400).json({ error: 'message required' })

  // Conversation history: prefer from widget, but fallback to DB (in case widget.js is cached)
  let conversationHistory = Array.isArray(history) ? history.slice(-20) : []

  // If widget didn't send history, rebuild from engine_messages DB
  if (conversationHistory.length === 0 && session_id) {
    try {
      const { data: prevMessages } = await supabase
        .from('engine_messages')
        .select('message_body, metadata')
        .eq('client_id', clientId)
        .eq('external_ticket_id', session_id)
        .order('created_at', { ascending: true })
        .limit(20)

      if (prevMessages && prevMessages.length > 0) {
        for (const msg of prevMessages) {
          conversationHistory.push({ role: 'user', content: msg.message_body })
          // Add the AI response if stored in metadata
          if (msg.metadata?.ai_response) {
            conversationHistory.push({ role: 'assistant', content: msg.metadata.ai_response })
          }
        }
      }
    } catch {}
  }

  console.log(`[widget] session=${session_id} message="${message.substring(0,50)}" history_length=${conversationHistory.length} from=${conversationHistory.length > 0 && !Array.isArray(history) ? 'db' : 'widget'}`)

  // Extract email from current message or use provided one
  const emailFromMessage = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]
  // Also scan conversation history for email if not provided
  let emailFromHistory = null
  if (!email && !emailFromMessage && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      if (msg.role === 'user' && msg.content) {
        const found = msg.content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
        if (found) { emailFromHistory = found[0]; break }
      }
    }
  }
  const customerEmail = email || emailFromMessage || emailFromHistory || `widget-${session_id || Date.now()}@anonymous.actero.fr`
  const isRealEmail = !customerEmail.includes('@anonymous.actero.fr')

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
      metadata: {
        session_id,
        user_agent: req.headers['user-agent'],
        amplitude_device_id: amplitude_device_id || null,
        amplitude_session_id: amplitude_session_id || null,
      },
      status: 'received',
    })
    .select()
    .single()

  if (insertError) {
    return res.status(500).json({ error: 'Failed to store message' })
  }

  const startTime = Date.now()

  try {
    // Find the first real user message from conversation history (for ticket display)
    let firstUserMessage = message
    if (conversationHistory.length > 0) {
      const firstUser = conversationHistory.find(m => m.role === 'user' && m.content && !m.content.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/))
      if (firstUser) firstUserMessage = firstUser.content
    }

    // Process inbound images from widget.
    // Accepts `images: string[]` — each entry is either a data-URL
    // (data:image/...;base64,...) which we decode & upload, or an already-stored
    // storage path (pass through).
    let uploadedImages = []
    try {
      if (Array.isArray(widgetImages) && widgetImages.length > 0) {
        const toUpload = []
        const passThrough = []
        for (const item of widgetImages) {
          if (typeof item !== 'string') continue
          const dataUrlMatch = item.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
          if (dataUrlMatch) {
            const mime = dataUrlMatch[1]
            const b64 = dataUrlMatch[2]
            try {
              const buffer = Buffer.from(b64, 'base64')
              const ext = (mime.split('/').pop() || 'bin').toLowerCase()
              toUpload.push({ buffer, mime, ext })
            } catch { /* skip malformed data url */ }
          } else {
            // Already a storage path
            passThrough.push(item)
          }
        }
        if (toUpload.length > 0) {
          const uploaded = await uploadToStorage({
            supabase,
            clientId,
            ticketId: session_id || engineMessage.id || `widget-${Date.now()}`,
            images: toUpload,
          })
          uploadedImages = uploadedImages.concat(uploaded)
        }
        uploadedImages = uploadedImages.concat(passThrough)
      }
    } catch (err) {
      console.warn('[widget] image upload failed (non-fatal):', err.message)
    }

    // Use Engine V2 pipeline (Brain → Executor → Logger)
    const normalized = normalizeEvent('widget_message', {
      customer_email: customerEmail,
      customer_name: name,
      message,
      session_id,
      images: uploadedImages,
    })
    // Override for logger: use first real message + detected email
    normalized.first_message = firstUserMessage
    normalized.customer_email = customerEmail
    // Carry Amplitude replay IDs through to ai_conversations.metadata so
    // the dashboard can deep-link into the Session Replay viewer.
    if (amplitude_device_id) normalized.amplitude_device_id = amplitude_device_id
    if (amplitude_session_id) normalized.amplitude_session_id = amplitude_session_id

    // Find playbook
    const playbook = await loadPlaybook(supabase, clientId, 'widget_message')

    if (!playbook) {
      // No playbook — use simple simulator-chat as fallback
      const { data: { session: authSession } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
      return res.status(200).json({
        response: 'Merci pour votre message. Un membre de notre equipe va vous repondre rapidement.',
        escalated: true,
      })
    }

    // Store event
    const { data: event } = await supabase.from('engine_events').insert({
      client_id: clientId,
      event_type: 'widget_message',
      source: 'web_widget',
      payload: { message, session_id },
      normalized,
      playbook_id: playbook.id,
      status: 'processing',
    }).select().single()

    // Determine if this is a follow-up message (not the first in the conversation)
    // If history was rebuilt from DB, it contains ONLY previous messages (current not yet inserted)
    // If history came from widget, it includes the current message too
    const previousUserMessages = conversationHistory.filter(m => m.role === 'user').length
    const historyFromDB = !Array.isArray(history) || history.length === 0
    // DB history: any user message = there were previous messages (current isn't in DB yet)
    // Widget history: >1 user messages means there were previous ones (current is included)
    const isFollowUp = historyFromDB ? previousUserMessages >= 1 : previousUserMessages > 1

    // Run Brain (with conversation history for memory)
    const brainResult = await runBrain(supabase, {
      event: event || { id: engineMessage.id, source: 'web_widget' },
      playbook,
      clientId,
      normalized,
      conversationHistory,
    })

    // Execute
    if (!brainResult.needsReview) {
      const executorResult = await runExecutor(supabase, {
        event: event || engineMessage,
        playbook,
        clientId,
        normalized,
        brainResult,
      })

      // Log run
      await logRun(supabase, {
        clientId,
        eventId: event?.id,
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
        isFollowUp,
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

      if (event) {
        await supabase.from('engine_events').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('id', event.id)
      }
    } else {
      // Needs review
      const runResult = await logRun(supabase, {
        clientId,
        eventId: event?.id,
        playbookId: playbook.id,
        status: 'needs_review',
        classification: brainResult.classification,
        confidence: brainResult.confidence,
        actionPlan: brainResult.actionPlan,
        steps: [],
        durationMs: Date.now() - startTime,
        normalized,
        aiResponse: brainResult.aiResponse,
        isFollowUp,
        agentUsed: brainResult.agentUsed || null,
        tokensIn: brainResult.usage?.tokensIn,
        tokensOut: brainResult.usage?.tokensOut,
        costUsd: brainResult.usage?.costUsd,
        modelId: brainResult.usage?.modelId,
        errorMessage: brainResult.errorMessage || null,
      })

      // Create review entry for admin/client dashboard
      if (runResult?.id) {
        try {
          await supabase.from('engine_reviews_v2').insert({
            run_id: runResult.id,
            client_id: clientId,
            event_id: event?.id,
            proposed_action: { classification: brainResult.classification, action_plan: brainResult.actionPlan, ai_response: brainResult.aiResponse },
            reason: brainResult.reviewReason || 'aggressive',
            status: 'pending',
          })
        } catch (err) {
          console.error('[widget] engine_reviews_v2 insert error:', err.message)
        }
      }

      // Update event status
      if (event) {
        await supabase.from('engine_events').update({ status: 'needs_review', processed_at: new Date().toISOString() }).eq('id', event.id)
      }
    }

    // Safety net: ensure response is clean text, not JSON
    let cleanResponse = brainResult.aiResponse || 'Merci pour votre message. Un membre de notre equipe va vous repondre rapidement.'
    // If response looks like JSON, try to extract the text
    if (cleanResponse.includes('"response"') && cleanResponse.includes('{')) {
      try {
        let jsonStr = cleanResponse
        const codeBlock = cleanResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
        if (codeBlock) jsonStr = codeBlock[1]
        const parsed = JSON.parse(jsonStr.match(/\{[\s\S]*\}/)?.[0] || jsonStr)
        if (parsed.response) cleanResponse = parsed.response
      } catch {}
    }
    // Strip any remaining markdown/code artifacts
    cleanResponse = cleanResponse.replace(/^```(?:json)?\s*/gm, '').replace(/```\s*$/gm, '').trim()

    // Save AI response in the engine_message metadata (for DB-based memory)
    try {
      await supabase.from('engine_messages')
        .update({ metadata: { session_id, ai_response: cleanResponse, user_agent: req.headers['user-agent'] } })
        .eq('id', engineMessage.id)
    } catch {}

    return res.status(200).json({
      response: cleanResponse,
      escalated: brainResult.needsReview,
      confidence: brainResult.confidence,
      product_recommendations: brainResult.productRecommendations || [],
    })
  } catch (err) {
    console.error('[engine/webhooks/widget] Error:', err)
    // Return 500 so monitoring catches the failure, but keep the widget UX
    // working by still sending a safe fallback response body.
    return res.status(500).json({
      error: 'internal_error',
      response: 'Merci pour votre message. Un membre de notre equipe va vous repondre rapidement.',
      escalated: true,
    })
  }
}

export default withSentry(handler)
