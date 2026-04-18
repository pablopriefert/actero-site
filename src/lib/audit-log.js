/**
 * Admin audit log — client-side helper.
 *
 * Inserts a row into `admin_audit_log` for every destructive / privileged admin action.
 * RLS enforces that only admins can insert, and only for themselves.
 *
 * Usage:
 *   import { logAdminAction } from '@/lib/audit-log'
 *   await logAdminAction({
 *     action: 'client.delete',
 *     target_type: 'client',
 *     target_id: client.id,
 *     details: { brand_name: client.brand_name, reason: 'GDPR request' },
 *   })
 *
 * The helper is intentionally non-throwing: audit log failures MUST NOT block
 * the user's action (they've already confirmed twice). But they do console.error
 * so Sentry picks it up and the drift gets surfaced.
 */
import { supabase } from './supabase'

/**
 * @param {Object} entry
 * @param {string} entry.action       - required, dot-namespaced (e.g. 'client.delete')
 * @param {string} [entry.target_type]
 * @param {string} [entry.target_id]
 * @param {Object} [entry.details]    - free-form JSON context
 */
export async function logAdminAction(entry) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.warn('[audit-log] no auth user; skipping', entry.action)
      return
    }

    const row = {
      admin_user_id: user.id,
      admin_email: user.email || null,
      action: entry.action,
      target_type: entry.target_type || null,
      target_id: entry.target_id ? String(entry.target_id) : null,
      details: entry.details || {},
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    }

    const { error } = await supabase.from('admin_audit_log').insert(row)
    if (error) {
      console.error('[audit-log] insert failed:', error, entry.action)
    }
  } catch (err) {
    // Never throw — a failed audit log must not break the user's action.
    console.error('[audit-log] unexpected error:', err)
  }
}
