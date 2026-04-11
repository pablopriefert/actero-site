/**
 * Actero Voice Agent — shared helpers
 *
 * Small utilities shared by all /api/voice/* endpoints:
 *   - service-role Supabase client
 *   - JWT auth + client access check (multi-tenant strict)
 *   - ElevenLabs fetch wrapper with clean error handling
 *   - voice prompt + system prompt adaptation
 *   - response sanitization for natural speech
 */
import { createClient } from '@supabase/supabase-js'
import { buildSystemPrompt } from '../engine/lib/prompt-builder.js'

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const ELEVENLABS_BASE = 'https://api.elevenlabs.io'

export function hasElevenLabsKey() {
  return Boolean(process.env.ELEVENLABS_API_KEY)
}

export function requireElevenLabsKey(res) {
  if (!hasElevenLabsKey()) {
    res.status(503).json({
      error: 'ELEVENLABS_API_KEY missing in env',
      hint: 'Add ELEVENLABS_API_KEY in your environment variables to enable the voice agent.',
    })
    return false
  }
  return true
}

/**
 * Authenticate the caller via Bearer token and ensure the user has access to
 * the requested client_id. Returns { user, clientId } or writes the error
 * response itself and returns null.
 */
export async function authenticateClientAccess(req, res, clientIdFromBody) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization header' })
    return null
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    res.status(401).json({ error: 'Invalid token' })
    return null
  }

  const clientId = clientIdFromBody || req.body?.client_id || req.query?.client_id
  if (!clientId) {
    res.status(400).json({ error: 'client_id required' })
    return null
  }

  const { data: membership } = await supabaseAdmin
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .maybeSingle()

  if (!membership) {
    res.status(403).json({ error: 'Forbidden: no access to this client' })
    return null
  }

  return { user, clientId }
}

/**
 * Minimal JSON body parser (Vercel Node fns usually already parse, but we
 * stay defensive for POSTs that arrive as a string).
 */
export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  const chunks = []
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c)
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return {} }
}

/**
 * Wrap fetch() to ElevenLabs API with xi-api-key + JSON helpers.
 */
export async function elevenLabsFetch(path, { method = 'GET', body, query } = {}) {
  const url = new URL(path, ELEVENLABS_BASE)
  if (query && typeof query === 'object') {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    }
  }

  const headers = { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
  let payload
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = typeof body === 'string' ? body : JSON.stringify(body)
  }

  const resp = await fetch(url.toString(), { method, headers, body: payload })
  const text = await resp.text()
  let data = null
  if (text) {
    try { data = JSON.parse(text) } catch { data = { raw: text } }
  }
  return { ok: resp.ok, status: resp.status, data }
}

/**
 * Build the voice-adapted system prompt (short, spoken, no markdown, no URLs).
 * Reuses the existing buildSystemPrompt() to keep the brand voice consistent.
 */
export function buildVoiceSystemPrompt(clientConfig) {
  const base = buildSystemPrompt(clientConfig)
  const voiceInstructions = `

MODE VOCAL — CONTRAINTES TRES STRICTES:
- Tu parles a un client au telephone. Reponds en francais parle naturel.
- Reponses TRES COURTES : 3 phrases maximum, idealement 1 a 2.
- Pas de markdown, pas de listes a puces, pas de symboles, pas de titres.
- NE LIS JAMAIS d'URL a voix haute. Si tu dois partager un lien, dis plutot "je vous envoie le lien par email" ou "vous trouverez l'information dans la section X du site".
- Pas de formules de salutation ("Bonjour", "Merci de nous contacter") — l'agent les a deja dites.
- Si tu ne sais pas, dis-le et propose de transferer a un conseiller.
- Si le client est agace, reste calme, reconnais son ressenti et propose de faire remonter au responsable.
- Tu DOIS repondre en texte brut uniquement (pas de JSON pour le mode vocal).`
  return base + voiceInstructions
}

/**
 * Clean up an LLM response so it sounds natural when spoken by TTS.
 * - strip markdown (bold, italic, headings, code fences, backticks, bullets)
 * - strip full URLs
 * - collapse whitespace
 * - truncate to ~500 chars at a sentence boundary
 */
export function sanitizeForVoice(raw) {
  if (!raw) return 'Desole, je n ai pas bien compris. Pouvez-vous reformuler ?'
  let txt = String(raw)

  // If the model accidentally returned JSON (our brain sometimes does), try
  // to extract the "response" field before cleaning.
  const trimmed = txt.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed.response === 'string') {
        txt = parsed.response
      }
    } catch { /* keep raw */ }
  }

  txt = txt
    .replace(/```[\s\S]*?```/g, ' ')       // code fences
    .replace(/`([^`]+)`/g, '$1')            // inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1')      // bold
    .replace(/\*([^*]+)\*/g, '$1')          // italic
    .replace(/__([^_]+)__/g, '$1')          // bold alt
    .replace(/_([^_]+)_/g, '$1')            // italic alt
    .replace(/^#{1,6}\s+/gm, '')            // headings
    .replace(/^[-*+]\s+/gm, '')             // bullets
    .replace(/^\d+\.\s+/gm, '')             // numbered lists
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1') // markdown links -> label
    .replace(/https?:\/\/\S+/gi, '')        // raw URLs
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (!txt) return 'Desole, je n ai pas bien compris. Pouvez-vous reformuler ?'

  if (txt.length > 500) {
    const cut = txt.slice(0, 500)
    const lastDot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
    txt = lastDot > 200 ? cut.slice(0, lastDot + 1) : cut + '...'
  }

  return txt
}
