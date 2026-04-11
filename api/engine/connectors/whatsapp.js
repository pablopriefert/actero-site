/**
 * Actero Engine — WhatsApp Cloud API Connector
 *
 * Sends messages out via Meta Graph API v21.0.
 *   POST https://graph.facebook.com/{v}/{phone_number_id}/messages
 *   Authorization: Bearer <access_token>
 *
 * Two flavors:
 *   - sendWhatsAppMessage: plain text (requires a 24h customer service window)
 *   - sendWhatsAppTemplate: approved template (needed outside the window)
 *
 * Meta error codes we flag explicitly:
 *   131026 — Message undeliverable (no recipient window / invalid phone)
 *   131047 — Re-engagement required (out of 24h window → template needed)
 *   131051 — Unsupported message type
 *   132000 — Template param mismatch
 */

import { createClient } from '@supabase/supabase-js'
import { META_GRAPH_VERSION, decryptToken } from '../../integrations/whatsapp/_helpers.js'

const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`

/**
 * Low-level: POST /{phone_number_id}/messages with a Bearer token.
 * Always returns { success, status, data, error, wa_message_id? }.
 */
async function postMessage({ phoneNumberId, accessToken, payload }) {
  if (!phoneNumberId || !accessToken) {
    return { success: false, error: 'Missing phone_number_id or access_token' }
  }

  const url = `${META_GRAPH_BASE}/${phoneNumberId}/messages`
  let resp, text, data = null
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    text = await resp.text()
    if (text) {
      try { data = JSON.parse(text) } catch { data = { raw: text } }
    }
  } catch (err) {
    return { success: false, error: `Meta fetch failed: ${err.message}` }
  }

  if (!resp.ok) {
    const code = data?.error?.code
    const metaMsg = data?.error?.message || `HTTP ${resp.status}`
    let hint = null
    if (code === 131047) hint = 'out_of_24h_window_template_required'
    else if (code === 131026) hint = 'recipient_unreachable'
    else if (code === 131051) hint = 'unsupported_message_type'
    return { success: false, status: resp.status, error: metaMsg, errorCode: code, hint, data }
  }

  const waMessageId = data?.messages?.[0]?.id || null
  return { success: true, status: resp.status, data, wa_message_id: waMessageId }
}

/**
 * sendWhatsAppMessage — send a plain text message.
 *
 * Accepts two signatures so it plugs cleanly into both the webhook flow and
 * the connector registry:
 *
 *   // direct (webhook):
 *   sendWhatsAppMessage(integration, { to, body, preview_url })
 *
 *   // via registry (supabase, { clientId, customerPhone, response, ... }):
 *   sendWhatsAppMessage(supabase, { clientId, customerPhone, response })
 */
export async function sendWhatsAppMessage(first, second = {}) {
  // --- Form A: direct integration object ---
  if (first && typeof first === 'object' && first.phone_number_id) {
    const integration = first
    const { to, body, preview_url = false } = second
    if (!to) return { success: false, error: 'Missing recipient (to)' }
    if (!body) return { success: false, error: 'Missing body' }

    const token = integration.access_token_decrypted || decryptToken(integration.access_token)
    return postMessage({
      phoneNumberId: integration.phone_number_id,
      accessToken: token,
      payload: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: String(to).replace(/^\+/, ''),
        type: 'text',
        text: { body: String(body).slice(0, 4096), preview_url: Boolean(preview_url) },
      },
    })
  }

  // --- Form B: (supabase, { clientId, ... }) registry adapter ---
  const supabase = first
  const {
    clientId,
    customerEmail,
    customerPhone,
    response,
    body: bodyParam,
  } = second || {}

  if (!supabase || !clientId) {
    return { success: false, error: 'sendWhatsAppMessage: missing supabase or clientId' }
  }

  const { data: account, error } = await supabase
    .from('whatsapp_accounts')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()

  if (error || !account) {
    return { success: false, error: 'No WhatsApp account connected for this client' }
  }

  // Resolve recipient phone:
  //   1. explicit customerPhone
  //   2. synthetic email in the form "<phone>@whatsapp.actero.fr" (see normalizer)
  let to = customerPhone || null
  if (!to && typeof customerEmail === 'string' && customerEmail.endsWith('@whatsapp.actero.fr')) {
    to = customerEmail.split('@')[0]
  }
  if (!to) {
    return { success: false, error: 'Missing recipient phone number' }
  }

  const token = decryptToken(account.access_token)
  return postMessage({
    phoneNumberId: account.phone_number_id,
    accessToken: token,
    payload: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: String(to).replace(/^\+/, ''),
      type: 'text',
      text: { body: String(response || bodyParam || '').slice(0, 4096), preview_url: false },
    },
  })
}

/**
 * sendWhatsAppTemplate — send an approved template (needed to re-open a
 * conversation outside the 24h customer service window).
 */
export async function sendWhatsAppTemplate(integration, { to, templateName, language = 'fr', components = [] }) {
  if (!templateName) return { success: false, error: 'templateName required' }
  if (!to) return { success: false, error: 'Missing recipient (to)' }

  const token = integration.access_token_decrypted || decryptToken(integration.access_token)
  return postMessage({
    phoneNumberId: integration.phone_number_id,
    accessToken: token,
    payload: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: String(to).replace(/^\+/, ''),
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components,
      },
    },
  })
}

/* --------------------------------------------------------------------------
 * Registry adapter (importable directly if connector-registry wants it):
 *   import { sendViaWhatsApp } from './whatsapp.js'
 * -------------------------------------------------------------------------- */
export async function sendViaWhatsApp(supabase, args) {
  return sendWhatsAppMessage(supabase, args)
}
