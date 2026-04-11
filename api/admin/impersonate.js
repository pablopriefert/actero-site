import crypto from 'crypto'
import { authenticateAdmin, logAdminAction, readJsonBody, supabaseAdmin } from './_helpers.js'

/**
 * POST /api/admin/impersonate
 *
 * Body: { client_id }
 *
 * Steps:
 *   1. Verify caller is admin
 *   2. Generate a random 64-char token
 *   3. Insert into admin_impersonation_tokens (1h expiry)
 *   4. Log admin action
 *   5. Return { success, token, expires_at, impersonate_url }
 *
 * Note: the actual read-only context switch in ClientDashboard is out of scope
 * for this endpoint — we only mint the token + return the URL.
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
  const { client_id } = body || {}

  if (!client_id || typeof client_id !== 'string') {
    return res.status(400).json({ error: 'client_id is required' })
  }

  // Confirm client exists
  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('id, brand_name')
    .eq('id', client_id)
    .maybeSingle()

  if (clientError || !client) {
    return res.status(404).json({ error: 'Client not found' })
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // +1h

  const { error: insertError } = await supabaseAdmin
    .from('admin_impersonation_tokens')
    .insert({
      admin_id: admin.id,
      client_id,
      token,
      expires_at: expiresAt,
    })

  if (insertError) {
    console.error('[admin/impersonate] insert error:', insertError)
    return res.status(500).json({ error: 'Failed to create impersonation token' })
  }

  await logAdminAction(
    admin.id,
    admin.email,
    'impersonate_start',
    'client',
    client_id,
    client_id,
    { brand_name: client.brand_name, expires_at: expiresAt }
  )

  return res.status(200).json({
    success: true,
    token,
    expires_at: expiresAt,
    impersonate_url: `/client/overview?impersonate=${token}`,
  })
}
