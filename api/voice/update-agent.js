/**
 * Actero Voice Agent — Update
 *
 * Patches an existing ElevenLabs agent's prompt / voice / greeting.
 * Body: { client_id, voice_id?, greeting?, extra_instructions? }
 *
 * POST /api/voice/update-agent
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

    const payload = {
      conversation_config: {
        agent: {
          prompt: { prompt: voicePrompt },
          ...(finalGreeting ? { first_message: finalGreeting } : {}),
          language: 'fr',
        },
        ...(finalVoiceId ? { tts: { voice_id: finalVoiceId } } : {}),
      },
    }

    const { ok, status, data } = await elevenLabsFetch(`/v1/convai/agents/${agentId}`, {
      method: 'PATCH',
      body: payload,
    })

    if (!ok) {
      return res.status(502).json({
        error: 'ElevenLabs agent update failed',
        status,
        details: data,
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
