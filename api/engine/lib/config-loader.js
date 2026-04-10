/**
 * Actero Engine — Config Loader
 * Loads all client configuration needed for AI processing in a single parallel fetch.
 */

export async function loadClientConfig(supabase, clientId) {
  const [
    clientRes,
    settingsRes,
    guardrailsRes,
    kbRes,
    integrationsRes,
    thresholdsRes,
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id, brand_name, client_type, contact_email')
      .eq('id', clientId)
      .single(),

    supabase
      .from('client_settings')
      .select('brand_tone, brand_language, return_policy, excluded_products, custom_instructions, greeting_template, hourly_cost, avg_ticket_time_min, brand_identity, tone_style, example_responses, tone_formality, tone_warmth, tone_detail')
      .eq('client_id', clientId)
      .maybeSingle(),

    supabase
      .from('client_guardrails')
      .select('rule_text')
      .eq('client_id', clientId)
      .eq('is_enabled', true)
      .order('priority', { ascending: true }),

    supabase
      .from('client_knowledge_base')
      .select('title, content, category')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .limit(50),

    supabase
      .from('client_integrations')
      .select('provider, status')
      .eq('client_id', clientId)
      .eq('status', 'active'),

    supabase
      .from('client_escalation_thresholds')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle(),
  ])

  const client = clientRes.data
  if (!client) throw new Error(`Client ${clientId} not found`)

  const settings = settingsRes.data || {}
  const guardrails = (guardrailsRes.data || []).map(g => g.rule_text)
  const knowledge = (kbRes.data || []).map(k => `[${k.category}] ${k.title}: ${k.content}`).join('\n')
  const activeIntegrations = (integrationsRes.data || []).map(i => i.provider)
  const thresholds = thresholdsRes.data || {}

  return {
    client,
    settings,
    guardrails,
    knowledge,
    activeIntegrations,
    thresholds,
    confidenceThreshold: thresholds.min_confidence || 0.7,
    timeSavedPerTicket: (settings.avg_ticket_time_min || 5) * 60, // in seconds
  }
}
