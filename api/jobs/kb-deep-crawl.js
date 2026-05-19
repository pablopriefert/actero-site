/**
 * POST /api/jobs/kb-deep-crawl
 *
 * Deep, UNBOUNDED knowledge-base crawl of the merchant's storefront help
 * center, run in an E2B sandbox (no 10-page cap, no 60s Vercel limit). The
 * shipped serverless api/knowledge/crawl-site.js stays as the fast/capped
 * seed; this is the deep seed + periodic refresh.
 *
 * Body: { client_id }
 *
 * Auth (either):
 *   - admin user JWT that owns the client (migrate-tickets.js pattern), OR
 *   - internal Authorization: Bearer <CRON_SECRET> (the refresh cron calls
 *     this server-to-server).
 *
 * Returns 202 { job_id } — poll /api/jobs/:id for progress.
 * 409 if a kb_deep_crawl job is already queued/running for this client.
 */

import { createClient } from '@supabase/supabase-js'
import { withSentry } from '../lib/sentry.js'
import { spawnJob } from '../lib/e2b-runner.js'

export const maxDuration = 60

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { client_id } = req.body || {}
  if (!client_id) {
    return res.status(400).json({ error: 'client_id requis' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  // Auth — internal cron secret OR an admin user JWT that owns the client.
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace(/^Bearer\s+/, '')
  const isCron = token && token === process.env.CRON_SECRET

  if (!isCron) {
    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization header' })
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    const userId = userData.user.id

    const { data: link } = await supabase
      .from('client_users')
      .select('client_id')
      .eq('user_id', userId)
      .eq('client_id', client_id)
      .maybeSingle()
    const { data: owner } = await supabase
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .eq('owner_user_id', userId)
      .maybeSingle()
    if (!link && !owner) {
      return res.status(403).json({ error: 'No access to this client' })
    }
  }

  // Guard — never run two deep crawls concurrently for the same client.
  const { data: existing } = await supabase
    .from('e2b_jobs')
    .select('id, status')
    .eq('client_id', client_id)
    .eq('job_type', 'kb_deep_crawl')
    .in('status', ['queued', 'running'])
    .maybeSingle()

  if (existing) {
    return res.status(409).json({
      error: 'kb_deep_crawl already in progress',
      job_id: existing.id,
      status: existing.status,
    })
  }

  try {
    const { jobId } = await spawnJob({
      jobType: 'kb_deep_crawl',
      clientId: client_id,
      scriptName: 'kb_deep_crawl.py',
      payload: {},
      env: {
        TAVILY_API_KEY: process.env.TAVILY_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      },
      timeoutMinutes: 30,
    })

    return res.status(202).json({ job_id: jobId })
  } catch (err) {
    console.error('[jobs/kb-deep-crawl] spawn failed:', err)
    return res.status(500).json({ error: err.message || 'Failed to spawn deep crawl job' })
  }
}

export default withSentry(handler)
