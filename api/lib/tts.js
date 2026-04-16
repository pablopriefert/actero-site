/**
 * Actero — TTS (Text-to-Speech) shared layer.
 *
 * Single source of truth for calling ElevenLabs. Used by:
 *   - /api/text-to-speech        (streaming playback, Copilot)
 *   - /api/tts/generate-upload   (persisted audio for escalation replies)
 *
 * Env required:
 *   ELEVENLABS_API_KEY
 * Env optional:
 *   ELEVENLABS_DEFAULT_VOICE_ID (default: Rachel — warm FR female)
 *   ELEVENLABS_MODEL_ID         (default: eleven_multilingual_v2)
 *
 * Security: ONLY callable from the backend. Frontend never touches the API key.
 */

export const DEFAULT_VOICE_ID = process.env.ELEVENLABS_DEFAULT_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
export const DEFAULT_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'
export const MAX_TEXT_LENGTH = 2500 // characters — avoids runaway generations

/**
 * Strip markdown / bullet noise so the audio reads naturally.
 */
export function cleanTextForSpeech(text) {
  if (!text) return ''
  return String(text)
    .replace(/```[\s\S]*?```/g, '') // drop code blocks
    .replace(/`([^`]+)`/g, '$1') // unwrap inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1') // **bold**
    .replace(/\*([^*]+)\*/g, '$1') // *italic*
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/^\s*[-•]\s+/gm, '') // bullet markers
    .replace(/^\s*\d+\.\s+/gm, '') // numbered list markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) -> text
    .replace(/https?:\/\/\S+/g, '') // raw urls
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Truncate to MAX_TEXT_LENGTH at the last sentence/comma boundary.
 */
export function truncateForSpeech(text, maxLen = MAX_TEXT_LENGTH) {
  if (!text || text.length <= maxLen) return text
  const window = text.slice(0, maxLen)
  const lastSentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '))
  const cutIdx = lastSentence > maxLen * 0.6 ? lastSentence + 1 : window.lastIndexOf(' ')
  return (cutIdx > 0 ? window.slice(0, cutIdx) : window).trim() + '…'
}

/**
 * Call ElevenLabs TTS API and return the audio as a Buffer.
 * Throws on any non-2xx response.
 */
export async function synthesize({
  text,
  voiceId = DEFAULT_VOICE_ID,
  modelId = DEFAULT_MODEL_ID,
  voiceSettings = null,
}) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY missing in server environment')
  }

  const cleaned = truncateForSpeech(cleanTextForSpeech(text))
  if (!cleaned || cleaned.length < 2) {
    throw new Error('text too short or empty after cleaning')
  }

  const settings = voiceSettings || {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.3,
    use_speaker_boost: true,
  }

  const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: cleaned,
      model_id: modelId,
      voice_settings: settings,
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`ElevenLabs ${resp.status}: ${errText.slice(0, 200)}`)
  }

  const arrayBuffer = await resp.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
