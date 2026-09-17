import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { ficheDuCompte, ficheVisible } from '../lib/fiche-closer.js'
import { totauxParStatut } from '../lib/commissions-closer.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/**
 * GET /api/closer/moi — la fiche du closer connecté et ses totaux.
 *
 * 200 { fiche, totaux: { a_valider, validee, payee, refusee, annulee } } (centimes)
 * 401 sans session ; 404 si le compte n'a pas de fiche (le navigateur propose
 * alors « Devenir closer », et DashboardGate sait que ce n'est pas un closer).
 */
async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'methode_non_autorisee' })
  const appel = await ficheDuCompte(supabase, req, res)
  if (!appel) return
  const { closer } = appel

  const { data: commissions, error } = await supabase
    .from('closer_commissions').select('montant_centimes, statut').eq('closer_id', closer.id)
  if (error) return res.status(503).json({ error: 'indisponible', message: 'Espace momentanément indisponible. Réessayez.' })

  return res.status(200).json({ fiche: ficheVisible(closer), totaux: totauxParStatut(commissions) })
}

export default withSentry(handler)
