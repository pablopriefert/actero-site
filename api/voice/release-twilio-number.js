/**
 * Actero Voice Agent — Release Twilio number
 *
 * Best-effort cleanup: detach from ElevenLabs, release on Twilio, reset
 * client_settings. Each step is wrapped so a partial failure does not block
 * the merchant.
 *
 * POST /api/voice/release-twilio-number   { client_id }
 */
import { withSentry } from '../lib/sentry.js'
import {
  supabaseAdmin,
  authenticateClientAccess,
  hasElevenLabsKey,
  hasTwilioCredentials,
  elevenLabsFetch,
  twilioFetch,
  readJsonBody,
} from './_helpers.js'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  req.body = await readJsonBody(req)
  const auth = await authenticateClientAccess(req, res, req.body?.client_id)
  if (!auth) return
  const { clientId } = auth

  try {
    const { data: settings } = await supabaseAdmin
      .from('client_settings')
      .select('voice_phone_number, voice_phone_number_id, voice_phone_twilio_sid')
      .eq('client_id', clientId)
      .maybeSingle()

    const released = settings?.voice_phone_number || null

    // Step A — Detach from ElevenLabs
    if (settings?.voice_phone_number_id && hasElevenLabsKey()) {
      try {
        await elevenLabsFetch(`/v1/convai/phone-numbers/${settings.voice_phone_number_id}`, {
          method: 'DELETE',
        })
      } catch (e) {
        // best effort
      }
    }

    // Step B — Release on Twilio
    if (settings?.voice_phone_twilio_sid && hasTwilioCredentials()) {
      try {
        await twilioFetch(`/IncomingPhoneNumbers/${settings.voice_phone_twilio_sid}.json`, {
          method: 'DELETE',
        })
      } catch (e) {
        // best effort
      }
    }

    // Step C — Reset
    await supabaseAdmin
      .from('client_settings')
      .update({
        voice_phone_number: null,
        voice_phone_number_id: null,
        voice_phone_twilio_sid: null,
        voice_phone_provider: null,
        voice_phone_country: null,
        voice_phone_type: null,
        voice_phone_provisioned_at: null,
      })
      .eq('client_id', clientId)

    return res.status(200).json({ success: true, released })
  } catch (err) {
    return res.status(500).json({ error: 'Internal error', message: err.message })
  }
}

export default withSentry(handler)
