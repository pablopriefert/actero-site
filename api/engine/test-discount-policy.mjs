/**
 * POST /api/engine/test-discount-policy
 *
 * Spawns an E2B sandbox, evaluates the merchant's discount policy with the
 * supplied (or saved) Python source against a mock cart + customer payload,
 * and returns the decision. Also persists the run in agent_action_logs so
 * the merchant has a real audit trail (same table used by refund-with-rules).
 *
 * Body:
 *   {
 *     client_id?:  string  (defaults to the user's primary client)
 *     policy_code?: string  (override — if absent, uses client_settings.discount_policy_code)
 *     mock_cart?:   { total_value, currency, items_count }
 *     mock_customer?: { clv, orders_count, email_domain }
 *     max_pct?:     number  (override — defaults to client_settings.discount_policy_max_pct or 15)
 *     persist?:     boolean (when true, saves policy_code into client_settings)
 *   }
 *
 * Auth: Supabase access token (Bearer).
 */

import { Sandbox } from '@e2b/code-interpreter'
import { createClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/node'
import { DISCOUNT_SANDBOX_SCRIPT, DEFAULT_DISCOUNT_POLICY } from './agent-actions/discount-with-rules.js'

export const maxDuration = 60

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  // Auth gate — dashboard users only.
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'unauthorized' })
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user) return res.status(401).json({ error: 'invalid_token' })
  const userId = userData.user.id

  // Resolve client_id
  const body = req.body || {}
  let clientId = body.client_id
  if (!clientId) {
    const { data: link } = await supabase
      .from('client_users').select('client_id').eq('user_id', userId).maybeSingle()
    clientId = link?.client_id
  }
  if (!clientId) return res.status(400).json({ error: 'no_client_for_user' })

  // Load saved policy + caps to fill in missing fields
  const { data: settings } = await supabase
    .from('client_settings')
    .select('discount_policy_code, discount_policy_max_pct')
    .eq('client_id', clientId)
    .maybeSingle()

  const policyCode = (typeof body.policy_code === 'string' && body.policy_code.trim())
    ? body.policy_code
    : (settings?.discount_policy_code || DEFAULT_DISCOUNT_POLICY)

  const maxPct = Number.isFinite(Number(body.max_pct))
    ? Number(body.max_pct)
    : (settings?.discount_policy_max_pct ?? 15)

  const mockCart = {
    total_value: Number(body.mock_cart?.total_value) || 89,
    currency: body.mock_cart?.currency || 'EUR',
    items_count: Number(body.mock_cart?.items_count) || 2,
  }
  const mockCustomer = {
    clv: Number(body.mock_customer?.clv) || 250,
    orders_count: Number(body.mock_customer?.orders_count) || 1,
    email_domain: body.mock_customer?.email_domain || 'example.com',
  }

  const context = {
    policy_code: policyCode,
    cart: mockCart,
    customer: mockCustomer,
    policy_caps: { max_pct: maxPct },
  }

  // Optional: persist as the new saved policy
  if (body.persist === true) {
    await supabase
      .from('client_settings')
      .upsert({
        client_id: clientId,
        discount_policy_code: policyCode,
        discount_policy_max_pct: maxPct,
        discount_policy_updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id' })
  }

  const startedAt = Date.now()
  let sandbox, decision = null, runError = null, sandboxId = null

  try {
    sandbox = await Sandbox.create({
      apiKey: process.env.E2B_API_KEY,
      timeoutMs: 60_000,
      metadata: {
        test_user: userId,
        client_id: clientId,
        env: 'discount_policy_test',
      },
    })
    sandboxId = sandbox.sandboxId
    await sandbox.files.write('/workspace/context.json', JSON.stringify(context))
    const exec = await sandbox.runCode(DISCOUNT_SANDBOX_SCRIPT, { timeoutMs: 30_000 })
    if (exec.error) {
      runError = String(exec.error.value || exec.error)
    } else {
      const stdout = exec.logs.stdout.join('').trim()
      const lastLine = stdout.split('\n').filter(Boolean).pop() || '{}'
      decision = JSON.parse(lastLine)
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { stage: 'discount_policy_test', clientId },
    })
    runError = err.message
  } finally {
    if (sandbox) await sandbox.kill().catch(() => {})
  }

  const durationMs = Date.now() - startedAt

  // Audit — same table as refund-with-rules so ops can reuse existing dashboards.
  try {
    await supabase.from('agent_action_logs').insert({
      merchant_id: clientId,
      action_type: 'discount_policy_test',
      payload: { mock_cart: mockCart, mock_customer: mockCustomer },
      guardrails: { max_pct: maxPct },
      decision: decision?.error ? `error:${decision.error}` : (decision ? 'evaluated' : (runError ? 'sandbox_error' : 'unknown')),
      success: !runError && !decision?.error,
      output: decision ? JSON.stringify(decision) : null,
      error: runError,
      duration_ms: durationMs,
      sandbox_id: sandboxId,
    })
  } catch (logErr) {
    Sentry.captureException(logErr, { tags: { stage: 'discount_policy_audit_log' } })
  }

  if (runError) {
    return res.status(500).json({
      ok: false,
      error: runError,
      sandbox_id: sandboxId,
      duration_ms: durationMs,
      context: { mock_cart: mockCart, mock_customer: mockCustomer, max_pct: maxPct },
    })
  }

  return res.status(200).json({
    ok: !decision?.error,
    sandbox_id: sandboxId,
    duration_ms: durationMs,
    context: { mock_cart: mockCart, mock_customer: mockCustomer, max_pct: maxPct },
    decision,
  })
}
