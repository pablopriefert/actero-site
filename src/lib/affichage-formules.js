import { formulePour, premierPaiementCentimes, PERIODES } from '../../api/lib/formules.js'

/**
 * Ce que le navigateur affiche des formules — dérivé du catalogue serveur,
 * jamais recopié. La page tarifs, la page de choix du plan, la facturation et
 * l'admin l'utilisent.
 */

export const PERIODES_AFFICHEES = [
  { id: 'mensuel', libelle: 'Mensuel', badge: null },
  // Badge de l'offre de bienvenue : masqué pour un client qui n'y a plus droit.
  { id: 'trimestriel', libelle: 'Trimestriel', badge: '−50 % le 1er mois', bienvenue: true },
  { id: 'annuel', libelle: 'Annuel', badge: '1 mois offert' },
]

/** « 99 € », « 247,50 € », « 3 950,10 € ». */
export function euros(centimes) {
  const valeur = centimes / 100
  const decimales = Number.isInteger(valeur) ? 0 : 2
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: 2 }).format(valeur)}\u00a0€`
}

/** L'équivalent mensuel d'une formule : « 81,68 € » pour Starter annuel. */
export function equivalentMensuel(plan, periode) {
  const f = formulePour(plan, periode)
  return f ? euros(Math.round(f.montantCentimes / f.mois)) : null
}

/**
 * Ce qu'une carte de prix affiche pour une formule.
 *
 * `offreBienvenue` : le −50 % du premier mois ne vaut qu'une fois par client.
 * Un client déjà abonné, ou qui a eu un essai, paiera le trimestre plein : lui
 * annoncer « 1er trimestre : 247,50 € » serait une promesse que Checkout ne
 * tiendrait pas.
 *
 * @param {string} plan
 * @param {string} periode
 * @param {{ offreBienvenue?: boolean }} [options]
 * @returns {{ principal: string, suffixe: string, detail: string|null, offre: string } | null}
 */
export function affichagePrix(plan, periode, { offreBienvenue = true } = {}) {
  const f = formulePour(plan, periode)
  if (!f) return null
  if (periode === 'trimestriel') {
    if (!offreBienvenue) {
      return { principal: euros(f.montantCentimes), suffixe: '/3 mois', detail: null, offre: 'Payé tous les 3 mois' }
    }
    return {
      principal: euros(f.montantCentimes),
      suffixe: '/3 mois',
      detail: `1er trimestre : ${euros(premierPaiementCentimes(f))}`,
      offre: '−50 % sur le premier mois',
    }
  }
  if (periode === 'annuel') {
    return {
      principal: euros(f.montantCentimes),
      suffixe: '/an',
      detail: `soit ${equivalentMensuel(plan, periode)} par mois`,
      offre: '12 mois pour le prix de 11',
    }
  }
  return { principal: euros(f.montantCentimes), suffixe: '/mois', detail: null, offre: 'Sans engagement' }
}

const CLE = 'actero_formule_choisie'
const DUREE_MS = 7 * 86400000

/** Mémorise la formule choisie : l'inscription perd la chaîne de requête. */
export function memoriserFormuleChoisie({ plan, periode }) {
  try {
    localStorage.setItem(CLE, JSON.stringify({ plan, periode, le: Date.now() }))
  } catch {
    // stockage indisponible (navigation privée) : on retombera sur le mensuel
  }
}

/**
 * La formule à présélectionner : celle de l'URL (`?formule=`, `?plan=`),
 * sinon celle mémorisée depuis moins de 7 jours, sinon le mensuel.
 *
 * @param {URLSearchParams} urlParams
 * @returns {{ plan: string|null, periode: string }}
 */
export function lireFormuleChoisie(urlParams) {
  const depuisUrl = urlParams?.get?.('formule')
  if (PERIODES.includes(depuisUrl)) return { plan: urlParams.get('plan') || null, periode: depuisUrl }
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) || 'null')
    if (brut && PERIODES.includes(brut.periode) && Date.now() - (brut.le || 0) < DUREE_MS) {
      return { plan: brut.plan || null, periode: brut.periode }
    }
  } catch {
    // valeur illisible : on l'ignore
  }
  return { plan: null, periode: 'mensuel' }
}
