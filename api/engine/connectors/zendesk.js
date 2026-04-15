/**
 * Actero Engine — Zendesk Connector
 * Sends AI responses back to Zendesk tickets via their API.
 */
import { decryptToken } from '../../lib/crypto.js'

/**
 * Reply to a Zendesk ticket.
 * @param {object} supabase - Supabase client
 * @param {object} params - { clientId, ticketId, response, customerEmail, brandName }
 */
export async function sendViaZendesk(supabase, { clientId, ticketId, response, customerEmail, brandName }) {
  if (!ticketId) return { success: false, error: 'No ticket ID for Zendesk reply' }

  // Load Zendesk credentials
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('access_token, extra_config')
    .eq('client_id', clientId)
    .eq('provider', 'zendesk')
    .eq('status', 'active')
    .maybeSingle()

  const accessToken = decryptToken(integration?.access_token)
  if (!accessToken) {
    return { success: false, error: 'Zendesk integration not active or missing token' }
  }

  const subdomain = integration.extra_config?.subdomain
  if (!subdomain) {
    return { success: false, error: 'Zendesk subdomain not configured' }
  }

  const zendeskUrl = `https://${subdomain}.zendesk.com/api/v2`

  try {
    // Add a public comment to the ticket
    const res = await fetch(`${zendeskUrl}/tickets/${ticketId}.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticket: {
          comment: {
            body: response,
            public: true,
            author_id: undefined, // Uses the authenticated user
          },
          tags: ['actero-auto-reply'],
          status: 'pending', // Keep ticket open for customer follow-up
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return { success: false, error: `Zendesk ${res.status}: ${err}` }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
