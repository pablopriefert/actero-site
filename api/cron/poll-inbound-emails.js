// Vercel Cron — Poll inbound emails (IMAP + Gmail OAuth).
//
// Schedule: every 2 min — cron expression configured in vercel.json
// (the raw cron pattern is NOT repeated here on purpose: the "*/" sequence
// prematurely closes JSDoc block comments and breaks ESM parsing on Node 24).
//
// For each active client integration (smtp_imap OR gmail) where the client has
// email_agent_enabled = true, polls the mailbox and forwards new messages to
// the Engine Gateway.
//
// Auth: Vercel Cron header OR Authorization: Bearer <CRON_SECRET>.
import { createClient } from '@supabase/supabase-js'
import { pollOneMailbox } from '../lib/email-poller.js'
import { withCronMonitor } from '../lib/cron-monitor.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export const maxDuration = 60

// Each mailbox poll gets its own budget so one slow IMAP can't eat the whole
// lambda window and starve Sentry's final cron check-in.
//
// Budget math: Vercel maxDuration=60s minus ~5s overhead for Sentry flush
// and Supabase writes leaves ~55s for polls. With 25s per mailbox × 2
// mailboxes max = 50s worst case, well under the lambda limit.
const PER_MAILBOX_TIMEOUT_MS = 25_000
const MAX_MAILBOXES_PER_RUN = 2
// 10 failures × 2-min cron = 20 min before a broken mailbox is silenced.
// That's enough to absorb a transient outage but stops the Sentry alert spam
// when a merchant rotates their IMAP password without telling us.
const CIRCUIT_BREAKER_THRESHOLD = 10

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ])
}

async function handler(req, res) {
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
    // Fetch all active email integrations (gmail OR smtp_imap)
    const { data: integrations } = await supabase
      .from('client_integrations')
      .select('client_id, provider, api_key, access_token, refresh_token, expires_at, extra_config')
      .in('provider', ['smtp_imap', 'gmail'])
      .eq('status', 'active')

    if (!integrations?.length) {
      return res.status(200).json({ ok: true, polled: 0, reason: 'no active email integrations' })
    }

    // Group by client_id — prefer Gmail over IMAP when both exist
    const byClient = new Map()
    for (const i of integrations) {
      const existing = byClient.get(i.client_id)
      if (!existing || (i.provider === 'gmail' && existing.provider !== 'gmail')) {
        byClient.set(i.client_id, i)
      }
    }

    // Fetch settings once for all candidate clients and filter to agent-enabled.
    // Order by email_last_polled_at so the least-recently-polled clients go first
    // (fairness across runs). Take at most MAX_MAILBOXES_PER_RUN to guarantee
    // the lambda always completes and Sentry receives the final cron check-in.
    const clientIds = Array.from(byClient.keys())
    const { data: settingsRows } = await supabase
      .from('client_settings')
      .select('client_id, email_agent_enabled, email_last_polled_at, email_consecutive_failures')
      .in('client_id', clientIds)

    const settingsByClient = new Map((settingsRows || []).map((s) => [s.client_id, s]))
    const eligible = Array.from(byClient.values())
      .filter((i) => {
        const s = settingsByClient.get(i.client_id)
        if (!s?.email_agent_enabled) return false
        // Circuit breaker: skip mailboxes that have failed too many times in a
        // row. The merchant has to fix the underlying problem (rotate password,
        // re-auth Gmail, etc.) and reset the counter from the dashboard.
        if ((s.email_consecutive_failures || 0) >= CIRCUIT_BREAKER_THRESHOLD) return false
        return true
      })
      .sort((a, b) => {
        const ta = settingsByClient.get(a.client_id)?.email_last_polled_at || ''
        const tb = settingsByClient.get(b.client_id)?.email_last_polled_at || ''
        return ta.localeCompare(tb) // oldest first; empty string sorts before any ISO date
      })
      .slice(0, MAX_MAILBOXES_PER_RUN)

    const results = []
    for (const integration of eligible) {
      let pollError = null
      let processed = 0
      try {
        const result = await withTimeout(
          pollOneMailbox({
            supabase,
            clientId: integration.client_id,
            provider: integration.provider,
            integration,
          }),
          PER_MAILBOX_TIMEOUT_MS,
          `pollOneMailbox(${integration.client_id})`,
        )
        processed = result.processed || 0
        pollError = result.error || null
      } catch (err) {
        console.error(`[poll-inbound] ${integration.client_id}:`, err.message)
        pollError = err.message
      }

      // Persist outcome so the merchant can self-diagnose from the dashboard.
      // On success → reset error state. On failure → bump the counter and
      // store the message; once it crosses CIRCUIT_BREAKER_THRESHOLD we stop
      // hammering the broken mailbox until the merchant intervenes.
      const updates = { email_last_polled_at: new Date().toISOString() }
      if (pollError) {
        const prev = settingsByClient.get(integration.client_id)?.email_consecutive_failures || 0
        updates.email_last_error = pollError.slice(0, 500)
        updates.email_last_error_at = new Date().toISOString()
        updates.email_consecutive_failures = prev + 1
      } else {
        updates.email_last_error = null
        updates.email_last_error_at = null
        updates.email_consecutive_failures = 0
      }
      try {
        await supabase.from('client_settings').update(updates).eq('client_id', integration.client_id)
      } catch (err) {
        console.warn(`[poll-inbound] settings update failed for ${integration.client_id}:`, err.message)
      }

      results.push({
        client_id: integration.client_id,
        provider: integration.provider,
        processed,
        error: pollError,
      })
    }

    return res.status(200).json({
      ok: true,
      candidates: byClient.size,
      polled: results.length,
      results,
    })
  } catch (err) {
    console.error('[poll-inbound-emails] fatal:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

export default withCronMonitor('cron-poll-inbound-emails', '*/2 * * * *', handler)
