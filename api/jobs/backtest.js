/**
 * POST /api/jobs/backtest
 *
 * Triggers the DRY-RUN ticket backtest harness: replays a client's imported
 * historical tickets through Actero's brain to produce the sales proof
 * "Actero would have resolved X% of your past tickets".
 *
 * Admin-only. Inserts `ticket_backtests` row(s) (status=running) and spawns the
 * `ticket_backtest.py` E2B sandbox per run. The sandbox is strictly read-only
 * on historical data and writes only to ticket_backtests + its e2b_jobs row.
 *
 * Body:
 *   { client_id }                              — single run, ambient provider
 *   { client_id, provider, model }             — single run, forced provider/model
 *   { client_id, compare: true }               — A/B: Claude vs GPT-5.4-mini
 * Returns: { backtest_id, job_id } | { comparison: [{provider, model, backtest_id, job_id}] }
 */

import { withSentry } from '../lib/sentry.js'
import { spawnJob } from '../lib/e2b-runner.js'
import { authenticateAdmin, supabaseAdmin, readJsonBody } from '../admin/_helpers.js'

export const maxDuration = 60

// Baseline (current prod quality) vs the switch candidate.
const COMPARE_CONFIGS = [
  { provider: 'anthropic', model: 'claude-sonnet-5' },
  { provider: 'openai', model: 'gpt-5.4-mini' },
]

async function spawnBacktest(clientId, { provider, model } = {}) {
  const { data: backtest, error: insertErr } = await supabaseAdmin
    .from('ticket_backtests')
    .insert({ client_id: clientId, status: 'running', provider: provider || null, model_id: model || null })
    .select('id')
    .single()
  if (insertErr || !backtest) {
    throw new Error(`Failed to create backtest row: ${insertErr?.message || 'unknown'}`)
  }
  const backtestId = backtest.id

  try {
    const { jobId } = await spawnJob({
      jobType: 'ticket_backtest',
      clientId,
      scriptName: 'ticket_backtest.py',
      payload: {
        backtest_id: backtestId,
        limit: 500,
        ...(provider ? { provider } : {}),
        ...(model ? { model } : {}),
      },
      env: {
        PUBLIC_API_URL: process.env.PUBLIC_API_URL || 'https://actero.fr',
        CRON_SECRET: process.env.CRON_SECRET,
      },
      timeoutMinutes: 30,
    })
    await supabaseAdmin.from('ticket_backtests').update({ job_id: jobId }).eq('id', backtestId)
    return { backtest_id: backtestId, job_id: jobId, provider: provider || null, model: model || null }
  } catch (err) {
    await supabaseAdmin
      .from('ticket_backtests')
      .update({ status: 'failed', error: err.message || 'Failed to spawn backtest job', completed_at: new Date().toISOString() })
      .eq('id', backtestId)
    throw err
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = await authenticateAdmin(req, res)
  if (!auth) return

  const body = await readJsonBody(req)
  const clientId = body?.client_id
  const compare = body?.compare === true
  if (!clientId) {
    return res.status(400).json({ error: 'client_id is required' })
  }

  const { data: client, error: clientErr } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .maybeSingle()
  if (clientErr || !client) {
    return res.status(404).json({ error: 'Client not found' })
  }

  // Guard: no overlap with an already-running backtest for this client.
  const { data: running } = await supabaseAdmin
    .from('ticket_backtests')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'running')
    .maybeSingle()
  if (running) {
    return res.status(409).json({ error: 'A backtest is already running for this client', backtest_id: running.id })
  }

  try {
    if (compare) {
      const comparison = []
      for (const cfg of COMPARE_CONFIGS) {
        comparison.push(await spawnBacktest(clientId, cfg))
      }
      return res.status(202).json({ comparison })
    }

    const result = await spawnBacktest(clientId, { provider: body?.provider, model: body?.model })
    return res.status(202).json(result)
  } catch (err) {
    console.error('[jobs/backtest] spawn failed:', err)
    return res.status(500).json({ error: err.message || 'Failed to spawn backtest job' })
  }
}

export default withSentry(handler)
