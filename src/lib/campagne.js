/**
 * Le code de campagne, côté navigateur — le transporter, puis le DÉPENSER.
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
 * LE DÉFAUT DU 11 SEPTEMBRE — LE MÊME, RETOURNÉ
 *
 * On avait garanti que le code SURVIVE. On n'avait rien dit sur le moment où
 * il devait être DÉPENSÉ. Résultat : il survivait à tout.
 *
 *  · le cookie durait trente jours et n'était **jamais effacé**, même une fois
 *    le mois accordé. Chaque nouveau compte créé dans ce navigateur pendant
 *    trente jours repartait avec un mois offert, **sans aucun paramètre dans
 *    l'URL** ;
 *  · pire, il se renouvelait tout seul. Le retour de Google redirigeait vers
 *    `/signup/plan?campagne=<code>`, `memoriserCodeCampagne()` tourne à chaque
 *    chargement, et repoussait l'expiration de trente jours. Un marchand actif
 *    ne perdait jamais son code.
 *
 * Une seule visite au lien de la publicité armait donc le navigateur pour de
 * bon. C'est ce que Pablo a constaté : « même si je passe pas par le lien,
 * j'ai quand même le mois gratuit ».
 *
 * Vingt-trois tests gardaient l'essai gratuit. Aucun ne demandait que le code
 * soit consommé — celui qui s'en approchait le plus, « le code survit à
 * l'aller-retour vers Google », exigeait exactement le contraire.
 *
 * LA RÈGLE MAINTENANT
 *
 * Le code est un jeton à usage unique. Il est écrit une fois, présenté une
 * fois, et effacé dès que le serveur a TRANCHÉ — qu'il ait accordé le mois ou
 * refusé le code. Un échec réseau ou une erreur serveur ne le consomme pas :
 * rien n'a été tranché, le marchand n'a pas à payer notre panne.
 *
 * CE QU'ON NE FAIT JAMAIS
 *
 * Le drapeau n'est jamais posé par le navigateur. Ce module ne fait que
 * TRANSPORTER le code ; c'est `api/lib/campagne.js`, côté serveur, qui décide
 * après confrontation à `CAMPAIGN_TRIAL_CODES`.
 */

const CLE = 'campaign_code'
// Assez long pour couvrir un aller-retour OAuth, une hésitation et un retour
// le lendemain ; assez court pour qu'un vieux code n'ouvre pas de droits des
// mois plus tard. Ce délai n'est plus la seule protection : le code est
// maintenant dépensé dès qu'il sert.
const DUREE_JOURS = 30

function cookieExistant() {
  const trouve = document.cookie.match(/(?:^|;\s*)campaign_code=([^;]*)/)
  return trouve ? decodeURIComponent(trouve[1]) : null
}

/**
 * Mémorise le code présent dans l'URL, s'il y en a un.
 * À appeler au chargement de l'application, avant toute redirection.
 *
 * N'écrit QUE si aucun code n'est déjà mémorisé. Sans cette condition le
 * cookie se renouvelle indéfiniment : il suffit qu'une page de notre propre
 * parcours remette le code dans l'URL pour repousser l'expiration de trente
 * jours à chaque chargement.
 */
export function memoriserCodeCampagne() {
  if (typeof window === 'undefined') return null
  try {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('campagne') || params.get('campaign_code')
    if (!code) return null
    const deja = cookieExistant()
    if (deja) return deja
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
    return cookieExistant()
  } catch {
    return null
  }
}

/**
 * Efface le code mémorisé. Appelé dès que le serveur a tranché : le jeton est
 * à usage unique, et ce qui reste en mémoire finit toujours par resservir.
 */
export function oublierCodeCampagne() {
  if (typeof window === 'undefined') return
  try {
    document.cookie = `${CLE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`
  } catch {
    /* un cookie qu'on ne peut pas effacer expirera de lui-même */
  }
}

/**
 * Ce que le serveur a répondu pendant cette vie de page.
 *
 * `AuthCallbackPage` appelle `resolveOrCreateClientId` (qui présente déjà le
 * code) PUIS `presenterCodeCampagne` pour connaître l'issue. Sans mémoire, le
 * second appel ne trouverait plus rien — le premier vient d'effacer le code —
 * et renverrait `false` pour un mois pourtant accordé : le marchand
 * atterrirait au tableau de bord au lieu de la page des formules.
 */
let adjuge = null

/** Remet la mémoire à zéro. Réservé aux tests. */
export function reinitialiserAdjudication() {
  adjuge = null
}

/**
 * Présente le code au serveur pour le compte qui vient d'être créé.
 *
 * Ne lève jamais : un échec ici ne doit pas empêcher un marchand d'entrer dans
 * son tableau de bord. Il perdrait son mois, ce qui se rattrape — pas son
 * inscription.
 */
export async function presenterCodeCampagne(supabase) {
  if (adjuge !== null) return adjuge
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
    // 200 = le serveur a tranché, dans un sens ou dans l'autre : accordé, ou
    // refusé parce que le code est inconnu ou l'essai déjà consommé. Dans les
    // deux cas le jeton a servi.
    //
    // Tout le reste — 404 « client introuvable » quand la création de compte
    // n'est pas encore visible, 5xx, coupure réseau — ne tranche rien. On
    // garde le code : c'est notre panne, pas la sienne.
    if (res.status !== 200) return false
    const data = await res.json()
    adjuge = !!data?.applique
    oublierCodeCampagne()
    return adjuge
  } catch {
    return false
  }
}
