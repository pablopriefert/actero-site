/**
 * Vercel Cron — Proactive Watchdog
 *
 * Schedule : every 15 minutes
 *
 * For each client with at least one active proactive rule :
 *   1. Run detectors via runProactiveChecks()
 *   2. For each NEW detection → execute the action (email proactif) via Claude + SMTP
 *   3. Update proactive_events rows
 *
 * Auth : Vercel Cron header OR Authorization: Bearer <CRON_SECRET>
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
  const cronSecret = process.env.CRON_SECRET
  const provided = req.headers['authorization']?.replace('Bearer ', '') || req.query?.secret
  const isVercelCron = req.headers['x-vercel-cron']
  if (!isVercelCron && cronSecret && provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (!cronSecret && !isVercelCron) {
    return res.status(503).json({ error: 'CRON_SECRET missing' })
  }

  try {
    // Clients with at least one active rule
    const { data: clientsWithRules } = await supabase
      .from('proactive_rules')
      .select('client_id')
      .eq('is_active', true)

    const clientIds = [...new Set((clientsWithRules || []).map(r => r.client_id))]
    if (!clientIds.length) {
      return res.status(200).json({ ok: true, reason: 'no active proactive rules' })
    }

    const results = []
    for (const clientId of clientIds) {
      try {
        const { newDetections } = await runProactiveChecks(supabase, clientId)
        let sent = 0, failed = 0
        for (const event of newDetections) {
          const r = await executeProactiveAction(supabase, event)
          if (r.ok) sent += 1
          else failed += 1
        }
        results.push({ client_id: clientId, detections: newDetections.length, sent, failed })
      } catch (err) {
        console.error(`[proactive-watchdog] ${clientId}:`, err.message)
        results.push({ client_id: clientId, error: err.message })
      }
    }

    return res.status(200).json({
      ok: true,
      clients_checked: clientIds.length,
      results,
    })
  } catch (err) {
    console.error('[proactive-watchdog] fatal:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
