/**
 * Actero Engine V2 — Playbook Loader
 * Loads the appropriate playbook for a client + event type.
 */

/**
 * Find the active playbook for a client based on event type.
 * Returns the playbook config or null if no active playbook matches.
 */
export async function loadPlaybook(supabase, clientId, eventType) {
  // Get all active playbooks for this client
  const { data: clientPlaybooks } = await supabase
    .from('engine_client_playbooks')
    .select('playbook_id, custom_config, is_active')
    .eq('client_id', clientId)
    .eq('is_active', true)

  if (!clientPlaybooks || clientPlaybooks.length === 0) return null

  const playbookIds = clientPlaybooks.map(cp => cp.playbook_id)

  // Get the playbook definitions that match the event type
  const { data: playbooks } = await supabase
    .from('engine_playbooks')
    .select('*')
    .in('id', playbookIds)
    .eq('is_active', true)
    .contains('event_types', [eventType])

  if (!playbooks || playbooks.length === 0) return null

  // Return the first matching playbook with client custom config merged
  const playbook = playbooks[0]
  const clientConfig = clientPlaybooks.find(cp => cp.playbook_id === playbook.id)

  return {
    ...playbook,
    custom_config: clientConfig?.custom_config || {},
    confidence_threshold: clientConfig?.custom_config?.confidence_threshold || playbook.confidence_threshold || 0.85,
  }
}

/**
 * Get all available playbooks (for listing in dashboard).
 */
export async function listPlaybooks(supabase) {
  const { data } = await supabase
    .from('engine_playbooks')
    .select('*')
    .eq('is_active', true)
    .order('display_name')
  return data || []
}

/**
 * Get a client's playbook associations.
 */
export async function getClientPlaybooks(supabase, clientId) {
  const { data } = await supabase
    .from('engine_client_playbooks')
    .select('*, engine_playbooks(*)')
    .eq('client_id', clientId)
  return data || []
}
