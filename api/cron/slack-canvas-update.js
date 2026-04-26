/**
 * Vercel Cron — Slack Ops Canvas Update
 *
 * Runs every 15 min. For every client with slack_ops_enabled=true and an
 * active Slack integration, refreshes a Slack Canvas with current ticket KPIs,
 * top topics and alerts. The merchant pins the canvas in their Slack and
 * keeps it open as their war room — single source of truth, always live.
 *
 * Lifecycle:
 *   - First run for a client → canvases.create + persist canvas_id + url
 *   - Subsequent runs → canvases.edit on the same canvas (URL stays stable)
 *
 * Auth: CRON_SECRET (Bearer) or x-vercel-cron header.
 */

import { createClient } from '@supabase/supabase-js'
import { decryptToken } from '../lib/crypto.js'
import { withCronMonitor } from '../lib/cron-monitor.js'
import { captureError } from '../lib/sentry.js'
import {
  fetchOpsStats,
  renderOpsCanvasMarkdown,
  createCanvas,
  editCanvas,
} from '../lib/slack-canvas.js'

export const maxDuration = 60

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  const provided = req.headers['authorization']?.replace('Bearer ', '') || req.query.secret
  const isVercelCron = req.headers['x-vercel-cron']
  if (!isVercelCron && cronSecret && provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Find every client with the toggle on AND a live Slack integration.
  const { data: enabled, error: settingsErr } = await supabase
    .from('client_settings')
    .select('client_id, slack_ops_canvas_id')
    .eq('slack_ops_enabled', true)

  if (settingsErr) {
    captureError(settingsErr, { stage: 'slack_canvas_settings_query' })
    return res.status(500).json({ error: 'settings_query_failed' })
  }
  if (!enabled?.length) {
    return res.status(200).json({ ok: true, refreshed: 0, reason: 'no clients enabled' })
  }

  const clientIds = enabled.map((r) => r.client_id)
  const { data: integrations } = await supabase
    .from('client_integrations')
    .select('client_id, access_token')
    .eq('provider', 'slack')
    .eq('status', 'active')
    .in('client_id', clientIds)

  const tokenByClient = new Map(
    (integrations || []).map((i) => [i.client_id, decryptToken(i.access_token)]),
  )

  const results = []
  for (const row of enabled) {
    const clientId = row.client_id
    const token = tokenByClient.get(clientId)
    if (!token) {
      results.push({ client_id: clientId, skipped: 'no_active_slack' })
      continue
    }

    try {
      const [{ data: client }, stats] = await Promise.all([
        supabase.from('clients').select('brand_name').eq('id', clientId).maybeSingle(),
        fetchOpsStats(supabase, clientId),
      ])

      const markdown = renderOpsCanvasMarkdown({
        brandName: client?.brand_name || 'votre boutique',
        stats,
        refreshedAt: new Date(),
      })

      let canvasId = row.slack_ops_canvas_id
      let canvasUrl = null

      if (canvasId) {
        const r = await editCanvas({ token, canvasId, markdown })
        if (r.error === 'canvas_not_found') {
          // Canvas was deleted in Slack — recreate one.
          canvasId = null
        } else if (r.error) {
          results.push({ client_id: clientId, error: r.error })
          continue
        }
      }

      if (!canvasId) {
        const r = await createCanvas({
          token,
          title: `Live Ops — ${client?.brand_name || 'Actero'}`,
          markdown,
        })
        if (r.error) {
          // missing_scope is the most common case — merchant needs to reconnect.
          results.push({ client_id: clientId, error: r.error })
          continue
        }
        canvasId = r.canvas_id
        canvasUrl = r.canvas_url
      }

      await supabase
        .from('client_settings')
        .update({
          slack_ops_canvas_id: canvasId,
          slack_ops_canvas_url: canvasUrl,
          slack_ops_last_refreshed_at: new Date().toISOString(),
        })
        .eq('client_id', clientId)

      results.push({ client_id: clientId, ok: true, canvas_id: canvasId })
    } catch (err) {
      captureError(err, { stage: 'slack_canvas_refresh', client_id: clientId })
      results.push({ client_id: clientId, error: err.message })
    }
  }

  return res.status(200).json({ ok: true, refreshed: results.length, results })
}

export default withCronMonitor('cron-slack-canvas-update', '*/15 * * * *', handler)
