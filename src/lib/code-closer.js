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
    document.cookie = `${CLE}=${encodeURIComponent(code)}; path=/; expires=${expire}; SameSite=Lax`
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
    document.cookie = `${CLE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`
  } catch {
    // un cookie qu'on ne peut pas effacer expirera de lui-même
  }
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
    // 200 : le serveur a tranché, rattaché ou refusé — le code a servi.
    // 404 (client pas encore visible), 429, 5xx, coupure : rien n'est
    // tranché, on garde le code pour la prochaine fois.
    if (res.status !== 200) return false
    const data = await res.json()
    adjuge = !!data?.rattache
    oublierCodeCloser()
    return adjuge
  } catch {
    return false
  }
}

/**
 * Le compte connecté a-t-il une fiche closer ? `true`, `false`, ou `null`
 * quand on ne sait pas (pas de jeton, panne) : un « je ne sais pas » ne doit
 * jamais bloquer un marchand.
 */
export async function estCompteCloser(jeton) {
  if (!jeton) return null
  try {
    const res = await fetch('/api/closer/moi', { headers: { Authorization: `Bearer ${jeton}` } })
    if (res?.status === 200) return true
    if (res?.status === 404) return false
    return null
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
