/**
 * Actero Voice Agent — Test call (WebRTC signed URL)
 *
 * Generates a signed URL so the merchant can test their voice agent in the
 * browser (via ElevenLabs' WebRTC widget) without owning a phone number.
 *
 * POST /api/voice/test-call   { client_id }
 * -> { signed_url }
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
      '/v1/convai/conversation/get_signed_url',
      {
        method: 'GET',
        query: { agent_id: agentId },
      }
    )

    if (!ok) {
      return res.status(502).json({
        error: 'ElevenLabs signed URL generation failed',
        status,
        details: data,
      })
    }

    return res.status(200).json({
      signed_url: data?.signed_url || data?.url || null,
      agent_id: agentId,
    })
  } catch (err) {
    console.error('[voice/test-call] Error:', err.message)
    return res.status(500).json({ error: 'Internal error', message: err.message })
  }
}
