/**
 * Purge des comptes dont le délai de grâce est écoulé — ACT-25.
 *
 * La suppression d'un compte se fait en deux temps. À la demande, le client est
 * marqué et son agent coupé : le marchand constate immédiatement l'effet. La
 * destruction, elle, attend le délai de grâce, parce qu'elle est irréversible
 * et qu'aucune sauvegarde restaurable n'existe encore (ACT-14).
 *
 * Ce cron est le second temps. Pour chaque client dont le délai est écoulé :
 * révoquer les accès chez les fournisseurs, puis effacer.
 *
 * L'ordre est le même que dans l'action admin, et pour la même raison : une
 * fois la ligne supprimée, on n'a plus les jetons pour révoquer.
 */
import { createClient } from '@supabase/supabase-js'
import { withCronMonitor } from '../lib/cron-monitor.js'
import { revokeClientAccess } from '../lib/revoke-integrations.js'

export const maxDuration = 60

// 14 jours : le RGPD laisse un mois pour répondre, ce qui garde deux semaines
// de marge après la purge pour confirmer au demandeur.
const DELAI_JOURS = Number(process.env.DELAI_GRACE_SUPPRESSION_JOURS || 14)

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function handler(req, res) {
  const limite = new Date(Date.now() - DELAI_JOURS * 24 * 60 * 60 * 1000).toISOString()

  const { data: aPurger, error } = await supabase
    .from('clients')
    .select('id, brand_name, deletion_requested_at')
    .not('deletion_requested_at', 'is', null)
    .lte('deletion_requested_at', limite)

  if (error) {
    console.error('[purge-deleted-clients] lecture impossible:', error.message)
    return res.status(500).json({ error: error.message })
  }

  if (!aPurger?.length) {
    return res.status(200).json({ ok: true, purges: 0, delai_jours: DELAI_JOURS })
  }

  const resultats = []
  for (const client of aPurger) {
    try {
      // Révoquer d'abord : après la suppression, les jetons n'existent plus.
      const revocations = await revokeClientAccess(supabase, client.id)

      const { data: etapes, error: errSuppr } = await supabase
        .rpc('delete_client_data', { p_client_id: client.id })
      if (errSuppr) throw new Error(errSuppr.message)

      const aFinirALaMain = revocations.filter((r) => r.resultat !== 'revoque')
      if (aFinirALaMain.length) {
        // Bruyant volontairement : ces autorisations restent actives chez le
        // fournisseur et personne ne le saura autrement — le client, lui,
        // n'existe plus pour venir le rappeler.
        console.error(
          `[purge-deleted-clients] ${client.brand_name} : ${aFinirALaMain.length} accès à révoquer à la main — `
          + aFinirALaMain.map((r) => `${r.fournisseur} (${r.resultat})`).join(', '),
        )
      }

      resultats.push({
        client: client.brand_name,
        demande_le: client.deletion_requested_at,
        etapes,
        a_finir_a_la_main: aFinirALaMain,
      })
    } catch (err) {
      // Un client qui échoue ne doit pas empêcher les suivants.
      console.error(`[purge-deleted-clients] ${client.brand_name} a échoué:`, err.message)
      resultats.push({ client: client.brand_name, erreur: err.message })
    }
  }

  return res.status(200).json({
    ok: true,
    purges: resultats.filter((r) => !r.erreur).length,
    echecs: resultats.filter((r) => r.erreur).length,
    delai_jours: DELAI_JOURS,
    resultats,
  })
}

export default withCronMonitor('cron-purge-deleted-clients', '0 4 * * *', handler)
