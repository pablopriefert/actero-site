/**
 * POST /api/jobs/backtest
 *
 * Triggers the DRY-RUN ticket backtest harness: replays a client's imported
 * historical tickets through Actero's brain to produce the sales proof
 * "Actero would have resolved X% of your past tickets".
 *
 * Admin-only. Inserts a `ticket_backtests` row (status=running) and spawns
 * the `ticket_backtest.py` E2B sandbox. The sandbox is strictly read-only on
 * historical data and writes only to ticket_backtests + its e2b_jobs row.
 *
 * Body: { client_id }
 * Returns: { backtest_id, job_id }
 */

import { withSentry } from '../lib/sentry.js'
import { spawnJob } from '../lib/e2b-runner.js'
import { authenticateAdmin, supabaseAdmin, readJsonBody } from '../admin/_helpers.js'

export const maxDuration = 60

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Admin auth (writes 401/403 + returns null on failure).
  const auth = await authenticateAdmin(req, res)
  if (!auth) return

  const body = await readJsonBody(req)
  const clientId = body?.client_id
  if (!clientId) {
    return res.status(400).json({ error: 'client_id is required' })
  }

  // Verify the client exists (admin has access to all clients, but we still
  // confirm the target is real before spawning a sandbox).
  const { data: client, error: clientErr } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .maybeSingle()
  if (clientErr || !client) {
    return res.status(404).json({ error: 'Client not found' })
  }

  // Guard: one running backtest per client at a time.
  const { data: running } = await supabaseAdmin
    .from('ticket_backtests')
    .select('id, status')
    .eq('client_id', clientId)
    .eq('status', 'running')
    .maybeSingle()
  if (running) {
    return res.status(409).json({
      error: 'A backtest is already running for this client',
      backtest_id: running.id,
    })
  }

  // Create the result row.
  const { data: backtest, error: insertErr } = await supabaseAdmin
    .from('ticket_backtests')
    .insert({ client_id: clientId, status: 'running' })
    .select('id')
    .single()
  if (insertErr || !backtest) {
    return res.status(500).json({
      error: `Failed to create backtest row: ${insertErr?.message || 'unknown'}`,
    })
  }
  const backtestId = backtest.id

  try {
    const { jobId } = await spawnJob({
      jobType: 'ticket_backtest',
      clientId,
      scriptName: 'ticket_backtest.py',
      payload: { backtest_id: backtestId, limit: 500 },
      env: {
        PUBLIC_API_URL: process.env.PUBLIC_API_URL || 'https://actero.fr',
        CRON_SECRET: process.env.CRON_SECRET,
      },
      timeoutMinutes: 30,
    })

    await supabaseAdmin
      .from('ticket_backtests')
      .update({ job_id: jobId })
      .eq('id', backtestId)

    return res.status(202).json({ backtest_id: backtestId, job_id: jobId })
  } catch (err) {
    console.error('[jobs/backtest] spawn failed:', err)
    // Mark the row failed so the UI doesn't show a stuck "running".
    await supabaseAdmin
      .from('ticket_backtests')
      .update({
        status: 'failed',
        error: err.message || 'Failed to spawn backtest job',
        completed_at: new Date().toISOString(),
      })
      .eq('id', backtestId)
    return res.status(500).json({ error: err.message || 'Failed to spawn backtest job' })
  }
}

export default withSentry(handler)
