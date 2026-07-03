import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Non autorisé' })

  const { reco_id, action = 'apply', title, content } = req.body || {}
  if (!reco_id) return res.status(400).json({ error: 'reco_id requis' })
  if (!['apply', 'dismiss'].includes(action)) return res.status(400).json({ error: 'action invalide' })

  const { data: reco } = await supabase
    .from('ai_recommendations')
    .select('id, client_id, status, evidence')
    .eq('id', reco_id)
    .maybeSingle()
  if (!reco) return res.status(404).json({ error: 'Recommandation introuvable' })

  // Ownership: service-role bypasses RLS, so verify the caller belongs to the client.
  const [{ data: membership }, { data: owned }] = await Promise.all([
    supabase.from('client_users').select('client_id').eq('user_id', user.id).eq('client_id', reco.client_id).maybeSingle(),
    supabase.from('clients').select('id').eq('id', reco.client_id).eq('owner_user_id', user.id).maybeSingle(),
  ])
  if (!membership && !owned) return res.status(403).json({ error: 'Accès refusé' })

  if (action === 'dismiss') {
    await supabase.rpc('mark_ai_recommendation', { p_id: reco_id, p_status: 'dismissed' })
    return res.status(200).json({ ok: true, status: 'dismissed' })
  }

  if (reco.status !== 'pending') return res.status(409).json({ error: 'Déjà traitée' })
  const draft = reco.evidence || {}
  // The merchant may have edited the draft in the widget; use their values if present.
  const kbTitle = (typeof title === 'string' && title.trim()) ? title.trim() : draft.kb_title
  const kbContent = (typeof content === 'string' && content.trim()) ? content.trim() : draft.kb_content
  if (!kbTitle || !kbContent) return res.status(422).json({ error: 'Brouillon KB manquant' })

  const { error: kbError } = await supabase.from('client_knowledge_base').insert({
    client_id: reco.client_id,
    category: 'faq',
    title: kbTitle,
    content: kbContent,
    is_active: true,
    needs_review: false,
    source: 'improvement_loop',
  })
  if (kbError) return res.status(500).json({ error: kbError.message })

  await supabase.rpc('mark_ai_recommendation', { p_id: reco_id, p_status: 'implemented' })
  await supabase.from('automation_events').insert({
    client_id: reco.client_id,
    event_category: 'generic',
    event_type: 'kb_gap_applied',
    event_title: `Entrée ajoutée à la base : ${kbTitle}`,
    description: '[Boucle] suggestion appliquée en 1 clic',
    metadata: { reco_id, source: 'improvement_loop' },
  }).then(() => {}).catch(() => {})

  return res.status(200).json({ ok: true, status: 'implemented' })
}

export default withSentry(handler)
