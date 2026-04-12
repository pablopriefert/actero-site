/**
 * Actero SaaS Plans — Backend mirror
 * Keep in sync with src/lib/plans.js
 */

export const PLAN_LIMITS = {
  free: { tickets: 50, workflows: 1, integrations: 1, voice_minutes: 0, whatsapp: false, overage: null },
  starter: { tickets: 1000, workflows: 3, integrations: 3, voice_minutes: 0, whatsapp: false, overage: 0.10 },
  pro: { tickets: 5000, workflows: Infinity, integrations: Infinity, voice_minutes: 200, whatsapp: true, overage: 0.10 },
  enterprise: { tickets: Infinity, workflows: Infinity, integrations: Infinity, voice_minutes: Infinity, whatsapp: true, overage: null },
}

export const PLAN_FEATURES = {
  free: { brand_editor: false, guardrails: false, simulator: false, voice_agent: false, whatsapp_agent: false, specialized_agents: false, api_webhooks: false },
  starter: { brand_editor: true, guardrails: true, simulator: false, voice_agent: false, whatsapp_agent: false, specialized_agents: true, api_webhooks: false },
  pro: { brand_editor: true, guardrails: true, simulator: true, voice_agent: true, whatsapp_agent: true, specialized_agents: true, api_webhooks: true },
  enterprise: { brand_editor: true, guardrails: true, simulator: true, voice_agent: true, whatsapp_agent: true, specialized_agents: true, api_webhooks: true },
}

export function getLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free
}

export function canAccessFeature(plan, feature) {
  const f = PLAN_FEATURES[plan] || PLAN_FEATURES.free
  return !!f[feature]
}

export async function getCurrentUsage(supabase, clientId) {
  const period = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  const { data } = await supabase
    .from('usage_counters')
    .select('tickets_used, voice_minutes_used, overage_tickets')
    .eq('client_id', clientId)
    .eq('period', period)
    .maybeSingle()
  return data || { tickets_used: 0, voice_minutes_used: 0, overage_tickets: 0 }
}

export async function incrementTicketUsage(supabase, clientId) {
  const period = new Date().toISOString().slice(0, 7)
  const { data, error } = await supabase
    .from('usage_counters')
    .upsert({
      client_id: clientId,
      period,
      tickets_used: 1,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'client_id,period',
    })
    .select('tickets_used')
    .single()

  // Upsert doesn't increment, it sets. We need to use rpc or manual update.
  // Better approach: increment via SQL
  const { data: updated } = await supabase.rpc('increment_ticket_usage', {
    p_client_id: clientId,
    p_period: period,
  })

  return updated
}
