import { normaliserCodeCloser } from './code-closer.js'

/**
 * Qui rattache un client à un closer, et quand c'est refusé.
 *
 * Spec : docs/superpowers/specs/2026-09-14-closers-espace-commissions-design.md,
 * « Règles d'attribution ». Elles ne s'appliquent qu'au lien du closer ; la
 * correction manuelle de l'admin (api/admin/closer-attribution.js) s'en passe,
 * c'est une décision d'Actero.
 */

/** Plans payants : un client sur l'un d'eux, actif, « paie déjà ». */
export const PLANS_PAYANTS = Object.freeze(['starter', 'pro', 'enterprise'])

/** Statuts de `clients` qui veulent dire « n'est plus client » (contrainte clients_status_check). */
const STATUTS_TERMINES = Object.freeze(['inactive', 'canceled', 'uninstalled', 'redacted', 'pending_deletion'])

/** Le client paie-t-il déjà ? Alors un lien ne peut plus le rattacher. */
export function clientPayant(client) {
  return PLANS_PAYANTS.includes(client?.plan) && client?.status === 'active'
}

/** Ce qu'un closer voit de l'état d'un client : actif, inscrit (pas encore abonné) ou résilié. */
export function etatClient(client) {
  if (STATUTS_TERMINES.includes(client?.status)) return 'resilie'
  if (PLANS_PAYANTS.includes(client?.plan)) return 'actif'
  return 'inscrit'
}

/**
 * La décision, sans rien lire ni écrire.
 *
 * @param {{ closer: { id: string, statut: string } | null, client: object | null, estMembre: boolean }} p
 * @returns {{ rattacher: true } | { rattacher: false, raison: string }}
 */
export function decisionAttribution({ closer, client, estMembre }) {
  if (typeof estMembre !== 'boolean') {
    // « Je ne sais pas » ne vaut pas « n'est pas membre » : ce serait une
    // auto-attribution sur une lecture ratée.
    throw new TypeError('decisionAttribution : estMembre doit être connu (true ou false)')
  }
  if (!closer) return { rattacher: false, raison: 'code_inconnu' }
  if (closer.statut !== 'actif') return { rattacher: false, raison: 'closer_suspendu' }
  if (!client) return { rattacher: false, raison: 'client_introuvable' }
  // Le premier closer gagne : un client rattaché ne change pas de closer par un lien.
  if (client.closer_id) return { rattacher: false, raison: client.closer_id === closer.id ? 'deja_rattache_a_ce_closer' : 'deja_rattache' }
  // Sinon un closer pourrait s'attribuer un client existant.
  if (clientPayant(client)) return { rattacher: false, raison: 'client_payant' }
  // Pas d'auto-attribution : le closer est propriétaire ou membre de ce client.
  if (estMembre) return { rattacher: false, raison: 'auto_attribution' }
  return { rattacher: true }
}

/**
 * Lit ce qu'il faut, décide, et rattache.
 *
 * L'écriture ne touche la ligne que si elle est encore sans closer : deux
 * présentations simultanées de deux codes ne peuvent pas gagner toutes les deux.
 * Une lecture en échec lève : la route répond 500, et le navigateur garde le
 * code pour une prochaine fois.
 *
 * @returns {Promise<{ rattache: true, closerId: string } | { rattache: false, raison: string }>}
 */
export async function rattacherCloser(supabase, { clientId, code, maintenant = new Date() }) {
  const codeNormalise = normaliserCodeCloser(code)
  if (!codeNormalise) return { rattache: false, raison: 'code_inconnu' }

  const { data: closer, error: erreurCloser } = await supabase
    .from('closers').select('id, user_id, statut').eq('code', codeNormalise).maybeSingle()
  if (erreurCloser) throw new Error(`closers illisible : ${erreurCloser.message}`)

  const { data: client, error: erreurClient } = await supabase
    .from('clients').select('id, plan, status, closer_id, owner_user_id').eq('id', clientId).maybeSingle()
  if (erreurClient) throw new Error(`clients illisible : ${erreurClient.message}`)

  let estMembre = false
  if (closer && client) {
    if (client.owner_user_id === closer.user_id) {
      estMembre = true
    } else {
      const { data: lien, error: erreurLien } = await supabase
        .from('client_users').select('client_id').eq('client_id', client.id).eq('user_id', closer.user_id).maybeSingle()
      if (erreurLien) throw new Error(`client_users illisible : ${erreurLien.message}`)
      estMembre = !!lien
    }
  }

  const decision = decisionAttribution({ closer, client, estMembre })
  if (!decision.rattacher) return { rattache: false, raison: decision.raison }

  const { data: ecrites, error: erreurEcriture } = await supabase
    .from('clients')
    .update({ closer_id: closer.id, closer_attribue_at: maintenant.toISOString(), closer_source: 'lien' })
    .eq('id', client.id)
    .is('closer_id', null)
    .select('id')
  if (erreurEcriture) throw new Error(`rattachement impossible : ${erreurEcriture.message}`)
  if (!ecrites?.length) return { rattache: false, raison: 'deja_rattache' }
  return { rattache: true, closerId: closer.id }
}
