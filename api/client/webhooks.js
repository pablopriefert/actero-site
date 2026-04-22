/**
 * Client Webhooks CRUD (Pro+ only)
 *
 * GET    /api/client/webhooks              → list all webhooks for the client
 * POST   /api/client/webhooks              → create a new webhook
 * PATCH  /api/client/webhooks?id=xxx       → update (toggle is_active, events, url, label)
 * DELETE /api/client/webhooks?id=xxx       → delete webhook
 * GET    /api/client/webhooks?id=xxx&deliveries=1 → list last 50 deliveries
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { canAccessFeature } from '../lib/plan-limits.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function requireClient(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) { res.status(401).json({ error: 'Non autorisé' }); return null }
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) { res.status(401).json({ error: 'Non autorisé' }); return null }

  const { data: link } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!link?.client_id) { res.status(403).json({ error: 'Aucun client associé' }); return null }

  // Plan gate: webhooks are Pro+
  const { data: client } = await supabase.from('clients').select('plan, trial_ends_at').eq('id', link.client_id).maybeSingle()
  const plan = client?.plan || 'free'
  const inTrial = client?.trial_ends_at && new Date(client.trial_ends_at) > new Date()
  if (!inTrial && !canAccessFeature(plan, 'api_webhooks')) {
    res.status(402).json({ error: 'Les webhooks sortants sont réservés au plan Pro et plus.', upgrade_required: true })
    return null
  }

  return { user, clientId: link.client_id, plan }
}

async function handler(req, res) {
  const auth = await requireClient(req, res)
  if (!auth) return
  const { user, clientId } = auth

  // LIST deliveries for a specific webhook
  if (req.method === 'GET' && req.query.deliveries === '1' && req.query.id) {
    const { data, error } = await supabase
      .from('client_webhook_deliveries')
      .select('*')
      .eq('webhook_id', req.query.id)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ deliveries: data || [] })
  }

  // LIST webhooks
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('client_webhooks')
      .select('id, label, url, events, is_active, last_delivery_at, last_delivery_status, failure_count, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ webhooks: data || [] })
  }

  // CREATE
  if (req.method === 'POST') {
    const { label, url, events } = req.body || {}
    if (!label || !url || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'label, url et events requis' })
    }
    try { new URL(url) } catch { return res.status(400).json({ error: 'URL invalide' }) }

    const secret = 'whsec_' + crypto.randomBytes(24).toString('hex')
    const { data, error } = await supabase
      .from('client_webhooks')
      .insert({
        client_id: clientId,
        label: label.trim().slice(0, 100),
        url: url.trim(),
        events,
        secret,
        created_by: user.id,
      })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ webhook: data })
  }

  // UPDATE
  if (req.method === 'PATCH') {
    const id = req.query.id
    if (!id) return res.status(400).json({ error: 'id requis' })
    const { label, url, events, is_active } = req.body || {}
    const update = { updated_at: new Date().toISOString() }
    if (label !== undefined) update.label = label.trim().slice(0, 100)
    if (url !== undefined) {
      try { new URL(url) } catch { return res.status(400).json({ error: 'URL invalide' }) }
      update.url = url.trim()
    }
    if (Array.isArray(events)) update.events = events
    if (typeof is_active === 'boolean') {
      update.is_active = is_active
      if (is_active) update.failure_count = 0 // reset on re-enable
    }

    const { data, error } = await supabase
      .from('client_webhooks')
      .update(update)
      .eq('id', id)
      .eq('client_id', clientId)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ webhook: data })
  }

  // DELETE
  if (req.method === 'DELETE') {
    const id = req.query.id
    if (!id) return res.status(400).json({ error: 'id requis' })
    const { error } = await supabase
      .from('client_webhooks')
      .delete()
      .eq('id', id)
      .eq('client_id', clientId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withSentry(handler)
