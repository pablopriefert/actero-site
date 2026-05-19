/**
 * Vercel Cron — E2B job watchdog.
 *
 * Schedule: every 5 min — see vercel.json
 *
 * Responsibilities:
 *   1. Mark jobs as `timeout` once expires_at < now() AND status='running'
 *      (and kill their sandboxes to release credits).
 *   2. Kill orphan sandboxes that have no matching DB row (defensive cleanup).
 *   3. Kill sandboxes attached to jobs that already self-reported completion.
 *
 * Auth: Vercel Cron header OR Authorization: Bearer <CRON_SECRET>.
 */

import { createClient } from '@supabase/supabase-js'
import { withCronMonitor } from '../lib/cron-monitor.js'
import { killSandbox, listActiveSandboxes } from '../lib/e2b-runner.js'
import { notifyOnboardingFailure } from '../lib/notify-onboarding.js'

export const maxDuration = 60

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

async function handler(req, res) {
  if (!isAuthorised(req)) {
    return res.status(401).json({ error: 'Unauthorised' })
  }

  const now = new Date().toISOString()
  const stats = { timed_out: 0, killed_orphans: 0, killed_completed: 0, errors: 0 }

  // 1. Time-out jobs whose deadline has passed.
  const { data: expired, error: expiredErr } = await supabase
    .from('e2b_jobs')
    .select('id, sandbox_id, job_type, client_id, payload')
    .lt('expires_at', now)
    .in('status', ['queued', 'running'])
    .limit(50)

  if (expiredErr) {
    console.error('[process-e2b-jobs] expired query error:', expiredErr)
  }

  for (const job of expired || []) {
    try {
      if (job.sandbox_id) {
        await killSandbox(job.sandbox_id)
      }
      await supabase
        .from('e2b_jobs')
        .update({
          status: 'timeout',
          error: 'Sandbox exceeded its time budget',
          completed_at: now,
        })
        .eq('id', job.id)
      stats.timed_out++

      // Surface onboarding timeouts to the internal team — the merchant is
      // otherwise stuck waiting for a "ready" signal that will never come.
      if (job.job_type === 'shopify_onboard') {
        notifyOnboardingFailure({
          jobId: job.id,
          clientId: job.client_id,
          shopDomain: job.payload?.shop_domain,
          status: 'timeout',
          error: 'Sandbox exceeded its time budget',
        }).catch(() => {})
      }
    } catch (err) {
      console.error(`[process-e2b-jobs] failed to timeout job ${job.id}:`, err)
      stats.errors++
    }
  }

  // 2. Kill sandboxes whose job is already completed (cost guard).
  const { data: doneJobs } = await supabase
    .from('e2b_jobs')
    .select('id, sandbox_id')
    .in('status', ['completed', 'failed', 'cancelled'])
    .not('sandbox_id', 'is', null)
    .gte('completed_at', new Date(Date.now() - 30 * 60_000).toISOString())
    .limit(50)

  for (const job of doneJobs || []) {
    try {
      await killSandbox(job.sandbox_id)
      // Null out sandbox_id once killed so we don't try again next tick.
      await supabase.from('e2b_jobs').update({ sandbox_id: null }).eq('id', job.id)
      stats.killed_completed++
    } catch (err) {
      console.warn(`[process-e2b-jobs] kill completed sandbox ${job.sandbox_id} failed:`, err.message)
    }
  }

  // 2b. Auto-seed the KB from the merchant's storefront once the Shopify
  //     onboarding job has completed. Fire-and-forget POST to crawl-site;
  //     idempotency is enforced both by client_settings.kb_autocrawl_done
  //     (checked here) and by the crawl-site endpoint itself (belt & braces).
  try {
    const { data: onboardJobs } = await supabase
      .from('e2b_jobs')
      .select('id, client_id, job_type')
      .eq('status', 'completed')
      .eq('job_type', 'shopify_onboard')
      .not('client_id', 'is', null)
      .gte('completed_at', new Date(Date.now() - 30 * 60_000).toISOString())
      .limit(50)

    for (const job of onboardJobs || []) {
      try {
        const { data: cs } = await supabase
          .from('client_settings')
          .select('kb_autocrawl_done')
          .eq('client_id', job.client_id)
          .maybeSingle()
        if (cs?.kb_autocrawl_done === true) continue

        const base = process.env.PUBLIC_API_URL || 'https://actero.fr'
        // Fire-and-forget: a slow/broken crawl must never block the cron.
        fetch(`${base}/api/knowledge/crawl-site`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.CRON_SECRET}`,
          },
          body: JSON.stringify({ client_id: job.client_id }),
        }).catch(() => {})
      } catch (err) {
        console.warn(`[process-e2b-jobs] kb autocrawl trigger failed for job ${job.id}:`, err.message)
      }
    }
  } catch (err) {
    console.warn('[process-e2b-jobs] kb autocrawl scan failed:', err.message)
  }

  // 2c. Periodic DEEP KB refresh. Re-crawl the merchant's full help center
  //     in a sandbox for clients that completed onboarding and whose last
  //     deep crawl is NULL or older than 30 days. Fire-and-forget POST to
  //     /api/jobs/kb-deep-crawl; the endpoint itself 409s on an in-flight
  //     job (belt & braces with the check here). Capped at 3 clients/tick
  //     and fully wrapped so a slow/broken refresh never blocks the cron.
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString()

    // Onboarded clients = those with a completed shopify_onboard job.
    const { data: onboarded } = await supabase
      .from('e2b_jobs')
      .select('client_id')
      .eq('status', 'completed')
      .eq('job_type', 'shopify_onboard')
      .not('client_id', 'is', null)
      .limit(500)

    const onboardedIds = Array.from(
      new Set((onboarded || []).map((j) => j.client_id).filter(Boolean)),
    )

    if (onboardedIds.length > 0) {
      // Settings for those clients — pick the ones due for a refresh.
      const { data: settingsRows } = await supabase
        .from('client_settings')
        .select('client_id, kb_last_deep_crawl_at')
        .in('client_id', onboardedIds)

      const due = (settingsRows || [])
        .filter((r) => !r.kb_last_deep_crawl_at || r.kb_last_deep_crawl_at < cutoff)
        .map((r) => r.client_id)

      // Clients with no completed deep crawl at all also have no settings
      // row matched above only if kb_last_deep_crawl_at is NULL — which is
      // already covered. Skip any client with an in-flight deep crawl job.
      let fired = 0
      for (const clientId of due) {
        if (fired >= 3) break
        try {
          const { data: inFlight } = await supabase
            .from('e2b_jobs')
            .select('id')
            .eq('client_id', clientId)
            .eq('job_type', 'kb_deep_crawl')
            .in('status', ['queued', 'running'])
            .maybeSingle()
          if (inFlight) continue

          const base = process.env.PUBLIC_API_URL || 'https://actero.fr'
          // Fire-and-forget: a slow/broken refresh must never block the cron.
          fetch(`${base}/api/jobs/kb-deep-crawl`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.CRON_SECRET}`,
            },
            body: JSON.stringify({ client_id: clientId }),
          }).catch(() => {})
          fired++
        } catch (err) {
          console.warn(`[process-e2b-jobs] kb deep refresh trigger failed for ${clientId}:`, err.message)
        }
      }
    }
  } catch (err) {
    console.warn('[process-e2b-jobs] kb deep refresh scan failed:', err.message)
  }

  // 3. Detect orphan sandboxes (alive in E2B but no matching active job row).
  try {
    const active = await listActiveSandboxes()
    const { data: trackedJobs } = await supabase
      .from('e2b_jobs')
      .select('sandbox_id')
      .in('status', ['queued', 'running'])

    const trackedIds = new Set((trackedJobs || []).map((j) => j.sandbox_id).filter(Boolean))

    for (const sb of active) {
      const sbId = sb.sandboxId || sb.sandbox_id
      if (!sbId) continue
      if (!trackedIds.has(sbId)) {
        await killSandbox(sbId)
        stats.killed_orphans++
      }
    }
  } catch (err) {
    console.warn('[process-e2b-jobs] orphan detection failed:', err.message)
    stats.errors++
  }

  return res.status(200).json({ ok: true, stats, ts: now })
}

function isAuthorised(req) {
  const cronHeader = req.headers['x-vercel-cron']
  if (cronHeader) return true
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace(/^Bearer\s+/, '')
  return token && token === process.env.CRON_SECRET
}

export default withCronMonitor('cron-process-e2b-jobs', '*/5 * * * *', handler)
