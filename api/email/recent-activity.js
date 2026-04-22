/**
 * GET /api/email/recent-activity?client_id=UUID&limit=10
 *
 * Returns recent email conversations for the Email Agent dashboard.
 * Auth: Bearer JWT.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Non autorisé' })

  const clientId = req.query?.client_id
  if (!clientId) return res.status(400).json({ error: 'client_id requis' })

  // Check access
  const { data: link } = await supabase.from('client_users')
    .select('client_id').eq('user_id', user.id).eq('client_id', clientId).maybeSingle()
  const isAdmin = user.app_metadata?.role === 'admin'
  if (!link && !isAdmin) {
    const { data: owned } = await supabase.from('clients')
      .select('id').eq('id', clientId).eq('owner_user_id', user.id).maybeSingle()
    if (!owned) return res.status(403).json({ error: 'Accès refusé' })
  }

  const limit = Math.min(parseInt(req.query?.limit || '10', 10) || 10, 50)

  // Only REAL emails — exclude widget/chatbot synthetic addresses like
  // widget-actero_xxx@anonymous.actero.fr or *@anonymous.actero.fr in general.
  const REAL_EMAIL_PATTERN = '%@anonymous.actero.fr'

  // Recent inbound emails (real mail addresses only)
  const { data: recent } = await supabase
    .from('ai_conversations')
    .select('id, customer_email, customer_name, subject, status, escalation_reason, ai_response, human_response, created_at, human_responded_at')
    .eq('client_id', clientId)
    .not('customer_email', 'ilike', REAL_EMAIL_PATTERN)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Weekly stats — same filter (real emails only)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const [{ count: total }, { count: auto }, { count: escalated }] = await Promise.all([
    supabase.from('ai_conversations').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).gte('created_at', weekAgo)
      .not('customer_email', 'ilike', REAL_EMAIL_PATTERN),
    supabase.from('ai_conversations').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).gte('created_at', weekAgo).eq('status', 'resolved')
      .not('customer_email', 'ilike', REAL_EMAIL_PATTERN),
    supabase.from('ai_conversations').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).gte('created_at', weekAgo).eq('status', 'escalated')
      .not('customer_email', 'ilike', REAL_EMAIL_PATTERN),
  ])

  return res.status(200).json({
    week: {
      total: total || 0,
      auto: auto || 0,
      escalated: escalated || 0,
      auto_rate: (total || 0) > 0 ? Math.round(((auto || 0) / (total || 0)) * 100) : 0,
    },
    recent: recent || [],
  })
}

export default withSentry(handler)
