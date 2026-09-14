/**
 * Contrôle d'appartenance : cet utilisateur a-t-il le droit d'agir sur ce client ?
 *
 * Pourquoi ce fichier existe. Un motif s'est répété quatre fois dans la base :
 *
 *   const { data: { user } } = await supabase.auth.getUser(token)   // qui appelle
 *   const { client_id } = req.body                                  // sur qui
 *   await supabase.from(...).eq('client_id', client_id)             // sans lien
 *
 * Authentifier l'appelant ne dit rien de la cible. Et ces routes travaillent
 * avec la clé service_role, qui contourne RLS — il n'y a donc aucun filet
 * derrière : le contrôle manquant est la seule barrière.
 *
 * Constaté le 9 septembre 2026 sur `api/engine/gateway.js`, la fonction
 * Postgres `recompute_client_metrics`, et sept routes dont
 * `knowledge/import-url` et `knowledge/import-file` — ces deux-là INSÈRENT
 * dans `client_knowledge_base`, c'est-à-dire dans la source de vérité sur
 * laquelle l'agent fonde ses réponses aux clients du marchand.
 *
 * La vérification reproduit exactement les policies RLS de la base : membre
 * via `client_users`, OU propriétaire via `clients.owner_user_id`. Ne vérifier
 * qu'un seul des deux chemins fonctionne aujourd'hui par chance — deux clients
 * sur quatre n'ont pas d'`owner_user_id` — mais divergerait de la base à la
 * première évolution.
 */
import { isActeroAdmin } from './admin-auth.js'

/**
 * @returns {Promise<boolean>} true si l'utilisateur peut agir sur ce client.
 */
export async function userCanAccessClient(supabaseAdmin, user, clientId) {
  if (!user?.id || !clientId) return false

  // Les administrateurs Actero voient tout, par conception.
  try {
    if (await isActeroAdmin(user, supabaseAdmin)) return true
  } catch {
    // Un échec de la résolution admin ne doit pas ouvrir l'accès.
  }

  const [{ data: lien }, { data: possede }] = await Promise.all([
    supabaseAdmin
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .maybeSingle(),
    supabaseAdmin
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('owner_user_id', user.id)
      .maybeSingle(),
  ])

  return Boolean(lien || possede)
}

/**
 * Variante qui répond directement en 403.
 *
 * @returns {Promise<boolean>} true si la requête peut continuer. Quand elle
 *   renvoie false, la réponse HTTP a déjà été envoyée — l'appelant doit
 *   simplement sortir.
 */
export async function requireClientAccess(supabaseAdmin, { user, clientId, res }) {
  if (await userCanAccessClient(supabaseAdmin, user, clientId)) return true
  res.status(403).json({ error: 'Ce client ne vous appartient pas.' })
  return false
}
