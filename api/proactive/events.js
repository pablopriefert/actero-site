/**
 * GET /api/proactive/events?client_id=UUID&limit=20  — list recent events
 * GET /api/proactive/events?client_id=UUID&stats=1   — stats summary
 *
 * Auth: Bearer JWT.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Non autorisé' })

  const clientId = req.query?.client_id
  if (!clientId) return res.status(400).json({ error: 'client_id requis' })

  const isAdmin = user.app_metadata?.role === 'admin'
  if (!isAdmin) {
    const { data: link } = await supabase.from('client_users')
      .select('client_id').eq('user_id', user.id).eq('client_id', clientId).maybeSingle()
    if (!link) {
      const { data: owned } = await supabase.from('clients')
        .select('id').eq('id', clientId).eq('owner_user_id', user.id).maybeSingle()
      if (!owned) return res.status(403).json({ error: 'Accès refusé' })
    }
  }

  // Stats summary
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const [{ count: totalAll }, { count: sentWeek }, { count: sentMonth }, recent] = await Promise.all([
    supabase.from('proactive_events').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId),
    supabase.from('proactive_events').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).eq('action_status', 'sent').gte('created_at', weekAgo),
    supabase.from('proactive_events').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).eq('action_status', 'sent').gte('created_at', monthAgo),
    supabase.from('proactive_events').select('id, rule_name, customer_email, customer_name, action_status, action_subject, trigger_data, created_at, sent_at')
      .eq('client_id', clientId).order('created_at', { ascending: false }).limit(20),
  ])

  // Estimated tickets avoided (sent = ticket évité)
  const estimatedSavedWeek = sentWeek || 0
  const estimatedEuroSavedMonth = (sentMonth || 0) * 2 // assume 2€ avg support cost avoided per ticket

  return res.status(200).json({
    stats: {
      total_all_time: totalAll || 0,
      tickets_avoided_week: estimatedSavedWeek,
      tickets_avoided_month: sentMonth || 0,
      euro_saved_month: estimatedEuroSavedMonth,
    },
    recent: recent.data || [],
  })
}
