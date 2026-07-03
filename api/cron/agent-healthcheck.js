/**
 * Vercel Cron — Agent Healthcheck
 *
 * Schedule : every 5 minutes
 *
 * Actero's whole value is "the agent answers". On 2026-07-02 a retired Claude
 * model took the agent 100% down and nobody was alerted — the brain swallows
 * the Claude error internally and returns an escalation fallback, so nothing
 * ever threw up to a monitored boundary. This job is that missing safety net.
 *
 * It checks the two systemic failure modes directly and cheaply:
 *   1. Claude reachable with the CONFIGURED model (catches model deprecation,
 *      a bad/expired API key, 402 credit exhaustion, 429 — exactly the 404
 *      from that outage).
 *   2. Supabase reachable (the other hard dependency of every ticket).
 *
 * On failure it captures to Sentry, best-effort pings an ops webhook, then
 * THROWS so withCronMonitor records an error check-in → Sentry cron alert.
 *
 * Auth : Vercel Cron header OR Authorization: Bearer <CRON_SECRET>
 */
import { createClient } from '@supabase/supabase-js'
import { withCronMonitor } from '../lib/cron-monitor.js'
import { captureError } from '../lib/sentry.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// Mirror the engine's model resolution so we test what production actually uses.
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5'

async function checkClaude() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { ok: false, detail: 'ANTHROPIC_API_KEY unset' }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 4, messages: [{ role: 'user', content: 'ping' }] }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, detail: `Claude API ${res.status} (model ${MODEL}): ${body.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, detail: `Claude fetch failed (model ${MODEL}): ${err.message}` }
  } finally {
    clearTimeout(timeout)
  }
}

async function checkDb() {
  const { error } = await supabase.from('clients').select('id', { count: 'exact', head: true }).limit(1)
  return error ? { ok: false, detail: `Supabase: ${error.message}` } : { ok: true }
}

// Best-effort instant ping to a Slack/Telegram-compatible incoming webhook
// (JSON {text}). Optional — Sentry is the guaranteed path; this is just faster.
async function sendOpsAlert(text) {
  const url = process.env.OPS_ALERT_WEBHOOK_URL
  if (!url) return
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 4000)
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `🔴 Actero — ${text}` }),
      signal: controller.signal,
    }).finally(() => clearTimeout(t))
  } catch { /* never let the alert channel break the healthcheck */ }
}

async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  const provided = req.headers['authorization']?.replace('Bearer ', '') || req.query?.secret
  const isVercelCron = req.headers['x-vercel-cron']
  if (!isVercelCron && cronSecret && provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const [claude, db] = await Promise.all([checkClaude(), checkDb()])
  const failures = [claude, db].filter((c) => !c.ok).map((c) => c.detail)

  if (failures.length > 0) {
    const message = `Agent healthcheck FAILED — ${failures.join(' | ')}`
    captureError(new Error(message), { stage: 'agent_healthcheck', model: MODEL })
    await sendOpsAlert(message)
    // Throw so withCronMonitor emits an error check-in → Sentry cron alert.
    throw new Error(message)
  }

  return res.status(200).json({ ok: true, model: MODEL, checks: { claude: true, db: true } })
}

export default withCronMonitor('cron-agent-healthcheck', '*/5 * * * *', handler)
