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

// Mirror the engine's provider + model resolution so we test what production
// actually uses (see llm-client.js / claude-client.js / openai-client.js).
const LLM_PROVIDER = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase()
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini'
const ACTIVE_MODEL = LLM_PROVIDER === 'openai' ? OPENAI_MODEL : CLAUDE_MODEL

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
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 4, messages: [{ role: 'user', content: 'ping' }] }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, detail: `Claude API ${res.status} (model ${CLAUDE_MODEL}): ${body.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, detail: `Claude fetch failed (model ${CLAUDE_MODEL}): ${err.message}` }
  } finally {
    clearTimeout(timeout)
  }
}

// OpenAI: hit the free /v1/models endpoint and confirm the configured model is
// present. Catches the key-invalid / model-retired / wrong-id failure class
// (exactly the outage this job exists for) without paying for a chat call
// every 5 minutes — GPT-5.5 completions are not cheap.
async function checkOpenAI() {
  const key = process.env.OPENAI_API_KEY
  if (!key) return { ok: false, detail: 'OPENAI_API_KEY unset' }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, detail: `OpenAI API ${res.status}: ${body.slice(0, 200)}` }
    }
    const data = await res.json().catch(() => null)
    const ids = (data?.data || []).map((m) => m.id)
    if (!ids.includes(OPENAI_MODEL)) {
      return { ok: false, detail: `OpenAI model "${OPENAI_MODEL}" not available on this account` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, detail: `OpenAI fetch failed (model ${OPENAI_MODEL}): ${err.message}` }
  } finally {
    clearTimeout(timeout)
  }
}

const checkLLM = () => (LLM_PROVIDER === 'openai' ? checkOpenAI() : checkClaude())

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

  const [llm, db] = await Promise.all([checkLLM(), checkDb()])
  const failures = [llm, db].filter((c) => !c.ok).map((c) => c.detail)

  if (failures.length > 0) {
    const message = `Agent healthcheck FAILED — ${failures.join(' | ')}`
    captureError(new Error(message), { stage: 'agent_healthcheck', provider: LLM_PROVIDER, model: ACTIVE_MODEL })
    await sendOpsAlert(message)
    // Throw so withCronMonitor emits an error check-in → Sentry cron alert.
    throw new Error(message)
  }

  return res.status(200).json({ ok: true, provider: LLM_PROVIDER, model: ACTIVE_MODEL, checks: { llm: true, db: true } })
}

export default withCronMonitor('cron-agent-healthcheck', '*/5 * * * *', handler)
