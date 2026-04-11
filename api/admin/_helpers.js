import { createClient } from '@supabase/supabase-js'

/**
 * Supabase admin client (service role). Used server-side only for admin endpoints.
 */
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Authenticate an admin request via a Bearer token.
 * Admin is detected via:
 *   1) auth.users.app_metadata.role === 'admin'
 *   2) admin_users table membership
 *   3) profiles.role === 'admin' (by user_id OR id)
 *
 * Writes 401/403 response on failure and returns null.
 *
 * @returns {Promise<{ user: object }|null>}
 */
export async function authenticateAdmin(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization header' })
    return null
  }

  const { data: { user } = {}, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    res.status(401).json({ error: 'Invalid token' })
    return null
  }

  // 1) app_metadata role (authoritative)
  if (user.app_metadata?.role === 'admin') return { user }

  // 2) admin_users table
  try {
    const { data: adminRow } = await supabaseAdmin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (adminRow) return { user }
  } catch {
    /* table might not exist in some environments */
  }

  // 3) profiles.role === 'admin' (try both user_id and id)
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .or(`user_id.eq.${user.id},id.eq.${user.id}`)
      .maybeSingle()
    if (profile?.role === 'admin') return { user }
  } catch {
    /* ignore */
  }

  res.status(403).json({ error: 'Forbidden: admin only' })
  return null
}

/**
 * Insert a row in admin_action_logs. Non-throwing (best effort).
 */
export async function logAdminAction(
  actorId,
  actorEmail,
  action,
  targetType,
  targetId,
  clientId,
  metadata = {}
) {
  try {
    await supabaseAdmin.from('admin_action_logs').insert({
      actor_id: actorId,
      actor_email: actorEmail,
      action,
      target_type: targetType,
      target_id: targetId,
      client_id: clientId,
      metadata,
    })
  } catch (err) {
    console.error('[admin/logAction] Error:', err.message)
  }
}

/**
 * Parse JSON body safely (works for Vercel/Express/Next API routes).
 */
export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return {}
}
