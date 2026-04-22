/**
 * GET  /api/email/settings?client_id=UUID  — read email agent settings
 * PATCH /api/email/settings                 — update settings (partial)
 *
 * Auth: Bearer JWT, user must belong to the client (or be owner).
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const ALLOWED_FIELDS = [
  'email_agent_enabled',
  'email_auto_reply_enabled',
  'email_confidence_threshold',
  'email_quiet_hours_start',
  'email_quiet_hours_end',
  'email_signature',
  'email_exclusions',
  'email_send_delay_seconds',
  'email_attach_voice',
]

async function requireClientAccess(req, res, clientId) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) { res.status(401).json({ error: 'Non autorisé' }); return null }
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) { res.status(401).json({ error: 'Non autorisé' }); return null }

  // Admin check
  const isAdmin = user.app_metadata?.role === 'admin'
  if (isAdmin) return user

  // client_users link
  const { data: link } = await supabase.from('client_users')
    .select('client_id').eq('user_id', user.id).eq('client_id', clientId).maybeSingle()
  if (link) return user

  // Legacy owner
  const { data: owned } = await supabase.from('clients')
    .select('id').eq('id', clientId).eq('owner_user_id', user.id).maybeSingle()
  if (owned) return user

  res.status(403).json({ error: 'Accès refusé' })
  return null
}

async function handler(req, res) {
  if (req.method === 'GET') {
    const clientId = req.query?.client_id
    if (!clientId) return res.status(400).json({ error: 'client_id requis' })
    const user = await requireClientAccess(req, res, clientId)
    if (!user) return

    const { data } = await supabase.from('client_settings')
      .select([
        'email_agent_enabled',
        'email_auto_reply_enabled',
        'email_confidence_threshold',
        'email_quiet_hours_start',
        'email_quiet_hours_end',
        'email_signature',
        'email_exclusions',
        'email_send_delay_seconds',
        'email_attach_voice',
        'email_last_polled_at',
      ].join(','))
      .eq('client_id', clientId)
      .maybeSingle()

    return res.status(200).json({ settings: data || {} })
  }

  if (req.method === 'PATCH') {
    const { client_id, ...patch } = req.body || {}
    if (!client_id) return res.status(400).json({ error: 'client_id requis' })
    const user = await requireClientAccess(req, res, client_id)
    if (!user) return

    // Whitelist
    const cleaned = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in patch) cleaned[key] = patch[key]
    }
    if (!Object.keys(cleaned).length) return res.status(400).json({ error: 'Aucun champ valide' })

    // Coerce types
    if ('email_confidence_threshold' in cleaned) {
      cleaned.email_confidence_threshold = Math.max(50, Math.min(100, parseInt(cleaned.email_confidence_threshold, 10) || 80))
    }
    if ('email_send_delay_seconds' in cleaned) {
      cleaned.email_send_delay_seconds = Math.max(0, Math.min(300, parseInt(cleaned.email_send_delay_seconds, 10) || 0))
    }
    if ('email_exclusions' in cleaned && !Array.isArray(cleaned.email_exclusions)) {
      cleaned.email_exclusions = []
    }
    cleaned.updated_at = new Date().toISOString()

    // Upsert via client_settings row
    const { error } = await supabase.from('client_settings')
      .update(cleaned)
      .eq('client_id', client_id)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, updated: cleaned })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withSentry(handler)
