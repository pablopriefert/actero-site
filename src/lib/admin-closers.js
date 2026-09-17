import { supabase } from './supabase'
import { NOTE_REMBOURSEE_APRES_PAIEMENT } from '../../api/lib/commissions-closer.js'

/**
 * La section « Closers » de l'admin lit et écrit par les routes serveur
 * (api/admin/closer*.js, requireAdmin), jamais par supabase.from() : les
 * tables du programme sont fermées au navigateur (principe du chantier C).
 */

/**
 * Les codes que les routes renvoient sans `message`. Un code brut
 * (`closer_requis`) ne dit rien à l'admin : il lit une phrase.
 */
export const MESSAGES_ERREUR = Object.freeze({
  Unauthorized: 'Session expirée : reconnectez-vous.',
  'Admin access required': 'Accès réservé aux administrateurs.',
  methode_non_autorisee: 'Cette action n’est pas prise en charge par le serveur.',
  action_inconnue: 'Action inconnue : rechargez la page.',
  statut_inconnu: 'Statut de commission inconnu : rechargez la page.',
  closer_requis: 'Choisissez un closer.',
  client_requis: 'Choisissez un client.',
  commission_requise: 'Commission manquante : rechargez la page.',
  closer_introuvable: 'Ce closer est introuvable : rechargez la page.',
  client_introuvable: 'Ce client est introuvable : rechargez la page.',
  indisponible: 'Service momentanément indisponible : réessayez dans un instant.',
  erreur_interne: 'Erreur du serveur : réessayez, et prévenez l’équipe technique si elle persiste.',
})

/** Faute de code connu, le statut HTTP donne encore une phrase. */
const MESSAGES_STATUT = Object.freeze({
  401: MESSAGES_ERREUR.Unauthorized,
  403: MESSAGES_ERREUR['Admin access required'],
  404: 'Élément introuvable : rechargez la page.',
  409: 'Les données ont changé entre-temps : rechargez la page.',
  429: 'Trop de demandes : patientez un instant, puis réessayez.',
  500: MESSAGES_ERREUR.erreur_interne,
  502: MESSAGES_ERREUR.indisponible,
  503: MESSAGES_ERREUR.indisponible,
  504: 'Le serveur a mis trop de temps à répondre : réessayez.',
})

/** La phrase d'une réponse en erreur : le `message` du serveur d'abord. */
export function messageDErreur(status, donnees) {
  const code = donnees?.error
  // Certaines routes renvoient le code lui-même en guise de message.
  const message = typeof donnees?.message === 'string' && donnees.message && donnees.message !== code ? donnees.message : null
  if (message) return message
  if (typeof code === 'string' && Object.hasOwn(MESSAGES_ERREUR, code)) return MESSAGES_ERREUR[code]
  if (status >= 200 && status < 300) return 'Réponse illisible du serveur : réessayez.'
  return MESSAGES_STATUT[status] ?? `Erreur inattendue du serveur (${status}) : réessayez.`
}

export async function appelAdmin(chemin, { methode = 'GET', corps, query } = {}) {
  const { data } = await supabase.auth.getSession()
  const jeton = data?.session?.access_token
  const recherche = query ? `?${new URLSearchParams(query)}` : ''
  let res
  try {
    res = await fetch(`/api/admin/${chemin}${recherche}`, {
      method: methode,
      headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
      ...(corps ? { body: JSON.stringify(corps) } : {}),
    })
  } catch {
    const erreur = new Error('Connexion au serveur impossible : vérifiez votre réseau, puis réessayez.')
    erreur.status = 0
    erreur.code = 'reseau'
    throw erreur
  }
  const donnees = await res.json().catch(() => null)
  if (!res.ok || donnees === null) {
    const erreur = new Error(messageDErreur(res.status, donnees))
    erreur.status = res.ok ? 502 : res.status
    erreur.code = donnees?.error
    throw erreur
  }
  return donnees
}

/**
 * Relit chez Stripe les factures payées d'un client rattaché et crée les
 * commissions manquantes → { resultats: [{ facture, issue }] }. Sans doublon :
 * un second appel ne crée rien de plus.
 */
export function rejouerFacturesStripe(clientId) {
  return appelAdmin('closer-commissions', { methode: 'POST', corps: { action: 'rejouer_factures', client_id: clientId } })
}

/** Les issues d'une facture rejouée (api/lib/commissions-stripe.js, rejouerFactures). */
export const LIBELLES_ISSUES_REJEU = Object.freeze({
  creee: 'Commissions créées',
  deja_creee: 'Déjà créées',
  non_traitee: 'Non traitées faute de temps : relancez pour continuer',
  erreur: 'En erreur : relancez ; si l’erreur persiste, voyez Sentry',
  hors_grille: 'Hors grille (facture, formule ou plan sans commission)',
  unique_deja_versee: 'Commission unique déjà versée pour ce client',
  devise: 'Facturées dans une autre devise que l’euro',
  client_ambigu: 'Abonnement partagé par plusieurs clients : à vérifier',
  sans_closer: 'Client sans closer au moment de la relecture',
  client_inconnu: 'Aucun client Actero ne correspond à la facture',
  rien_encaisse: 'Rien d’encaissé',
  hors_abonnement: 'Hors abonnement',
  sans_facture: 'Facture introuvable',
})

/** Le résumé d'un rejeu : combien de factures, de créées, de déjà créées, et le reste par issue. */
export function resumeRejeu(resultats) {
  const liste = Array.isArray(resultats) ? resultats : []
  const compte = new Map()
  for (const r of liste) compte.set(r?.issue, (compte.get(r?.issue) ?? 0) + 1)
  const autres = [...compte.entries()]
    .filter(([issue]) => issue !== 'creee' && issue !== 'deja_creee')
    .map(([issue, nombre]) => ({
      issue,
      nombre,
      libelle: Object.hasOwn(LIBELLES_ISSUES_REJEU, issue) ? LIBELLES_ISSUES_REJEU[issue] : `Autre issue (${issue})`,
    }))
  return {
    factures: liste.length,
    creees: compte.get('creee') ?? 0,
    dejaCreees: compte.get('deja_creee') ?? 0,
    autres,
    aRelancer: compte.has('non_traitee') || compte.has('erreur'),
  }
}

/** Le canal de facturation d'un client rattaché (api/admin/closers.js). */
export const LIBELLES_CANAL = Object.freeze({ shopify: 'Shopify', stripe: 'Stripe', autre: 'Autre canal' })

/** « 2026-09 » → « septembre 2026 » ; une valeur d'une autre forme est rendue telle quelle. */
export function moisLisible(mois) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(mois ?? ''))
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return mois || '—'
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1))
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Les notes s'ajoutent ligne à ligne (ajouterNote) : une ligne par événement. */
export function lignesDeNote(note) {
  return String(note ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
}

/** Les statuts de l'onglet « Historique » : les commissions sorties de la file. */
export const STATUTS_HISTORIQUE = Object.freeze(['payee', 'refusee', 'annulee'])

/**
 * Une commission déjà payée dont la facture a été remboursée : la note le dit
 * (effetRemboursement), et rien n'est repris automatiquement. Rend le libellé
 * de l'alerte, ou null.
 */
export function alerteRemboursement(commission) {
  if (commission?.statut !== 'payee') return null
  const lignes = lignesDeNote(commission.note)
  if (lignes.some((l) => l.includes(NOTE_REMBOURSEE_APRES_PAIEMENT))) return 'Facture remboursée après paiement'
  if (lignes.some((l) => l.startsWith('Remboursement partiel'))) return 'Facture remboursée en partie'
  return null
}
