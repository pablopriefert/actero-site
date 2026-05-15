/**
 * POST /api/leads/audit-email
 *
 * Generates and sends a personalized cold email to a prospect
 * based on their audit results. Uses Resend for delivery.
 *
 * Body: { audit_id }
 * Auth: admin only
 *
 * Core logic (HTML builder + Resend send + suppression check) lives in
 * ../lib/prospect-audit.js (shared with the batch runner).
 */

import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../lib/admin-auth.js'
import { sendAuditEmail } from '../lib/prospect-audit.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function handler(req, res) {
  const allowedOrigin = process.env.SITE_URL || 'https://actero.fr'
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const adminUser = await requireAdmin(req, res, supabase)
  if (!adminUser) return

  const { audit_id } = req.body
  if (!audit_id) return res.status(400).json({ error: 'audit_id required' })

  try {
    // Fetch the audit
    const { data: audit, error: fetchError } = await supabase
      .from('prospect_audits')
      .select('*')
      .eq('id', audit_id)
      .single()

    if (fetchError || !audit) {
      return res.status(404).json({ error: 'Audit not found' })
    }

    if (!audit.contact_email) {
      return res.status(400).json({ error: 'No contact_email on this audit' })
    }

    const result = await sendAuditEmail({ audit, supabase })

    if (result.skipped) {
      return res.status(409).json({
        error:
          result.reason === 'suppressed'
            ? 'Ce contact s\'est désinscrit — email non envoyé.'
            : 'Email non envoyé: ' + result.reason,
      })
    }

    return res.status(200).json({
      ok: true,
      email_id: result.email_id,
      sent_to: result.sent_to,
    })
  } catch (error) {
    console.error('Audit email error:', error)
    return res.status(500).json({ error: 'Erreur envoi email: ' + error.message })
  }
}

export default withSentry(handler)
