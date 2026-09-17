import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { ficheDuCompte } from '../lib/fiche-closer.js'
import { derniereNote } from '../lib/commissions-closer.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/**
 * GET /api/closer/commissions — les commissions du closer connecté, de la
 * plus récente à la plus ancienne.
 *
 * Le motif n'est montré que pour une commission refusée ou annulée : les
 * autres notes (saisie manuelle, remboursement après paiement) sont internes.
 */
async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'methode_non_autorisee' })
  const appel = await ficheDuCompte(supabase, req, res)
  if (!appel) return
  const { closer } = appel

  const { data: commissions, error } = await supabase
    .from('closer_commissions')
    .select('id, client_id, montant_centimes, plan, formule, type, statut, payee_par_client_le, note, created_at')
    .eq('closer_id', closer.id)
    .order('created_at', { ascending: false })
  if (error) return res.status(503).json({ error: 'indisponible', message: 'Espace momentanément indisponible. Réessayez.' })

  const ids = [...new Set((commissions || []).map((c) => c.client_id).filter(Boolean))]
  let boutiques = {}
  if (ids.length) {
    const { data: clients, error: erreurClients } = await supabase.from('clients').select('id, brand_name').in('id', ids)
    if (erreurClients) return res.status(503).json({ error: 'indisponible', message: 'Espace momentanément indisponible. Réessayez.' })
    boutiques = Object.fromEntries((clients || []).map((c) => [c.id, c.brand_name]))
  }

  return res.status(200).json({
    commissions: (commissions || []).map((c) => ({
      id: c.id,
      boutique: boutiques[c.client_id] ?? 'Client supprimé',
      montant_centimes: c.montant_centimes,
      plan: c.plan,
      formule: c.formule,
      type: c.type,
      statut: c.statut,
      paye_par_client_le: c.payee_par_client_le,
      cree_le: c.created_at,
      motif: ['refusee', 'annulee'].includes(c.statut) ? derniereNote(c.note) : null,
    })),
  })
}

export default withSentry(handler)
