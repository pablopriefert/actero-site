/**
 * Actero Engine — ElevenLabs Post-Call Webhook
 *
 * Receives call data after each ElevenLabs Conversational AI call ends.
 * Logs the call in engine_runs_v2, automation_events, and metrics_daily.
 *
 * POST /api/engine/webhooks/elevenlabs-postcall
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ELEVENLABS_WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET

// Disable body parsing so we can verify the HMAC against the raw request body.
export const config = {
  api: {
    bodyParser: false,
  },
}

async function getRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let rawBody
  try {
    rawBody = await getRawBody(req)
  } catch (err) {
    console.error('[elevenlabs-postcall] getRawBody error:', err.message)
    return res.status(400).json({ error: 'Unable to read request body' })
  }

  // Verify HMAC signature if secret is configured
  if (ELEVENLABS_WEBHOOK_SECRET) {
    const signature = req.headers['elevenlabs-signature']
    if (signature) {
      const crypto = await import('crypto')
      const expected = crypto.createHmac('sha256', ELEVENLABS_WEBHOOK_SECRET).update(rawBody).digest('hex')
      // Strip common prefixes like "sha256=" or "t=...,v1=..."
      const parts = String(signature).split(',').map(s => s.trim())
      const provided = parts.find(p => p.startsWith('v1=') || p.startsWith('sha256='))?.split('=')[1] || signature
      let valid = false
      try {
        const a = Buffer.from(expected)
        const b = Buffer.from(provided)
        valid = a.length === b.length && crypto.timingSafeEqual(a, b)
      } catch {
        valid = false
      }
      if (!valid) {
        console.warn('[elevenlabs-postcall] Invalid HMAC signature')
        return res.status(401).json({ error: 'Invalid signature' })
      }
    }
  }

  // Parse the JSON body now that the signature is verified (or skipped)
  let data
  try {
    data = JSON.parse(rawBody.toString('utf8'))
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }
  req.body = data

  try {
    const conversationId = data.conversation_id || data.id
    const agentId = data.agent_id
    const status = data.status // completed, failed, etc.
    const transcript = data.transcript || data.messages || []
    const duration = data.metadata?.call_duration_secs || data.call_duration_secs || 0
    const customerNumber = data.metadata?.caller_id || data.caller_id || ''
    const satisfaction = data.analysis?.user_sentiment || data.feedback?.rating || null
    const summary = data.analysis?.summary || ''
    const escalated = data.analysis?.call_successful === false || data.metadata?.transferred === true

    // Try to identify the client from the agent_id
    // For now, use a mapping or default to the first client with vocal agent active
    const { data: voiceConfig } = await supabase
      .from('voice_agent_config')
      .select('client_id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    const clientId = voiceConfig?.client_id

    if (!clientId) {
      console.warn('[elevenlabs-postcall] No active voice agent config found')
      return res.status(200).json({ received: true, warning: 'No client mapped' })
    }

    // Build transcript text
    let transcriptText = ''
    if (Array.isArray(transcript)) {
      transcriptText = transcript
        .map(msg => `${msg.role === 'agent' ? 'Agent' : 'Client'}: ${msg.message || msg.text || msg.content || ''}`)
        .join('\n')
    } else if (typeof transcript === 'string') {
      transcriptText = transcript
    }

    // 1. Log in engine_events
    const { data: event } = await supabase.from('engine_events').insert({
      client_id: clientId,
      event_type: 'phone_call_completed',
      source: 'elevenlabs_voice',
      payload: data,
      normalized: {
        customer_email: customerNumber,
        customer_name: customerNumber,
        message: summary || transcriptText.substring(0, 500),
        channel: 'voice',
      },
      status: 'completed',
      received_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    }).select('id').single()

    // 2. Log in engine_runs_v2
    await supabase.from('engine_runs_v2').insert({
      client_id: clientId,
      event_id: event?.id,
      status: escalated ? 'needs_review' : 'completed',
      classification: 'voice_call',
      confidence: satisfaction ? satisfaction / 5 : 0.8,
      action_plan: ['voice_conversation'],
      steps: [{
        action: 'voice_conversation',
        status: 'completed',
        duration_ms: duration * 1000,
        result: { transcript_length: transcriptText.length, escalated },
      }],
      duration_ms: duration * 1000,
    })

    // 3. Log in automation_events (feeds dashboard)
    await supabase.from('automation_events').insert({
      client_id: clientId,
      event_category: escalated ? 'ticket_escalated' : 'ticket_resolved',
      event_type: 'voice_call',
      ticket_type: 'voice',
      time_saved_seconds: escalated ? 0 : Math.max(duration, 180), // Assume 3min saved minimum
      description: `[Vocal] Appel ${duration}s — ${escalated ? 'Escalade' : 'Resolu'} — ${summary || 'Pas de resume'}`,
      metadata: {
        conversation_id: conversationId,
        agent_id: agentId,
        duration_secs: duration,
        satisfaction,
        escalated,
        transcript_preview: transcriptText.substring(0, 200),
        source: 'elevenlabs_postcall',
      },
    })

    // 4. Update metrics_daily
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase
      .from('metrics_daily')
      .select('*')
      .eq('client_id', clientId)
      .eq('date', today)
      .maybeSingle()

    if (existing) {
      await supabase.from('metrics_daily').update({
        tickets_total: (existing.tickets_total || 0) + 1,
        tickets_auto: (existing.tickets_auto || 0) + (escalated ? 0 : 1),
        time_saved_minutes: (existing.time_saved_minutes || 0) + Math.round(Math.max(duration, 180) / 60),
        conversations_handled: (existing.conversations_handled || 0) + 1,
      }).eq('id', existing.id)
    } else {
      await supabase.from('metrics_daily').insert({
        client_id: clientId,
        date: today,
        tickets_total: 1,
        tickets_auto: escalated ? 0 : 1,
        time_saved_minutes: Math.round(Math.max(duration, 180) / 60),
        conversations_handled: 1,
      })
    }

    // 5. Store conversation in ai_conversations
    await supabase.from('ai_conversations').insert({
      client_id: clientId,
      customer_email: customerNumber || 'appel-vocal',
      customer_name: customerNumber,
      subject: 'Appel vocal',
      customer_message: transcriptText.substring(0, 2000),
      ai_response: summary || 'Conversation vocale terminee',
      status: escalated ? 'escalated' : 'resolved',
      confidence_score: satisfaction ? satisfaction / 5 : 0.8,
      response_time_ms: duration * 1000,
    })

    // 6. Persist full call record in voice_calls (powers the dashboard)
    const recordingUrl = data.recording_url || data.audio_url || data.metadata?.recording_url || null
    const customerName = data.metadata?.caller_name || data.caller_name || null
    await supabase.from('voice_calls').insert({
      client_id: clientId,
      conversation_id: conversationId,
      customer_phone: customerNumber || null,
      customer_name: customerName,
      duration_seconds: duration,
      transcript: transcriptText,
      summary: summary || null,
      sentiment: typeof satisfaction === 'string' ? satisfaction : (satisfaction != null ? String(satisfaction) : null),
      status: escalated ? 'escalated' : (status || 'completed'),
      recording_url: recordingUrl,
      metadata: {
        agent_id: agentId,
        raw_status: status,
        transferred: data.metadata?.transferred || false,
        call_successful: data.analysis?.call_successful,
        analysis: data.analysis || null,
      },
    })

    return res.status(200).json({
      received: true,
      conversation_id: conversationId,
      client_id: clientId,
      duration,
      escalated,
    })

  } catch (err) {
    console.error('[elevenlabs-postcall] Error:', err)
    return res.status(200).json({ received: true, error: err.message })
  }
}
