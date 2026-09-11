/**
 * Le code de campagne, côté navigateur — le transporter, rien de plus.
 *
 * LE DÉFAUT QUE CE FICHIER CORRIGE
 *
 * Le 10 septembre 2026 : inscription par le lien de la publicité, connexion
 * avec Google, et sept jours d'essai au lieu de trente. Deux causes,
 * indépendantes, et il fallait les deux pour que ça marche.
 *
 *  1. La redirection vers Google **perd la chaîne de requête**. Le marchand
 *     part de `/signup?campagne=ONEMONTHFREE`, revient sur `/auth/callback`,
 *     et le code n'existe plus nulle part. Il faut donc l'avoir mémorisé
 *     AVANT de quitter le site.
 *  2. Le compte créé après OAuth ne passe par aucune route serveur : il est
 *     inséré depuis le navigateur. La route qui posait le drapeau n'était
 *     donc jamais appelée sur ce chemin.
 *
 * Ce module ne fait que la moitié navigateur : mémoriser, puis présenter le
 * code au serveur. **Il n'accorde rien.** C'est `api/lib/campagne.js` qui
 * décide, après confrontation à la liste des codes actifs — sans quoi
 * n'importe qui s'offrirait un mois en écrivant un cookie.
 */

const CLE = 'campaign_code'
// Assez long pour couvrir un aller-retour OAuth, une hésitation et un retour
// le lendemain ; assez court pour qu'un vieux code n'ouvre pas de droits des
// mois plus tard.
const DUREE_JOURS = 30

/**
 * Mémorise le code présent dans l'URL, s'il y en a un.
 * À appeler au chargement de l'application, avant toute redirection.
 */
export function memoriserCodeCampagne() {
  if (typeof window === 'undefined') return null
  try {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('campagne') || params.get('campaign_code')
    if (!code) return null
    const expire = new Date(Date.now() + DUREE_JOURS * 86400_000).toUTCString()
    document.cookie = `${CLE}=${encodeURIComponent(code)}; path=/; expires=${expire}; SameSite=Lax`
    return code
  } catch {
    return null
  }
}

/** Le code courant : l'URL d'abord, le cookie ensuite. */
export function codeCampagneCourant() {
  if (typeof window === 'undefined') return null
  try {
    const params = new URLSearchParams(window.location.search)
    const depuisUrl = params.get('campagne') || params.get('campaign_code')
    if (depuisUrl) return depuisUrl
    const trouve = document.cookie.match(/(?:^|;\s*)campaign_code=([^;]*)/)
    return trouve ? decodeURIComponent(trouve[1]) : null
  } catch {
    return null
  }
}

/**
 * Présente le code au serveur pour le compte qui vient d'être créé.
 *
 * Ne lève jamais : un échec ici ne doit pas empêcher un marchand d'entrer dans
 * son tableau de bord. Il perdrait son mois, ce qui se rattrape — pas son
 * inscription.
 */
export async function presenterCodeCampagne(supabase) {
  const code = codeCampagneCourant()
  if (!code) return false
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return false
    const res = await fetch('/api/auth/apply-campaign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ campaign_code: code }),
    })
    if (!res.ok) return false
    const data = await res.json()
    return !!data?.applique
  } catch {
    return false
  }
}
