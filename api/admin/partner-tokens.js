/**
 * Admin — Partner tokens management
 *
 * GET  /api/admin/partner-tokens       → list all tokens
 * POST /api/admin/partner-tokens       → create a new token
 * PATCH /api/admin/partner-tokens?id=xxx → toggle is_active
 * DELETE /api/admin/partner-tokens?id=xxx → delete token
 *
 * Admin only.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function requireAdmin(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) { res.status(401).json({ error: 'Non autorisé' }); return null }
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) { res.status(401).json({ error: 'Non autorisé' }); return null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') { res.status(403).json({ error: 'Accès réservé aux administrateurs' }); return null }
  return user
}

async function handler(req, res) {
  const user = await requireAdmin(req, res)
  if (!user) return

  // LIST
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('partner_access_tokens')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ tokens: data || [] })
  }

  // CREATE
  if (req.method === 'POST') {
    const { agency_name, contact_email, contact_name, expires_in_days, notes } = req.body || {}
    if (!agency_name) return res.status(400).json({ error: 'agency_name requis' })

    const token = 'ptr_' + crypto.randomBytes(16).toString('hex')
    const expires_at = expires_in_days
      ? new Date(Date.now() + expires_in_days * 86400000).toISOString()
      : null

    const { data, error } = await supabase
      .from('partner_access_tokens')
      .insert({
        token,
        agency_name,
        contact_email: contact_email || null,
        contact_name: contact_name || null,
        created_by: user.id,
        expires_at,
        notes: notes || null,
      })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ token: data, url: `https://actero.fr/partner?token=${token}` })
  }

  // UPDATE (toggle active)
  if (req.method === 'PATCH') {
    const id = req.query.id
    if (!id) return res.status(400).json({ error: 'id requis' })
    const { is_active } = req.body || {}
    const { data, error } = await supabase
      .from('partner_access_tokens')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ token: data })
  }

  // DELETE
  if (req.method === 'DELETE') {
    const id = req.query.id
    if (!id) return res.status(400).json({ error: 'id requis' })
    const { error } = await supabase.from('partner_access_tokens').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withSentry(handler)
