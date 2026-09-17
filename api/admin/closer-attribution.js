import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../lib/admin-auth.js'
import { logAdminAction } from './_helpers.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const COLONNES_CLIENT = 'id, brand_name, contact_email, plan, status, closer_id, closer_source, closer_attribue_at'

/**
 * /api/admin/closer-attribution — rattacher, changer ou retirer le closer d'un client.
 *
 * GET   ?q=… → { clients, closers } : recherche par boutique ou e-mail de
 *       contact (20 résultats par champ), et la liste des closers
 * PATCH { client_id, closer_id | null } → { client }
 *
 * Décision d'Actero : les règles d'attribution du lien ne s'appliquent pas
 * ici (spec closers). C'est le recours pour un prospect inscrit depuis un
 * autre appareil, ou un marchand Shopify installé depuis l'App Store. Les
 * commissions déjà créées ne bougent pas ; les suivantes iront au nouveau
 * closer.
 */
async function handler(req, res) {
  const admin = await requireAdmin(req, res, supabase)
  if (!admin) return
  if (req.method === 'GET') return chercher(req, res)
  if (req.method === 'PATCH') return attribuer(req, res, admin)
  return res.status(405).json({ error: 'methode_non_autorisee' })
}

async function chercher(req, res) {
  // Jokers et séparateurs retirés : la saisie ne pilote pas la requête.
  const motif = String(req.query?.q ?? '').replace(/[%_\\,()*]/g, '').trim().slice(0, 80)
  const vide = { data: [], error: null }
  const [closersR, parBoutique, parEmail] = await Promise.all([
    supabase.from('closers').select('id, prenom, nom, code, statut').order('nom', { ascending: true }),
    motif.length >= 2 ? supabase.from('clients').select(COLONNES_CLIENT).ilike('brand_name', `%${motif}%`).limit(20) : vide,
    motif.length >= 2 ? supabase.from('clients').select(COLONNES_CLIENT).ilike('contact_email', `%${motif}%`).limit(20) : vide,
  ])
  const erreur = closersR.error || parBoutique.error || parEmail.error
  if (erreur) return res.status(503).json({ error: 'indisponible', message: erreur.message })

  const clients = new Map()
  for (const c of [...parBoutique.data, ...parEmail.data]) {
    clients.set(c.id, {
      id: c.id,
      boutique: c.brand_name,
      contact_email: c.contact_email,
      plan: c.plan,
      statut: c.status,
      closer_id: c.closer_id,
      source: c.closer_source,
      rattache_le: c.closer_attribue_at,
    })
  }
  return res.status(200).json({ clients: [...clients.values()], closers: closersR.data || [] })
}

async function attribuer(req, res, admin) {
  const { client_id: clientId, closer_id: closerId } = req.body || {}
  if (typeof clientId !== 'string' || !clientId) return res.status(400).json({ error: 'client_requis' })
  if (closerId !== null && (typeof closerId !== 'string' || !closerId)) {
    return res.status(400).json({ error: 'closer_requis', message: 'closer_id : un identifiant, ou null pour retirer le closer.' })
  }

  const { data: client, error } = await supabase.from('clients').select('id, closer_id').eq('id', clientId).maybeSingle()
  if (error) return res.status(503).json({ error: 'indisponible', message: error.message })
  if (!client) return res.status(404).json({ error: 'client_introuvable' })

  if (closerId) {
    const { data: closer, error: erreurCloser } = await supabase.from('closers').select('id').eq('id', closerId).maybeSingle()
    if (erreurCloser) return res.status(503).json({ error: 'indisponible', message: erreurCloser.message })
    if (!closer) return res.status(404).json({ error: 'closer_introuvable' })
  }

  const maj = closerId
    ? { closer_id: closerId, closer_attribue_at: new Date().toISOString(), closer_source: 'manuel' }
    : { closer_id: null, closer_attribue_at: null, closer_source: null }
  const { data: ecrites, error: erreurEcriture } = await supabase
    .from('clients').update(maj).eq('id', client.id).select('id, closer_id, closer_source, closer_attribue_at')
  if (erreurEcriture) return res.status(500).json({ error: 'erreur_interne', message: erreurEcriture.message })

  await logAdminAction(admin.id, admin.email, closerId ? 'closer_attribution' : 'closer_attribution_retiree', 'client', client.id, client.id, {
    avant: client.closer_id,
    apres: closerId,
  })
  return res.status(200).json({ client: ecrites?.[0] ?? null })
}

export default withSentry(handler)
