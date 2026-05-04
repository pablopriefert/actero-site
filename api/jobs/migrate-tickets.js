/**
 * POST /api/jobs/migrate-tickets
 *
 * Bulk-imports historical tickets from a competitor helpdesk (Gorgias /
 * Zendesk / Intercom) into Actero. Runs in an E2B sandbox up to 24h.
 *
 * Supported providers:
 *   - 'gorgias'   — needs { gorgias_subdomain, gorgias_api_key }
 *   - 'zendesk'   — needs { zendesk_subdomain, zendesk_email, zendesk_api_token }
 *   - 'intercom'  — needs { intercom_token }
 *
 * Body:
 *   {
 *     clientId: string,
 *     provider: 'gorgias' | 'zendesk' | 'intercom',
 *     credentials: { ...provider-specific... },
 *     options?: {
 *       since?: string  // ISO date — only tickets created after this
 *       limit?: number  // optional cap (default: no limit)
 *       trainAi?: boolean // default true — also re-train the engine on imported tickets
 *     }
 *   }
 *
 * Returns 202 with { jobId, sandboxId } — poll /api/jobs/:id for progress.
 *
 * IMPORTANT: this endpoint receives plaintext API credentials in the body.
 * They are passed straight to the sandbox env (never persisted) and the
 * sandbox kills itself once the migration completes.
 */

import { createClient } from '@supabase/supabase-js'
import { withSentry } from '../lib/sentry.js'
import { spawnJob } from '../lib/e2b-runner.js'

export const maxDuration = 60

const PROVIDER_SCRIPTS = {
  gorgias: 'migrate_gorgias.py',
  zendesk: 'migrate_zendesk.py',
  intercom: 'migrate_intercom.py',
}

const PROVIDER_REQUIRED_CREDS = {
  gorgias: ['gorgias_subdomain', 'gorgias_api_key', 'gorgias_email'],
  zendesk: ['zendesk_subdomain', 'zendesk_email', 'zendesk_api_token'],
  intercom: ['intercom_token'],
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { clientId, provider, credentials = {}, options = {} } = req.body || {}

  if (!clientId || !provider) {
    return res.status(400).json({ error: 'clientId and provider are required' })
  }

  const scriptName = PROVIDER_SCRIPTS[provider]
  if (!scriptName) {
    return res.status(400).json({
      error: `Unsupported provider: ${provider}. Supported: ${Object.keys(PROVIDER_SCRIPTS).join(', ')}`,
    })
  }

  const requiredKeys = PROVIDER_REQUIRED_CREDS[provider]
  const missing = requiredKeys.filter((k) => !credentials[k])
  if (missing.length) {
    return res.status(400).json({
      error: `Missing credentials for ${provider}: ${missing.join(', ')}`,
    })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  // Auth — caller must own the client.
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

  const { data: link } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', userId)
    .eq('client_id', clientId)
    .maybeSingle()
  const { data: owner } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('owner_user_id', userId)
    .maybeSingle()
  if (!link && !owner) {
    return res.status(403).json({ error: 'No access to this client' })
  }

  // Avoid duplicate migration for the same client + provider.
  const { data: existing } = await supabase
    .from('e2b_jobs')
    .select('id, status')
    .eq('client_id', clientId)
    .eq('job_type', `migrate_${provider}`)
    .in('status', ['queued', 'running'])
    .maybeSingle()

  if (existing) {
    return res.status(409).json({
      error: `${provider} migration already in progress`,
      jobId: existing.id,
      status: existing.status,
    })
  }

  // Build the sandbox env. Credentials live ONLY in sandbox env, never DB.
  const sandboxEnv = {}
  for (const [k, v] of Object.entries(credentials)) {
    sandboxEnv[k.toUpperCase()] = String(v)
  }

  try {
    const { jobId, sandboxId } = await spawnJob({
      jobType: `migrate_${provider}`,
      clientId,
      scriptName,
      payload: {
        provider,
        since: options.since || null,
        limit: options.limit || null,
        train_ai: options.trainAi !== false,
      },
      env: sandboxEnv,
      timeoutMinutes: 240, // 4h cap — large stores can have 100k+ tickets
    })

    return res.status(202).json({
      jobId,
      sandboxId,
      status: 'running',
      provider,
      message: `${provider} migration started. Poll /api/jobs/:id for progress.`,
    })
  } catch (err) {
    console.error('migrate-tickets spawn failed:', err)
    return res.status(500).json({ error: err.message || 'Failed to spawn migration job' })
  }
}

export default withSentry(handler)
