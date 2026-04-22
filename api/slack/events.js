/**
 * POST /api/slack/events
 *
 * Slack Events API endpoint. Handles:
 *   - url_verification challenge (first-time setup)
 *   - app_mention events (@Actero ... in any channel)
 *   - message.im events (DM to the bot)
 *
 * Security:
 *   - Verifies x-slack-signature HMAC with SLACK_SIGNING_SECRET
 *   - Rejects events older than 5 min (replay protection)
 *
 * Tenant isolation:
 *   - Looks up team_id -> client_id via client_integrations
 *   - Zero cross-tenant data leakage
 *
 * Slack requires a response in <3s. We ack immediately, then process the
 * question in the background and post the reply via chat.postMessage.
 */
import { withSentry } from '../lib/sentry.js'
import {
  readRawBody,
  verifySlackSignature,
  resolveTeam,
  postSlackMessage,
  formatAsBlocks,
  stripBotMention,
  supabaseAdmin,
} from '../lib/slack.js'
import { askCopilot } from '../lib/kpi-tools.js'

// Raw body is mandatory for Slack signature verification.
export const config = { api: { bodyParser: false } }

// Slack requires ack <3s but our Claude processing can take 5-15s.
// We process synchronously and rely on idempotence for Slack retries.
export const maxDuration = 60

async function handler(req, res) {
  try {
    return await mainHandler(req, res)
  } catch (err) {
    console.error('[slack/events] TOP-LEVEL crash:', err?.stack || err?.message || err)
    return res.status(200).json({ ok: true, debug_err: err?.message || String(err) })
  }
}

async function mainHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 1) Read raw body + verify signature
  let rawBody
  try {
    rawBody = await readRawBody(req)
  } catch (err) {
    console.error('[slack/events] body read failed:', err.message)
    return res.status(400).json({ error: 'Cannot read body' })
  }

  // DEBUG: log every incoming POST (temp — remove once debugged)
  try {
    await supabaseAdmin.from('slack_debug_logs').insert({
      stage: 'received',
      payload: {
        body_len: rawBody.length,
        body_preview: rawBody.toString('utf8').slice(0, 500),
        has_signature: !!req.headers['x-slack-signature'],
        has_timestamp: !!req.headers['x-slack-request-timestamp'],
      },
    })
  } catch { /* noop */ }

  const timestamp = req.headers['x-slack-request-timestamp']
  const signature = req.headers['x-slack-signature']
  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    try {
      await supabaseAdmin.from('slack_debug_logs').insert({
        stage: 'signature_rejected',
        error: 'Invalid signature',
      })
    } catch { /* noop */ }
    return res.status(401).json({ error: 'Invalid signature' })
  }

  let payload
  try {
    payload = JSON.parse(rawBody.toString('utf8') || '{}')
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  // 2) URL verification challenge — Slack's initial handshake
  if (payload.type === 'url_verification') {
    return res.status(200).json({ challenge: payload.challenge })
  }

  // 3) Event callback — process synchronously.
  // Vercel kills fire-and-forget work once the function returns, so we await.
  // If processing takes >3s, Slack will retry — but slack_events_seen idempotence
  // catches duplicates, so it's safe.
  if (payload.type === 'event_callback') {
    try {
      await processEvent(payload)
    } catch (err) {
      console.error('[slack/events] processEvent error:', err?.message || err)
      try {
        await supabaseAdmin.from('slack_debug_logs').insert({
          stage: 'process_event_crash',
          error: err?.message || String(err),
        })
      } catch { /* noop */ }
    }
    return res.status(200).json({ ok: true })
  }

  // Unknown payload type
  return res.status(200).json({ ok: true })
}

/* -------------------------------------------------------------------------- */
/*  Event processor                                                           */
/* -------------------------------------------------------------------------- */

async function processEvent(payload) {
  const event = payload.event || {}
  const teamId = payload.team_id

  // DEBUG log
  try {
    await supabaseAdmin.from('slack_debug_logs').insert({
      stage: 'process_event_start',
      payload: { event_type: event.type, channel_type: event.channel_type, team_id: teamId, has_text: !!event.text },
    })
  } catch { /* noop */ }

  // Only handle app_mention and direct message events
  const isMention = event.type === 'app_mention'
  const isDM = event.type === 'message' && event.channel_type === 'im'
  if (!isMention && !isDM) {
    try {
      await supabaseAdmin.from('slack_debug_logs').insert({
        stage: 'event_type_skipped',
        payload: { event_type: event.type, channel_type: event.channel_type },
      })
    } catch { /* noop */ }
    return
  }

  // Ignore edit / delete / system events — they're not real user questions
  if (event.subtype === 'message_changed' || event.subtype === 'message_deleted') return
  if (event.subtype === 'assistant_app_thread') return // Slack Assistant thread bootstrap

  // Ignore messages from bots (including ourselves) to avoid loops
  if (event.bot_id || event.subtype === 'bot_message') return
  if (event.app_id && event.app_id === payload.api_app_id) return // our own message echo

  // Resolve tenant from team_id
  const team = await resolveTeam(teamId)
  if (!team) {
    console.warn(`[slack/events] no active Slack integration for team_id=${teamId}`)
    return
  }

  // Ignore messages sent BY our bot user (belt & suspenders vs loops)
  if (team.botUserId && event.user === team.botUserId) return

  // Extract the user's question — strip bot mention
  const rawText = event.text || ''
  const question = stripBotMention(rawText, team.botUserId)
  if (!question) {
    await postSlackMessage({
      token: team.botToken,
      channel: event.channel,
      thread_ts: event.thread_ts || event.ts,
      text: 'Bonjour ! Posez-moi une question sur vos KPIs (ex: "combien de tickets aujourd\'hui ?")',
    })
    return
  }

  // Idempotence — Slack may retry events. Track by event_id + team
  const eventId = payload.event_id
  if (eventId) {
    const { data: seen } = await supabaseAdmin
      .from('slack_events_seen')
      .select('event_id')
      .eq('event_id', eventId)
      .maybeSingle()
    if (seen) {
      console.log(`[slack/events] duplicate event ${eventId}, skipping`)
      return
    }
    try {
      await supabaseAdmin.from('slack_events_seen').insert({
        event_id: eventId,
        team_id: teamId,
        client_id: team.clientId,
      })
    } catch { /* ignore race */ }
  }

  // Ask Claude Copilot with KPI tools
  let reply
  try {
    const result = await askCopilot(supabaseAdmin, {
      clientId: team.clientId,
      message: question,
      brandName: team.brandName,
      channel: 'slack',
    })
    reply = result.reply
  } catch (err) {
    console.error('[slack/events] askCopilot error:', err.message)
    reply = `Désolé, erreur côté IA: ${err.message.slice(0, 120)}`
  }

  // Post the reply. Always respect the event's thread_ts — Slack's new
  // "Assistant Apps" UX creates a dedicated thread per question, even in DMs,
  // so we must reply IN that thread (not as a new root message).
  await postSlackMessage({
    token: team.botToken,
    channel: event.channel,
    thread_ts: event.thread_ts || (isMention ? event.ts : undefined),
    text: reply.slice(0, 300), // fallback for notifications
    blocks: formatAsBlocks(reply),
  })
}

export default withSentry(handler)
