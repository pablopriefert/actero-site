/**
 * Slack Ops Canvas helpers — used by api/cron/slack-canvas-update.js.
 *
 * Builds a live operational dashboard for each merchant inside their Slack
 * workspace. The Canvas is created once (canvases.create) then edited on each
 * refresh (canvases.edit) so the same URL keeps stable in their bookmarks.
 *
 * Slack scopes required (added to the OAuth install URL):
 *   - canvases:write
 *   - canvases:read
 *
 * Merchants who installed before these scopes were added need to reconnect.
 * The cron logs a "missing_scope" hint and skips them — no crash.
 */

/* -------------------------------------------------------------------------- */
/*  Stats fetcher — single round-trip per client.                             */
/* -------------------------------------------------------------------------- */

/**
 * Pulls the numbers we display on the canvas. Single pass over the client's
 * recent activity — keeps the cron under 2 s per client even at scale.
 *
 * Returns: {
 *   open_tickets, resolved_24h, escalated_24h,
 *   auto_rate_pct, avg_first_response_min,
 *   top_topics: [{ topic, count }, ...],
 *   alerts: [{ severity, message }, ...]
 * }
 */
export async function fetchOpsStats(supabase, clientId) {
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  // There is no `tickets` table. Open items awaiting a human live in
  // escalation_tickets; resolved/escalated volume, latency and topic all come
  // from automation_events (the engine's per-run log).
  const [openTickets, events24h, alerts] = await Promise.all([
    supabase
      .from('escalation_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .in('status', ['pending', 'open']),
    supabase
      .from('automation_events')
      .select('event_category, ticket_type, metadata, created_at')
      .eq('client_id', clientId)
      .gte('created_at', dayAgo),
    supabase
      .from('agent_action_logs')
      .select('action_type, success')
      .eq('merchant_id', clientId)
      .gte('created_at', dayAgo)
      .eq('success', false)
      .limit(20),
  ])

  const events = events24h.data || []
  const resolved = events.filter((e) => e.event_category === 'ticket_resolved')
  const escalated = events.filter((e) => e.event_category === 'ticket_escalated')
  const handledCount = resolved.length + escalated.length

  // Auto-resolution rate over the day
  const autoRatePct = handledCount > 0
    ? Math.round((resolved.length / handledCount) * 100)
    : null

  // Avg AI response time (metadata.duration_ms → min; only surface if it rounds to ≥1 min)
  const durationsMs = resolved
    .map((e) => Number(e.metadata?.duration_ms))
    .filter((ms) => Number.isFinite(ms) && ms > 0)
  const avgSec = durationsMs.length > 0
    ? durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length / 1000
    : null
  const avgFirstResponseMin = avgSec && avgSec >= 60 ? Math.round(avgSec / 60) : null

  // Top 3 topics by ticket type over the day
  const counts = new Map()
  for (const e of events) {
    if (!e.ticket_type) continue
    counts.set(e.ticket_type, (counts.get(e.ticket_type) || 0) + 1)
  }
  const topTopics = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic, count]) => ({ topic, count }))

  // Active alerts — failed agent actions in the last 24h
  const alertList = (alerts.data || []).slice(0, 3).map((a) => ({
    severity: 'warning',
    message: `Action ${a.action_type} a échoué dans les dernières 24 h`,
  }))

  return {
    open_tickets: openTickets.count || 0,
    resolved_24h: resolved.length,
    escalated_24h: escalated.length,
    auto_rate_pct: autoRatePct,
    avg_first_response_min: avgFirstResponseMin,
    top_topics: topTopics,
    alerts: alertList,
  }
}

/* -------------------------------------------------------------------------- */
/*  Canvas markdown renderer.                                                 */
/* -------------------------------------------------------------------------- */

export function renderOpsCanvasMarkdown({ brandName, stats, refreshedAt }) {
  const time = new Date(refreshedAt).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  })

  const lines = []
  lines.push(`# Live Ops — ${brandName}`)
  lines.push('')
  lines.push(`> Mis à jour à ${time} (toutes les 15 min) · [Ouvrir le dashboard](https://actero.fr/client)`)
  lines.push('')
  lines.push('## Tickets — dernières 24 h')
  lines.push('')
  lines.push(`- **${stats.open_tickets}** tickets ouverts`)
  lines.push(`- **${stats.resolved_24h}** résolus`)
  lines.push(`- **${stats.escalated_24h}** escaladés vers un humain`)
  if (stats.auto_rate_pct !== null) {
    lines.push(`- **${stats.auto_rate_pct}%** résolus par l'agent IA`)
  }
  if (stats.avg_first_response_min !== null) {
    lines.push(`- Temps de première réponse moyen : **${stats.avg_first_response_min} min**`)
  }
  lines.push('')

  lines.push('## Top sujets')
  lines.push('')
  if (stats.top_topics.length === 0) {
    lines.push('_Pas encore assez de données sur les dernières 24 h._')
  } else {
    for (const t of stats.top_topics) {
      lines.push(`- **${t.topic}** — ${t.count} tickets`)
    }
  }
  lines.push('')

  lines.push('## Alertes actives')
  lines.push('')
  if (stats.alerts.length === 0) {
    lines.push('_Aucune alerte. Tout roule._')
  } else {
    for (const a of stats.alerts) {
      lines.push(`- ⚠️ ${a.message}`)
    }
  }

  return lines.join('\n')
}

/* -------------------------------------------------------------------------- */
/*  Slack Canvas API wrappers.                                                */
/* -------------------------------------------------------------------------- */

/**
 * Create a standalone canvas. Returns { canvas_id, canvas_url } on success.
 * On missing_scope or any other error, returns { error }.
 */
export async function createCanvas({ token, title, markdown }) {
  const resp = await fetch('https://slack.com/api/canvases.create', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      title,
      document_content: { type: 'markdown', markdown },
    }),
  })
  const data = await resp.json().catch(() => ({}))
  if (!data.ok) {
    return { error: data.error || 'unknown_error' }
  }
  // Slack returns canvas_id; the URL is constructed by the workspace.
  // We can't get a permalink from canvases.create, so we leave canvas_url
  // null and let the dashboard show an "Open in Slack" button that uses a
  // canvases.access deep link by id.
  return { canvas_id: data.canvas_id, canvas_url: null }
}

/**
 * Replace the entire body of an existing canvas with fresh markdown.
 * Slack's canvases.edit takes a list of section operations — for an ops
 * dashboard we want a wholesale replace, which is one "replace" op on
 * the canvas with no document_id (operates on the root).
 */
export async function editCanvas({ token, canvasId, markdown }) {
  const resp = await fetch('https://slack.com/api/canvases.edit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      canvas_id: canvasId,
      changes: [{
        operation: 'replace',
        document_content: { type: 'markdown', markdown },
      }],
    }),
  })
  const data = await resp.json().catch(() => ({}))
  if (!data.ok) {
    return { error: data.error || 'unknown_error' }
  }
  return { ok: true }
}
