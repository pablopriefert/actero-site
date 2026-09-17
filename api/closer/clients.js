import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { ficheDuCompte } from '../lib/fiche-closer.js'
import { etatClient } from '../lib/attribution-closer.js'
import { periodeDepuisApi } from '../lib/formules.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/**
 * GET /api/closer/clients — les clients rattachés au closer connecté.
 *
 * Boutique, plan, formule, date de rattachement, état. Ni coordonnées ni
 * chiffre d'affaires : la sélection de colonnes ci-dessous est la liste
 * complète de ce qu'un closer peut savoir d'un client.
 */
async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'methode_non_autorisee' })
  const appel = await ficheDuCompte(supabase, req, res)
  if (!appel) return
  const { closer } = appel

  const { data, error } = await supabase
    .from('clients')
    .select('id, brand_name, plan, billing_period, status, closer_attribue_at')
    .eq('closer_id', closer.id)
    .order('closer_attribue_at', { ascending: false })
  if (error) return res.status(503).json({ error: 'indisponible', message: 'Espace momentanément indisponible. Réessayez.' })

  return res.status(200).json({
    clients: (data || []).map((c) => ({
      id: c.id,
      boutique: c.brand_name,
      plan: c.plan,
      formule: periodeDepuisApi(c.billing_period),
      rattache_le: c.closer_attribue_at,
      etat: etatClient(c),
    })),
  })
}

export default withSentry(handler)
