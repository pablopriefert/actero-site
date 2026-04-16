/**
 * POST /api/tts/generate-upload
 *
 * Generates speech audio via ElevenLabs AND uploads it to Supabase Storage
 * (bucket `tts-audio`, public bucket). Returns the public URL so it can be
 * embedded in emails, messages, etc.
 *
 * Used by the Escalations flow to attach a voice version to a human reply.
 *
 * Body:  { text, voice_id?, conversation_id?, purpose? }
 *   - conversation_id: optional, used for filename traceability
 *   - purpose: optional tag, e.g. 'escalation_reply'
 * Auth:  Bearer JWT (any authenticated user)
 *
 * Response:
 *   { audio_url, path, bytes, voice_id }
 */
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { synthesize, DEFAULT_VOICE_ID } from '../lib/tts.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const BUCKET = 'tts-audio'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth check
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé.' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Non autorisé.' })

  // Resolve the client_id this user belongs to (for folder scoping).
  const { data: link } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .maybeSingle()
  const clientId = link?.client_id || user.id // fallback to user-scoped folder

  const { text, voice_id, conversation_id, purpose } = req.body || {}
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing text' })
  }

  try {
    // 1. Synthesize via ElevenLabs
    const audioBuffer = await synthesize({
      text,
      voiceId: voice_id || DEFAULT_VOICE_ID,
    })

    // 2. Build a traceable path: {client_id}/{YYYY-MM}/{purpose-conv-nonce}.mp3
    const nonce = crypto.randomBytes(6).toString('hex')
    const yearMonth = new Date().toISOString().slice(0, 7) // 2026-04
    const safeTag = [purpose || 'reply', conversation_id]
      .filter(Boolean)
      .map(s => String(s).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40))
      .join('-')
    const filename = `${safeTag || 'audio'}-${nonce}.mp3`
    const path = `${clientId}/${yearMonth}/${filename}`

    // 3. Upload to Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, audioBuffer, {
        contentType: 'audio/mpeg',
        cacheControl: '2592000', // 30 days browser cache
        upsert: false,
      })

    if (uploadError) {
      console.error('[tts/generate-upload] upload error:', uploadError.message)
      return res.status(500).json({ error: 'Storage upload failed', detail: uploadError.message })
    }

    // 4. Get the public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const audioUrl = urlData?.publicUrl
    if (!audioUrl) {
      return res.status(500).json({ error: 'Could not build public URL' })
    }

    return res.status(200).json({
      audio_url: audioUrl,
      path,
      bytes: audioBuffer.byteLength,
      voice_id: voice_id || DEFAULT_VOICE_ID,
    })
  } catch (error) {
    console.error('[tts/generate-upload] error:', error.message)
    return res.status(500).json({ error: error.message || 'TTS generation failed' })
  }
}
