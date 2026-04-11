import { authenticateAdmin, logAdminAction, readJsonBody, supabaseAdmin } from './_helpers.js'

/**
 * /api/admin/alert-rules
 *
 * GET                            -> list all rules
 * POST   { name, description, trigger_type, condition, slack_channel, cooldown_min, enabled }
 * PATCH  { id, ...partial }
 * DELETE ?id=xxx
 *
 * condition is a JSON blob that depends on trigger_type:
 *  - event_threshold  { event_type, threshold, window_minutes }
 *  - client_metric    { metric, operator, value }
 *  - engine_error     { threshold_pct, window_hours }
 *  - webhook_failure  { threshold, window_minutes }
 */
export default async function handler(req, res) {
  const auth = await authenticateAdmin(req, res)
  if (!auth) return
  const { user: admin } = auth

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('admin_alert_rules')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return res.status(200).json({ rules: data || [] })
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req)
      const {
        name,
        description,
        trigger_type,
        condition,
        slack_channel,
        cooldown_min = 15,
        enabled = true,
      } = body || {}
      if (!name || !trigger_type || !condition || !slack_channel) {
        return res.status(400).json({
          error: 'name, trigger_type, condition and slack_channel are required',
        })
      }
      const payload = {
        name,
        description: description || null,
        trigger_type,
        condition,
        slack_channel,
        cooldown_min,
        enabled,
        created_by: admin.id,
      }
      const { data, error } = await supabaseAdmin
        .from('admin_alert_rules')
        .insert(payload)
        .select()
        .single()
      if (error) throw error

      await logAdminAction(
        admin.id,
        admin.email,
        'alert_rule_create',
        'admin_alert_rules',
        data.id,
        null,
        { name, trigger_type }
      )
      return res.status(200).json({ rule: data })
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody(req)
      const { id, ...rest } = body || {}
      if (!id) return res.status(400).json({ error: 'id is required' })

      const allowedFields = [
        'name',
        'description',
        'trigger_type',
        'condition',
        'slack_channel',
        'cooldown_min',
        'enabled',
      ]
      const update = {}
      for (const k of allowedFields) {
        if (k in rest) update[k] = rest[k]
      }
      update.updated_at = new Date().toISOString()

      const { data, error } = await supabaseAdmin
        .from('admin_alert_rules')
        .update(update)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      await logAdminAction(
        admin.id,
        admin.email,
        'alert_rule_update',
        'admin_alert_rules',
        id,
        null,
        { fields: Object.keys(update) }
      )
      return res.status(200).json({ rule: data })
    }

    if (req.method === 'DELETE') {
      const { id } = req.query || {}
      if (!id) return res.status(400).json({ error: 'id is required' })
      const { error } = await supabaseAdmin
        .from('admin_alert_rules')
        .delete()
        .eq('id', id)
      if (error) throw error

      await logAdminAction(
        admin.id,
        admin.email,
        'alert_rule_delete',
        'admin_alert_rules',
        id,
        null,
        {}
      )
      return res.status(200).json({ success: true })
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (err) {
    console.error('[admin/alert-rules] Error:', err.message)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
