/**
 * POST /api/text-to-speech
 *
 * Streaming TTS — returns audio/mpeg bytes directly. Used by the Client
 * Copilot bubble to let the user listen to replies.
 *
 * Body:  { text, voice_id? }
 * Auth:  Bearer JWT (any authenticated user)
 */
import { withSentry } from './lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { synthesize, DEFAULT_VOICE_ID } from './lib/tts.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth — any authenticated user can synthesize (rate-limited by ElevenLabs quota).
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé.' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Non autorisé.' })

  const { text, voice_id } = req.body || {}
  if (!text) return res.status(400).json({ error: 'Missing text' })

  try {
    const buffer = await synthesize({
      text,
      voiceId: voice_id || DEFAULT_VOICE_ID,
    })
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Length', buffer.byteLength)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    return res.status(200).send(buffer)
  } catch (error) {
    console.error('[text-to-speech] error:', error.message)
    return res.status(500).json({ error: error.message || 'TTS failed' })
  }
}

export default withSentry(handler)
