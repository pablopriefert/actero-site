/**
 * Admin — One-time setup of Stripe Features (Entitlements).
 *
 * POST /api/admin/setup-stripe-features
 *   → Creates all Actero features in Stripe with the right lookup_keys.
 *     Safe to run multiple times (idempotent — skips existing).
 *
 * POST /api/admin/setup-stripe-features?attach=1
 *   Body: { product_id, feature_keys: [...] }
 *   → Attaches features to a product.
 *
 * GET /api/admin/setup-stripe-features
 *   → Lists all Stripe features with their lookup_keys.
 *
 * Requires admin role.
 */
import { withSentry } from '../lib/sentry.js'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { FEATURE_MAP } from '../lib/entitlements.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

const FEATURE_DEFINITIONS = [
  { key: 'brand_editor', name: 'Éditeur de ton de marque' },
  { key: 'guardrails', name: 'Garde-fous & règles métier' },
  { key: 'simulator', name: 'Simulateur de conversation' },
  { key: 'voice_agent', name: 'Agent vocal IA' },
  { key: 'specialized_agents', name: 'Agents IA spécialisés' },
  { key: 'api_webhooks', name: 'API + Webhooks sortants' },
  { key: 'pdf_report', name: 'Rapport PDF mensuel' },
  { key: 'multi_shop', name: 'Multi-boutiques' },
  { key: 'white_label', name: 'White-label' },
  { key: 'roi_dashboard_full', name: 'Dashboard ROI complet' },
  { key: 'voice_minutes_200', name: '200 minutes d\'appel vocal incluses' },
  { key: 'workflows_unlimited', name: 'Workflows illimités' },
  { key: 'integrations_unlimited', name: 'Intégrations illimitées' },
]

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
  if (!stripe) return res.status(500).json({ error: 'Stripe non configuré' })

  try {
    // LIST existing features
    if (req.method === 'GET') {
      const existing = await stripe.entitlements.features.list({ limit: 100 })
      return res.status(200).json({ features: existing.data })
    }

    // ATTACH features to a product
    if (req.method === 'POST' && req.query.attach === '1') {
      const { product_id, feature_keys } = req.body || {}
      if (!product_id || !Array.isArray(feature_keys)) {
        return res.status(400).json({ error: 'product_id et feature_keys requis' })
      }

      // Get all features to find their IDs by lookup_key
      const all = await stripe.entitlements.features.list({ limit: 100 })
      const byLookup = Object.fromEntries(all.data.map((f) => [f.lookup_key, f]))

      const results = []
      for (const key of feature_keys) {
        const lookupKey = FEATURE_MAP[key]
        const feature = lookupKey ? byLookup[lookupKey] : null
        if (!feature) {
          results.push({ key, error: 'Feature not found in Stripe' })
          continue
        }
        try {
          const attached = await stripe.products.createFeature(product_id, { entitlement_feature: feature.id })
          results.push({ key, attached_id: attached.id })
        } catch (err) {
          results.push({ key, error: err.message })
        }
      }
      return res.status(200).json({ results })
    }

    // CREATE all Actero features (idempotent)
    if (req.method === 'POST') {
      const existing = await stripe.entitlements.features.list({ limit: 100 })
      const existingKeys = new Set(existing.data.map((f) => f.lookup_key))

      const created = []
      const skipped = []
      const errors = []

      for (const def of FEATURE_DEFINITIONS) {
        const lookupKey = FEATURE_MAP[def.key]
        if (existingKeys.has(lookupKey)) {
          skipped.push({ key: def.key, lookup_key: lookupKey })
          continue
        }
        try {
          const f = await stripe.entitlements.features.create({
            name: def.name,
            lookup_key: lookupKey,
          })
          created.push({ key: def.key, lookup_key: lookupKey, id: f.id })
        } catch (err) {
          errors.push({ key: def.key, error: err.message })
        }
      }

      return res.status(200).json({
        created: created.length,
        skipped: skipped.length,
        errors: errors.length,
        created_features: created,
        skipped_features: skipped,
        errors_details: errors,
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[setup-stripe-features]', err.message)
    return res.status(500).json({ error: err.message })
  }
}

export default withSentry(handler)
