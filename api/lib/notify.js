/**
 * Unified notification dispatcher — respects client preferences.
 *
 * Use this from any API endpoint or cron to send a notification
 * across all the channels the client has enabled for that event type.
 *
 * Usage:
 *   import { notifyClient } from './lib/notify.js'
 *   await notifyClient(supabase, {
 *     clientId,
 *     eventKey: 'escalation_alert',      // must match NOTIFICATION_TYPES in NotificationCenterView
 *     title: 'Ticket escaladé',
 *     message: 'Un ticket urgent nécessite votre intervention',
 *     context: { customerEmail, subject, url },
 *   })
 */

import { sendViaSlack } from '../engine/connectors/slack.js'

/**
 * Send a client-facing notification through all enabled channels.
 * Fails silently: individual channel failures are logged, never throw.
 */
export async function notifyClient(supabase, { clientId, eventKey, title, message, context = {} }) {
  if (!clientId || !eventKey) return { sent: [], skipped: [] }

  // Load client preferences — structure: notification_channels = {event_key: {email: true, slack: false, ...}}
  const { data: prefs } = await supabase
    .from('client_notification_preferences')
    .select('notification_channels, quiet_hours_enabled, quiet_hours_start, quiet_hours_end')
    .eq('client_id', clientId)
    .maybeSingle()

  // Check quiet hours (skip non-critical notifications during that window)
  const isCritical = ['escalation_alert', 'urgent_ticket_alert', 'security_alert'].includes(eventKey)
  if (!isCritical && prefs?.quiet_hours_enabled) {
    const hour = new Date().getHours()
    const start = prefs.quiet_hours_start ?? 22
    const end = prefs.quiet_hours_end ?? 7
    const inQuiet = start < end ? (hour >= start && hour < end) : (hour >= start || hour < end)
    if (inQuiet) return { sent: [], skipped: [{ reason: 'quiet_hours' }] }
  }

  // Extract channels for this event
  const eventPrefs = prefs?.notification_channels?.[eventKey] || {}
  const channels = Object.entries(eventPrefs).filter(([, v]) => v).map(([k]) => k)

  const results = { sent: [], skipped: [] }

  // SLACK
  if (channels.includes('slack')) {
    try {
      const r = await sendSimpleSlackMessage(supabase, clientId, { title, message, context })
      if (r.success) results.sent.push('slack')
      else results.skipped.push({ channel: 'slack', reason: r.error })
    } catch (err) {
      results.skipped.push({ channel: 'slack', reason: err.message })
    }
  }

  // EMAIL
  if (channels.includes('email')) {
    try {
      const r = await sendSimpleEmail(supabase, clientId, { title, message, context })
      if (r.success) results.sent.push('email')
      else results.skipped.push({ channel: 'email', reason: r.error })
    } catch (err) {
      results.skipped.push({ channel: 'email', reason: err.message })
    }
  }

  // PUSH — not implemented yet
  if (channels.includes('push')) {
    results.skipped.push({ channel: 'push', reason: 'not_implemented' })
  }

  // VOCAL — not implemented yet
  if (channels.includes('vocal')) {
    results.skipped.push({ channel: 'vocal', reason: 'not_implemented' })
  }

  return results
}

/**
 * Simple Slack message (generic, for notifications that aren't escalations).
 */
async function sendSimpleSlackMessage(supabase, clientId, { title, message, context }) {
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('access_token, extra_config')
    .eq('client_id', clientId)
    .eq('provider', 'slack')
    .eq('status', 'active')
    .maybeSingle()

  if (!integration) return { success: false, error: 'Slack non connecté' }

  const webhookUrl = integration.extra_config?.webhook_url
  const accessToken = integration.access_token
  const channelId = integration.extra_config?.channel_id

  // Build blocks
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${title}*\n${message}`,
      },
    },
  ]
  if (context?.url) {
    blocks.push({
      type: 'actions',
      elements: [{
        type: 'button',
        text: { type: 'plain_text', text: 'Ouvrir dans Actero', emoji: true },
        url: context.url,
      }],
    })
  }

  if (webhookUrl) {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    })
    if (!res.ok) return { success: false, error: `webhook ${res.status}` }
    return { success: true }
  }

  if (accessToken && channelId) {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: channelId, blocks, text: title }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) return { success: false, error: data.error || `api ${res.status}` }
    return { success: true }
  }

  return { success: false, error: 'Aucun webhook ou token' }
}

/**
 * Simple client email via Resend.
 */
async function sendSimpleEmail(supabase, clientId, { title, message, context }) {
  if (!process.env.RESEND_API_KEY) return { success: false, error: 'RESEND non configuré' }

  const { data: client } = await supabase
    .from('clients')
    .select('contact_email, brand_name')
    .eq('id', clientId)
    .maybeSingle()

  if (!client?.contact_email) return { success: false, error: 'Pas d\'email client' }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'Actero <notifications@actero.fr>',
      to: client.contact_email,
      subject: `Actero — ${title}`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="font-size:18px;margin:0 0 12px">${title}</h2>
          <p style="color:#4a4a4a;line-height:1.6">${message}</p>
          ${context?.url ? `<a href="${context.url}" style="display:inline-block;margin-top:16px;padding:10px 18px;background:#0F5F35;color:white;text-decoration:none;border-radius:8px;font-weight:600">Ouvrir dans Actero</a>` : ''}
        </div>
      `,
      replyTo: 'contact@actero.fr',
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
