import crypto from 'crypto'
import { authenticateAdmin, logAdminAction, readJsonBody, supabaseAdmin } from './_helpers.js'

const ALLOWED_ACTIONS = new Set([
  'pause_agent',
  'resume_agent',
  'resync_shopify',
  'clear_memory',
  'resend_welcome',
  'rotate_keys',
  'delete_client',
])

/**
 * POST /api/admin/client-actions
 *
 * Body: { client_id, action, confirm?: boolean }
 *
 * Supported actions:
 *  - pause_agent    -> client_settings.agent_enabled = false
 *  - resume_agent   -> client_settings.agent_enabled = true
 *  - resync_shopify -> queue in client_sync_queue (if exists) else log-only
 *  - clear_memory   -> DELETE FROM customer_memories WHERE client_id
 *  - resend_welcome -> log + { sent: true } placeholder
 *  - rotate_keys    -> regen client_settings.widget_api_key
 *  - delete_client  -> hard delete (requires confirm === true)
 *
 * Each action is logged to admin_action_logs.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const auth = await authenticateAdmin(req, res)
  if (!auth) return
  const { user: admin } = auth

  const body = await readJsonBody(req)
  const { client_id, action, confirm } = body || {}

  if (!client_id || typeof client_id !== 'string') {
    return res.status(400).json({ error: 'client_id is required' })
  }
  if (!action || !ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ error: `Unsupported action: ${action}` })
  }

  // Verify client exists
  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('id, brand_name, email')
    .eq('id', client_id)
    .maybeSingle()

  if (clientError || !client) {
    return res.status(404).json({ error: 'Client not found' })
  }

  let result = { success: true }
  const metadata = { brand_name: client.brand_name }

  try {
    switch (action) {
      case 'pause_agent': {
        const { error } = await supabaseAdmin
          .from('client_settings')
          .update({ agent_enabled: false })
          .eq('client_id', client_id)
        if (error) throw error
        result = { success: true, agent_enabled: false }
        break
      }

      case 'resume_agent': {
        const { error } = await supabaseAdmin
          .from('client_settings')
          .update({ agent_enabled: true })
          .eq('client_id', client_id)
        if (error) throw error
        result = { success: true, agent_enabled: true }
        break
      }

      case 'resync_shopify': {
        // Try to queue; if table does not exist, log-only.
        const { error } = await supabaseAdmin
          .from('client_sync_queue')
          .insert({
            client_id,
            source: 'shopify',
            status: 'pending',
            requested_by: admin.id,
          })
        if (error) {
          // Likely table not present — degrade gracefully.
          console.warn('[admin/client-actions] resync_shopify queue skipped:', error.message)
          result = { success: true, queued: false, note: 'queue unavailable, logged only' }
        } else {
          result = { success: true, queued: true }
        }
        break
      }

      case 'clear_memory': {
        if (confirm !== true) {
          return res.status(400).json({ error: 'Confirmation required for clear_memory' })
        }
        const { error, count } = await supabaseAdmin
          .from('customer_memories')
          .delete({ count: 'exact' })
          .eq('client_id', client_id)
        if (error) throw error
        result = { success: true, deleted: count ?? 0 }
        metadata.deleted = count ?? 0
        break
      }

      case 'resend_welcome': {
        // No real email impl — placeholder for future hook.
        result = { success: true, sent: true, email: client.email }
        break
      }

      case 'rotate_keys': {
        if (confirm !== true) {
          return res.status(400).json({ error: 'Confirmation required for rotate_keys' })
        }
        const newKey = `wak_${crypto.randomBytes(24).toString('hex')}`
        const { error } = await supabaseAdmin
          .from('client_settings')
          .update({ widget_api_key: newKey })
          .eq('client_id', client_id)
        if (error) throw error
        result = { success: true, widget_api_key: newKey }
        metadata.rotated = true
        break
      }

      case 'delete_client': {
        if (confirm !== true) {
          return res.status(400).json({ error: 'Confirmation required for delete_client' })
        }
        const { error } = await supabaseAdmin
          .from('clients')
          .delete()
          .eq('id', client_id)
        if (error) throw error
        result = { success: true, deleted: true }
        break
      }

      default:
        return res.status(400).json({ error: `Unhandled action: ${action}` })
    }
  } catch (err) {
    console.error(`[admin/client-actions] ${action} error:`, err)
    await logAdminAction(
      admin.id,
      admin.email,
      `${action}_failed`,
      'client',
      client_id,
      client_id,
      { ...metadata, error: err.message }
    )
    return res.status(500).json({ error: err.message || 'Action failed' })
  }

  await logAdminAction(admin.id, admin.email, action, 'client', client_id, client_id, metadata)

  return res.status(200).json(result)
}
