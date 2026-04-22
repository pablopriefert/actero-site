/**
 * Partner Landing — Token verification
 *
 * GET /api/partner/verify-token?token=xxx
 *
 * Verifies the token is valid and active. Increments use count.
 * Returns agency info for personalized display.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  const token = req.query.token || req.body?.token
  if (!token || typeof token !== 'string' || token.length < 8) {
    return res.status(400).json({ valid: false, error: 'Token manquant' })
  }

  try {
    const { data: row } = await supabase
      .from('partner_access_tokens')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle()

    if (!row) {
      return res.status(200).json({ valid: false, error: 'Lien invalide ou expiré' })
    }

    // Check expiration
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return res.status(200).json({ valid: false, error: 'Lien expiré' })
    }

    // Update usage stats (fire and forget)
    const now = new Date().toISOString()
    const update = {
      last_used_at: now,
      use_count: (row.use_count || 0) + 1,
    }
    if (!row.first_used_at) update.first_used_at = now

    supabase
      .from('partner_access_tokens')
      .update(update)
      .eq('id', row.id)
      .then(() => {})

    return res.status(200).json({
      valid: true,
      agency_name: row.agency_name,
      contact_name: row.contact_name,
    })
  } catch (err) {
    console.error('[partner/verify-token] Error:', err.message)
    return res.status(500).json({ valid: false, error: 'Erreur serveur' })
  }
}

export default withSentry(handler)
