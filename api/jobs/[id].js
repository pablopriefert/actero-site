/**
 * GET    /api/jobs/:id  — fetch status + progress of an E2B job
 * DELETE /api/jobs/:id  — cancel a running job (kills sandbox + marks cancelled)
 *
 * Auth: caller must own the client referenced by the job.
 */

import { createClient } from '@supabase/supabase-js'
import { withSentry } from '../lib/sentry.js'
import { killSandbox } from '../lib/e2b-runner.js'

export const maxDuration = 30

async function handler(req, res) {
  const { id } = req.query
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing job id' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace(/^Bearer\s+/, '')
  if (!userToken) {
    return res.status(401).json({ error: 'Missing Authorization header' })
  }
  const { data: userData, error: userErr } = await supabase.auth.getUser(userToken)
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Invalid token' })
  }
  const userId = userData.user.id

  const { data: job, error: jobErr } = await supabase
    .from('e2b_jobs')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (jobErr || !job) {
    return res.status(404).json({ error: 'Job not found' })
  }

  // Verify access to the linked client.
  if (job.client_id) {
    const { data: link } = await supabase
      .from('client_users')
      .select('client_id')
      .eq('user_id', userId)
      .eq('client_id', job.client_id)
      .maybeSingle()
    const { data: owner } = await supabase
      .from('clients')
      .select('id')
      .eq('id', job.client_id)
      .eq('owner_user_id', userId)
      .maybeSingle()
    if (!link && !owner) {
      return res.status(403).json({ error: 'No access to this job' })
    }
  }

  if (req.method === 'GET') {
    // Sanitise — never leak full payload (may contain sensitive helpdesk creds).
    const { payload, ...safeJob } = job
    return res.status(200).json({
      ...safeJob,
      payload: stripSensitive(payload),
    })
  }

  if (req.method === 'DELETE') {
    if (!['queued', 'running'].includes(job.status)) {
      return res.status(409).json({ error: `Cannot cancel a ${job.status} job` })
    }

    if (job.sandbox_id) {
      await killSandbox(job.sandbox_id)
    }

    await supabase
      .from('e2b_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error: 'Cancelled by user',
      })
      .eq('id', id)

    return res.status(200).json({ status: 'cancelled' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

function stripSensitive(payload) {
  if (!payload || typeof payload !== 'object') return payload
  const sensitive = ['api_key', 'token', 'password', 'access_token', 'subdomain']
  const cleaned = {}
  for (const [k, v] of Object.entries(payload)) {
    const isSensitive = sensitive.some((s) => k.toLowerCase().includes(s))
    cleaned[k] = isSensitive ? '***' : v
  }
  return cleaned
}

export default withSentry(handler)
