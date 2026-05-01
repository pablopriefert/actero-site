/**
 * Actero Entitlements — Stripe-based feature flags.
 *
 * When a client has an active Stripe subscription, their features
 * are provisioned via Stripe Entitlements. We cache them in `client_entitlements`
 * and refresh on webhook events.
 *
 * Source of truth order:
 *   1. client_entitlements (source=manual) — admin override
 *   2. client_entitlements (source=stripe) — synced from Stripe
 *   3. Fallback to static plans.js via client.plan
 *
 * All feature keys match src/lib/plans.js PLANS.*.features.
 */

import { canAccessFeature as planCanAccess, getLimits as planGetLimits } from './plan-limits.js'

// Map feature key → Stripe lookup_key (must match lookup_keys created in Stripe Dashboard)
export const FEATURE_MAP = {
  brand_editor: 'actero_brand_editor',
  guardrails: 'actero_guardrails',
  simulator: 'actero_simulator',
  voice_agent: 'actero_voice_agent',
  specialized_agents: 'actero_specialized_agents',
  api_webhooks: 'actero_api_webhooks',
  pdf_report: 'actero_pdf_report',
  multi_shop: 'actero_multi_shop',
  white_label: 'actero_white_label',
  roi_dashboard_full: 'actero_roi_full',
  voice_minutes_200: 'actero_voice_minutes_200',
  workflows_unlimited: 'actero_workflows_unlimited',
  integrations_unlimited: 'actero_integrations_unlimited',
}

export const REVERSE_FEATURE_MAP = Object.fromEntries(
  Object.entries(FEATURE_MAP).map(([k, v]) => [v, k])
)

/**
 * Check if a client has access to a feature.
 *
 * @param {object} supabase — Supabase client
 * @param {string} clientId
 * @param {string} featureKey — e.g. 'voice_agent'
 * @returns {Promise<boolean>}
 */
export async function clientHasEntitlement(supabase, clientId, featureKey) {
  if (!clientId || !featureKey) return false

  // 1. Check entitlements cache (Stripe or manual override)
  const { data: ent } = await supabase
    .from('client_entitlements')
    .select('feature_key, expires_at')
    .eq('client_id', clientId)
    .eq('feature_key', featureKey)
    .maybeSingle()

  if (ent) {
    // Check expiration
    if (!ent.expires_at || new Date(ent.expires_at) > new Date()) {
      return true
    }
  }

  // 2. Fallback to plan.js if no entitlement found
  const { data: client } = await supabase
    .from('clients')
    .select('plan, trial_ends_at')
    .eq('id', clientId)
    .maybeSingle()

  if (!client) return false

  const inTrial = client.trial_ends_at && new Date(client.trial_ends_at) > new Date()
  if (inTrial) return true // trial grants all features

  return planCanAccess(client.plan || 'free', featureKey)
}

/**
 * Sync active entitlements from Stripe into our cache.
 * Called by webhook on subscription.created/updated/deleted.
 *
 * @param {object} supabase
 * @param {object} stripe — Stripe SDK instance
 * @param {string} clientId
 * @param {string} stripeCustomerId
 */
export async function syncEntitlementsFromStripe(supabase, stripe, clientId, stripeCustomerId) {
  if (!stripe || !stripeCustomerId) return { synced: 0 }

  try {
    // Stripe Entitlements API (beta/new feature — requires API version 2024+)
    const active = await stripe.entitlements.activeEntitlements.list({
      customer: stripeCustomerId,
      limit: 100,
    })

    // Remove old stripe-sourced entitlements
    await supabase
      .from('client_entitlements')
      .delete()
      .eq('client_id', clientId)
      .eq('source', 'stripe')

    // Insert new ones
    const rows = (active.data || [])
      .map((ent) => {
        // Stripe lookup_key is on the feature object
        const lookupKey = ent.lookup_key || ent.feature?.lookup_key
        const featureKey = REVERSE_FEATURE_MAP[lookupKey]
        if (!featureKey) return null
        return {
          client_id: clientId,
          feature_key: featureKey,
          stripe_entitlement_id: ent.id,
          stripe_feature_id: ent.feature?.id || null,
          source: 'stripe',
        }
      })
      .filter(Boolean)

    if (rows.length > 0) {
      await supabase.from('client_entitlements').upsert(rows, { onConflict: 'client_id,feature_key' })
    }

    return { synced: rows.length }
  } catch (err) {
    console.error('[entitlements] sync error:', err.message)
    return { synced: 0, error: err.message }
  }
}

/**
 * Grant a manual entitlement (admin override).
 * Useful for Enterprise clients or trial extensions.
 */
export async function grantManualEntitlement(supabase, clientId, featureKey, expiresAt = null) {
  return supabase.from('client_entitlements').upsert({
    client_id: clientId,
    feature_key: featureKey,
    source: 'manual',
    expires_at: expiresAt,
  }, { onConflict: 'client_id,feature_key' })
}

/**
 * Revoke a manual entitlement.
 */
export async function revokeManualEntitlement(supabase, clientId, featureKey) {
  return supabase
    .from('client_entitlements')
    .delete()
    .eq('client_id', clientId)
    .eq('feature_key', featureKey)
    .eq('source', 'manual')
}
