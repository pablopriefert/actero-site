/**
 * Actero SaaS Plans — Backend mirror of src/lib/plans.js
 *
 * Kept aligned with the frontend single source of truth. Any change to
 * pricing / limits / features must land in BOTH files.
 */

export const PLAN_LIMITS = {
  free: {
    tickets: 50,
    workflows: 1,
    integrations: 1,
    knowledge_entries: 10,
    team_members: 1,
    history_days: 7,
    voice_minutes: 0,
    whatsapp: false,
    overage: null,
  },
  starter: {
    tickets: 1000,
    workflows: 3,
    integrations: 3,
    knowledge_entries: 100,
    team_members: 2,
    history_days: 90,
    voice_minutes: 0,
    whatsapp: false,
    overage: 0.15,
  },
  pro: {
    tickets: 5000,
    workflows: Infinity,
    integrations: Infinity,
    knowledge_entries: Infinity,
    team_members: 5,
    history_days: Infinity,
    voice_minutes: 200,
    whatsapp: true,
    overage: 0.10,
  },
  enterprise: {
    tickets: Infinity,
    workflows: Infinity,
    integrations: Infinity,
    knowledge_entries: Infinity,
    team_members: Infinity,
    history_days: Infinity,
    voice_minutes: Infinity,
    whatsapp: true,
    overage: null,
  },
}

export const PLAN_FEATURES = {
  free: {
    brand_editor: false,
    guardrails: true,
    simulator: false,
    voice_agent: false,
    whatsapp_agent: false,
    specialized_agents: false,
    api_webhooks: false,
    pdf_report: false,
    multi_shop: false,
    white_label: false,
    roi_dashboard: 'basic',
  },
  starter: {
    brand_editor: true,
    guardrails: true,
    simulator: true,
    voice_agent: false,
    whatsapp_agent: false,
    specialized_agents: false,
    api_webhooks: true,
    pdf_report: false,
    multi_shop: false,
    white_label: false,
    roi_dashboard: 'full',
  },
  pro: {
    brand_editor: true,
    guardrails: true,
    simulator: true,
    voice_agent: true,
    whatsapp_agent: true,
    specialized_agents: true,
    api_webhooks: true,
    pdf_report: true,
    multi_shop: false,
    white_label: false,
    roi_dashboard: 'full',
  },
  enterprise: {
    brand_editor: true,
    guardrails: true,
    simulator: true,
    voice_agent: true,
    whatsapp_agent: true,
    specialized_agents: true,
    api_webhooks: true,
    pdf_report: true,
    multi_shop: true,
    white_label: true,
    roi_dashboard: 'custom',
  },
}

export function getLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free
}

export function canAccessFeature(plan, feature) {
  const f = PLAN_FEATURES[plan] || PLAN_FEATURES.free
  const value = f[feature]
  return value === true || value === 'full' || value === 'custom'
}

export function getLimit(plan, limitKey) {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free
  return limits[limitKey] ?? 0
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

/**
 * Atomically increment the ticket usage counter via the SQL RPC
 * `increment_ticket_usage(p_client_id uuid, p_period text)`.
 *
 * Returns the updated row. The previous implementation did an upsert({tickets_used: 1})
 * which reset the counter on every call — fixed here by delegating entirely to the RPC.
 */
export async function incrementTicketUsage(supabase, clientId) {
  const period = new Date().toISOString().slice(0, 7)
  const { data, error } = await supabase.rpc('increment_ticket_usage', {
    p_client_id: clientId,
    p_period: period,
  })
  if (error) {
    console.error('[plan-limits] increment_ticket_usage RPC failed:', error.message)
    return null
  }
  return data
}
