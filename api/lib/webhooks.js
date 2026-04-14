/**
 * Outbound webhook dispatcher.
 *
 * Send an event to all of a client's active webhooks that subscribe to it.
 * Each delivery is signed with HMAC-SHA256 using the webhook's secret.
 *
 * Usage:
 *   import { dispatchWebhook } from './lib/webhooks.js'
 *   await dispatchWebhook(supabase, {
 *     clientId,
 *     eventType: 'ticket.resolved',
 *     data: { ticket_id, customer_email, classification, ... },
 *   })
 */
import crypto from 'crypto'

export const WEBHOOK_EVENTS = [
  { id: 'ticket.resolved', label: 'Ticket résolu', description: 'L\'IA a répondu à un ticket' },
  { id: 'ticket.escalated', label: 'Ticket escaladé', description: 'Un ticket nécessite intervention humaine' },
  { id: 'conversation.created', label: 'Nouvelle conversation', description: 'Un client a initié un échange' },
  { id: 'conversation.sentiment_negative', label: 'Sentiment négatif', description: 'Le sentiment d\'une conversation est critique' },
  { id: 'usage.threshold_reached', label: 'Seuil de consommation', description: '80%/100% du quota mensuel atteint' },
  { id: 'integration.connected', label: 'Intégration connectée', description: 'Une nouvelle intégration est active' },
  { id: 'integration.disconnected', label: 'Intégration déconnectée', description: 'Une intégration a été déconnectée ou est en erreur' },
  { id: 'playbook.activated', label: 'Playbook activé', description: 'Un workflow IA a été activé' },
  { id: 'ticket.response_failed', label: 'Échec de réponse', description: 'L\'IA n\'a pas pu générer de réponse' },
]

function sign(secret, timestamp, body) {
  const payload = `${timestamp}.${body}`
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Dispatch an event to all subscribed webhooks for a client.
 * Logs each delivery attempt; fails silently (never throws).
 */
export async function dispatchWebhook(supabase, { clientId, eventType, data }) {
  try {
    const { data: hooks } = await supabase
      .from('client_webhooks')
      .select('id, url, secret, events')
      .eq('client_id', clientId)
      .eq('is_active', true)

    if (!hooks?.length) return { dispatched: 0 }

    const eligible = hooks.filter((h) => {
      const evs = Array.isArray(h.events) ? h.events : []
      return evs.includes(eventType) || evs.includes('*')
    })

    if (!eligible.length) return { dispatched: 0 }

    const timestamp = Math.floor(Date.now() / 1000).toString()
    const body = JSON.stringify({
      event: eventType,
      timestamp: new Date().toISOString(),
      client_id: clientId,
      data: data || {},
    })

    // Fire all deliveries in parallel
    const results = await Promise.all(eligible.map(async (hook) => {
      const startedAt = Date.now()
      let status = null
      let responseBody = null
      let succeeded = false

      try {
        const signature = sign(hook.secret, timestamp, body)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

        const res = await fetch(hook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Actero-Webhooks/1.0',
            'X-Actero-Event': eventType,
            'X-Actero-Timestamp': timestamp,
            'X-Actero-Signature': `v1=${signature}`,
          },
          body,
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        status = res.status
        succeeded = res.ok
        responseBody = (await res.text().catch(() => '')).slice(0, 500)
      } catch (err) {
        responseBody = `ERROR: ${err.message}`.slice(0, 500)
      }

      const duration = Date.now() - startedAt

      // Log delivery (fire and forget)
      supabase.from('client_webhook_deliveries').insert({
        webhook_id: hook.id,
        client_id: clientId,
        event_type: eventType,
        payload: JSON.parse(body),
        response_status: status,
        response_body: responseBody,
        duration_ms: duration,
        succeeded,
      }).then(() => {})

      // Update webhook stats
      const update = {
        last_delivery_at: new Date().toISOString(),
        last_delivery_status: status,
      }
      if (!succeeded) {
        update.failure_count = (hook.failure_count || 0) + 1
        // Auto-disable after 20 consecutive failures
        if (update.failure_count >= 20) update.is_active = false
      } else {
        update.failure_count = 0
      }
      supabase.from('client_webhooks').update(update).eq('id', hook.id).then(() => {})

      return { hook_id: hook.id, succeeded, status }
    }))

    return {
      dispatched: results.length,
      successes: results.filter((r) => r.succeeded).length,
    }
  } catch (err) {
    console.error('[webhooks] dispatch error:', err.message)
    return { dispatched: 0, error: err.message }
  }
}
