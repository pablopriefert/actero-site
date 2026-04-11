/**
 * Actero Voice Agent — Attach phone number
 *
 * Attaches an ElevenLabs-managed phone number to the client's agent.
 *
 * POST /api/voice/attach-number
 *   { client_id, phone_number_id, phone_number }
 */
import {
  supabaseAdmin,
  authenticateClientAccess,
  requireElevenLabsKey,
  elevenLabsFetch,
  readJsonBody,
} from './_helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireElevenLabsKey(res)) return

  req.body = await readJsonBody(req)
  const auth = await authenticateClientAccess(req, res, req.body?.client_id)
  if (!auth) return
  const { clientId } = auth

  const { phone_number_id, phone_number } = req.body || {}
  if (!phone_number_id) {
    return res.status(400).json({ error: 'phone_number_id required' })
  }

  try {
    const { data: settings } = await supabaseAdmin
      .from('client_settings')
      .select('elevenlabs_agent_id')
      .eq('client_id', clientId)
      .maybeSingle()

    const agentId = settings?.elevenlabs_agent_id
    if (!agentId) {
      return res.status(400).json({
        error: 'No agent provisioned. Call /api/voice/setup-agent first.',
      })
    }

    const { ok, status, data } = await elevenLabsFetch(
      `/v1/convai/phone-numbers/${phone_number_id}/assign`,
      {
        method: 'POST',
        body: { agent_id: agentId },
      }
    )

    if (!ok) {
      return res.status(502).json({
        error: 'ElevenLabs number assignment failed',
        status,
        details: data,
      })
    }

    await supabaseAdmin
      .from('client_settings')
      .update({
        voice_phone_number: phone_number || data?.phone_number || null,
        voice_phone_number_id: phone_number_id,
      })
      .eq('client_id', clientId)

    return res.status(200).json({
      success: true,
      agent_id: agentId,
      phone_number: phone_number || data?.phone_number || null,
    })
  } catch (err) {
    console.error('[voice/attach-number] Error:', err.message)
    return res.status(500).json({ error: 'Internal error', message: err.message })
  }
}
