/**
 * Actero Engine — Config Loader
 * Loads all client configuration needed for AI processing in a single parallel fetch.
 */

// Plancher du "mode conservateur" (ACT-12). Il n'existe pas de barème par type
// de demande dans ce dépôt (voir commit 38ad5fb) : la seule donnée qu'on ait
// est le réglage libre `avg_ticket_time_min`, jamais recalibré par les clients
// (les 4 clients en base sont tous restés sur le défaut 5 min). On ne peut donc
// pas fabriquer un "barème le plus bas" par type — on plafonne le seul chiffre
// qui existe à la borne basse déjà documentée au marchand dans le centre
// d'aide (SupportGuidePage.jsx : "entre 3 et 10 minutes généralement"). 3 min
// est la valeur la plus difficile à contester, pas une mesure indépendante.
export const CONSERVATIVE_AVG_TICKET_TIME_MIN = 3

/**
 * Calcule le temps (en secondes) valorisé par ticket résolu.
 *
 * En mode conservateur, on plafonne au lieu de remplacer : un client qui a
 * lui-même saisi une valeur déjà basse garde SA valeur, seul le défaut
 * uniforme (ou une saisie optimiste) est ramené au plancher défendable.
 */
export function resolveAvgTicketTimeSec(settings = {}) {
  const configuredMin = Number(settings.avg_ticket_time_min) || 5
  const effectiveMin = settings.roi_conservative_mode
    ? Math.min(configuredMin, CONSERVATIVE_AVG_TICKET_TIME_MIN)
    : configuredMin
  return effectiveMin * 60
}

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
      // `plan` est indispensable : brain.js s'en sert pour décider si le
      // message va à un agent spécialisé ou à l'agent générique. Sans lui, la
      // résolution retombait sur 'free' pour TOUS les clients, et les agents
      // order / return / product / escalation n'ont jamais tourné en
      // production — y compris chez les clients pro et enterprise (ACT-8).
      .select('id, brand_name, client_type, contact_email, plan')
      .eq('id', clientId)
      .single(),

    supabase
      .from('client_settings')
      .select('brand_tone, brand_language, return_policy, excluded_products, custom_instructions, greeting_template, hourly_cost, avg_ticket_time_min, roi_conservative_mode, brand_identity, tone_style, example_responses, tone_formality, tone_warmth, tone_detail, product_recommendations_enabled')
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
    timeSavedPerTicket: resolveAvgTicketTimeSec(settings), // in seconds
  }
}
