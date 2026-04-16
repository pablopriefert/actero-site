/**
 * POST /api/proactive/trigger-check
 *
 * Manually trigger a proactive check for the caller's client (bypass cron).
 * Useful for testing rules from the dashboard.
 *
 * Body: { client_id }
 * Auth: Bearer JWT.
 */
import { createClient } from '@supabase/supabase-js'
import { runProactiveChecks } from '../lib/proactive-detector.js'
import { executeProactiveAction } from '../lib/proactive-action.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export const maxDuration = 60

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Non autorisé' })

  const { client_id, dry_run = false } = req.body || {}
  if (!client_id) return res.status(400).json({ error: 'client_id requis' })

  const isAdmin = user.app_metadata?.role === 'admin'
  if (!isAdmin) {
    const { data: link } = await supabase.from('client_users')
      .select('client_id').eq('user_id', user.id).eq('client_id', client_id).maybeSingle()
    if (!link) {
      const { data: owned } = await supabase.from('clients')
        .select('id').eq('id', client_id).eq('owner_user_id', user.id).maybeSingle()
      if (!owned) return res.status(403).json({ error: 'Accès refusé' })
    }
  }

  try {
    const { newDetections } = await runProactiveChecks(supabase, client_id)

    if (dry_run) {
      // Don't actually send — just return what would have been sent
      return res.status(200).json({
        ok: true,
        detections: newDetections.length,
        would_send: newDetections.map(d => ({
          rule: d.rule_name,
          to: d.customer_email,
          name: d.customer_name,
          trigger: d.trigger_data,
        })),
      })
    }

    let sent = 0, failed = 0, errors = []
    for (const event of newDetections) {
      const r = await executeProactiveAction(supabase, event)
      if (r.ok) sent += 1
      else {
        failed += 1
        if (r.error) errors.push(r.error.slice(0, 120))
      }
    }

    return res.status(200).json({
      ok: true,
      detections: newDetections.length,
      sent,
      failed,
      errors: errors.slice(0, 5),
    })
  } catch (err) {
    console.error('[proactive/trigger-check]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
