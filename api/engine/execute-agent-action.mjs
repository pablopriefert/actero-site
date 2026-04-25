/**
 * POST /api/engine/execute-agent-action
 *
 * Body: { merchantId, actionType, payload, guardrails }
 *
 * Spawns an E2B sandbox, runs the merchant-scoped agentic action, returns
 * the structured decision + output. Every execution is audited in
 * `public.agent_action_logs` for SOC 2 + debugging.
 *
 * Why E2B:
 *   - Untrusted action code (LLM-generated or merchant-authored playbooks)
 *     never touches our shared infra.
 *   - Per-session isolation = leakage between merchants is impossible.
 *   - Compute cost is predictable (~5-15s per action × $0.0003/s).
 */

import { Sandbox } from '@e2b/code-interpreter'
import { createClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/node'
import {
  REFUND_WITH_RULES_SCRIPT,
} from './agent-actions/refund-with-rules.js'

const SUPPORTED_ACTIONS = {
  refund_with_rules: REFUND_WITH_RULES_SCRIPT,
}

// 5 min hard cap — no legit SAV action lasts longer.
const SANDBOX_TIMEOUT_MS = 300_000
const PIP_INSTALL_TIMEOUT_MS = 90_000

const PIP_DEPS = 'ShopifyAPI pillow pandas requests pydantic python-dotenv'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { merchantId, actionType, payload, guardrails } = req.body || {}

  if (!merchantId || typeof merchantId !== 'string') {
    return res.status(400).json({ error: 'merchant_id_required' })
  }
  if (!SUPPORTED_ACTIONS[actionType]) {
    return res.status(400).json({
      error: 'unsupported_action_type',
      supported: Object.keys(SUPPORTED_ACTIONS),
    })
  }

  const result = await executeAgentAction({
    merchantId,
    actionType,
    payload: payload || {},
    guardrails: guardrails || {},
  })

  return res.status(result.success ? 200 : 500).json(result)
}

/**
 * Programmatic entry point — also used directly by other server-side modules
 * (engine routing, n8n hooks, scheduled cron jobs).
 */
export async function executeAgentAction({
  merchantId,
  actionType,
  payload,
  guardrails,
}) {
  const startedAt = Date.now()
  const script = SUPPORTED_ACTIONS[actionType]
  if (!script) {
    return { success: false, error: 'unsupported_action_type', actionType }
  }

  let sandbox
  let result = {
    success: false,
    decision: null,
    output: null,
    error: null,
    sandboxId: null,
  }

  try {
    sandbox = await Sandbox.create({
      apiKey: process.env.E2B_API_KEY,
      timeoutMs: SANDBOX_TIMEOUT_MS,
      metadata: {
        merchant_id: merchantId,
        action_type: actionType,
        env: process.env.NODE_ENV || 'development',
      },
    })
    result.sandboxId = sandbox.sandboxId

    // Install Python deps. After the first run E2B caches the layer
    // in the sandbox image so the install is near-instant. We accept the
    // ~10s cold-start until we ship a custom v2 template.
    const install = await sandbox.commands.run(
      `pip install -q ${PIP_DEPS}`,
      { timeoutMs: PIP_INSTALL_TIMEOUT_MS },
    )
    if (install.exitCode !== 0) {
      throw new Error(`pip_install_failed: ${install.stderr}`)
    }

    // Resolve merchant credentials (Shopify Admin token must already be
    // decrypted server-side before this call — never store the encrypted
    // value in the sandbox).
    const { data: merchant, error: merchErr } = await supabase
      .from('merchants')
      .select('shopify_domain, shopify_admin_token')
      .eq('id', merchantId)
      .single()

    if (merchErr || !merchant) {
      throw new Error(`merchant_not_found: ${merchErr?.message || merchantId}`)
    }

    // Inject scoped env + payload + guardrails as files in the sandbox.
    // Files (rather than env vars) keep the values out of process listings
    // and make them visible only to the script that explicitly reads them.
    await sandbox.files.write(
      '/workspace/context.json',
      JSON.stringify({
        shopify_domain: merchant.shopify_domain,
        shopify_admin_token: merchant.shopify_admin_token,
        merchant_id: merchantId,
        action_type: actionType,
        payload,
        guardrails,
      }),
    )

    const execution = await sandbox.runCode(script, {
      timeoutMs: SANDBOX_TIMEOUT_MS,
    })

    if (execution.error) {
      result.error = String(execution.error.value || execution.error)
    } else {
      const stdout = execution.logs.stdout.join('').trim()
      result.output = stdout
      try {
        const parsed = JSON.parse(stdout.split('\n').filter(Boolean).pop() || '{}')
        result.decision = parsed.decision || null
        result.success = parsed.decision !== 'reject' && !parsed.error
      } catch {
        // Script didn't emit JSON — fall back to plain stdout.
        result.success = true
      }
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { merchantId, actionType },
      extra: { payload, guardrails },
    })
    result.error = err.message
  } finally {
    if (sandbox) {
      await sandbox.kill().catch(() => {})
    }

    // Audit trail — best-effort. We never want a logging failure to
    // mask the actual action result.
    try {
      await supabase.from('agent_action_logs').insert({
        merchant_id: merchantId,
        action_type: actionType,
        payload,
        guardrails,
        decision: result.decision,
        success: result.success,
        output: result.output,
        error: result.error,
        duration_ms: Date.now() - startedAt,
        sandbox_id: result.sandboxId,
      })
    } catch (logErr) {
      Sentry.captureException(logErr, {
        tags: { stage: 'agent_action_log' },
      })
    }
  }

  return result
}
