/**
 * Actero Engine — WhatsApp Cloud API Webhook
 *
 * Implements both sides of Meta's webhook contract:
 *
 *   GET  — Verification handshake (hub.mode / hub.verify_token / hub.challenge)
 *   POST — Inbound events (messages, statuses, ...)
 *
 * Security:
 *   - GET verified via META_WEBHOOK_VERIFY_TOKEN (exact match)
 *   - POST body is signed by Meta with META_APP_SECRET. We compute the
 *     HMAC-SHA256 of the RAW body and compare against x-hub-signature-256
 *     using timingSafeEqual. No signature → 401.
 *
 * Processing pipeline for a customer message:
 *   1. Parse & signature-check raw body
 *   2. Lookup whatsapp_accounts by phone_number_id → client_id
 *   3. Respect client_settings.whatsapp_agent_enabled
 *   4. Light per-phone-number rate limit
 *   5. Idempotence: skip if wa_message_id already in whatsapp_messages
 *   6. Insert inbound row in whatsapp_messages
 *   7. Normalize → loadPlaybook (with fallback) → runBrain
 *   8. If Brain produced an aiResponse and no review needed, send it back
 *      via sendWhatsAppMessage and log the outbound row
 *   9. Always return 200 to Meta so it doesn't retry (we swallow errors)
 *
 * Meta mandates that the endpoint answer within a few seconds, so we keep the
 * processing inline but guard every step with try/catch. If your Brain call
 * ever starts blocking, move steps 7-8 to a queued worker — keep this handler
 * fast.
 */

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { loadPlaybook } from '../lib/playbook-loader.js'
import { runBrain } from '../brain.js'
import { normalizeWhatsAppMessage } from '../lib/whatsapp-normalizer.js'
import { sendWhatsAppMessage } from '../connectors/whatsapp.js'
import { decryptToken } from '../../integrations/whatsapp/_helpers.js'

// Raw body is mandatory for HMAC verification.
export const config = { api: { bodyParser: false } }

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/* -------------------------------------------------------------------------- */
/*  Per-phone-number-id in-memory throttle (soft)                             */
/* -------------------------------------------------------------------------- */

const RATE_WINDOW_MS = 10_000
const RATE_MAX_PER_WINDOW = 30
const rateBuckets = new Map() // phone_number_id -> { windowStart, count }

function checkSoftRateLimit(phoneNumberId) {
  if (!phoneNumberId) return { allowed: true }
  const now = Date.now()
  const bucket = rateBuckets.get(phoneNumberId)
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    rateBuckets.set(phoneNumberId, { windowStart: now, count: 1 })
    return { allowed: true }
  }
  bucket.count += 1
  if (bucket.count > RATE_MAX_PER_WINDOW) {
    return { allowed: false, reason: `soft rate limit (${RATE_MAX_PER_WINDOW}/${RATE_WINDOW_MS}ms) for ${phoneNumberId}` }
  }
  return { allowed: true }
}

/* -------------------------------------------------------------------------- */
/*  Raw body reader                                                           */
/* -------------------------------------------------------------------------- */

async function readRawBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c)
  return Buffer.concat(chunks)
}

/* -------------------------------------------------------------------------- */
/*  HMAC signature verification                                               */
/* -------------------------------------------------------------------------- */

