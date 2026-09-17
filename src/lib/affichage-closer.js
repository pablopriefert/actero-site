import { LIBELLES_STATUT_COMMISSION, montantDeLaGrille } from '../../api/lib/commissions-closer.js'
import { euros } from './affichage-formules'

/**
 * Ce que l'espace closer et la section admin affichent — sans rien lire.
 */

export { LIBELLES_STATUT_COMMISSION }

export const LIBELLES_PLAN = Object.freeze({ free: 'Free', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' })
export const LIBELLES_FORMULE = Object.freeze({ mensuel: 'Mensuel', trimestriel: 'Trimestriel', annuel: 'Annuel' })
export const LIBELLES_ETAT_CLIENT = Object.freeze({ actif: 'Abonné', inscrit: 'Inscrit, pas encore abonné', resilie: 'Résilié' })
export const LIBELLES_TYPE = Object.freeze({ mensuelle: 'Mensualité', unique: 'Une fois' })

/** Le lien d'abonnement d'un closer, avec le plan et la formule convenus s'il y en a. */
export function lienDAbonnement(origine, code, { plan, formule } = {}) {
  const base = `${String(origine).replace(/\/+$/, '')}/c/${encodeURIComponent(code)}`
  return plan && formule ? `${base}?plan=${plan}&formule=${formule}` : base
}

/** « 600 € une fois », « 100 € par mois payé », ou null hors grille. */
export function commissionAnnoncee(plan, formule) {
  const montant = montantDeLaGrille(plan, formule)
  if (!montant) return null
  return formule === 'mensuel' ? `${euros(montant)} par mois payé` : `${euros(montant)} une fois`
}

/** Un montant en centimes, ou un tiret. */
export function montant(centimes) {
  return Number.isInteger(centimes) ? euros(centimes) : '—'
}

/** « 16 sept. 2026 », ou un tiret. */
export function dateCourte(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
