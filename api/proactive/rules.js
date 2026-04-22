/**
 * GET   /api/proactive/rules?client_id=UUID  — list rules with availability
 * PATCH /api/proactive/rules                  — toggle rule + update config
 *
 * Auth: Bearer JWT. Scoped to caller's client.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { DETECTORS } from '../lib/proactive-detector.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function requireClientAccess(req, res, clientId) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) { res.status(401).json({ error: 'Non autorisé' }); return null }
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) { res.status(401).json({ error: 'Non autorisé' }); return null }
  const isAdmin = user.app_metadata?.role === 'admin'
  if (isAdmin) return user
  const { data: link } = await supabase.from('client_users')
    .select('client_id').eq('user_id', user.id).eq('client_id', clientId).maybeSingle()
  if (link) return user
  const { data: owned } = await supabase.from('clients')
    .select('id').eq('id', clientId).eq('owner_user_id', user.id).maybeSingle()
  if (owned) return user
  res.status(403).json({ error: 'Accès refusé' })
  return null
}

async function handler(req, res) {
  if (req.method === 'GET') {
    const clientId = req.query?.client_id
    if (!clientId) return res.status(400).json({ error: 'client_id requis' })
    const user = await requireClientAccess(req, res, clientId)
    if (!user) return

    // Get saved rules + connected integrations in parallel
    const [rulesRes, integrationsRes] = await Promise.all([
      supabase.from('proactive_rules').select('*').eq('client_id', clientId),
      supabase.from('client_integrations').select('provider').eq('client_id', clientId).eq('status', 'active'),
    ])
    const connectedProviders = new Set((integrationsRes.data || []).map(i => i.provider))

    // Check Shopify via legacy client_shopify_connections too
    const { data: shopifyConn } = await supabase
      .from('client_shopify_connections')
      .select('id').eq('client_id', clientId).maybeSingle()
    if (shopifyConn) connectedProviders.add('shopify')

    // Build the list
    const rules = Object.entries(DETECTORS).map(([ruleName, meta]) => {
      const saved = (rulesRes.data || []).find(r => r.rule_name === ruleName)
      const requiredProviders = meta.requires || []
      const missingProviders = requiredProviders.filter(p => !connectedProviders.has(p))
      return {
        rule_name: ruleName,
        label: meta.label,
        description: meta.description,
        is_active: saved?.is_active || false,
        config: saved?.config || meta.defaultConfig,
        default_config: meta.defaultConfig,
        requires: meta.requires,
        missing_providers: missingProviders,
        ready: missingProviders.length === 0,
      }
    })

    return res.status(200).json({ rules })
  }

  if (req.method === 'PATCH') {
    const { client_id, rule_name, is_active, config } = req.body || {}
    if (!client_id || !rule_name) return res.status(400).json({ error: 'client_id + rule_name requis' })
    const user = await requireClientAccess(req, res, client_id)
    if (!user) return

    if (!DETECTORS[rule_name]) return res.status(400).json({ error: 'rule_name inconnu' })

    const patch = { updated_at: new Date().toISOString() }
    if (typeof is_active === 'boolean') patch.is_active = is_active
    if (config && typeof config === 'object') patch.config = config

    // Upsert
    const { data: existing } = await supabase.from('proactive_rules')
      .select('id').eq('client_id', client_id).eq('rule_name', rule_name).maybeSingle()

    if (existing) {
      const { error } = await supabase.from('proactive_rules').update(patch).eq('id', existing.id)
      if (error) return res.status(500).json({ error: error.message })
    } else {
      const { error } = await supabase.from('proactive_rules').insert({
        client_id, rule_name,
        is_active: patch.is_active ?? false,
        config: patch.config ?? DETECTORS[rule_name].defaultConfig,
      })
      if (error) return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withSentry(handler)
