import { supabase } from './supabase'

/**
 * L'espace closer parle au serveur, et seulement à lui.
 *
 * Aucune table du programme closers n'est lisible depuis le navigateur (RLS
 * sans politique) : toutes les lectures et écritures passent par /api/closer/*,
 * qui retrouvent la fiche par le jeton de session.
 */

/** Intention du retour Google (« inscription » ou « connexion »), gardée le temps de l'aller-retour. */
export const CLE_INTENTION_GOOGLE = 'actero_closer_intention'

/**
 * Appelle /api/closer/<chemin> avec le jeton de la session, s'il y en a une.
 * Lève une erreur portant `status`, `code` et le message du serveur.
 */
export async function appelCloser(chemin, { methode = 'GET', corps } = {}) {
  const { data } = await supabase.auth.getSession()
  const jeton = data?.session?.access_token
  const res = await fetch(`/api/closer/${chemin}`, {
    method: methode,
    headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
    ...(corps ? { body: JSON.stringify(corps) } : {}),
  })
  // Une réponse qui n'est pas du JSON (page HTML d'un serveur sans les
  // fonctions, proxy en panne) est une erreur, même avec un statut 200.
  const donnees = await res.json().catch(() => null)
  if (!res.ok || donnees === null) {
    const erreur = new Error(donnees?.message || 'Une erreur est survenue. Réessayez.')
    erreur.status = res.ok ? 502 : res.status
    erreur.code = donnees?.error
    throw erreur
  }
  return donnees
}

/** Part vers Google ; le retour se fait sur /closer/callback, jamais sur /auth/callback. */
export async function connexionGoogleCloser(intention) {
  try {
    sessionStorage.setItem(CLE_INTENTION_GOOGLE, intention)
  } catch {
    // navigation privée : le retour mènera à l'espace, qui proposera « Devenir closer »
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/closer/callback` },
  })
  if (error) throw error
}

export function lireIntentionGoogle() {
  try {
    return sessionStorage.getItem(CLE_INTENTION_GOOGLE)
  } catch {
    return null
  }
}

export function oublierIntentionGoogle() {
  try {
    sessionStorage.removeItem(CLE_INTENTION_GOOGLE)
  } catch {
    // rien à oublier
  }
}
