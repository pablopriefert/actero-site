/**
 * Actero Voice Agent — List phone numbers
 *
 * Proxies ElevenLabs to list phone numbers already attached to the workspace.
 * Buying a new number is done from the ElevenLabs dashboard (no public
 * purchase API today), so we also return a deep link to help the merchant.
 *
 * GET /api/voice/list-numbers?client_id=<uuid>
 */
import { withSentry } from '../lib/sentry.js'
import {
  authenticateClientAccess,
  requireElevenLabsKey,
  elevenLabsFetch,
} from './_helpers.js'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireElevenLabsKey(res)) return

  const auth = await authenticateClientAccess(req, res, req.query?.client_id)
  if (!auth) return

  try {
    // Primary: list owned numbers in the ElevenLabs workspace.
    const { ok, status, data } = await elevenLabsFetch('/v1/convai/phone-numbers', {
      method: 'GET',
    })

    if (ok) {
      const numbers = Array.isArray(data) ? data : data?.phone_numbers || []
      return res.status(200).json({
        numbers,
        purchase_url: 'https://elevenlabs.io/app/conversational-ai/phone-numbers',
        note: 'Pour acheter un nouveau numero, utilisez le dashboard ElevenLabs puis attachez-le a votre agent via /api/voice/attach-number.',
      })
    }

    // Fallback: API shape may differ — surface a helpful message.
    return res.status(200).json({
      numbers: [],
      purchase_url: 'https://elevenlabs.io/app/conversational-ai/phone-numbers',
      note: 'Achetez un numero directement sur le dashboard ElevenLabs puis attachez-le ici.',
      upstream_status: status,
      upstream_details: data,
    })
  } catch (err) {
    console.error('[voice/list-numbers] Error:', err.message)
    return res.status(500).json({ error: 'Internal error', message: err.message })
  }
}

export default withSentry(handler)
