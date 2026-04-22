/**
 * Actero Voice Agent — Update
 *
 * Patches an existing ElevenLabs agent's prompt / voice / greeting.
 * Body: { client_id, voice_id?, greeting?, extra_instructions? }
 *
 * POST /api/voice/update-agent
 */
import { withSentry } from '../lib/sentry.js'
import { loadClientConfig } from '../engine/lib/config-loader.js'
import {
  supabaseAdmin,
  authenticateClientAccess,
  requireElevenLabsKey,
  elevenLabsFetch,
  buildVoiceSystemPrompt,
  readJsonBody,
} from './_helpers.js'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireElevenLabsKey(res)) return

  req.body = await readJsonBody(req)
  const auth = await authenticateClientAccess(req, res, req.body?.client_id)
  if (!auth) return
  const { clientId } = auth

  const { voice_id, greeting, extra_instructions } = req.body || {}

  try {
    const { data: settings } = await supabaseAdmin
      .from('client_settings')
      .select('elevenlabs_agent_id')
      .eq('client_id', clientId)
      .maybeSingle()

    const agentId = settings?.elevenlabs_agent_id
    if (!agentId) {
      return res.status(404).json({ error: 'No ElevenLabs agent provisioned for this client' })
    }

    const clientConfig = await loadClientConfig(supabaseAdmin, clientId)
    let voicePrompt = buildVoiceSystemPrompt(clientConfig)
    if (extra_instructions && typeof extra_instructions === 'string') {
      voicePrompt += `\n\nINSTRUCTIONS SUPPLEMENTAIRES:\n${extra_instructions.trim()}`
    }

    const finalGreeting = greeting || clientConfig.settings?.voice_greeting
    const finalVoiceId =
      voice_id ||
      clientConfig.settings?.elevenlabs_voice_id ||
      process.env.ELEVENLABS_DEFAULT_VOICE_ID

    // Re-send the full prompt structure (including custom_llm) so PATCH does
    // not accidentally wipe the LLM wiring that was set during creation.
    // api_key needs to be a secret_id object — we use request_headers instead.
    const customLlmUrl = `${(process.env.PUBLIC_API_URL || '').replace(/\/$/, '')}/api/voice/custom-llm?client_id=${clientId}`
    const payload = {
      conversation_config: {
        agent: {
          ...(finalGreeting ? { first_message: finalGreeting } : {}),
          language: 'fr',
          prompt: {
            prompt: voicePrompt,
            llm: 'custom-llm',
            custom_llm: {
              url: customLlmUrl,
              model_id: 'actero-brain',
              api_type: 'chat_completions',
              request_headers: {
                'X-Voice-Auth-Token': process.env.VOICE_LLM_SECRET,
              },
            },
          },
        },
        // Non-english agents MUST use turbo or flash v2_5 (we pick flash).
        ...(finalVoiceId ? { tts: { voice_id: finalVoiceId, model_id: 'eleven_flash_v2_5' } } : {}),
      },
    }

    const { ok, status, data } = await elevenLabsFetch(`/v1/convai/agents/${agentId}`, {
      method: 'PATCH',
      body: payload,
    })

    if (!ok) {
      console.error('[voice/update-agent] ElevenLabs error', status, JSON.stringify(data))
      const upstreamMsg =
        data?.detail?.message ||
        (typeof data?.detail === 'string' ? data.detail : null) ||
        (Array.isArray(data?.detail) ? data.detail.map(d => d?.msg || JSON.stringify(d)).join(' | ') : null) ||
        data?.error ||
        data?.message ||
        (data?.raw ? String(data.raw).slice(0, 200) : null) ||
        `ElevenLabs returned status ${status}`
      return res.status(502).json({
        error: `ElevenLabs: ${upstreamMsg}`,
        upstream_status: status,
      })
    }

    const update = {}
    if (finalGreeting) update.voice_greeting = finalGreeting
    if (finalVoiceId) update.elevenlabs_voice_id = finalVoiceId
    if (Object.keys(update).length > 0) {
      await supabaseAdmin.from('client_settings').update(update).eq('client_id', clientId)
    }

    return res.status(200).json({ success: true, agent_id: agentId })
  } catch (err) {
    console.error('[voice/update-agent] Error:', err.message)
    return res.status(500).json({ error: 'Internal error', message: err.message })
  }
}

export default withSentry(handler)
