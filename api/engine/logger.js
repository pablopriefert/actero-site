/**
 * Actero Engine V2 — Logger
 *
 * Enregistre chaque run avec ses steps, met à jour les métriques.
 * Écrit dans engine_runs_v2 + automation_events + metrics_daily + ai_conversations.
 */

/**
 * Map a free-text classification to a valid ticket_type enum value.
 * Valid values: order_tracking, address_change, return_exchange, product_info,
 *              other, lead_qualification, visit_request, property_matching, billing, general
 */
function mapTicketType(classification) {
  if (!classification) return 'general'
  const c = classification.toLowerCase()

  // Direct matches
  const directMap = {
    order_tracking: 'order_tracking',
    suivi_commande: 'order_tracking',
    tracking: 'order_tracking',
    livraison: 'order_tracking',
    shipping: 'order_tracking',
    colis: 'order_tracking',

    address_change: 'address_change',
    changement_adresse: 'address_change',
    adresse: 'address_change',

    return_exchange: 'return_exchange',
    retour: 'return_exchange',
    echange: 'return_exchange',
    remboursement: 'return_exchange',
    refund: 'return_exchange',

    product_info: 'product_info',
    question_produit: 'product_info',
    produit: 'product_info',
    product: 'product_info',
    info_produit: 'product_info',

    billing: 'billing',
    facturation: 'billing',
    paiement: 'billing',
    facture: 'billing',
    payment: 'billing',

    lead_qualification: 'lead_qualification',
    qualification: 'lead_qualification',
    lead: 'lead_qualification',

    general: 'general',
    autre: 'general',
    greeting: 'general',
    bonjour: 'general',
    aggressive: 'other',
    complaint: 'other',
    plainte: 'other',
    error: 'other',
  }

  // Check for direct match
  if (directMap[c]) return directMap[c]

  // Check for partial match
  for (const [key, value] of Object.entries(directMap)) {
    if (c.includes(key) || key.includes(c)) return value
  }

  return 'general'
}

/**
 * Log a complete run.
 * Also accepts optional normalized event data for ai_conversations logging.
 */
