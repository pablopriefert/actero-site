/**
 * POST /api/dev/test-e2b-sandbox
 *
 * Dry-run sandbox spawn used by the dashboard "Test E2B sandbox" button.
 * Validates the orchestrator pipeline end-to-end without touching Shopify
 * — the script uses mock customer/order data so the merchant doesn't need
 * a real connected store to verify their guardrails behave correctly.
 *
 * Auth: requires a valid Supabase access token (Bearer header).
 * Audit: logs every run to public.agent_action_logs with action_type
 * "dev_test_sandbox" so ops can see usage + catch broken sandboxes early.
 */

import { Sandbox } from '@e2b/code-interpreter'
import { createClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/node'

// E2B sandbox spawn + runCode + kill routinely takes 5-15s. Without this,
// Vercel kills the function at the 10s default and returns its HTML error
// page, which the dashboard then fails to parse as JSON.
export const maxDuration = 60

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const MOCK_SCRIPT = `
import json
from pathlib import Path

ctx = json.loads(Path('/workspace/context.json').read_text())
payload = ctx['payload']
guardrails = ctx['guardrails']

requested = float(payload['amount'])
max_auto = float(guardrails['max_auto_refund_eur'])
vip_threshold = float(guardrails['vip_threshold_eur'])

customer_total_spent = float(payload.get('mock_customer_total', 250))
order_total = float(payload.get('mock_order_total', 89))
is_vip = customer_total_spent >= vip_threshold

if requested > order_total:
    out = {'decision': 'reject', 'reason': 'amount_exceeds_order',
           'requested': requested, 'order_total': order_total}
elif requested > max_auto and not is_vip:
    out = {'decision': 'escalate_human', 'reason': 'amount_above_auto_threshold_non_vip',
           'amount': requested, 'threshold': max_auto, 'is_vip': is_vip}
else:
    out = {'decision': 'refunded', 'mock_refund_id': 9999,
           'amount': requested, 'is_vip': is_vip}

print(json.dumps(out))
`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  // Auth gate — only logged-in dashboard users can spin up sandboxes.
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'invalid_token' })
  }
  const userId = userData.user.id
  const clientId = req.body?.client_id || userId

  // Build mock context from body (with safe defaults)
  const body = req.body || {}
  const context = {
    shopify_domain: 'demo.myshopify.com',
    shopify_admin_token: 'shpat_dev_dummy',
    merchant_id: clientId,
    action_type: 'refund_with_rules',
    payload: {
      order_id: body.order_id || 12_345,
      reason: body.reason || 'damaged_product',
      amount: Number(body.amount) || 42.5,
      mock_customer_total: Number(body.mock_customer_total) || 250,
      mock_order_total: Number(body.mock_order_total) || 89,
    },
    guardrails: {
      max_auto_refund_eur: Number(body.max_auto_refund_eur) || 100,
      vip_threshold_eur: Number(body.vip_threshold_eur) || 500,
    },
  }

  const startedAt = Date.now()
  let sandbox
  let decision = null
  let error = null
  let sandboxId = null

  try {
    sandbox = await Sandbox.create({
      apiKey: process.env.E2B_API_KEY,
      timeoutMs: 60_000,
      metadata: {
        test_user: userId,
        client_id: clientId,
        env: 'dashboard_dev_test',
      },
    })
    sandboxId = sandbox.sandboxId

    await sandbox.files.write(
      '/workspace/context.json',
      JSON.stringify(context),
    )

    const exec = await sandbox.runCode(MOCK_SCRIPT, { timeoutMs: 30_000 })
    if (exec.error) {
      error = String(exec.error.value || exec.error)
    } else {
      const stdout = exec.logs.stdout.join('').trim()
      const lastLine = stdout.split('\n').filter(Boolean).pop() || '{}'
      decision = JSON.parse(lastLine)
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { stage: 'dashboard_e2b_test', clientId },
    })
    error = err.message
  } finally {
    if (sandbox) await sandbox.kill().catch(() => {})
  }

  const durationMs = Date.now() - startedAt

  // Audit
  try {
    await supabase.from('agent_action_logs').insert({
      merchant_id: clientId,
      action_type: 'dev_test_sandbox',
      payload: context.payload,
      guardrails: context.guardrails,
      decision: decision?.decision || (error ? 'error' : 'unknown'),
      success: !error,
      output: decision ? JSON.stringify(decision) : null,
      error,
      duration_ms: durationMs,
      sandbox_id: sandboxId,
    })
  } catch (logErr) {
    Sentry.captureException(logErr, { tags: { stage: 'dev_test_audit_log' } })
  }

  if (error) {
    return res.status(500).json({
      ok: false,
      error,
      sandbox_id: sandboxId,
      duration_ms: durationMs,
      context,
    })
  }

  return res.status(200).json({
    ok: true,
    sandbox_id: sandboxId,
    duration_ms: durationMs,
    context,
    decision,
  })
}
