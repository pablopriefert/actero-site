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

/**
 * Durée de vie de l'intention. Un aller-retour Google prend quelques minutes ;
 * au-delà, l'intention vient d'un départ abandonné (retour arrière depuis la
 * page de Google) et ne doit pas détourner la connexion Google suivante d'un
 * marchand vers l'espace closer.
 */
const DUREE_INTENTION_MS = 15 * 60 * 1000

export function memoriserIntentionGoogle(intention) {
  try {
    sessionStorage.setItem(CLE_INTENTION_GOOGLE, JSON.stringify({ intention, le: Date.now() }))
  } catch {
    // navigation privée : le retour mènera à l'espace, qui proposera « Devenir closer »
  }
}

/** Part vers Google ; le retour se fait sur /closer/callback, jamais sur /auth/callback. */
export async function connexionGoogleCloser(intention) {
  memoriserIntentionGoogle(intention)
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/closer/callback` },
  })
  if (error) {
    oublierIntentionGoogle()
    throw error
  }
}

/** « inscription », « connexion », ou null (rien de posé, ou posé il y a trop longtemps). */
export function lireIntentionGoogle() {
  try {
    const brut = JSON.parse(sessionStorage.getItem(CLE_INTENTION_GOOGLE) || 'null')
    if (!brut?.intention || Date.now() - (brut.le || 0) > DUREE_INTENTION_MS) return null
    return brut.intention
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

/**
 * La fin d'un retour Google closer, quelle que soit la page où il arrive :
 * crée la fiche après une inscription, oublie l'intention, et rend la page où
 * aller. Ne crée jamais de client marchand, et ne lève jamais.
 */
export async function terminerRetourGoogleCloser() {
  if (lireIntentionGoogle() === 'inscription') {
    try {
      await appelCloser('devenir-closer', { methode: 'POST', corps: {} })
    } catch {
      // L'espace proposera « Devenir closer » : rien n'est perdu.
    }
  }
  oublierIntentionGoogle()
  return '/closer'
}
