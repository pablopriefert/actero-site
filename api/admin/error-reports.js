/**
 * Admin — Error reports management + Vercel logs fetching.
 *
 * GET  /api/admin/error-reports                 → list all reports
 * PATCH /api/admin/error-reports?id=xxx         → update status/notes
 * GET  /api/admin/error-reports?vercel_logs=1&since=ISO&until=ISO → fetch Vercel runtime logs
 *
 * Admin only.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function requireAdmin(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) { res.status(401).json({ error: 'Non autorisé' }); return null }
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) { res.status(401).json({ error: 'Non autorisé' }); return null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') { res.status(403).json({ error: 'Accès réservé aux administrateurs' }); return null }
  return user
}

/**
 * Fetch Vercel runtime logs around a specific timestamp.
 * Requires VERCEL_TOKEN and VERCEL_PROJECT_ID env vars.
 */
async function fetchVercelLogs({ since, until, query }) {
  const token = process.env.VERCEL_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  const teamId = process.env.VERCEL_TEAM_ID

  if (!token || !projectId) {
    return { error: 'VERCEL_TOKEN ou VERCEL_PROJECT_ID manquant', logs: [] }
  }

  try {
    const params = new URLSearchParams({
      projectId,
      ...(teamId && { teamId }),
      ...(since && { since: String(new Date(since).getTime()) }),
      ...(until && { until: String(new Date(until).getTime()) }),
      limit: '100',
    })
    if (query) params.set('query', query)

    const url = `https://api.vercel.com/v3/projects/${projectId}/logs?${params}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { error: `Vercel API ${res.status}: ${text.slice(0, 200)}`, logs: [] }
    }
    const data = await res.json()
    return { logs: data.logs || data || [], error: null }
  } catch (err) {
    return { error: err.message, logs: [] }
  }
}

export default async function handler(req, res) {
  const user = await requireAdmin(req, res)
  if (!user) return

  // FETCH Vercel logs
  if (req.method === 'GET' && req.query.vercel_logs === '1') {
    const { since, until, query } = req.query
    const result = await fetchVercelLogs({ since, until, query })
    return res.status(200).json(result)
  }

  // LIST reports
  if (req.method === 'GET') {
    const { status, limit = 100 } = req.query
    let q = supabase
      .from('error_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit, 10))
    if (status) q = q.eq('status', status)

    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ reports: data || [] })
  }

  // UPDATE report
  if (req.method === 'PATCH') {
    const id = req.query.id
    if (!id) return res.status(400).json({ error: 'id requis' })
    const { status, admin_notes } = req.body || {}
    const update = {}
    if (status) {
      update.status = status
      if (['resolved', 'closed'].includes(status)) {
        update.resolved_at = new Date().toISOString()
        update.resolved_by = user.id
      }
    }
    if (admin_notes !== undefined) update.admin_notes = admin_notes

    const { data, error } = await supabase
      .from('error_reports')
      .update(update)
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ report: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
