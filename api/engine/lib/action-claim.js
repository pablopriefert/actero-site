/**
 * Réservation d'action : garantir qu'une action irréversible ne part qu'une fois.
 *
 * Le problème. `runExecutor` déroule un plan d'actions pour un événement. Si le
 * même événement est rejoué — retry de cron, webhook redélivré, job repris,
 * appel concurrent — le plan se redéroule, et une action irréversible part deux
 * fois. Concrètement : le client du marchand reçoit deux fois la même réponse.
 *
 * Le 9 septembre 2026, ce défaut a été trouvé sur le chemin email et corrigé
 * localement (contrôle en tête de webhooks/inbound-email.js + index unique sur
 * ai_conversations). Mais l'exécuteur, lui, restait sans protection : c'est le
 * point de passage commun de TOUS les chemins.
 *
 * Le principe. On RÉSERVE avant d'exécuter, pas après. L'unicité est garantie
 * par la base — `unique (event_id, action)` — donc deux exécutions simultanées
 * ne peuvent pas gagner toutes les deux : la seconde reçoit une violation
 * d'unicité et s'abstient. Un contrôle « est-ce que ça existe déjà ? » suivi
 * d'une insertion ne suffirait pas ; c'est précisément la fenêtre restée
 * ouverte sur le correctif email de ce matin.
 *
 * Seules les actions `external && !reversible` du registre sont protégées.
 * Réserver `log_metric` n'a aucun sens : la rejouer est sans conséquence, et
 * chaque réservation coûte deux requêtes.
 */
import { ACTIONS } from './action-registry.js'

/** Une action mérite-t-elle une réservation ? */
export function doitEtreReservee(action) {
  const d = ACTIONS[action]
  return Boolean(d && d.external && !d.reversible)
}

/**
 * Que faire face à une réservation déjà présente ?
 *
 * Isolé de la base pour être testable. Les quatre cas sont les seuls possibles
 * et chacun a une raison d'être :
 *
 *   absente   première exécution — on y va
 *   done      déjà partie — on s'abstient, c'est tout l'objet du mécanisme
 *   running   une autre exécution est en vol — on s'abstient plutôt que de
 *             risquer un double envoi ; si elle échoue, un retry ultérieur
 *             trouvera `failed` et reprendra
 *   failed    la tentative précédente n'a rien envoyé — réessayer est
 *             légitime, et l'interdire signifierait qu'un échec réseau perd
 *             définitivement la réponse au client
 *
 * @param {{status?: string}|null} existante
 * @returns {{autorise: boolean, raison: string}}
 */
export function peutExecuter(existante) {
  if (!existante) return { autorise: true, raison: 'premiere_execution' }
  switch (existante.status) {
    case 'done':
      return { autorise: false, raison: 'deja_executee' }
    case 'running':
      return { autorise: false, raison: 'execution_en_cours' }
    case 'failed':
      return { autorise: true, raison: 'nouvelle_tentative_apres_echec' }
    default:
      // Statut inconnu : on s'abstient. Sur une action irréversible, le doute
      // profite à l'inaction.
      return { autorise: false, raison: `statut_inconnu:${existante.status}` }
  }
}

/**
 * Réserve l'action, ou dit pourquoi elle ne doit pas partir.
 *
 * @returns {Promise<{autorise: boolean, raison: string, id?: string}>}
 */
export async function reserverAction(supabase, { clientId, eventId, action }) {
  // Sans identifiant d'événement, aucune réservation n'est possible. On laisse
  // passer plutôt que de bloquer l'exécuteur — mais on le dit, parce qu'une
  // protection silencieusement absente est pire qu'une protection absente.
  if (!eventId || eventId === 'test') {
    return { autorise: true, raison: 'sans_identifiant_devenement' }
  }

  const { data, error } = await supabase
    .from('engine_action_claims')
    .insert({ client_id: clientId, event_id: eventId, action, status: 'running' })
    .select('id')
    .single()

  if (!error) return { autorise: true, raison: 'premiere_execution', id: data.id }

  // 23505 = unique_violation : quelqu'un a réservé avant nous.
  if (error.code !== '23505') {
    // Une panne de la table de réservation ne doit pas empêcher le SAV de
    // fonctionner. On laisse passer, on trace.
    console.warn('[action-claim] réservation impossible:', error.message)
    return { autorise: true, raison: 'table_de_reservation_indisponible' }
  }

  const { data: existante } = await supabase
    .from('engine_action_claims')
    .select('id, status')
    .eq('event_id', eventId)
    .eq('action', action)
    .maybeSingle()

  const verdict = peutExecuter(existante)
  if (!verdict.autorise) return verdict

  // Reprise après échec : on remet en cours, en s'assurant que personne
  // d'autre ne l'a fait entre-temps.
  const { data: reprise } = await supabase
    .from('engine_action_claims')
    .update({ status: 'running', completed_at: null })
    .eq('id', existante.id)
    .eq('status', 'failed')
    .select('id')
    .maybeSingle()

  if (!reprise) return { autorise: false, raison: 'reprise_deja_prise' }
  return { ...verdict, id: reprise.id }
}

/** Clôt la réservation avec le résultat réel de l'action. */
export async function cloturerAction(supabase, { id, reussi, resultat, erreur }) {
  if (!id) return
  try {
    await supabase
      .from('engine_action_claims')
      .update({
        status: reussi ? 'done' : 'failed',
        result: resultat ? { resultat } : null,
        error: erreur || null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
  } catch (err) {
    // Si la clôture échoue après une action RÉUSSIE, la réservation reste en
    // `running` et un retry s'abstiendra. C'est le bon côté de l'erreur : on
    // préfère ne pas renvoyer que renvoyer deux fois.
    console.warn('[action-claim] clôture impossible:', err.message)
  }
}
