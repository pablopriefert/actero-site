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

  const [
    openTickets,
    resolved24h,
    escalated24h,
    handled24h,
    topics,
    alerts,
  ] = await Promise.all([
    supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .in('status', ['open', 'pending']),
    supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'resolved')
      .gte('updated_at', dayAgo),
    supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('escalated', true)
      .gte('updated_at', dayAgo),
    supabase
      .from('tickets')
      .select('id, resolved_by_ai, first_response_seconds')
      .eq('client_id', clientId)
      .gte('updated_at', dayAgo),
    supabase
      .from('tickets')
      .select('topic')
      .eq('client_id', clientId)
      .gte('created_at', dayAgo)
      .not('topic', 'is', null)
      .limit(500),
    supabase
      .from('agent_action_logs')
      .select('action_type, success')
      .eq('merchant_id', clientId)
      .gte('created_at', dayAgo)
      .eq('success', false)
      .limit(20),
  ])

  // Auto-resolution rate over the day
  const handled = handled24h.data || []
  const autoResolvedCount = handled.filter((t) => t.resolved_by_ai).length
  const autoRatePct = handled.length > 0
    ? Math.round((autoResolvedCount / handled.length) * 100)
    : null

  // Avg first-response time (only on tickets that have one)
  const responseTimes = handled
    .map((t) => t.first_response_seconds)
    .filter((s) => Number.isFinite(s) && s > 0)
  const avgFirstResponseMin = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 60)
    : null

  // Top 3 topics
  const counts = new Map()
  for (const row of topics.data || []) {
    if (!row.topic) continue
    counts.set(row.topic, (counts.get(row.topic) || 0) + 1)
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
    resolved_24h: resolved24h.count || 0,
    escalated_24h: escalated24h.count || 0,
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
