/**
 * Actero Engine — Slack Connector
 * Posts notifications and escalation alerts to Slack channels.
 */
import { decryptToken } from '../../lib/crypto.js'

/**
 * Send a notification to Slack.
 * @param {object} supabase - Supabase client
 * @param {object} params - { clientId, response, customerEmail, customerName, subject, brandName, isEscalation, escalationReason }
 */
export async function sendViaSlack(supabase, { clientId, response, customerEmail, customerName, subject, brandName, isEscalation, escalationReason }) {
  // Load Slack credentials
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('access_token, extra_config')
    .eq('client_id', clientId)
    .eq('provider', 'slack')
    .eq('status', 'active')
    .maybeSingle()

  if (!integration) {
    return { success: false, error: 'Slack integration not active' }
  }

  const webhookUrl = integration.extra_config?.webhook_url
  const accessToken = decryptToken(integration.access_token)
  const channelId = integration.extra_config?.channel_id

  try {
    if (webhookUrl) {
      // Use incoming webhook
      const blocks = isEscalation
        ? buildEscalationBlocks({ customerEmail, customerName, escalationReason, subject })
        : buildAutoReplyBlocks({ customerEmail, customerName, response, subject })

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks }),
      })

      if (!res.ok) {
        const err = await res.text()
        return { success: false, error: `Slack webhook ${res.status}: ${err}` }
      }

      return { success: true }

    } else if (accessToken && channelId) {
      // Use Slack API
      const text = isEscalation
        ? `:warning: *Escalade* — ${customerName || customerEmail}: ${escalationReason}`
        : `:white_check_mark: Reponse auto a ${customerName || customerEmail}: ${response.substring(0, 200)}`

      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: channelId,
          text,
          unfurl_links: false,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        return { success: false, error: `Slack API ${res.status}: ${err}` }
      }

      return { success: true }
    }

    return { success: false, error: 'No Slack webhook or token configured' }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

function buildEscalationBlocks({ customerEmail, customerName, escalationReason, subject }) {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: ':warning: Ticket escalade', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Client:*\n${customerName || customerEmail}` },
        { type: 'mrkdwn', text: `*Raison:*\n${escalationReason}` },
        { type: 'mrkdwn', text: `*Sujet:*\n${subject || 'N/A'}` },
        { type: 'mrkdwn', text: `*Email:*\n${customerEmail}` },
      ],
    },
    {
      type: 'actions',
      elements: [{
        type: 'button',
        text: { type: 'plain_text', text: 'Voir dans Actero', emoji: true },
        url: 'https://actero.fr/client/escalations',
        style: 'danger',
      }],
    },
  ]
}

function buildAutoReplyBlocks({ customerEmail, customerName, response, subject }) {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:white_check_mark: *Reponse automatique envoyee*\n*A:* ${customerName || customerEmail}${subject ? `\n*Sujet:* ${subject}` : ''}\n\n> ${response.substring(0, 300)}${response.length > 300 ? '...' : ''}`,
      },
    },
  ]
}
