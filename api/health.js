/**
 * GET /api/health
 *
 * Liveness probe for external uptime monitors (BetterStack, UptimeRobot).
 * Returns 200 with a small JSON body when the serverless function can boot
 * and reach Supabase. Returns 503 if Supabase is unreachable so the monitor
 * flags an actual infrastructure issue, not a client bug.
 *
 * Deliberately auth-less and cheap — runs on every monitor check.
 */
import { withSentry } from './lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const maxDuration = 10

async function handler(req, res) {
  // No-cache so monitors see the actual current health, not a cached 200.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')

  const checks = {
    lambda: 'ok',
    supabase: 'unknown',
  }

  // Lightweight Supabase probe: a 2s call that verifies DB + auth layer
  // respond. We don't care about the data, only that the round-trip works.
  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      })
      // Cheap liveness probe: HEAD select (no COUNT(*) scan) with a 5s budget
      // (maxDuration is 10s). The old 2s + exact-count tripped false 503s on
      // cold starts as the clients table grew.
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const { error } = await supabase
        .from('clients')
        .select('id', { head: true })
        .limit(1)
        .abortSignal(controller.signal)
      clearTimeout(timer)
      checks.supabase = error ? 'error' : 'ok'
    } catch {
      checks.supabase = 'error'
    }
  } else {
    checks.supabase = 'not_configured'
  }

  const healthy = checks.supabase === 'ok' || checks.supabase === 'not_configured'
  return res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    checks,
    ts: new Date().toISOString(),
  })
}

export default withSentry(handler)
