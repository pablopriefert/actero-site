/**
 * Actero Voice Agent — Custom LLM endpoint (OpenAI-compatible)
 *
 * ElevenLabs Conversational AI calls this URL for every user turn.
 * We translate the OpenAI chat.completions request into a runBrain() call
 * against our existing SAV brain, sanitize the output for TTS, then reply
 * in the OpenAI format (non-streaming JSON or SSE stream).
 *
 * Path:   POST /api/voice/custom-llm?client_id=<uuid>
 * Auth:   X-Voice-Auth-Token header === process.env.VOICE_LLM_SECRET
 *
 * Docs: https://elevenlabs.io/docs/conversational-ai/customization/llm/custom-llm
 */
import { withSentry } from '../lib/sentry.js'
import { runBrain } from '../engine/brain.js'
import { loadPlaybook } from '../engine/lib/playbook-loader.js'
import { supabaseAdmin, readJsonBody, sanitizeForVoice } from './_helpers.js'

const FALLBACK_SAFE =
  'Desole, je rencontre un petit probleme technique. Pouvez-vous reformuler votre demande ?'

function isAuthorized(req) {
  const expected = process.env.VOICE_LLM_SECRET
  if (!expected) return false
  const provided =
    req.headers['x-voice-auth-token'] ||
    req.headers['X-Voice-Auth-Token'] ||
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  return Boolean(provided) && provided === expected
}

function extractLastUserMessage(messages) {
  if (!Array.isArray(messages)) return ''
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (!m) continue
    if (m.role === 'user') {
      if (typeof m.content === 'string') return m.content
      if (Array.isArray(m.content)) {
        return m.content
          .map(c => (typeof c === 'string' ? c : c?.text || ''))
          .filter(Boolean)
          .join(' ')
      }
    }
  }
  return ''
}

/**
 * Build a history array compatible with runBrain's `conversationHistory`,
 * skipping the very last user message (already the "current" one).
 */
function buildHistory(messages) {
  if (!Array.isArray(messages) || messages.length <= 1) return []
  const history = []
  for (let i = 0; i < messages.length - 1; i++) {
    const m = messages[i]
    if (!m || !m.content) continue
    if (m.role === 'user' || m.role === 'assistant') {
      history.push({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })
    }
  }
  return history
}

/**
 * Ensure the client has at least one usable playbook. Falls back to a
 * minimal in-memory playbook so the voice agent can still answer even if
 * no DB playbook is attached.
 */
async function getVoicePlaybook(clientId) {
  try {
    const dbPlaybook =
      (await loadPlaybook(supabaseAdmin, clientId, 'voice_call')) ||
      (await loadPlaybook(supabaseAdmin, clientId, 'widget')) ||
      (await loadPlaybook(supabaseAdmin, clientId, 'email'))
    if (dbPlaybook) return dbPlaybook
  } catch (err) {
    console.error('[voice/custom-llm] loadPlaybook error:', err.message)
  }

  // Fallback minimal playbook matching runBrain's expected shape
  return {
    id: 'voice-fallback',
    name: 'voice_fallback',
    classification_prompt:
      'Tu es un classifieur pour un centre d appel e-commerce. Classe le message en une de ces categories: suivi_commande, retour_remboursement, question_produit, reclamation, general, aggressive, autre.',
    decision_rules: {
      suivi_commande: ['send_reply'],
      retour_remboursement: ['send_reply'],
      question_produit: ['send_reply'],
      reclamation: ['send_reply', 'escalate'],
      general: ['send_reply'],
      aggressive: ['escalate'],
      autre: ['send_reply'],
    },
    confidence_threshold: 0.5,
    custom_config: {},
  }
}

/* -------------------------- OpenAI response shapes ------------------------- */

function buildCompletionResponse(callId, text) {
  return {
    id: `chatcmpl-${callId}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'actero-brain',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  }
}

function writeSseChunk(res, callId, model, delta, finish = null) {
  const chunk = {
    id: `chatcmpl-${callId}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta,
        finish_reason: finish,
      },
    ],
  }
  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
}

