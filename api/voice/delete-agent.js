/**
 * Actero Voice Agent — Delete
 *
 * Removes the ElevenLabs agent for a client and disables the voice feature
 * in client_settings.
 *
 * POST /api/voice/delete-agent   { client_id }
 */
import { withSentry } from '../lib/sentry.js'
import {
  supabaseAdmin,
  authenticateClientAccess,
  requireElevenLabsKey,
  elevenLabsFetch,
  twilioFetch,
  hasTwilioCredentials,
  readJsonBody,
} from './_helpers.js'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireElevenLabsKey(res)) return

  req.body = await readJsonBody(req)
  const auth = await authenticateClientAccess(req, res, req.body?.client_id)
  if (!auth) return
  const { clientId } = auth

  try {
    const { data: settings } = await supabaseAdmin
      .from('client_settings')
      .select('elevenlabs_agent_id, voice_phone_number_id, voice_phone_twilio_sid')
      .eq('client_id', clientId)
      .maybeSingle()

    // Best-effort release of the Twilio number first so we stop being billed
    if (settings?.voice_phone_number_id) {
      try {
        await elevenLabsFetch(`/v1/convai/phone-numbers/${settings.voice_phone_number_id}`, {
          method: 'DELETE',
        })
      } catch { /* best effort */ }
    }
    if (settings?.voice_phone_twilio_sid && hasTwilioCredentials()) {
      try {
        await twilioFetch(`/IncomingPhoneNumbers/${settings.voice_phone_twilio_sid}.json`, {
          method: 'DELETE',
        })
      } catch { /* best effort */ }
    }

    const agentId = settings?.elevenlabs_agent_id

    if (agentId) {
      const { ok, status, data } = await elevenLabsFetch(`/v1/convai/agents/${agentId}`, {
        method: 'DELETE',
      })
      if (!ok && status !== 404) {
        return res.status(502).json({
          error: 'ElevenLabs agent deletion failed',
          status,
          details: data,
        })
      }
    }

    await supabaseAdmin
      .from('client_settings')
      .update({
        elevenlabs_agent_id: null,
        voice_agent_enabled: false,
        voice_phone_number: null,
        voice_phone_number_id: null,
        voice_phone_twilio_sid: null,
        voice_phone_provider: null,
        voice_phone_country: null,
        voice_phone_type: null,
        voice_phone_provisioned_at: null,
      })
      .eq('client_id', clientId)

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[voice/delete-agent] Error:', err.message)
    return res.status(500).json({ error: 'Internal error', message: err.message })
  }
}

export default withSentry(handler)