export async function logRun(supabase, {
  clientId, eventId, playbookId, status, classification,
  confidence, actionPlan, steps, durationMs, error,
  normalized, aiResponse, isFollowUp,
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

  // For follow-up messages: don't create new events/metrics
  // But: update the existing ai_conversation + automation_event + metrics when escalating
  if (isFollowUp) {
    const sessionId = normalized?.session_id
    const isEscalatedNow = status === 'needs_review' || actionPlan?.includes('escalate')
    const hasRealEmail = normalized?.customer_email && !normalized.customer_email.includes('@anonymous.actero.fr')

    try {
      // Find the ai_conversation for THIS session
      let query = supabase
        .from('ai_conversations')
        .select('id, status, customer_email')
        .eq('client_id', clientId)
      if (sessionId) query = query.eq('session_id', sessionId)

      const { data: existing } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing) {
        const updates = {}
        if (hasRealEmail && existing.customer_email?.includes('@anonymous.actero.fr')) {
          updates.customer_email = normalized.customer_email
        }
        if (isEscalatedNow && existing.status !== 'escalated') {
          updates.status = 'escalated'
          updates.escalation_reason = confidence < 0.6 ? 'low_confidence' : 'out_of_policy'
        }
        if (aiResponse && aiResponse.length > 20) {
          updates.ai_response = aiResponse
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from('ai_conversations').update(updates).eq('id', existing.id)
        }
      }
    } catch (err) {
      console.error('[logger] follow-up ai_conversations update error:', err.message)
    }

    // If this follow-up escalates, also update automation_event and metrics_daily
    // Convert the "ticket_resolved" into "ticket_escalated"
    if (isEscalatedNow) {
      try {
        // Update the automation_event from ticket_resolved → ticket_escalated
        const { data: existingEvent } = await supabase
          .from('automation_events')
          .select('id, event_category')
          .eq('client_id', clientId)
          .eq('event_category', 'ticket_resolved')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existingEvent) {
          await supabase.from('automation_events')
            .update({ event_category: 'ticket_escalated' })
            .eq('id', existingEvent.id)
        }
      } catch (err) {
        console.error('[logger] follow-up automation_event update error:', err.message)
      }

      // Update metrics_daily: move from tickets_auto to tickets_escalated
      try {
        const today = new Date().toISOString().split('T')[0]
        const { data: todayMetrics } = await supabase
          .from('metrics_daily')
          .select('*')
          .eq('client_id', clientId)
          .eq('date', today)
          .maybeSingle()

        if (todayMetrics) {
          await supabase.from('metrics_daily').update({
            tickets_auto: Math.max(0, (todayMetrics.tickets_auto || 0) - 1),
            tickets_escalated: (todayMetrics.tickets_escalated || 0) + 1,
            estimated_roi: Math.max(0, (todayMetrics.estimated_roi || 0) - ((todayMetrics.time_saved_minutes || 0) > 0 ? Math.round(((todayMetrics.time_saved_minutes || 0) / (todayMetrics.tickets_auto || 1)) / 60 * 25 * 100) / 100 : 0)),
          }).eq('id', todayMetrics.id)
        }
      } catch (err) {
        console.error('[logger] follow-up metrics update error:', err.message)
      }
    }

    return run
  }

  // 2. Log to automation_events (feeds the existing dashboard)
  const isEscalated = status === 'needs_review' || actionPlan?.includes('escalate')
  const eventCategory = status === 'completed'
    ? (actionPlan?.includes('escalate') ? 'ticket_escalated' : 'ticket_resolved')
    : status === 'needs_review'
      ? 'ticket_escalated'
      : 'ticket_error'

  // Map classification to valid ticket_type enum
  const ticketType = mapTicketType(classification)

  // Get client's settings (avg ticket time + hourly cost for ROI)
  let avgTicketTimeSec = 300 // default 5 min
  let hourlyCost = 25 // default 25€/h
  try {
    const { data: clientSettings } = await supabase
      .from('client_settings')
      .select('avg_ticket_time_min, hourly_cost')
      .eq('client_id', clientId)
      .maybeSingle()
    if (clientSettings?.avg_ticket_time_min) {
      avgTicketTimeSec = clientSettings.avg_ticket_time_min * 60
    }
    if (clientSettings?.hourly_cost) {
      hourlyCost = clientSettings.hourly_cost
    }
  } catch {}

  const isResolved = status === 'completed' && !actionPlan?.includes('escalate')
  const timeSaved = isResolved ? avgTicketTimeSec : 0
  const timeSavedMinutes = Math.round(timeSaved / 60)
  // ROI = time saved in hours * hourly cost
  const estimatedRoi = isResolved ? Math.round((timeSaved / 3600) * hourlyCost * 100) / 100 : 0

  try {
    const { error: aeError } = await supabase.from('automation_events').insert({
      client_id: clientId,
      event_category: eventCategory,
      event_type: classification || 'engine_run',
      ticket_type: ticketType,
      time_saved_seconds: timeSaved,
      description: `[Engine] ${classification} — ${status} (${Math.round((confidence || 0) * 100)}% confiance, ${durationMs}ms)`,
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
    if (aeError) console.error('[logger] automation_events insert error:', aeError.message)
  } catch (err) {
    console.error('[logger] automation_events insert exception:', err.message)
  }

  // 3. Write to ai_conversations (feeds "A traiter" tab + activity feed)
  try {
    const conversationStatus = isEscalated ? 'escalated' : 'resolved'
    const escalationReason = status === 'needs_review'
      ? (confidence < 0.6 ? 'low_confidence' : 'error')
      : actionPlan?.includes('escalate')
        ? 'aggressive'
        : null

    // Use first_message if available (from widget conversations with history)
    const displayMessage = normalized?.first_message || normalized?.message || 'N/A'

    const { error: aiError } = await supabase.from('ai_conversations').insert({
      client_id: clientId,
      session_id: normalized?.session_id || null,
      customer_email: normalized?.customer_email || null,
      customer_name: normalized?.customer_name || null,
      subject: normalized?.subject || classification || 'general',
      customer_message: displayMessage,
      ai_response: aiResponse || 'Pas de reponse generee',
      status: conversationStatus,
      ticket_type: classification || 'general',
      confidence_score: confidence,
      response_time_ms: durationMs,
      escalation_reason: escalationReason,
    })
    if (aiError) console.error('[logger] ai_conversations insert error:', aiError.message)
  } catch (err) {
    console.error('[logger] ai_conversations insert exception:', err.message)
  }

  // 4. Update metrics_daily (upsert for today)
  try {
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase
      .from('metrics_daily')
      .select('*')
      .eq('client_id', clientId)
      .eq('date', today)
      .maybeSingle()

    if (existing) {
      const newTicketsTotal = (existing.tickets_total || 0) + 1
      const newTicketsAuto = (existing.tickets_auto || 0) + (isResolved ? 1 : 0)
      const newTasksExecuted = (existing.tasks_executed || 0) + 1
      const newTimeSaved = (existing.time_saved_minutes || 0) + timeSavedMinutes
      const newRoi = (existing.estimated_roi || 0) + estimatedRoi

      const { error: updateError } = await supabase.from('metrics_daily').update({
        tickets_total: newTicketsTotal,
        tickets_auto: newTicketsAuto,
        tasks_executed: newTasksExecuted,
        time_saved_minutes: newTimeSaved,
        conversations_handled: (existing.conversations_handled || 0) + 1,
        estimated_roi: Math.round(newRoi * 100) / 100,
        resolution_rate: newTicketsTotal > 0
          ? Math.round(newTicketsAuto / newTicketsTotal * 100)
          : 0,
      }).eq('id', existing.id)
      if (updateError) console.error('[logger] metrics_daily update error:', updateError.message)
    } else {
      const { error: insertError } = await supabase.from('metrics_daily').insert({
        client_id: clientId,
        date: today,
        tickets_total: 1,
        tickets_auto: isResolved ? 1 : 0,
        tasks_executed: 1,
        time_saved_minutes: timeSavedMinutes,
        conversations_handled: 1,
        estimated_roi: estimatedRoi,
        resolution_rate: isResolved ? 100 : 0,
      })
      if (insertError) console.error('[logger] metrics_daily insert error:', insertError.message)
    }
  } catch (err) {
    console.error('[logger] metrics_daily exception:', err.message)
  }

  return run
}
