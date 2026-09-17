import { PERIODES } from '../../api/lib/formules.js'

/**
 * Le code closer, côté navigateur — le transporter, puis le DÉPENSER.
 *
 * Même mécanique que le code de campagne (src/lib/campagne.js, et ses deux
 * défauts des 10 et 11 septembre 2026) : mémorisé au passage sur le lien du
 * closer (/c/:code), présenté au serveur une fois le compte marchand créé,
 * oublié dès que le serveur a tranché. Le navigateur ne rattache rien : il
 * transporte le code, et api/closer/attribuer.js applique les règles.
 *
 * Aucun import de ./supabase ici : resolve-client.js importe ce fichier, et
 * ses tests tournent hors navigateur.
 */

/**
 * Durée de l'attribution (décision 8 de la spec, confirmée par Pablo le
 * 16 septembre 2026) : un prospect qui s'inscrit dans les 60 jours après avoir
 * cliqué le lien d'un closer lui est rattaché. La seule valeur à changer pour
 * allonger ou raccourcir la fenêtre.
 */
export const DUREE_ATTRIBUTION_JOURS = 60

const CLE = 'closer_code'

/** Même format que api/lib/code-closer.js et que la contrainte SQL. */
export const FORMAT_CODE_CLOSER = /^ACT-[A-Z0-9]{5}$/

const PLANS_DU_LIEN = ['starter', 'pro']

function cookieExistant() {
  const trouve = document.cookie.match(/(?:^|;\s*)closer_code=([^;]*)/)
  return trouve ? decodeURIComponent(trouve[1]) : null
}

/**
 * Attributs communs à l'écriture et à l'effacement. `Secure` sur une page
 * https : le code ne voyage jamais en clair. Pas en http (développement
 * local), où le navigateur refuserait le cookie.
 */
function attributsCookie() {
  const https = window.location?.protocol === 'https:'
  return `path=/; SameSite=Lax${https ? '; Secure' : ''}`
}

/**
 * Mémorise le code du lien. Le premier lien cliqué gagne, comme le premier
 * closer gagne côté serveur ; et un second passage ne repousse pas
 * l'expiration (le défaut du 11 septembre sur le code de campagne).
 *
 * @returns {string|null} le code désormais mémorisé
 */
export function memoriserCodeCloser(brut) {
  if (typeof window === 'undefined') return null
  try {
    const deja = cookieExistant()
    if (deja) return deja
    const code = typeof brut === 'string' ? brut.trim().toUpperCase() : ''
    if (!FORMAT_CODE_CLOSER.test(code)) return null
    const expire = new Date(Date.now() + DUREE_ATTRIBUTION_JOURS * 86_400_000).toUTCString()
    document.cookie = `${CLE}=${encodeURIComponent(code)}; expires=${expire}; ${attributsCookie()}`
    return code
  } catch {
    return null
  }
}

/** Le code mémorisé, ou null. */
export function codeCloserCourant() {
  if (typeof window === 'undefined') return null
  try {
    return cookieExistant()
  } catch {
    return null
  }
}

/** Efface le code : le serveur a tranché, il ne doit plus resservir. */
export function oublierCodeCloser() {
  if (typeof window === 'undefined') return
  try {
    document.cookie = `${CLE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${attributsCookie()}`
  } catch {
    // un cookie qu'on ne peut pas effacer expirera de lui-même
  }
}

/**
 * La réponse de api/closer/attribuer.js a-t-elle tranché, pour de bon ?
 *
 *   200       oui : rattaché, ou refus définitif — code inconnu, client déjà
 *             rattaché, client payant (ou qui a déjà payé), auto-rattachement,
 *             client trop ancien, non-propriétaire. Le serveur ne dit pas
 *             lequel, exprès.
 *   autre 4xx oui : la requête est refusée telle quelle (400 code_requis) ;
 *             la représenter n'y changerait rien.
 *   401, 404, 408, 429, 5xx
 *             non, erreur passagère : session à rafraîchir, boutique pas
 *             encore visible juste après l'inscription, surcharge, panne.
 *             Une coupure réseau non plus (voir presenterCodeCloser).
 */
export function reponseTranchee(status) {
  if (status === 200) return true
  if ([401, 404, 408, 429].includes(status)) return false
  return status >= 400 && status < 500
}

/** Ce que le serveur a répondu pendant cette vie de page (voir campagne.js). */
let adjuge = null

/** Remet la mémoire à zéro. Réservé aux tests. */
export function reinitialiserAdjudicationCloser() {
  adjuge = null
}

/**
 * Présente le code au serveur pour le compte marchand connecté.
 *
 * Ne lève jamais : un échec ici n'empêche pas un marchand d'entrer. Rend
 * `true` si le client vient d'être rattaché.
 */
export async function presenterCodeCloser(supabase) {
  if (adjuge !== null) return adjuge
  const code = codeCloserCourant()
  if (!code) return false
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return false
    const res = await fetch('/api/closer/attribuer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ code }),
    })
    // Tranché (voir reponseTranchee) : le code a servi, on l'oublie. Sinon
    // — erreur passagère ou coupure — on le garde pour la prochaine fois.
    if (!reponseTranchee(res.status)) return false
    const data = res.status === 200 ? await res.json() : null
    adjuge = !!data?.rattache
    oublierCodeCloser()
    return adjuge
  } catch {
    return false
  }
}

/**
 * Le compte connecté a-t-il une fiche closer ? Réponse de GET /api/closer/moi :
 *
 *   true   seulement un corps JSON qui porte la fiche ;
 *   false  seulement le 404 `pas_de_fiche` de api/lib/fiche-closer.js ;
 *   null   on ne sait pas : pas de jeton, réponse qui n'est pas du JSON (une
 *          page HTML servie à la place de la route), autre statut, coupure.
 *
 * Le statut seul ne suffit pas : un 200 ou un 404 venu d'ailleurs que la
 * route aurait classé un compte à tort.
 */
export async function estCompteCloser(jeton) {
  if (!jeton) return null
  try {
    const res = await fetch('/api/closer/moi', { headers: { Authorization: `Bearer ${jeton}` } })
    if (res?.status !== 200 && res?.status !== 404) return null
    const corps = await res.json().catch(() => null)
    if (res.status === 200) return corps?.fiche && typeof corps.fiche === 'object' ? true : null
    return corps?.error === 'pas_de_fiche' ? false : null
  } catch {
    return null
  }
}

/** Le plan et la formule convenus, lus dans le lien du closer (`?plan=&formule=`), ou null. */
export function formuleDuLien(params) {
  const plan = params?.get?.('plan')
  const periode = params?.get?.('formule')
  return PLANS_DU_LIEN.includes(plan) && PERIODES.includes(periode) ? { plan, periode } : null
}

/** Où mène le lien : l'inscription marchand, plan et formule présélectionnés s'il y en a. */
export function destinationDuLien(formule) {
  return formule ? `/signup?plan=${formule.plan}&formule=${formule.periode}` : '/signup'
}

/**
 * Où envoyer un prospect qui vient d'être rattaché avec une formule convenue :
 * la page des plans, formule présélectionnée. Sinon null (destination habituelle).
 */
export function destinationApresRattachement(rattache, formule) {
  if (rattache !== true || !PLANS_DU_LIEN.includes(formule?.plan) || !PERIODES.includes(formule?.periode)) return null
  return `/signup/plan?plan=${formule.plan}&formule=${formule.periode}`
}
