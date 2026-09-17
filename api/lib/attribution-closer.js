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

/**
 * Âge maximal, en jours, d'une boutique qu'un lien peut rattacher.
 *
 * Aligné sur la durée du cookie du lien (DUREE_ATTRIBUTION_JOURS,
 * src/lib/code-closer.js) : un prospect est rattaché s'il s'inscrit dans les
 * 60 jours qui suivent son clic, donc une boutique plus ancienne n'est pas née
 * de ce clic. Un test vérifie que les deux valeurs restent égales.
 */
export const ANCIENNETE_MAX_CLIENT_JOURS = 60
const JOUR_MS = 24 * 60 * 60 * 1000

/** Les colonnes de `clients` que la règle lit. */
export const COLONNES_CLIENT_ATTRIBUTION = [
  'id', 'plan', 'status', 'closer_id', 'owner_user_id', 'created_at',
  'payment_received_at', 'stripe_subscription_id', 'shopify_subscription_id', 'billing_provider',
].join(', ')

/** Le client paie-t-il en ce moment ? Un plan payant, sur un compte actif. */
export function clientPayant(client) {
  return PLANS_PAYANTS.includes(client?.plan) && client?.status === 'active'
}

/**
 * Le client a-t-il DÉJÀ payé ? Alors un lien ne peut plus le rattacher : un
 * closer ne s'attribue pas un client qui existait avant lui.
 *
 * - un paiement reçu (`payment_received_at`) ;
 * - un plan payant actif (`clientPayant`) ;
 * - un abonnement accordé, en cours ou passé : `stripe_subscription_id` et
 *   `shopify_subscription_id` pendant l'abonnement, puis `billing_provider`,
 *   que la résiliation n'efface pas (elle remet le plan à Free — voir
 *   api/lib/essai-gratuit.js, qui s'appuie sur les mêmes traces).
 *
 * PAS `stripe_customer_id` seul, ni `pending_shopify_subscription_id` : le
 * code est présenté juste avant le paiement, parfois après une tentative
 * abandonnée, quand le client Stripe existe déjà sans que rien soit payé.
 */
export function aDejaPaye(client) {
  if (!client) return false
  if (client.payment_received_at || clientPayant(client)) return true
  return Boolean(client.stripe_subscription_id || client.shopify_subscription_id || client.billing_provider)
}

/**
 * `clients.created_at` est un `timestamp` SANS fuseau, écrit en UTC par la
 * base : PostgREST le rend sans « Z », et JavaScript lirait alors une heure
 * locale. Rend null pour une valeur absente ou illisible.
 */
function dateUtc(valeur) {
  if (!valeur) return null
  const texte = String(valeur).trim()
  const avecFuseau = /(?:z|[+-]\d{2}(?::?\d{2})?)$/i.test(texte) ? texte : `${texte}Z`
  const date = new Date(avecFuseau)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Le client a-t-il été créé il y a au plus 60 jours ? Une date inconnue ne vaut pas « récent ». */
export function clientRecent(client, maintenant = new Date()) {
  const creeLe = dateUtc(client?.created_at)
  if (!creeLe) return false
  return maintenant.getTime() - creeLe.getTime() <= ANCIENNETE_MAX_CLIENT_JOURS * JOUR_MS
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
 * Raisons de refus (toutes définitives ; la route ne les dit pas) :
 * code_inconnu, closer_suspendu, client_introuvable, non_proprietaire,
 * deja_rattache, deja_rattache_a_ce_closer, client_payant,
 * client_trop_ancien, auto_attribution.
 *
 * @param {{ closer: { id: string, statut: string } | null, client: object | null,
 *           estMembre: boolean, estProprietaire: boolean, maintenant?: Date }} p
 *   estMembre        le CLOSER est propriétaire ou membre de ce client
 *   estProprietaire  l'APPELANT est propriétaire de ce client
 * @returns {{ rattacher: true } | { rattacher: false, raison: string }}
 */
export function decisionAttribution({ closer, client, estMembre, estProprietaire, maintenant = new Date() }) {
  if (typeof estMembre !== 'boolean') {
    // « Je ne sais pas » ne vaut pas « n'est pas membre » : ce serait une
    // auto-attribution sur une lecture ratée.
    throw new TypeError('decisionAttribution : estMembre doit être connu (true ou false)')
  }
  if (typeof estProprietaire !== 'boolean') {
    // Même raison : « je ne sais pas » ne vaut pas « c'est le propriétaire ».
    throw new TypeError('decisionAttribution : estProprietaire doit être connu (true ou false)')
  }
  if (!closer) return { rattacher: false, raison: 'code_inconnu' }
  if (closer.statut !== 'actif') return { rattacher: false, raison: 'closer_suspendu' }
  if (!client) return { rattacher: false, raison: 'client_introuvable' }
  // Seul le propriétaire engage sa boutique : un membre de l'équipe ne la
  // rattache pas à un closer.
  if (!estProprietaire) return { rattacher: false, raison: 'non_proprietaire' }
  // Le premier closer gagne : un client rattaché ne change pas de closer par un lien.
  if (client.closer_id) return { rattacher: false, raison: client.closer_id === closer.id ? 'deja_rattache_a_ce_closer' : 'deja_rattache' }
  // Sinon un closer pourrait s'attribuer un client existant.
  if (aDejaPaye(client)) return { rattacher: false, raison: 'client_payant' }
  // Une boutique plus ancienne que le cookie du lien n'est pas née de ce lien.
  if (!clientRecent(client, maintenant)) return { rattacher: false, raison: 'client_trop_ancien' }
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
 * @param {{ clientId: string, userId: string, code: string, maintenant?: Date }} p
 *   userId  l'appelant, qui doit être propriétaire du client
 * @returns {Promise<{ rattache: true, closerId: string } | { rattache: false, raison: string }>}
 */
export async function rattacherCloser(supabase, { clientId, userId, code, maintenant = new Date() }) {
  if (!userId) {
    // Sans appelant, aucun propriétaire à vérifier : on lève plutôt que de rattacher.
    throw new TypeError('rattacherCloser : userId (l’appelant) est requis')
  }
  const codeNormalise = normaliserCodeCloser(code)
  if (!codeNormalise) return { rattache: false, raison: 'code_inconnu' }

  const { data: closer, error: erreurCloser } = await supabase
    .from('closers').select('id, user_id, statut').eq('code', codeNormalise).maybeSingle()
  if (erreurCloser) throw new Error(`closers illisible : ${erreurCloser.message}`)

  const { data: client, error: erreurClient } = await supabase
    .from('clients').select(COLONNES_CLIENT_ATTRIBUTION).eq('id', clientId).maybeSingle()
  if (erreurClient) throw new Error(`clients illisible : ${erreurClient.message}`)

  // Propriétaire : `owner_user_id`, ou le rôle `owner` dans client_users.
  let estProprietaire = false
  if (client) {
    if (client.owner_user_id === userId) {
      estProprietaire = true
    } else {
      const { data: role, error: erreurRole } = await supabase
        .from('client_users').select('client_id').eq('client_id', client.id).eq('user_id', userId).eq('role', 'owner').maybeSingle()
      if (erreurRole) throw new Error(`client_users illisible : ${erreurRole.message}`)
      estProprietaire = !!role
    }
  }

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

  const decision = decisionAttribution({ closer, client, estMembre, estProprietaire, maintenant })
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
