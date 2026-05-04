/**
 * E2B sandbox runner — shared library for background jobs that exceed
 * Vercel's 60s function limit.
 *
 * Architecture:
 *   1. spawnJob() creates a row in `e2b_jobs` (status=queued).
 *   2. It spawns an E2B sandbox, uploads the requested Python script, and
 *      starts it in the background. The sandbox runs autonomously after the
 *      Vercel function returns.
 *   3. The Python script writes progress updates back via Supabase REST
 *      using the service role key passed as an env var.
 *   4. spawnJob() returns immediately with { jobId, sandboxId }.
 *
 * Cost guardrails:
 *   - Default sandbox timeout = 30 min. Override via opts.timeoutMinutes.
 *   - If the script doesn't write any progress in 5 min, the watchdog kills it.
 *   - Each sandbox costs ~$0.0001/CPU-sec. A 10-min job ≈ $0.06.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Sandbox } from '@e2b/code-interpreter'
import { createClient } from '@supabase/supabase-js'
import { captureError } from './sentry.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Resolve repo root so we can read e2b-sandbox/scripts/*.py.
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SCRIPTS_DIR = path.join(REPO_ROOT, 'e2b-sandbox', 'scripts')

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Spawn a sandbox job that runs in the background.
 *
 * @param {Object} opts
 * @param {string} opts.jobType        — see e2b_jobs.job_type CHECK constraint
 * @param {string} opts.clientId       — UUID of the Actero client
 * @param {string} opts.scriptName     — filename in e2b-sandbox/scripts/ (e.g. 'shopify_onboard.py')
 * @param {Object} [opts.payload]      — JSON payload available to the script as JOB_PAYLOAD env
 * @param {Object} [opts.env]          — extra env vars passed to the sandbox
 * @param {number} [opts.timeoutMinutes] — sandbox kill timeout (default 30)
 * @returns {Promise<{ jobId: string, sandboxId: string }>}
 */
