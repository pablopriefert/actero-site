/**
 * Actero Engine V2 — Logger
 *
 * Enregistre chaque run avec ses steps, met à jour les métriques.
 * Écrit dans engine_runs_v2 + automation_events + metrics_daily.
 */

/**
 * Log a complete run.
 */
export async function logRun(supabase, {
  clientId, eventId, playbookId, status, classification,
  confidence, actionPlan, steps, durationMs, error,
}) {
  // 1. Create run record
  const { data: run, error: runError } = await supabase
    .from('engine_runs_v2')
    .insert({
      client_id: clientId,
      event_id: eventId,
      playbook_id: playbookId,
      status,
      classification,
      confidence,
      action_plan: actionPlan,
      steps,
      duration_ms: durationMs,
      error,
    })
    .select('id')
    .single()

  if (runError) console.error('[logger] Run insert error:', runError.message)

  // 2. Log to automation_events (feeds the existing dashboard)
  const eventCategory = status === 'completed'
    ? (actionPlan?.includes('escalate') ? 'ticket_escalated' : 'ticket_resolved')
    : status === 'needs_review'
      ? 'ticket_escalated'
      : 'ticket_error'

  // Get client's avg ticket time from settings
  let avgTicketTimeSec = 300 // default 5 min
  try {
    const { data: clientSettings } = await supabase
      .from('client_settings')
      .select('avg_ticket_time_min')
      .eq('client_id', clientId)
      .maybeSingle()
    if (clientSettings?.avg_ticket_time_min) {
      avgTicketTimeSec = clientSettings.avg_ticket_time_min * 60
    }
  } catch {}

  const timeSaved = status === 'completed' && !actionPlan?.includes('escalate') ? avgTicketTimeSec : 0

  try {
    await supabase.from('automation_events').insert({
      client_id: clientId,
      event_category: eventCategory,
      event_type: classification || 'engine_run',
      ticket_type: classification || 'general',
      time_saved_seconds: timeSaved,
      description: `[Engine] ${classification} — ${status} (${Math.round(confidence * 100)}% confiance, ${durationMs}ms)`,
      metadata: {
        run_id: run?.id,
        event_id: eventId,
        playbook_id: playbookId,
        classification,
        confidence,
        steps_count: steps?.length || 0,
        duration_ms: durationMs,
        source: 'engine_v2',
      },
    })
  } catch (err) {
    console.error('[logger] automation_events insert error:', err.message)
  }

  // 3. Update metrics_daily (upsert for today)
  try {
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase
      .from('metrics_daily')
      .select('*')
      .eq('client_id', clientId)
      .eq('date', today)
      .maybeSingle()

    if (existing) {
      const isResolved = status === 'completed' && !actionPlan?.includes('escalate')
      await supabase.from('metrics_daily').update({
        tickets_total: (existing.tickets_total || 0) + 1,
        tickets_auto: (existing.tickets_auto || 0) + (isResolved ? 1 : 0),
        tasks_executed: (existing.tasks_executed || 0) + (steps?.length || 0),
        time_saved_minutes: (existing.time_saved_minutes || 0) + Math.round(timeSaved / 60),
        conversations_handled: (existing.conversations_handled || 0) + 1,
        resolution_rate: existing.tickets_total > 0
          ? Math.round(((existing.tickets_auto || 0) + (isResolved ? 1 : 0)) / ((existing.tickets_total || 0) + 1) * 100)
          : (isResolved ? 100 : 0),
      }).eq('id', existing.id)
    } else {
      const isResolved = status === 'completed' && !actionPlan?.includes('escalate')
      await supabase.from('metrics_daily').insert({
        client_id: clientId,
        date: today,
        tickets_total: 1,
        tickets_auto: isResolved ? 1 : 0,
        tasks_executed: steps?.length || 0,
        time_saved_minutes: Math.round(timeSaved / 60),
        conversations_handled: 1,
        resolution_rate: isResolved ? 100 : 0,
      })
    }
  } catch (err) {
    console.error('[logger] metrics_daily upsert error:', err.message)
  }

  return run
}
