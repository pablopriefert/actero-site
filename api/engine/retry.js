/**
 * Actero Engine — Retry Handler
 *
 * Re-processes failed messages. Call this via Vercel Cron or n8n schedule.
 * GET /api/engine/retry?secret=ENGINE_WEBHOOK_SECRET
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { processMessage } from './process.js'

const ENGINE_SECRET = process.env.ENGINE_WEBHOOK_SECRET
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET
const MAX_RETRIES = 3

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  // Auth
  const secret = req.query?.secret || req.headers['x-engine-secret'] || req.headers['x-internal-secret']
  if (secret !== ENGINE_SECRET && secret !== INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Non autorise' })
  }

  try {
    // Find failed messages that haven't exceeded max retries
    const { data: failedMessages, error } = await supabase
      .from('engine_messages')
      .select('*')
      .eq('status', 'failed')
      .lt('retry_count', MAX_RETRIES)
      .order('created_at', { ascending: true })
      .limit(10) // Process 10 at a time

    if (error) throw error
    if (!failedMessages || failedMessages.length === 0) {
      return res.status(200).json({ retried: 0, message: 'No failed messages to retry' })
    }

    const results = []

    for (const msg of failedMessages) {
      // Update retry count
      await supabase
        .from('engine_messages')
        .update({
          retry_count: (msg.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString(),
          status: 'received', // Reset to received for reprocessing
          error_message: null,
        })
        .eq('id', msg.id)

      try {
        const result = await processMessage(supabase, {
          messageId: msg.id,
          clientId: msg.client_id,
          source: msg.source,
          customerEmail: msg.customer_email,
          customerName: msg.customer_name,
          subject: msg.subject,
          messageBody: msg.message_body,
          externalTicketId: msg.external_ticket_id,
          orderId: msg.metadata?.order_id,
          metadata: msg.metadata || {},
        })

        results.push({ id: msg.id, status: 'success', escalated: result.escalated })
      } catch (err) {
        const newRetryCount = (msg.retry_count || 0) + 1

        // Mark as dead letter if max retries exceeded
        const newStatus = newRetryCount >= MAX_RETRIES ? 'dead_letter' : 'failed'

        await supabase
          .from('engine_messages')
          .update({ status: newStatus, error_message: err.message })
          .eq('id', msg.id)

        results.push({ id: msg.id, status: newStatus, error: err.message })

        // Alert admin if dead letter
        if (newStatus === 'dead_letter') {
          console.error(`[engine/retry] Dead letter: message ${msg.id} after ${MAX_RETRIES} retries: ${err.message}`)
        }
      }
    }

    return res.status(200).json({
      retried: results.length,
      results,
    })
  } catch (err) {
    console.error('[engine/retry] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}

export default withSentry(handler)
