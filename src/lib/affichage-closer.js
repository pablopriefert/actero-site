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

// ── Fil d'activité ───────────────────────────────────────────────────────────
// Spec : docs/superpowers/specs/2026-09-17-closers-fil-activite-design.md

export const LIBELLES_PLATEFORME = Object.freeze({ shopify: 'Shopify', woocommerce: 'WooCommerce', webflow: 'Webflow', stripe: 'Stripe' })

/** Les filtres de l'onglet Activité, dans l'ordre des boutons (`famille` null : tout). */
export const FILTRES_ACTIVITE = Object.freeze([
  { famille: null, libelle: 'Tout' },
  { famille: 'paiement', libelle: 'Paiements' },
  { famille: 'abonnement', libelle: 'Abonnement' },
  { famille: 'inscription', libelle: 'Inscriptions' },
  { famille: 'mise_en_route', libelle: 'Mise en route' },
  { famille: 'lien', libelle: 'Lien' },
])

/** La pastille de chaque famille (tokens de src/lib/tokens.ts). */
export const PASTILLE_FAMILLE = Object.freeze({
  lien: 'bg-ink-4',
  inscription: 'bg-ink',
  paiement: 'bg-cta',
  abonnement: 'bg-gold',
  mise_en_route: 'bg-primary-soft',
})

/** Une valeur d'une table de libellés, sans rien hériter d'Object (`toString`…). */
const libelleDe = (table, cle) => (typeof cle === 'string' && Object.hasOwn(table, cle) ? table[cle] : null)

/** « Pro annuel », « Starter », ou null si le plan est inconnu. */
export function offreEnClair({ plan, formule } = {}) {
  const libellePlan = libelleDe(LIBELLES_PLAN, plan)
  if (!libellePlan) return null
  const libelleFormule = libelleDe(LIBELLES_FORMULE, formule)
  return libelleFormule ? `${libellePlan} ${libelleFormule.toLowerCase()}` : libellePlan
}

const avecOffre = (debut) => (d) => (offreEnClair(d) ? `${debut} (${offreEnClair(d)})` : debut)

const LIBELLES_EVENEMENT = Object.freeze({
  lien_ouvert: () => 'A ouvert votre lien',
  inscription: () => 'S’est inscrit',
  paiement_ouvert: (d) => (offreEnClair(d) ? `A choisi ${offreEnClair(d)} et ouvert le paiement` : 'A ouvert le paiement'),
  paiement_abandonne: avecOffre('Paiement non finalisé'),
  abonnement_demarre: avecOffre('S’est abonné'),
  renouvellement_paye: avecOffre('Renouvellement payé'),
  paiement_echoue: () => 'Paiement échoué',
  formule_changee: (d) => (offreEnClair(d) ? `Est passé à ${offreEnClair(d)}` : 'A changé de formule'),
  resiliation_programmee: () => 'A programmé sa résiliation',
  resiliation_annulee: () => 'A annulé sa résiliation',
  abonnement_termine: () => 'Abonnement terminé',
  rembourse: (d) => (d.partiel === true ? 'Remboursé en partie' : d.partiel === false ? 'Remboursé en totalité' : 'Remboursé'),
  app_desinstallee: () => 'A désinstallé l’application Shopify',
  boutique_connectee: (d) => {
    const plateforme = libelleDe(LIBELLES_PLATEFORME, d.plateforme)
    return plateforme ? `A connecté sa boutique ${plateforme}` : 'A connecté sa boutique'
  },
  agent_premiere_reponse: () => 'L’agent a envoyé sa première réponse',
  agent_en_pause: () => 'A mis l’agent en pause',
  agent_reactive: () => 'A réactivé l’agent',
})

/** Le libellé d'une étape du fil, avec l'offre et la plateforme en clair. */
export function libelleEvenement({ type, details } = {}) {
  const libelle = libelleDe(LIBELLES_EVENEMENT, type)
  if (!libelle) return 'Nouvelle étape'
  return libelle(details && typeof details === 'object' ? details : {})
}

