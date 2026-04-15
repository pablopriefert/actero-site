/**
 * Actero Engine — Gorgias Connector
 * Sends AI responses back to Gorgias tickets via their API.
 */
import { decryptToken } from '../../lib/crypto.js'

/**
 * Reply to a Gorgias ticket.
 * @param {object} supabase - Supabase client
 * @param {object} params - { clientId, ticketId, response, customerEmail, brandName }
 */
export async function sendViaGorgias(supabase, { clientId, ticketId, response, customerEmail, brandName }) {
  if (!ticketId) return { success: false, error: 'No ticket ID for Gorgias reply' }

  // Load Gorgias credentials
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('access_token, extra_config')
    .eq('client_id', clientId)
    .eq('provider', 'gorgias')
    .eq('status', 'active')
    .maybeSingle()

  const accessToken = decryptToken(integration?.access_token)
  if (!accessToken) {
    return { success: false, error: 'Gorgias integration not active or missing token' }
  }

  const subdomain = integration.extra_config?.subdomain
  if (!subdomain) {
    return { success: false, error: 'Gorgias subdomain not configured' }
  }

  const gorgiasUrl = `https://${subdomain}.gorgias.com/api`

  try {
    // Create a message on the ticket
    const res = await fetch(`${gorgiasUrl}/tickets/${ticketId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: 'email',
        via: 'api',
        from_agent: true,
        sender: {
          email: `support@${subdomain}.gorgias.com`,
          name: brandName || 'Support',
        },
        receiver: {
          email: customerEmail,
        },
        body_html: `<p>${response.replace(/\n/g, '<br/>')}</p>`,
        body_text: response,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return { success: false, error: `Gorgias ${res.status}: ${err}` }
    }

    // Optionally close/tag the ticket
    await fetch(`${gorgiasUrl}/tickets/${ticketId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tags: [{ name: 'actero-auto-reply' }],
      }),
    }).catch(() => {}) // Non-critical

    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
