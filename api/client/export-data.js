/**
 * GET /api/client/export-data?format=json|csv
 *
 * GDPR data export endpoint for the authenticated client user. Returns a
 * bundle of every row we hold on the caller's client tenant across the
 * conversation/ticket/metric tables. The user triggers this from
 * SettingsHubView → export section.
 *
 * Auth: Bearer JWT (Supabase session). The caller must be a member of the
 * client_id resolved from client_users + clients.owner_user_id.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// Tables we export, in the order that makes the bundle easy to read.
const EXPORT_TABLES = [
  { name: 'client', from: 'clients', filter: (q, id) => q.eq('id', id) },
  { name: 'settings', from: 'client_settings', filter: (q, id) => q.eq('client_id', id) },
  { name: 'integrations', from: 'client_integrations', filter: (q, id) => q.eq('client_id', id), select: 'id, provider, provider_label, status, connected_at, created_at, updated_at' },
  { name: 'ai_conversations', from: 'ai_conversations', filter: (q, id) => q.eq('client_id', id) },
  { name: 'automation_events', from: 'automation_events', filter: (q, id) => q.eq('client_id', id) },
  { name: 'engine_runs', from: 'engine_runs_v2', filter: (q, id) => q.eq('client_id', id) },
  { name: 'metrics_daily', from: 'metrics_daily', filter: (q, id) => q.eq('client_id', id) },
  { name: 'escalation_tickets', from: 'escalation_tickets', filter: (q, id) => q.eq('client_id', id) },
  { name: 'sentiment_logs', from: 'sentiment_logs', filter: (q, id) => q.eq('client_id', id) },
  { name: 'churn_predictions', from: 'churn_predictions', filter: (q, id) => q.eq('client_id', id) },
  { name: 'response_templates', from: 'response_templates', filter: (q, id) => q.eq('client_id', id) },
  { name: 'knowledge_entries', from: 'client_knowledge_base', filter: (q, id) => q.eq('client_id', id) },
]

async function resolveClientId(user) {
  // Owner?
  const { data: owned } = await supabase
    .from('clients')
    .select('id')
    .eq('owner_user_id', user.id)
    .maybeSingle()
  if (owned?.id) return owned.id
  // Member?
  const { data: member } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .maybeSingle()
  return member?.client_id || null
}

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toCsv(rows) {
  if (!rows || rows.length === 0) return ''
  const cols = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r || {}).forEach((k) => set.add(k))
      return set
    }, new Set()),
  )
  const header = cols.join(',')
  const body = rows.map((r) => cols.map((c) => csvEscape(r[c])).join(',')).join('\n')
  return header + '\n' + body + '\n'
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Non autorisé' })

  const clientId = await resolveClientId(user)
  if (!clientId) return res.status(403).json({ error: 'Aucun client associé' })

  const bundle = { exported_at: new Date().toISOString(), client_id: clientId }
  for (const t of EXPORT_TABLES) {
    try {
      let q = supabase.from(t.from).select(t.select || '*')
      q = t.filter(q, clientId)
      const { data, error } = await q
      bundle[t.name] = error ? [] : data || []
    } catch {
      bundle[t.name] = []
    }
  }

  const format = String(req.query?.format || 'json').toLowerCase()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

  if (format === 'csv') {
    // Concat all tables into a single CSV with section headers. Excel-friendly.
    const parts = []
    for (const [name, rows] of Object.entries(bundle)) {
      if (!Array.isArray(rows)) continue
      parts.push(`## ${name} (${rows.length})`)
      parts.push(toCsv(rows))
      parts.push('')
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="actero-export-${stamp}.csv"`)
    return res.status(200).send('\uFEFF' + parts.join('\n'))
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="actero-export-${stamp}.json"`)
  return res.status(200).send(JSON.stringify(bundle, null, 2))
}

export default withSentry(handler)