const TYPES_ALERTE = new Set(['paiement_abandonne', 'paiement_echoue', 'resiliation_programmee', 'agent_en_pause', 'app_desinstallee'])

/** Une étape à surveiller : affichée en orange. */
export function evenementAlerte(type) {
  return TYPES_ALERTE.has(type)
}

// Les dates du fil se lisent à l'heure de Paris, quel que soit le navigateur.
const CALENDRIER = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  weekday: 'long',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: 'h23',
})
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** Les morceaux d'une date à Paris, et le numéro de son jour (sans piège d'heure d'été). */
function calendrier(valeur) {
  const date = new Date(valeur)
  if (valeur == null || Number.isNaN(date.getTime())) return null
  const p = {}
  for (const { type, value } of CALENDRIER.formatToParts(date)) p[type] = value
  const annee = Number(p.year)
  const mois = Number(p.month)
  const jour = Number(p.day)
  return {
    date,
    annee,
    mois,
    jour,
    jourSemaine: p.weekday,
    heure: `${Number(p.hour)} h ${String(Number(p.minute)).padStart(2, '0')}`,
    numero: Date.UTC(annee, mois - 1, jour) / 86_400_000,
  }
}

/** « 12 septembre », « 1er septembre », avec l'année si ce n'est pas celle de `ref`. */
const jourEtMois = (c, ref) => `${c.jour === 1 ? '1er' : c.jour} ${MOIS[c.mois - 1]}${c.annee !== ref.annee ? ` ${c.annee}` : ''}`

/** « 14 h 05 », ou un tiret. */
export function heureDuFil(iso) {
  return calendrier(iso)?.heure ?? '—'
}

/** « à l’instant », « il y a 5 min », « il y a 2 h », « hier à 14 h 05 », « le 12 septembre ». */
export function dateRelative(iso, maintenant = new Date()) {
  const c = calendrier(iso)
  const ref = calendrier(maintenant)
  if (!c || !ref) return '—'
  const ecart = ref.date.getTime() - c.date.getTime()
  if (ecart < 60_000) return 'à l’instant'
  if (ecart < 3_600_000) return `il y a ${Math.floor(ecart / 60_000)} min`
  const jours = ref.numero - c.numero
  if (jours <= 0) return `il y a ${Math.floor(ecart / 3_600_000)} h`
  if (jours === 1) return `hier à ${c.heure}`
  return `le ${jourEtMois(c, ref)}`
}

/** L'heure d'une ligne du fil : relative quand elle est récente (« il y a 5 min »), sinon « 14 h 05 ». */
export function momentDuFil(iso, maintenant = new Date()) {
  const relative = dateRelative(iso, maintenant)
  return /^(à l’instant|il y a )/.test(relative) ? relative : heureDuFil(iso)
}

/** La boutique d'une étape ; un clic pas encore relié vient d'un visiteur. */
export function boutiqueDuFil({ boutique, client_id: clientId } = {}) {
  if (boutique) return boutique
  return clientId ? 'Boutique sans nom' : 'Visiteur, pas encore inscrit'
}

/** Le titre d'un jour du fil : « Aujourd’hui », « Hier », « Lundi 14 septembre ». */
export function jourDuFil(iso, maintenant = new Date()) {
  const c = calendrier(iso)
  const ref = calendrier(maintenant)
  if (!c || !ref) return '—'
  const jours = ref.numero - c.numero
  if (jours === 0) return 'Aujourd’hui'
  if (jours === 1) return 'Hier'
  return `${c.jourSemaine.charAt(0).toUpperCase()}${c.jourSemaine.slice(1)} ${jourEtMois(c, ref)}`
}

/** Les étapes (déjà triées) regroupées par jour, dans le même ordre. */
export function grouperParJour(evenements, maintenant = new Date()) {
  const groupes = []
  for (const e of evenements) {
    const jour = jourDuFil(e.survenu_le, maintenant)
    const dernier = groupes.at(-1)
    if (dernier?.jour === jour) dernier.evenements.push(e)
    else groupes.push({ jour, evenements: [e] })
  }
  return groupes
}
