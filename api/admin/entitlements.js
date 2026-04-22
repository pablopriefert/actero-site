/**
 * Admin — Manage client entitlements (manual overrides).
 *
 * GET  /api/admin/entitlements?client_id=xxx  → list entitlements for a client
 * POST /api/admin/entitlements                → grant a manual entitlement
 *   Body: { client_id, feature_key, expires_at? }
 * DELETE /api/admin/entitlements?client_id=xxx&feature_key=xxx  → revoke manual entitlement
 * POST /api/admin/entitlements?action=sync    → force resync from Stripe
 *   Body: { client_id }
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import {
  FEATURE_MAP,
  syncEntitlementsFromStripe,
  grantManualEntitlement,
  revokeManualEntitlement,
} from '../lib/entitlements.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

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

  // LIST entitlements for a client
  if (req.method === 'GET') {
    const clientId = req.query.client_id
    if (!clientId) return res.status(400).json({ error: 'client_id requis' })

    const [entRes, clientRes] = await Promise.all([
      supabase.from('client_entitlements').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('clients').select('id, brand_name, plan, stripe_customer_id, trial_ends_at').eq('id', clientId).maybeSingle(),
    ])

    return res.status(200).json({
      client: clientRes.data,
      entitlements: entRes.data || [],
      available_features: Object.keys(FEATURE_MAP),
    })
  }

  // FORCE SYNC from Stripe
  if (req.method === 'POST' && req.query.action === 'sync') {
    const { client_id } = req.body || {}
    if (!client_id) return res.status(400).json({ error: 'client_id requis' })
    if (!stripe) return res.status(500).json({ error: 'Stripe non configuré' })

    const { data: client } = await supabase
      .from('clients')
      .select('stripe_customer_id')
      .eq('id', client_id)
      .maybeSingle()

    if (!client?.stripe_customer_id) {
      return res.status(400).json({ error: 'Aucun stripe_customer_id pour ce client' })
    }

    const result = await syncEntitlementsFromStripe(supabase, stripe, client_id, client.stripe_customer_id)
    return res.status(200).json(result)
  }

  // GRANT manual entitlement
  if (req.method === 'POST') {
    const { client_id, feature_key, expires_at } = req.body || {}
    if (!client_id || !feature_key) return res.status(400).json({ error: 'client_id et feature_key requis' })
    if (!FEATURE_MAP[feature_key]) return res.status(400).json({ error: 'feature_key invalide' })

    const { data, error } = await grantManualEntitlement(supabase, client_id, feature_key, expires_at)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ ok: true, entitlement: data })
  }

  // REVOKE manual entitlement
  if (req.method === 'DELETE') {
    const { client_id, feature_key } = req.query
    if (!client_id || !feature_key) return res.status(400).json({ error: 'client_id et feature_key requis' })

    const { error } = await revokeManualEntitlement(supabase, client_id, feature_key)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withSentry(handler)