/**
 * Stream a full text answer as a small number of SSE chunks.
 * We don't have true token-level streaming from runBrain, so we split the
 * sanitized answer on sentence boundaries and emit each chunk — this already
 * gives ElevenLabs much lower TTFB than waiting for the full response.
 */
async function streamResponse(res, callId, text) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  // First chunk: role
  writeSseChunk(res, callId, 'actero-brain', { role: 'assistant' })

  const pieces = text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [text]
  for (const piece of pieces) {
    writeSseChunk(res, callId, 'actero-brain', { content: piece })
  }

  writeSseChunk(res, callId, 'actero-brain', {}, 'stop')
  res.write('data: [DONE]\n\n')
  res.end()
}

/* --------------------------------- Handler -------------------------------- */

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const clientId = req.query?.client_id || req.body?.client_id
  if (!clientId) {
    return res.status(400).json({ error: 'client_id required (query or body)' })
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  const messages = body?.messages || []
  const stream = Boolean(body?.stream)
  const callId =
    body?.conversation_id ||
    body?.call_id ||
    req.headers['x-conversation-id'] ||
    `call-${Date.now()}`

  const userMessage = extractLastUserMessage(messages)

  // Guard: empty message -> polite fallback
  if (!userMessage || !userMessage.trim()) {
    const text = 'Je vous ecoute, que puis-je faire pour vous ?'
    if (stream) return streamResponse(res, callId, text)
    return res.status(200).json(buildCompletionResponse(callId, text))
  }

  try {
    // Check voice minutes quota
    const { data: clientRow } = await supabaseAdmin.from('clients').select('plan').eq('id', clientId).maybeSingle()
    const clientPlan = clientRow?.plan || 'free'
    const voiceLimits = { free: 0, starter: 0, pro: 200, enterprise: Infinity }
    const voiceLimit = voiceLimits[clientPlan] ?? 0

    if (voiceLimit !== Infinity) {
      const period = new Date().toISOString().slice(0, 7)
      const { data: usageRow } = await supabaseAdmin.from('usage_counters').select('voice_minutes_used').eq('client_id', clientId).eq('period', period).maybeSingle()
      const minutesUsed = Number(usageRow?.voice_minutes_used || 0)
      if (minutesUsed >= voiceLimit) {
        const quotaMsg = voiceLimit === 0
          ? 'L agent vocal n est pas inclus dans votre plan. Veuillez passer au plan Pro pour l utiliser.'
          : 'Votre quota de minutes vocales est atteint pour ce mois. Veuillez contacter le support ou passer au plan superieur.'
        if (stream) return streamResponse(res, callId, quotaMsg)
        return res.status(200).json(buildCompletionResponse(callId, quotaMsg))
      }
    }

    const playbook = await getVoicePlaybook(clientId)

    const normalized = {
      customer_email: `voice-call-${callId}@actero.voice`,
      customer_name: 'Caller',
      message: userMessage,
      subject: 'Voice call',
      session_id: `voice-${callId}`,
      source: 'voice_call',
    }

    const brainResult = await runBrain(supabaseAdmin, {
      event: { id: callId, source: 'voice_call' },
      playbook,
      clientId,
      normalized,
      conversationHistory: buildHistory(messages),
    })

    let reply = brainResult?.aiResponse
    if (!reply || typeof reply !== 'string') {
      reply =
        'Je vais faire de mon mieux pour vous aider. Pouvez-vous me donner un peu plus de details ?'
    }

    const clean = sanitizeForVoice(reply)

    if (stream) return streamResponse(res, callId, clean)
    return res.status(200).json(buildCompletionResponse(callId, clean))
  } catch (err) {
    console.error('[voice/custom-llm] Brain error:', err.message)
    if (stream) {
      try { return await streamResponse(res, callId, FALLBACK_SAFE) } catch {}
    }
    return res.status(200).json(buildCompletionResponse(callId, FALLBACK_SAFE))
  }
}

export default withSentry(handler)
