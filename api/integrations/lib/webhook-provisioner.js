/**
 * Actero Integrations — Webhook Auto-Provisioner
 *
 * Après OAuth Zendesk/Gorgias, on crée automatiquement le webhook côté
 * provider pour que les nouveaux tickets/messages arrivent chez nous
 * sans que le client touche aux réglages admin.
 *
 * Références :
 *   Zendesk : POST /api/v2/webhooks — event-subscription webhooks firent
 *     automatiquement sur les events abonnés (pas besoin de trigger).
 *     Event : `zen:event-type:ticket.comment_added`
 *     Source : https://developer.zendesk.com/api-reference/webhooks/webhooks-api/webhooks/
 *   Gorgias : POST /api/integrations — HTTP integration avec trigger
 *     `message_created` fire sur chaque nouveau message.
 *     Source : https://developers.gorgias.com/reference/create-integration
 *
 * Sécurité : chaque webhook a son propre `webhook_secret` (32-byte hex
 * random) stocké dans `client_integrations.extra_config.webhook_secret`.
 * Le receiver (webhooks/zendesk.js, webhooks/gorgias.js) compare le secret
 * reçu en query string contre celui en DB pour ce client-là. Pas de
 * secret global partagé entre tous les clients.
 */
import crypto from 'crypto'
import { decryptToken } from '../../lib/crypto.js'

const ACTERO_BASE_URL = process.env.PUBLIC_SITE_URL || 'https://actero.fr'

/**
 * Génère un secret webhook de 32 bytes hex (crypto-secure).
 */
function generateWebhookSecret() {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Provisionne un webhook Zendesk après OAuth.
 *
 * @param {object} supabase - Supabase client (service role)
 * @param {string} clientId - UUID du client Actero
 * @returns {{ success: boolean, webhookId?: string, error?: string }}
 */
export async function provisionZendeskWebhook(supabase, clientId) {
  // Charge l'intégration qu'on vient de créer dans le callback
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('access_token, extra_config')
    .eq('client_id', clientId)
    .eq('provider', 'zendesk')
    .eq('status', 'active')
    .maybeSingle()

  if (!integration) return { success: false, error: 'Zendesk integration not found' }

  const accessToken = decryptToken(integration.access_token)
  const subdomain = integration.extra_config?.subdomain
  if (!accessToken || !subdomain) {
    return { success: false, error: 'Missing access_token or subdomain' }
  }

  // Génère le secret per-client (si pas déjà présent)
  const webhookSecret = integration.extra_config?.webhook_secret || generateWebhookSecret()

  const endpoint = `${ACTERO_BASE_URL}/api/engine/webhooks/zendesk`
  + `?client_id=${encodeURIComponent(clientId)}`
  + `&secret=${encodeURIComponent(webhookSecret)}`

  try {
    const res = await fetch(`https://${subdomain}.zendesk.com/api/v2/webhooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhook: {
          name: 'Actero — Auto-reply SAV',
          description: 'Envoie les nouveaux commentaires clients à l\'agent IA Actero pour réponse automatique.',
          endpoint,
          http_method: 'POST',
          request_format: 'json',
          status: 'active',
          subscriptions: ['zen:event-type:ticket.comment_added'],
        },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[zendesk/provisioner] create webhook failed:', res.status, body)
      return { success: false, error: `Zendesk ${res.status}: ${body.slice(0, 200)}` }
    }

    const data = await res.json()
    const webhookId = data?.webhook?.id

    // Persiste le secret + l'ID du webhook (pour pouvoir le supprimer
    // si l'utilisateur déconnecte l'intégration plus tard)
    await supabase
      .from('client_integrations')
      .update({
        extra_config: {
          ...(integration.extra_config || {}),
          webhook_secret: webhookSecret,
          webhook_id: webhookId,
          webhook_provisioned_at: new Date().toISOString(),
        },
      })
      .eq('client_id', clientId)
      .eq('provider', 'zendesk')

    return { success: true, webhookId }
  } catch (err) {
    console.error('[zendesk/provisioner] exception:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Provisionne une HTTP integration Gorgias après OAuth.
 *
 * Gorgias utilise des "HTTP integrations" (pas "webhooks" au sens strict).
 * On crée une integration avec trigger `message_created` qui POST chez nous
 * dès qu'un nouveau message arrive sur un ticket.
 */
export async function provisionGorgiasIntegration(supabase, clientId) {
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('access_token, extra_config')
    .eq('client_id', clientId)
    .eq('provider', 'gorgias')
    .eq('status', 'active')
    .maybeSingle()

  if (!integration) return { success: false, error: 'Gorgias integration not found' }

  const accessToken = decryptToken(integration.access_token)
  const subdomain = integration.extra_config?.subdomain
  if (!accessToken || !subdomain) {
    return { success: false, error: 'Missing access_token or subdomain' }
  }

  const webhookSecret = integration.extra_config?.webhook_secret || generateWebhookSecret()

  const endpoint = `${ACTERO_BASE_URL}/api/engine/webhooks/gorgias`
  + `?client_id=${encodeURIComponent(clientId)}`
  + `&secret=${encodeURIComponent(webhookSecret)}`

  try {
    const res = await fetch(`https://${subdomain}.gorgias.com/api/integrations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Actero — Auto-reply SAV',
        type: 'http',
        http: {
          url: endpoint,
          method: 'POST',
          headers: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'X-Actero-Webhook-Secret', value: webhookSecret },
          ],
          // Trigger sur chaque nouveau message client entrant
          trigger_events: ['message_created'],
        },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[gorgias/provisioner] create integration failed:', res.status, body)
      return { success: false, error: `Gorgias ${res.status}: ${body.slice(0, 200)}` }
    }

    const data = await res.json()
    const integrationId = data?.id || data?.integration?.id

    await supabase
      .from('client_integrations')
      .update({
        extra_config: {
          ...(integration.extra_config || {}),
          webhook_secret: webhookSecret,
          gorgias_integration_id: integrationId,
          webhook_provisioned_at: new Date().toISOString(),
        },
      })
      .eq('client_id', clientId)
      .eq('provider', 'gorgias')

    return { success: true, integrationId }
  } catch (err) {
    console.error('[gorgias/provisioner] exception:', err)
    return { success: false, error: err.message }
  }
}