function verifyMetaSignature(rawBody, signatureHeader) {
  const secret = process.env.META_APP_SECRET
  if (!secret || !signatureHeader) return false
  // Header is "sha256=<hex>"
  const [, provided] = signatureHeader.split('=')
  if (!provided) return false

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    const a = Buffer.from(provided, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/* -------------------------------------------------------------------------- */
/*  Handler                                                                   */
/* -------------------------------------------------------------------------- */

export default async function handler(req, res) {
  // --- GET: Meta verification handshake ---
  if (req.method === 'GET') {
    const mode = req.query?.['hub.mode']
    const token = req.query?.['hub.verify_token']
    const challenge = req.query?.['hub.challenge']
    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN

    if (mode === 'subscribe' && expected && token === expected) {
      return res.status(200).send(challenge)
    }
    return res.status(403).send('Forbidden')
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // --- POST: inbound events ---
  let rawBody
  try {
    rawBody = await readRawBody(req)
  } catch (err) {
    console.error('[whatsapp-webhook] raw body read error:', err.message)
    return res.status(400).json({ error: 'Cannot read body' })
  }

  // Signature check — mandatory. If META_APP_SECRET isn't set we refuse.
  const signature = req.headers['x-hub-signature-256']
  if (!verifyMetaSignature(rawBody, signature)) {
    console.warn('[whatsapp-webhook] invalid or missing signature')
    return res.status(401).json({ error: 'Invalid signature' })
  }

  let payload
  try {
    payload = JSON.parse(rawBody.toString('utf8') || '{}')
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  // Meta POSTs an envelope: { object, entry: [{ changes: [{ value, field }] }] }
  // Ack fast on the envelope — process changes in a loop. Any processing
  // failure is swallowed so we always return 200 (Meta retries on non-200).
  try {
    const entries = Array.isArray(payload?.entry) ? payload.entry : []
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : []
      for (const change of changes) {
        if (change?.field && change.field !== 'messages') continue
        await processChange(change?.value || {}).catch(err => {
          console.error('[whatsapp-webhook] processChange error:', err?.message || err)
        })
      }
    }
  } catch (err) {
    console.error('[whatsapp-webhook] top-level error:', err?.message || err)
  }

  // Always 200 to Meta so the event isn't retried endlessly.
  return res.status(200).json({ received: true })
}

/* -------------------------------------------------------------------------- */
/*  Core: handle a single "change.value" object                               */
/* -------------------------------------------------------------------------- */

async function processChange(value) {
  const phoneNumberId = value?.metadata?.phone_number_id
  if (!phoneNumberId) return

  // Statuses (sent/delivered/read) — log and return. We don't re-Brain them.
  if (Array.isArray(value?.statuses) && value.statuses.length > 0 && !value?.messages) {
    for (const status of value.statuses) {
      try {
        await supabase.from('whatsapp_messages').update({
          status: status.status || 'unknown',
          updated_at: new Date().toISOString(),
        }).eq('wa_message_id', status.id)
      } catch { /* best effort */ }
    }
    return
  }

  const messages = Array.isArray(value?.messages) ? value.messages : []
  if (messages.length === 0) return

  // Lookup merchant by phone_number_id.
  const { data: account } = await supabase
    .from('whatsapp_accounts')
    .select('*')
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle()

  if (!account) {
    console.warn(`[whatsapp-webhook] no whatsapp_accounts row for phone_number_id=${phoneNumberId}`)
    return
  }
  const clientId = account.client_id

  // Respect client_settings kill-switch.
  const { data: settings } = await supabase
    .from('client_settings')
    .select('whatsapp_agent_enabled')
    .eq('client_id', clientId)
    .maybeSingle()

  if (settings && settings.whatsapp_agent_enabled === false) {
    console.log(`[whatsapp-webhook] agent disabled for client ${clientId}, skipping`)
    return
  }

  // Soft rate limit per merchant number.
  const rate = checkSoftRateLimit(phoneNumberId)
  if (!rate.allowed) {
    console.warn(`[whatsapp-webhook] ${rate.reason}`)
    return
  }

  const contacts = Array.isArray(value?.contacts) ? value.contacts : []
  const contact = contacts[0] || null

  // Decrypt access token once, reuse for every outbound call in this batch.
  const accessTokenDecrypted = decryptToken(account.access_token)
  const integration = {
    phone_number_id: account.phone_number_id,
    waba_id: account.waba_id,
    access_token_decrypted: accessTokenDecrypted,
  }

  for (const message of messages) {
    await handleInboundMessage({
      clientId,
      account,
      integration,
      value,
      message,
      contact,
    }).catch(err => {
      console.error('[whatsapp-webhook] handleInboundMessage error:', err?.message || err)
    })
  }
}

/* -------------------------------------------------------------------------- */
/*  Per-message: idempotence → insert → Brain → send reply                    */
/* -------------------------------------------------------------------------- */

async function handleInboundMessage({ clientId, account, integration, value, message, contact }) {
  const waMessageId = message?.id
  if (!waMessageId) return

  // Idempotence: Meta can retry the same event. Never process twice.
  const { data: existing } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .eq('wa_message_id', waMessageId)
    .maybeSingle()
  if (existing) {
    console.log(`[whatsapp-webhook] duplicate wa_message_id=${waMessageId}, skipping`)
    return
  }

  const normalized = normalizeWhatsAppMessage({ value, message, contact })

  // Store the inbound row.
  const { data: inboundRow } = await supabase
    .from('whatsapp_messages')
    .insert({
      client_id: clientId,
      whatsapp_account_id: account.id,
      phone_number_id: account.phone_number_id,
      wa_message_id: waMessageId,
      wa_message_type: message.type || 'text',
      direction: 'inbound',
      from_phone: message.from,
      to_phone: account.display_phone_number || null,
      contact_name: contact?.profile?.name || null,
      body: normalized.message,
      status: 'received',
      metadata: {
        wa_timestamp: message.timestamp,
        raw_type: message.type,
        display_phone_number: value?.metadata?.display_phone_number,
      },
    })
    .select()
    .single()

  // Load playbook (prefer 'whatsapp', fallback to generic ecommerce).
  let playbook = await loadPlaybook(supabase, clientId, 'whatsapp')
  if (!playbook) playbook = await loadPlaybook(supabase, clientId, 'sav_ecommerce')
  if (!playbook) {
    console.warn(`[whatsapp-webhook] no playbook found for client ${clientId}`)
    return
  }

  // Build a minimal synthetic event for the Brain.
  const event = {
    id: inboundRow?.id || null,
    source: 'whatsapp',
    event_type: 'whatsapp',
    client_id: clientId,
  }

  let brainResult
  try {
    brainResult = await runBrain(supabase, {
      event,
      playbook,
      clientId,
      normalized,
      conversationHistory: [],
    })
  } catch (err) {
    console.error('[whatsapp-webhook] Brain error:', err?.message || err)
    if (inboundRow?.id) {
      await supabase.from('whatsapp_messages').update({
        status: 'failed',
        error_message: err?.message || 'brain_error',
      }).eq('id', inboundRow.id)
    }
    return
  }

  const aiResponse = brainResult?.aiResponse
  const needsReview = brainResult?.needsReview === true

  // If low confidence / escalation → leave the message for the dashboard
  // review queue (engine_reviews_v2 is owned by the email flow; for WA we
  // simply mark the row as needs_review so the dashboard can pick it up).
  if (needsReview || !aiResponse) {
    if (inboundRow?.id) {
      await supabase.from('whatsapp_messages').update({
        status: needsReview ? 'needs_review' : 'no_response',
        classification: brainResult?.classification || null,
        confidence: brainResult?.confidence || null,
      }).eq('id', inboundRow.id)
    }
    return
  }

  // --- Send the AI response ---
  const sendResult = await sendWhatsAppMessage(integration, {
    to: message.from,
    body: aiResponse,
  })

  if (!sendResult.success) {
    console.error(`[whatsapp-webhook] send failed: ${sendResult.error}`)
    if (inboundRow?.id) {
      await supabase.from('whatsapp_messages').update({
        status: 'failed',
        error_message: sendResult.error,
      }).eq('id', inboundRow.id)
    }
    return
  }

  // Log the outbound row.
  await supabase.from('whatsapp_messages').insert({
    client_id: clientId,
    whatsapp_account_id: account.id,
    phone_number_id: account.phone_number_id,
    wa_message_id: sendResult.wa_message_id || null,
    wa_message_type: 'text',
    direction: 'outbound',
    from_phone: account.display_phone_number || null,
    to_phone: message.from,
    body: aiResponse,
    status: 'sent',
    in_reply_to_wa_id: waMessageId,
    metadata: {
      classification: brainResult?.classification || null,
      confidence: brainResult?.confidence || null,
      agent_used: brainResult?.agentUsed || null,
    },
  })

  // Mark inbound as handled.
  if (inboundRow?.id) {
    await supabase.from('whatsapp_messages').update({
      status: 'answered',
      classification: brainResult?.classification || null,
      confidence: brainResult?.confidence || null,
    }).eq('id', inboundRow.id)
  }

  // Log to automation_events so the dashboard counters stay consistent.
  try {
    await supabase.from('automation_events').insert({
      client_id: clientId,
      event_category: 'ticket_resolved',
      event_type: 'whatsapp',
      ticket_type: brainResult?.classification || 'general',
      time_saved_seconds: 180,
      description: `WhatsApp auto-reply: ${(aiResponse || '').substring(0, 120)}`,
      metadata: {
        wa_message_id: waMessageId,
        phone_number_id: account.phone_number_id,
        from: message.from,
        classification: brainResult?.classification || null,
        confidence: brainResult?.confidence || null,
      },
    })
  } catch { /* non-blocking */ }
}
