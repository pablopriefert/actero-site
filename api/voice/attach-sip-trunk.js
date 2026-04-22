/**
 * Voice Agent — Attach a SIP trunk (BYON: Bring Your Own Number).
 *
 * POST /api/voice/attach-sip-trunk
 * Body: { client_id, phone_number, sip_server, sip_username, sip_password, transport? }
 *
 * Creates a phone number in ElevenLabs Conversational AI tied to the client's
 * own SIP trunk (OVH, Bouygues Pro, Orange Pro, 3CX, etc.) — no Twilio needed.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY

function encryptPassword(plaintext) {
  // Symmetric encryption at rest using env secret (falls back to base64 if no key)
  const key = process.env.ENCRYPTION_KEY
  if (!key) return 'b64:' + Buffer.from(plaintext).toString('base64')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key.slice(0, 32).padEnd(32, '0')), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return 'aes:' + iv.toString('base64') + ':' + tag.toString('base64') + ':' + encrypted.toString('base64')
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })

  const { client_id, phone_number, sip_server, sip_username, sip_password, transport } = req.body || {}
  if (!client_id) return res.status(400).json({ error: 'client_id requis' })
  if (!phone_number || !/^\+\d{7,15}$/.test(phone_number.replace(/\s/g, ''))) {
    return res.status(400).json({ error: 'Numéro au format E.164 requis (ex: +33123456789)' })
  }
  if (!sip_server || !sip_username || !sip_password) {
    return res.status(400).json({ error: 'Serveur SIP, identifiant et mot de passe requis' })
  }

  // Verify user belongs to client
  const { data: link } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .eq('client_id', client_id)
    .maybeSingle()
  if (!link) return res.status(403).json({ error: 'Accès refusé' })

  // Fetch agent_id
  const { data: settings } = await supabase
    .from('client_settings')
    .select('elevenlabs_agent_id')
    .eq('client_id', client_id)
    .maybeSingle()

  const agentId = settings?.elevenlabs_agent_id
  if (!agentId) return res.status(400).json({ error: 'Créez d\'abord votre agent vocal.' })
  if (!ELEVENLABS_KEY) return res.status(500).json({ error: 'ELEVENLABS_API_KEY manquante' })

  const cleanNumber = phone_number.replace(/\s/g, '')
  const cleanServer = sip_server.trim()
  const cleanTransport = (transport || 'UDP').toUpperCase()

  try {
    // Create a SIP-trunk phone number in ElevenLabs
    const createRes = await fetch('https://api.elevenlabs.io/v1/convai/phone-numbers/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_KEY,
      },
      body: JSON.stringify({
        phone_number: cleanNumber,
        label: `SIP-${cleanServer}`,
        provider: 'sip_trunk',
        inbound_trunk: {
          address: cleanServer,
          transport: cleanTransport,
          credentials: {
            username: sip_username.trim(),
            password: sip_password,
          },
        },
        outbound_trunk: {
          address: cleanServer,
          transport: cleanTransport,
          credentials: {
            username: sip_username.trim(),
            password: sip_password,
          },
        },
      }),
    })

    const createJson = await createRes.json().catch(() => ({}))
    if (!createRes.ok) {
      return res.status(createRes.status).json({
        error: createJson?.detail?.message || createJson?.detail || `ElevenLabs ${createRes.status}`,
        hint: 'Vérifiez que votre SIP trunk accepte les connexions depuis les serveurs ElevenLabs.',
      })
    }

    const phoneNumberId = createJson?.phone_number_id || createJson?.id
    if (!phoneNumberId) {
      return res.status(500).json({ error: 'Réponse ElevenLabs invalide (pas d\'ID)' })
    }

    // Attach the phone number to the agent
    try {
      await fetch(`https://api.elevenlabs.io/v1/convai/phone-numbers/${phoneNumberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_KEY,
        },
        body: JSON.stringify({ agent_id: agentId }),
      })
    } catch (attachErr) {
      console.warn('[attach-sip-trunk] attach to agent failed:', attachErr.message)
      // Non-fatal — user can retry or attach manually
    }

    // Save to DB (encrypted password)
    await supabase.from('client_settings').update({
      voice_sip_phone_number: cleanNumber,
      voice_sip_server: cleanServer,
      voice_sip_username: sip_username.trim(),
      voice_sip_password_encrypted: encryptPassword(sip_password),
      voice_sip_transport: cleanTransport,
      voice_sip_attached_at: new Date().toISOString(),
      elevenlabs_phone_number_id: phoneNumberId,
      voice_phone_number: cleanNumber, // for backward compat with UI display
      voice_phone_provider: 'sip',
      voice_phone_provisioned_at: new Date().toISOString(),
    }).eq('client_id', client_id)

    return res.status(200).json({
      success: true,
      phone_number: cleanNumber,
      phone_number_id: phoneNumberId,
    })
  } catch (err) {
    console.error('[attach-sip-trunk]', err.message)
    return res.status(500).json({ error: err.message })
  }
}

export default withSentry(handler)
