/**
 * Actero Voice Agent — Provision Twilio number (1-click)
 *
 * Buys an available Twilio phone number on the Actero master account, imports
 * it into ElevenLabs Conv AI as a Twilio-backed number, and assigns it to the
 * client's existing agent. Rolls back the Twilio purchase if any later step
 * fails so we never pay for an orphaned number.
 *
 * POST /api/voice/provision-twilio-number
 *   { client_id, country = 'FR', type = 'mobile' | 'local' }
 */
import {
  supabaseAdmin,
  authenticateClientAccess,
  requireElevenLabsKey,
  requireTwilioCredentials,
  elevenLabsFetch,
  twilioFetch,
  readJsonBody,
} from './_helpers.js'

const TYPE_TO_TWILIO = { mobile: 'Mobile', local: 'Local' }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireElevenLabsKey(res)) return
  if (!requireTwilioCredentials(res)) return

  req.body = await readJsonBody(req)
  const auth = await authenticateClientAccess(req, res, req.body?.client_id)
  if (!auth) return
  const { clientId } = auth

  const country = (req.body?.country || 'FR').toUpperCase()
  const type = req.body?.type === 'local' ? 'local' : 'mobile'
  const twilioType = TYPE_TO_TWILIO[type]

  let purchasedSid = null

  try {
    // Check the client has an ElevenLabs agent first
    const { data: settings } = await supabaseAdmin
      .from('client_settings')
      .select('elevenlabs_agent_id, voice_phone_number, client_id')
      .eq('client_id', clientId)
      .maybeSingle()

    if (!settings?.elevenlabs_agent_id) {
      return res.status(400).json({
        error: 'No agent provisioned. Activate the voice agent first.',
      })
    }
    if (settings.voice_phone_number) {
      return res.status(400).json({
        error: 'A phone number is already attached to this client. Release it first.',
      })
    }

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('brand_name')
      .eq('id', clientId)
      .maybeSingle()
    const brandName = client?.brand_name || 'Actero client'

    // Step A — Search for an available number
    let availableNumbers = await searchAvailable(country, twilioType)

    // Fallback to the other type if nothing found
    if (!availableNumbers.length) {
      const fallbackType = type === 'mobile' ? 'Local' : 'Mobile'
      availableNumbers = await searchAvailable(country, fallbackType)
    }

    if (!availableNumbers.length) {
      return res.status(503).json({
        error: 'No Twilio number available right now',
        hint: 'Try again in a few minutes or pick a different country.',
      })
    }

    const candidate = availableNumbers[0]
    const phoneNumber = candidate.phone_number

    // Step B — Purchase the number
    const buy = await twilioFetch('/IncomingPhoneNumbers.json', {
      method: 'POST',
      form: {
        PhoneNumber: phoneNumber,
        FriendlyName: `Actero - ${brandName}`,
      },
    })
    if (!buy.ok || !buy.data?.sid) {
      console.error('[voice/provision-twilio-number] Twilio purchase failed', buy.status, JSON.stringify(buy.data))
      return res.status(502).json({
        error: `Twilio: ${buy.data?.message || buy.data?.detail || 'purchase failed'}`,
        upstream_status: buy.status,
        upstream_data: buy.data,
        step: 'twilio_purchase',
      })
    }
    purchasedSid = buy.data.sid

    // Step C — Import into ElevenLabs Conv AI as a Twilio number
    const imported = await elevenLabsFetch('/v1/convai/phone-numbers/create', {
      method: 'POST',
      body: {
        phone_number: phoneNumber,
        label: `Actero - ${brandName}`,
        provider: 'twilio',
        sid: process.env.TWILIO_ACCOUNT_SID,
        token: process.env.TWILIO_AUTH_TOKEN,
      },
    })
    if (!imported.ok || !imported.data?.phone_number_id) {
      console.error('[voice/provision-twilio-number] ElevenLabs import failed', imported.status, JSON.stringify(imported.data))
      // Rollback Twilio purchase
      await twilioFetch(`/IncomingPhoneNumbers/${purchasedSid}.json`, { method: 'DELETE' })
        .catch(() => {})
      const upstreamMsg =
        imported.data?.detail?.message ||
        (typeof imported.data?.detail === 'string' ? imported.data.detail : null) ||
        (Array.isArray(imported.data?.detail) ? imported.data.detail.map(d => d?.msg || JSON.stringify(d)).join(' | ') : null) ||
        imported.data?.error ||
        imported.data?.message ||
        `ElevenLabs returned status ${imported.status}`
      return res.status(502).json({
        error: `ElevenLabs import: ${upstreamMsg}`,
        upstream_status: imported.status,
        upstream_data: imported.data,
        step: 'elevenlabs_import',
      })
    }
    const phoneNumberId = imported.data.phone_number_id

    // Step D — Assign to the client's agent
    const assign = await elevenLabsFetch(`/v1/convai/phone-numbers/${phoneNumberId}/assign`, {
      method: 'POST',
      body: { agent_id: settings.elevenlabs_agent_id },
    })
    if (!assign.ok) {
      console.error('[voice/provision-twilio-number] ElevenLabs assign failed', assign.status, JSON.stringify(assign.data))
      // Rollback ElevenLabs import + Twilio purchase
      await elevenLabsFetch(`/v1/convai/phone-numbers/${phoneNumberId}`, { method: 'DELETE' })
        .catch(() => {})
      await twilioFetch(`/IncomingPhoneNumbers/${purchasedSid}.json`, { method: 'DELETE' })
        .catch(() => {})
      const upstreamMsg =
        assign.data?.detail?.message ||
        (typeof assign.data?.detail === 'string' ? assign.data.detail : null) ||
        (Array.isArray(assign.data?.detail) ? assign.data.detail.map(d => d?.msg || JSON.stringify(d)).join(' | ') : null) ||
        assign.data?.error ||
        assign.data?.message ||
        `ElevenLabs returned status ${assign.status}`
      return res.status(502).json({
        error: `ElevenLabs assign: ${upstreamMsg}`,
        upstream_status: assign.status,
        upstream_data: assign.data,
        step: 'elevenlabs_assign',
      })
    }

    // Step E — Persist
    const provisionedAt = new Date().toISOString()
    await supabaseAdmin
      .from('client_settings')
      .update({
        voice_phone_number: phoneNumber,
        voice_phone_number_id: phoneNumberId,
        voice_phone_twilio_sid: purchasedSid,
        voice_phone_provider: 'twilio',
        voice_phone_country: country,
        voice_phone_type: type,
        voice_phone_provisioned_at: provisionedAt,
      })
      .eq('client_id', clientId)

    return res.status(200).json({
      success: true,
      phone_number: phoneNumber,
      country,
      type,
      provisioned_at: provisionedAt,
    })
  } catch (err) {
    // Best-effort rollback if we crashed mid-flight
    if (purchasedSid) {
      await twilioFetch(`/IncomingPhoneNumbers/${purchasedSid}.json`, { method: 'DELETE' })
        .catch(() => {})
    }
    return res.status(500).json({ error: 'Internal error', message: err.message })
  }
}

async function searchAvailable(country, twilioType) {
  const path = `/AvailablePhoneNumbers/${country}/${twilioType}.json`
  const { ok, status, data } = await twilioFetch(path, {
    method: 'GET',
    query: { VoiceEnabled: 'true', Limit: 5 },
  })
  if (!ok) {
    console.error(`[voice/provision-twilio-number] Twilio search ${country}/${twilioType} failed`, status, JSON.stringify(data))
    return []
  }
  return Array.isArray(data?.available_phone_numbers) ? data.available_phone_numbers : []
}
