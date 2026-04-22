/**
 * Voice Agent — Detach the SIP trunk.
 *
 * POST /api/voice/detach-sip-trunk
 * Body: { client_id }
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })

  const { client_id } = req.body || {}
  if (!client_id) return res.status(400).json({ error: 'client_id requis' })

  const { data: link } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .eq('client_id', client_id)
    .maybeSingle()
  if (!link) return res.status(403).json({ error: 'Accès refusé' })

  const { data: settings } = await supabase
    .from('client_settings')
    .select('elevenlabs_phone_number_id')
    .eq('client_id', client_id)
    .maybeSingle()

  // Delete from ElevenLabs if present
  const phoneNumberId = settings?.elevenlabs_phone_number_id
  if (phoneNumberId && ELEVENLABS_KEY) {
    try {
      await fetch(`https://api.elevenlabs.io/v1/convai/phone-numbers/${phoneNumberId}`, {
        method: 'DELETE',
        headers: { 'xi-api-key': ELEVENLABS_KEY },
      })
    } catch (err) {
      console.warn('[detach-sip-trunk] ElevenLabs delete failed:', err.message)
      // Non-fatal
    }
  }

  // Clear DB columns
  await supabase.from('client_settings').update({
    voice_sip_phone_number: null,
    voice_sip_server: null,
    voice_sip_username: null,
    voice_sip_password_encrypted: null,
    voice_sip_attached_at: null,
    elevenlabs_phone_number_id: null,
    voice_phone_number: null,
    voice_phone_provider: null,
    voice_phone_provisioned_at: null,
  }).eq('client_id', client_id)

  return res.status(200).json({ success: true })
}

export default withSentry(handler)