export async function spawnJob({
  jobType,
  clientId,
  scriptName,
  payload = {},
  env = {},
  timeoutMinutes = 30,
}) {
  if (!jobType) throw new Error('jobType is required')
  if (!scriptName) throw new Error('scriptName is required')
  if (!process.env.E2B_API_KEY) throw new Error('E2B_API_KEY not configured')

  const supabase = getSupabase()

  // 1. Create the job row.
  const { data: job, error: insertError } = await supabase
    .from('e2b_jobs')
    .insert({
      client_id: clientId || null,
      job_type: jobType,
      status: 'queued',
      payload,
      progress: 0,
      progress_message: 'Queued',
      expires_at: new Date(Date.now() + timeoutMinutes * 60_000 + 5 * 60_000).toISOString(),
    })
    .select('id')
    .single()

  if (insertError || !job) {
    throw new Error(`Failed to enqueue job: ${insertError?.message || 'unknown'}`)
  }

  const jobId = job.id

  // 2. Read the Python script from disk.
  const scriptPath = path.join(SCRIPTS_DIR, scriptName)
  if (!fs.existsSync(scriptPath)) {
    await markJobFailed(jobId, `Sandbox script not found: ${scriptName}`)
    throw new Error(`Sandbox script not found: ${scriptPath}`)
  }
  const scriptCode = fs.readFileSync(scriptPath, 'utf-8')

  // Also include the shared helper lib if it exists.
  const libPath = path.join(SCRIPTS_DIR, 'lib_actero.py')
  const libCode = fs.existsSync(libPath) ? fs.readFileSync(libPath, 'utf-8') : null

  // 3. Spawn sandbox.
  let sandbox
  try {
    sandbox = await Sandbox.create({
      apiKey: process.env.E2B_API_KEY,
      timeoutMs: timeoutMinutes * 60_000,
      metadata: {
        jobId,
        jobType,
        clientId: clientId || '',
      },
    })
  } catch (err) {
    await markJobFailed(jobId, `Failed to create sandbox: ${err.message}`)
    captureError(err, { context: 'e2b-runner.spawnJob.create', jobId, jobType })
    throw err
  }

  const sandboxId = sandbox.sandboxId

  // 4. Upload script + lib + .env file.
  try {
    await sandbox.files.write('/script.py', scriptCode)
    if (libCode) {
      await sandbox.files.write('/lib_actero.py', libCode)
    }
  } catch (err) {
    await markJobFailed(jobId, `Failed to upload script: ${err.message}`)
    captureError(err, { context: 'e2b-runner.spawnJob.upload', jobId, sandboxId })
    await sandbox.kill().catch(() => {})
    throw err
  }

  // 5. Update the job row with sandbox ID + status=running.
  await supabase
    .from('e2b_jobs')
    .update({
      sandbox_id: sandboxId,
      status: 'running',
      started_at: new Date().toISOString(),
      progress_message: 'Sandbox started',
    })
    .eq('id', jobId)

  // 6. Build the env block. Env values must be JSON-encoded so they survive
  // shell interpolation cleanly (especially payloads with special chars).
  const fullEnv = {
    JOB_ID: jobId,
    JOB_TYPE: jobType,
    JOB_PAYLOAD: JSON.stringify(payload),
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CLIENT_ID: clientId || '',
    ...env,
  }

  // 7. Install minimal Python deps + run the script in background.
  // We use `nohup ... &` so the command returns immediately while the script
  // keeps running until it exits (or the sandbox times out).
  const installCmd = [
    'pip install -q --no-input',
    'requests==2.32.3',
    'pydantic==2.9.2',
    'python-dotenv==1.0.1',
  ].join(' ')

  try {
    // Block on install (5-15s) — this is fine within the Vercel 60s limit.
    await sandbox.commands.run(installCmd, { timeoutMs: 30_000 })
  } catch (err) {
    await markJobFailed(jobId, `pip install failed: ${err.message}`)
    captureError(err, { context: 'e2b-runner.spawnJob.pip', jobId, sandboxId })
    await sandbox.kill().catch(() => {})
    throw err
  }

  // Fire-and-forget the actual script. We do NOT await this — the sandbox
  // keeps running after the Vercel function returns.
  sandbox.commands
    .run(`python /script.py`, {
      envs: fullEnv,
      background: true,
      onStderr: (data) => console.error(`[sandbox ${sandboxId}] stderr:`, data),
      onStdout: (data) => console.log(`[sandbox ${sandboxId}] stdout:`, data),
    })
    .catch((err) => {
      console.error('[e2b-runner] background run failed:', err)
      captureError(err, { context: 'e2b-runner.spawnJob.background', jobId, sandboxId })
    })

  return { jobId, sandboxId }
}

/**
 * Kill a sandbox (called by the watchdog cron when a job is done or stuck).
 */
export async function killSandbox(sandboxId) {
  if (!sandboxId) return
  try {
    const sandbox = await Sandbox.connect(sandboxId, { apiKey: process.env.E2B_API_KEY })
    await sandbox.kill()
  } catch (err) {
    // Sandbox may already be dead — that's fine.
    console.warn(`[e2b-runner] killSandbox(${sandboxId}) failed:`, err.message)
  }
}

/**
 * List currently active sandboxes (cron uses this to detect orphans).
 */
export async function listActiveSandboxes() {
  try {
    const sandboxes = await Sandbox.list({ apiKey: process.env.E2B_API_KEY })
    return sandboxes
  } catch (err) {
    captureError(err, { context: 'e2b-runner.listActiveSandboxes' })
    return []
  }
}

async function markJobFailed(jobId, errorMessage) {
  try {
    const supabase = getSupabase()
    await supabase
      .from('e2b_jobs')
      .update({
        status: 'failed',
        error: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)
  } catch (err) {
    console.error('[e2b-runner] markJobFailed error:', err)
  }
}

export const __test__ = { getSupabase, markJobFailed, SCRIPTS_DIR }
