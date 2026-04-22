/**
 * Vercel Cron — Slack Daily Digest
 *
 * Schedule: every weekday at 07:30 UTC (08:30/09:30 Paris time depending on DST).
 * Configure in vercel.json:
 *   { "path": "/api/cron/slack-daily-digest", "schedule": "30 7 * * 1-5" }
 *
 * For each active Slack integration:
 *   - Fetches yesterday's KPIs (tickets, auto rate, escalated, time saved)
 *   - Generates a short digest via Claude (channel=slack style)
 *   - Posts to the default channel (or webhook URL as fallback)
 *
 * Auth: CRON_SECRET required in headers (or Vercel Cron header).
 */
import { createClient } from '@supabase/supabase-js'
import { askCopilot } from '../lib/kpi-tools.js'
import { postSlackMessage, formatAsBlocks } from '../lib/slack.js'
import { decryptToken } from '../lib/crypto.js'
import { withCronMonitor } from '../lib/cron-monitor.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function handler(req, res) {
  // Auth — Vercel Cron or manual trigger with CRON_SECRET
  const cronSecret = process.env.CRON_SECRET
  const provided = req.headers['authorization']?.replace('Bearer ', '') || req.query.secret
  const isVercelCron = req.headers['x-vercel-cron']

  if (!isVercelCron && cronSecret && provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (!cronSecret && !isVercelCron) {
    return res.status(503).json({ error: 'CRON_SECRET missing' })
  }

  try {
    // Fetch all active Slack integrations
    const { data: integrations } = await supabase
      .from('client_integrations')
      .select('client_id, access_token, extra_config')
      .eq('provider', 'slack')
      .eq('status', 'active')

    if (!integrations?.length) {
      return res.status(200).json({ ok: true, digests_sent: 0, reason: 'no active Slack integrations' })
    }

    const results = []
    for (const integration of integrations) {
      try {
        const { client_id, access_token, extra_config } = integration
        const botToken = decryptToken(access_token)
        const channel = extra_config?.channel
        const webhookUrl = extra_config?.webhook_url

        // Fetch brand name
        const { data: client } = await supabase
          .from('clients')
          .select('brand_name, slack_digest_enabled')
          .eq('id', client_id)
          .maybeSingle()

        // Respect opt-out (if column exists)
        if (client && client.slack_digest_enabled === false) {
          results.push({ client_id, skipped: 'opted_out' })
          continue
        }

        const brandName = client?.brand_name || 'votre boutique'

        // Generate the digest via Claude Copilot with a targeted prompt
        const { reply } = await askCopilot(supabase, {
          clientId: client_id,
          brandName,
          channel: 'slack',
          message: `Fais un résumé quotidien ultra-concis de la journée d'hier (tickets, taux d'automatisation, escalades en attente, temps économisé) + une recommandation actionnable. Format : *Résumé d'hier* puis bullets, puis *Recommandation*.`,
        })

        if (reply && (channel || webhookUrl)) {
          const postResult = await postSlackMessage({
            token: botToken,
            channel,
            webhookUrl,
            text: `📊 Résumé Actero — ${brandName}`,
            blocks: formatAsBlocks(reply),
          })
          results.push({ client_id, posted: postResult.ok })
        } else {
          results.push({ client_id, skipped: 'no channel' })
        }
      } catch (err) {
        console.error('[slack-daily-digest] per-client error:', err.message)
        results.push({ client_id: integration.client_id, error: err.message })
      }
    }

    return res.status(200).json({
      ok: true,
      digests_sent: results.filter(r => r.posted).length,
      total: integrations.length,
      results,
    })
  } catch (err) {
    console.error('[slack-daily-digest] fatal:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

export default withCronMonitor('cron-slack-daily-digest', '30 7 * * 1-5', handler)
