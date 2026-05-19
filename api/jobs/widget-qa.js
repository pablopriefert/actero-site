/**
 * POST /api/jobs/widget-qa
 *
 * Widget Install QA — spawns an E2B sandbox that visits the client's live
 * storefront and verifies the Actero chat widget is actually present and
 * visible. Catches broken installs (theme reverted, script stripped by a
 * theme update) before the client notices.
 *
 * Body: { client_id: string }
 *
 * Auth (either):
 *   - Admin/owner user JWT with access to client_id (same access-check
 *     pattern as api/jobs/migrate-tickets.js), OR
 *   - Internal `Authorization: Bearer ${CRON_SECRET}` so a future periodic
 *     scheduler can call this without code changes here. (No cron is added
 *     in this task — periodic scheduling is a separate workstream.)
 *
 * Writes ONLY: a new `widget_health` row + the e2b_jobs row (via spawnJob).
 * Returns 202 with { health_id, job_id }.
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
    return res.status(400).json({ error: 'client_id is required' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  // --- Auth: internal cron secret OR an authorised user JWT. ---
  const authHeader = req.headers.authorization || ''
  const bearer = authHeader.replace(/^Bearer\s+/, '')
  if (!bearer) {
    return res.status(401).json({ error: 'Missing Authorization header' })
  }

  const cronSecret = process.env.CRON_SECRET
  const isInternal = !!cronSecret && bearer === cronSecret

  if (!isInternal) {
    const { data: userData, error: userErr } = await supabase.auth.getUser(bearer)
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

  // --- Guard: don't stack QA jobs for the same client. ---
  const { data: existing } = await supabase
    .from('e2b_jobs')
    .select('id, status')
    .eq('client_id', client_id)
    .eq('job_type', 'widget_qa')
    .in('status', ['queued', 'running'])
    .maybeSingle()

  if (existing) {
    return res.status(409).json({
      error: 'Widget QA already in progress',
      job_id: existing.id,
      status: existing.status,
    })
  }

  // --- Create the widget_health row first so the sandbox can PATCH it. ---
  const { data: health, error: healthErr } = await supabase
    .from('widget_health')
    .insert({
      client_id,
      widget_found: false,
      widget_visible: false,
    })
    .select('id')
    .single()

  if (healthErr || !health) {
    console.error('[widget-qa] failed to create widget_health row:', healthErr)
    return res.status(500).json({
      error: `Failed to create widget_health row: ${healthErr?.message || 'unknown'}`,
    })
  }

  const healthId = health.id

  try {
    const { jobId } = await spawnJob({
      jobType: 'widget_qa',
      clientId: client_id,
      scriptName: 'widget_qa.py',
      payload: { health_id: healthId },
      env: {},
      timeoutMinutes: 10,
    })

    // Link the job back to the health row for the admin UI.
    await supabase
      .from('widget_health')
      .update({ job_id: jobId })
      .eq('id', healthId)

    return res.status(202).json({
      health_id: healthId,
      job_id: jobId,
      status: 'running',
      message: 'Widget QA started. Poll /api/jobs/:id for progress.',
    })
  } catch (err) {
    console.error('[widget-qa] spawn failed:', err)
    // Best-effort: annotate the health row so the failure isn't silent.
    await supabase
      .from('widget_health')
      .update({ error: err.message || 'spawn failed' })
      .eq('id', healthId)
      .then(() => {}, () => {})
    return res.status(500).json({ error: err.message || 'Failed to spawn widget QA job' })
  }
}

export default withSentry(handler)
