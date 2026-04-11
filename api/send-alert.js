// Send alerts via webhook (Slack/Telegram)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Internal-only endpoint: require internal secret. Fail closed if not configured.
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (!internalSecret) {
    console.error('[send-alert] INTERNAL_API_SECRET not set — refusing request');
    return res.status(500).json({ error: 'Server not configured' });
  }
  if (req.headers['x-internal-secret'] !== internalSecret) {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }

  const { type, clientName, details } = req.body || {};

  if (!type || !clientName) {
    return res.status(400).json({ error: 'Missing required fields: type, clientName' });
  }

  // Only use the server-configured webhook URL — never accept user-supplied URLs (SSRF risk)
  const targetUrl = process.env.SLACK_WEBHOOK_URL;

  if (!targetUrl) {
    return res.status(500).json({ error: 'No webhook URL provided and SLACK_WEBHOOK_URL not configured' });
  }

  try {
    const message = formatSlackMessage(type, clientName, details);

    const webhookRes = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!webhookRes.ok) {
      const err = await webhookRes.text();
      throw new Error(`Webhook failed: ${webhookRes.status} — ${err}`);
    }

    return res.status(200).json({ success: true, type, clientName });
  } catch (error) {
    console.error('send-alert error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Format a Slack Block Kit message based on alert type.
 */
function formatSlackMessage(type, clientName, details) {
  const alertConfig = {
    health_low: {
      emoji: ':warning:',
      title: 'Score de santé bas',
      color: '#f59e0b',
    },
    workflow_failed: {
      emoji: ':x:',
      title: 'Workflow en erreur',
      color: '#ef4444',
    },
    no_events: {
      emoji: ':zzz:',
      title: 'Aucune activité détectée',
      color: '#6b7280',
    },
  };

  const config = alertConfig[type] || {
    emoji: ':bell:',
    title: 'Alerte',
    color: '#3b82f6',
  };

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${config.emoji} ${config.title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Client:*\n${clientName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Type:*\n${type}`,
          },
        ],
      },
      ...(details ? [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Détails:*\n${details}`,
        },
      }] : []),
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Actero Alert | ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };
}
