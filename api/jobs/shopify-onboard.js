/**
 * POST /api/jobs/shopify-onboard
 *
 * Triggers the heavy-lift onboarding pipeline in an E2B sandbox after a
 * Shopify OAuth completion. The Vercel function returns 202 immediately
 * and the sandbox keeps running for up to 30 minutes:
 *
 *   1. Pull all products / customers / orders (paginated, rate-limited)
 *   2. Pull historical conversations from any connected helpdesk
 *   3. Build initial knowledge base entries
 *   4. Generate embeddings + index in pgvector
 *   5. Mark client.onboarding_status = 'ready' so the dashboard unlocks
 *
 * Body:
 *   { clientId: string, shopDomain: string }
 *
 * Auth: same as other admin/internal endpoints — Bearer service token OR
 * called server-to-server from api/shopify/callback.js (header bypass).
 */

import { createClient } from '@supabase/supabase-js'
import { withSentry } from '../lib/sentry.js'
import { spawnJob } from '../lib/e2b-runner.js'
import { decryptToken } from '../lib/crypto.js'

export const maxDuration = 60

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Internal calls from callback.js carry a shared header; user-facing calls
  // require a Bearer token tied to a client owner.
  const internalSecret = req.headers['x-actero-internal']
  const isInternal = internalSecret && internalSecret === process.env.ACTERO_INTERNAL_TOKEN

  const { clientId, shopDomain, syncRange = '90d' } = req.body || {}

  if (!clientId || !shopDomain) {
    return res.status(400).json({ error: 'clientId and shopDomain are required' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  // 1. Verify caller has access (skip for internal calls).
  if (!isInternal) {
    const authHeader = req.headers.authorization || ''
    const userToken = authHeader.replace(/^Bearer\s+/, '')
    if (!userToken) {
      return res.status(401).json({ error: 'Missing Authorization header' })
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(userToken)
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    const { data: link } = await supabase
      .from('client_users')
      .select('client_id')
      .eq('user_id', userData.user.id)
      .eq('client_id', clientId)
      .maybeSingle()
    const { data: owner } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('owner_user_id', userData.user.id)
      .maybeSingle()
    if (!link && !owner) {
      return res.status(403).json({ error: 'No access to this client' })
    }
  }

  // 2. Look up the encrypted Shopify access token.
  const { data: connection, error: connErr } = await supabase
    .from('client_shopify_connections')
    .select('access_token, scopes')
    .eq('client_id', clientId)
    .eq('shop_domain', shopDomain)
    .maybeSingle()

  if (connErr || !connection?.access_token) {
    return res.status(404).json({ error: 'Shopify connection not found for this client' })
  }

  let decryptedToken
  try {
    decryptedToken = decryptToken(connection.access_token)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to decrypt Shopify token' })
  }

  // 3. Avoid duplicate onboarding jobs for the same connection.
  const { data: existing } = await supabase
    .from('e2b_jobs')
    .select('id, status')
    .eq('client_id', clientId)
    .eq('job_type', 'shopify_onboard')
    .in('status', ['queued', 'running'])
    .maybeSingle()

  if (existing) {
    return res.status(409).json({
      error: 'Onboarding already in progress for this client',
      jobId: existing.id,
      status: existing.status,
    })
  }

  // 4. Spawn the sandbox.
  try {
    const { jobId, sandboxId } = await spawnJob({
      jobType: 'shopify_onboard',
      clientId,
      scriptName: 'shopify_onboard.py',
      payload: {
        shop_domain: shopDomain,
        sync_range: syncRange, // '90d' | '180d' | '365d' | 'all'
      },
      env: {
        SHOPIFY_ACCESS_TOKEN: decryptedToken,
        SHOPIFY_SHOP_DOMAIN: shopDomain,
      },
      timeoutMinutes: 30,
    })

    return res.status(202).json({
      jobId,
      sandboxId,
      status: 'running',
      message: 'Onboarding started. Poll /api/jobs/:id for progress.',
    })
  } catch (err) {
    console.error('shopify-onboard spawn failed:', err)
    return res.status(500).json({ error: err.message || 'Failed to spawn onboarding job' })
  }
}

export default withSentry(handler)
