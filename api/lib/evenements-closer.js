import { TYPES_EVENEMENT } from './familles-evenements.js'

/**
 * Le fil d'activité des closers — l'écriture.
 * Spec : docs/superpowers/specs/2026-09-17-closers-fil-activite-design.md
 *
 * Trois règles :
 *   - une étape n'est écrite que pour un client rattaché à un closer (ou, pour
 *     une ouverture de lien, pour le closer du code) ;
 *   - seules quatre clés de détail passent (plan, formule, plateforme,
 *     partiel), avec des valeurs connues : jamais un montant ni une adresse.
 *     La base refuse d'ailleurs toute autre clé ;
 *   - cette fonction ne lève JAMAIS. Un fil incomplet se rattrape ; un
 *     paiement ou un webhook qui échoue à cause du fil, non.
 */

export const CLES_DETAILS = ['plan', 'formule', 'plateforme', 'partiel']

const VALEURS_PERMISES = {
  plan: ['free', 'starter', 'pro', 'enterprise'],
  formule: ['mensuel', 'trimestriel', 'annuel'],
  plateforme: ['stripe', 'shopify', 'woocommerce', 'webflow'],
}

/** Les détails réduits aux clés et aux valeurs permises. */
export function filtrerDetails(details) {
  const propres = {}
  if (!details || typeof details !== 'object' || Array.isArray(details)) return propres
  for (const [cle, valeurs] of Object.entries(VALEURS_PERMISES)) {
    if (valeurs.includes(details[cle])) propres[cle] = details[cle]
  }
  if (typeof details.partiel === 'boolean') propres.partiel = details.partiel
  return propres
}

/** Une date ISO, depuis une date, un texte ISO ou un horodatage Stripe (secondes). */
function dateIso(valeur) {
  if (valeur == null) return null
  const ms = typeof valeur === 'number' && valeur < 1e12 ? valeur * 1000 : valeur
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Écrit une étape du fil. Rend `{ enregistre: true }`, ou `{ enregistre: false,
 * raison }` avec `raison` parmi `type_inconnu`, `cle_manquante`, `sans_closer`,
 * `deja_enregistre` et `erreur`.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase client service_role
 * @param {{
 *   clientId?: string | null,
 *   closerId?: string | null,   si absent, lu sur le client
 *   visiteId?: string | null,
 *   type: string,
 *   details?: object,
 *   sourceKey: string,          unique : un doublon n'écrit rien
 *   survenuLe?: Date | string | number,
 * }} etape
 */
export async function enregistrerEvenementCloser(supabase, etape = {}) {
  const { clientId = null, closerId = null, visiteId = null, type, details, sourceKey, survenuLe } = etape
  try {
    if (!TYPES_EVENEMENT.includes(type)) return { enregistre: false, raison: 'type_inconnu' }
    if (!sourceKey) return { enregistre: false, raison: 'cle_manquante' }

    let closer = closerId
    if (!closer && clientId) {
      const { data, error } = await supabase.from('clients').select('closer_id').eq('id', clientId).maybeSingle()
      if (error) throw error
      closer = data?.closer_id || null
    }
    if (!closer) return { enregistre: false, raison: 'sans_closer' }

    const date = dateIso(survenuLe)
    const { error } = await supabase.from('closer_evenements').insert({
      closer_id: closer,
      client_id: clientId,
      visite_id: visiteId,
      type,
      details: filtrerDetails(details),
      source_key: String(sourceKey).slice(0, 300),
      ...(date ? { survenu_le: date } : {}),
    })
    if (error?.code === '23505') return { enregistre: false, raison: 'deja_enregistre' }
    if (error) throw error
    return { enregistre: true }
  } catch (err) {
    // Identifiants seulement : ni adresse, ni détail de paiement.
    console.warn('[CLOSER] fil d’activité non écrit', { type, client: clientId, erreur: err?.code || err?.name || 'erreur' })
    return { enregistre: false, raison: 'erreur' }
  }
}
