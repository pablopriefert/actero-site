/**
 * Actero — Slack helpers (shared across /api/slack/*).
 *
 * Handles:
 *   - Signature verification (HMAC-SHA256 with SLACK_SIGNING_SECRET)
 *   - Raw body reading (required for signature computation)
 *   - Tenant lookup by team_id
 *   - Bot token decryption
 *   - Posting a message back to a channel
 *   - Converting plain-text replies into Slack-friendly formatting
 *
 * Env required:
 *   SLACK_SIGNING_SECRET   — used to verify incoming events/commands
 *   SLACK_CLIENT_ID        — OAuth
 *   SLACK_CLIENT_SECRET    — OAuth
 */
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { decryptToken } from './crypto.js'

// Lazy init — avoid throwing at module-load if env is missing
let _supabaseAdmin = null
function getSupabase() {
  if (_supabaseAdmin) return _supabaseAdmin
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(`Supabase env missing: url=${!!url}, key=${!!key}`)
  }
  _supabaseAdmin = createClient(url, key)
  return _supabaseAdmin
}
export const supabaseAdmin = new Proxy({}, {
  get(_target, prop) {
    return getSupabase()[prop]
  },
})

/* -------------------------------------------------------------------------- */
/*  Raw body reader — required because Slack signs the raw bytes.             */
/* -------------------------------------------------------------------------- */

export async function readRawBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c)
  return Buffer.concat(chunks)
}

/* -------------------------------------------------------------------------- */
/*  Signature verification                                                    */
/* -------------------------------------------------------------------------- */

export function verifySlackSignature(rawBody, timestamp, signature) {
  const secret = process.env.SLACK_SIGNING_SECRET
  if (!secret || !signature || !timestamp) return false

  // Reject events older than 5 minutes (replay protection)
  const fiveMin = 60 * 5
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp, 10)) > fiveMin) return false

  const sigBase = `v0:${timestamp}:${rawBody.toString('utf8')}`
  const mySig = 'v0=' + crypto.createHmac('sha256', secret).update(sigBase).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(mySig), Buffer.from(signature))
  } catch {
    return false
  }
}

/* -------------------------------------------------------------------------- */
/*  Tenant lookup by Slack team_id                                            */
/* -------------------------------------------------------------------------- */

export async function findTenantByTeamId(teamId) {
  if (!teamId) return null
  const { data } = await supabaseAdmin
    .from('client_integrations')
    .select('client_id, access_token, extra_config')
    .eq('provider', 'slack')
    .eq('status', 'active')
    .filter('extra_config->>team_id', 'eq', teamId)
    .maybeSingle()
  return data || null
}

/**
 * Resolve the decrypted bot token + client_id + channel for a team.
 * Returns null if no active Slack integration found.
 */
export async function resolveTeam(teamId) {
  const integration = await findTenantByTeamId(teamId)
  if (!integration) return null

  // Fetch brand name for the system prompt
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('brand_name')
    .eq('id', integration.client_id)
    .maybeSingle()

  return {
    clientId: integration.client_id,
    brandName: client?.brand_name || 'votre boutique',
    botToken: decryptToken(integration.access_token),
    teamId,
    teamName: integration.extra_config?.team_name || null,
    defaultChannel: integration.extra_config?.channel || null,
    webhookUrl: integration.extra_config?.webhook_url || null,
    botUserId: integration.extra_config?.bot_user_id || null,
  }
}

/* -------------------------------------------------------------------------- */
/*  Slack Web API — post message                                              */
/* -------------------------------------------------------------------------- */

export async function postSlackMessage({
  token,
  channel,
  text,
  blocks,
  thread_ts,
  webhookUrl,
}) {
  // Prefer direct bot API if we have a token — richer formatting + thread support
  if (token && channel) {
    const resp = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ channel, text, blocks, thread_ts }),
    })
    const data = await resp.json().catch(() => ({}))
    if (!data.ok) {
      console.error('[slack] chat.postMessage failed:', data.error)
      return { ok: false, error: data.error }
    }
    return { ok: true, ts: data.ts, channel: data.channel }
  }

  // Fallback: webhook URL (no thread, simpler)
  if (webhookUrl) {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, blocks }),
    })
    return { ok: resp.ok }
  }

  return { ok: false, error: 'No token or webhook provided' }
}

/* -------------------------------------------------------------------------- */
/*  Message formatting — plain text -> Slack blocks                           */
/* -------------------------------------------------------------------------- */

/**
 * Strip the bot mention from an @mention message.
 * Slack sends "@U07ABC hello" or "<@U07ABC> hello"
 */
export function stripBotMention(text, botUserId) {
  if (!text) return ''
  let cleaned = String(text)
  if (botUserId) {
    const mentionRegex = new RegExp(`<@${botUserId}>`, 'g')
    cleaned = cleaned.replace(mentionRegex, '')
  }
  return cleaned.replace(/<@[A-Z0-9]+>/g, '').trim()
}

/**
 * Convert a plain text reply (potentially containing Markdown-ish *bold*,
 * "- bullets", line breaks) into Slack Block Kit blocks. Slack's mrkdwn
 * syntax uses single asterisks for bold, which works great because our
 * system prompt already tells Claude to use that.
 */
export function formatAsBlocks(text) {
  if (!text || typeof text !== 'string') {
    return [{
      type: 'section',
      text: { type: 'mrkdwn', text: 'Désolé, pas de réponse à afficher.' },
    }]
  }

  const trimmed = text.trim()
  // Keep it simple — one section block preserves newlines + *bold* formatting.
  // If we wanted heavier styling later, we'd split on headings and emit
  // multiple blocks + dividers. For V1, one block is clean and readable.
  return [{
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: trimmed.slice(0, 2900), // Slack text limit is 3000 chars per section
    },
  }, {
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: '🤖 _Réponse générée par Actero Copilot — <https://actero.fr/client|Ouvrir le dashboard>_',
    }],
  }]
}

/**
 * Ultra-compact single-line response (for slash command initial ack).
 */
export function shortAck(msg = 'Je cherche…') {
  return {
    response_type: 'ephemeral',
    text: msg,
  }
}
