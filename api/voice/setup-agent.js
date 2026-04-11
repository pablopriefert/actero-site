/**
 * Actero Voice Agent — Setup
 *
 * Provisions a new ElevenLabs Conversational AI agent for a client, wiring
 * it to our custom-llm endpoint so the brand's brain handles every turn.
 *
 * POST /api/voice/setup-agent   { client_id }
 */
import { loadClientConfig } from '../engine/lib/config-loader.js'
import {
  supabaseAdmin,
  authenticateClientAccess,
  requireElevenLabsKey,
  elevenLabsFetch,
  buildVoiceSystemPrompt,
  readJsonBody,
} from './_helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireElevenLabsKey(res)) return
  if (!process.env.VOICE_LLM_SECRET) {
    return res.status(503).json({ error: 'VOICE_LLM_SECRET missing in env' })
  }
  if (!process.env.PUBLIC_API_URL) {
    return res.status(503).json({ error: 'PUBLIC_API_URL missing in env' })
  }

  req.body = await readJsonBody(req)
  const auth = await authenticateClientAccess(req, res, req.body?.client_id)
  if (!auth) return
  const { clientId } = auth

  try {
    const clientConfig = await loadClientConfig(supabaseAdmin, clientId)
    const voicePrompt = buildVoiceSystemPrompt(clientConfig)

    const greeting =
      clientConfig.settings?.voice_greeting ||
      `Bonjour, vous etes chez ${clientConfig.client.brand_name}, comment puis-je vous aider ?`
    const voiceId =
      clientConfig.settings?.elevenlabs_voice_id ||
      process.env.ELEVENLABS_DEFAULT_VOICE_ID

    if (!voiceId) {
      return res.status(503).json({ error: 'ELEVENLABS_DEFAULT_VOICE_ID missing in env' })
    }

    const customLlmUrl = `${process.env.PUBLIC_API_URL.replace(/\/$/, '')}/api/voice/custom-llm?client_id=${clientId}`

    // ElevenLabs Conv AI agent payload — `llm` and `custom_llm` MUST be
    // nested inside `agent.prompt` (NOT at conversation_config root).
    // Ref: https://elevenlabs.io/docs/conversational-ai/customization/llm/custom-llm
    const payload = {
      name: `${clientConfig.client.brand_name} - Agent Vocal`,
      conversation_config: {
        agent: {
          first_message: greeting,
          language: 'fr',
          prompt: {
            prompt: voicePrompt,
            llm: 'custom-llm',
            custom_llm: {
              url: customLlmUrl,
              model_id: 'actero-brain',
              api_key: process.env.VOICE_LLM_SECRET,
            },
          },
        },
        tts: { voice_id: voiceId },
      },
    }

    const { ok, status, data } = await elevenLabsFetch('/v1/convai/agents/create', {
      method: 'POST',
      body: payload,
    })

    if (!ok) {
      const upstreamMsg =
        data?.detail?.message ||
        (typeof data?.detail === 'string' ? data.detail : null) ||
        data?.error ||
        data?.message ||
        (data?.raw ? String(data.raw).slice(0, 200) : null) ||
        `ElevenLabs returned status ${status}`
      return res.status(502).json({
        error: `ElevenLabs: ${upstreamMsg}`,
        upstream_status: status,
        hint: status === 401
          ? 'Verifie ELEVENLABS_API_KEY (workspace API key valide).'
          : status === 402
          ? 'Ton plan ElevenLabs ne couvre pas Conversational AI. Passe en plan Creator/Pro.'
          : status === 422
          ? 'ELEVENLABS_DEFAULT_VOICE_ID invalide ou prompt mal forme.'
          : undefined,
      })
    }

    const agentId = data?.agent_id || data?.id
    if (!agentId) {
      return res.status(502).json({
        error: 'ElevenLabs response missing agent_id',
        details: data,
      })
    }

    const { error: upsertErr } = await supabaseAdmin
      .from('client_settings')
      .update({
        elevenlabs_agent_id: agentId,
        elevenlabs_voice_id: voiceId,
        voice_agent_enabled: true,
        voice_greeting: greeting,
      })
      .eq('client_id', clientId)

    if (upsertErr) {
      console.error('[voice/setup-agent] Supabase update error:', upsertErr.message)
    }

    return res.status(200).json({ success: true, agent_id: agentId })
  } catch (err) {
    console.error('[voice/setup-agent] Error:', err.message)
    return res.status(500).json({ error: 'Internal error', message: err.message })
  }
}
