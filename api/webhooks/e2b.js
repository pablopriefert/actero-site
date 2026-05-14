/**
 * POST /api/webhooks/e2b
 *
 * Receives lifecycle events from E2B (sandbox.created, sandbox.killed,
 * sandbox.timeout, sandbox.error) and forwards anomalies to Sentry +
 * persists a compact event log in Supabase for ops visibility.
 *
 * Configure on E2B dashboard:
 *   - URL: https://actero.fr/api/webhooks/e2b
 *   - Secret: env E2B_WEBHOOK_SECRET (HMAC SHA-256)
 *   - Events: sandbox.created, sandbox.killed, sandbox.timeout, sandbox.error
 */

import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/node'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

function verifySignature(rawBody, signature, secret) {
  if (!signature || !secret) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex'),
    )
  } catch {
    return false
  }
}

export const config = {
  api: { bodyParser: false },
}

async function readRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const rawBody = await readRawBody(req)
  const signature = req.headers['x-e2b-signature'] || req.headers['x-signature']

  if (process.env.E2B_WEBHOOK_SECRET) {
    if (!verifySignature(rawBody, signature, process.env.E2B_WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'invalid_signature' })
    }
  }

  let event
  try {
    event = JSON.parse(rawBody)
  } catch {
    return res.status(400).json({ error: 'invalid_json' })
  }

  const eventType = event.type || event.event || 'unknown'
  const sandboxId = event.sandbox_id || event.sandboxId || event.data?.sandbox_id
  const merchantId = event.metadata?.merchant_id || event.data?.metadata?.merchant_id
  const actionType = event.metadata?.action_type || event.data?.metadata?.action_type

  // Persist a compact ops-friendly trail. Errors/timeouts also go to
  // Sentry so on-call gets paged automatically.
  try {
    await supabase.from('agent_action_logs').insert({
      merchant_id: merchantId || '00000000-0000-0000-0000-000000000000',
      action_type: actionType || 'e2b_lifecycle',
      decision: eventType,
      success: !['sandbox.error', 'sandbox.timeout'].includes(eventType),
      output: null,
      error: event.error || null,
      sandbox_id: sandboxId,
    })
  } catch (logErr) {
    Sentry.captureException(logErr, { tags: { stage: 'e2b_webhook_log' } })
  }

  if (eventType === 'sandbox.error' || eventType === 'sandbox.timeout') {
    Sentry.captureMessage(`E2B ${eventType}`, {
      level: 'warning',
      tags: { sandboxId, merchantId, actionType },
      extra: { event },
    })
  }

  return res.status(200).json({ ok: true })
}
