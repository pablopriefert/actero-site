/**
 * Les commissions des closers — le calcul, sans rien lire ni écrire.
 *
 * Spec : docs/superpowers/specs/2026-09-14-closers-espace-commissions-design.md
 * (grille validée par Pablo le 14 septembre 2026).
 *
 * Le webhook Stripe, l'admin et l'espace closer appellent ces fonctions ; eux
 * ne font que lire, appeler et écrire. Le navigateur importe aussi ce fichier
 * (libellés, grille du générateur de liens) : aucune dépendance Node ici.
 *
 * CE QU'ON NE FAIT JAMAIS : deviner. Une facture dont la formule n'est pas
 * celle du catalogue (tarif Enterprise sur mesure, ancien prix sans clé ni
 * métadonnées conformes, prix non étendu) ne crée rien. Une commission oubliée se saisit à la main ; une
 * commission inventée se paie.
 */
import { formuleDuPrix, formulePour, periodeDepuisApi, PERIODES } from './formules.js'

/** Ce que rapporte chaque formule payée, en centimes (note de Pablo). */
export const GRILLE_COMMISSIONS_CENTIMES = Object.freeze({
  starter: Object.freeze({ mensuel: 2500, trimestriel: 10000, annuel: 25000 }),
  pro: Object.freeze({ mensuel: 10000, trimestriel: 25000, annuel: 60000 }),
})

/** Les statuts d'une commission — la contrainte SQL de la migration dit les mêmes. */
export const STATUTS_COMMISSION = Object.freeze(['a_valider', 'validee', 'payee', 'refusee', 'annulee'])

export const LIBELLES_STATUT_COMMISSION = Object.freeze({
  a_valider: 'À valider',
  validee: 'Validée',
  payee: 'Payée',
  refusee: 'Refusée',
  annulee: 'Annulée',
})

/** Plans qui peuvent porter une commission. Enterprise : hors grille, saisie à la main. */
export const PLANS_COMMISSIONNABLES = Object.freeze(['starter', 'pro', 'enterprise'])

/**
 * Les seules factures d'abonnement qui rapportent : la première, chaque
 * renouvellement, et un changement de formule facturé tout de suite
 * (`subscription_update`, par exemple du mensuel à l'annuel).
 *
 * Une facture de changement porte surtout du prorata : ces lignes sont
 * écartées par formuleDesLignes, et une facture de pur prorata ne crée rien.
 * Seule compte la période neuve facturée en entier. La clé unique
 * (`unique:<client>`) empêche une seconde commission unique.
 */
export const RAISONS_FACTURE_COMMISSIONNEES = Object.freeze(['subscription_create', 'subscription_cycle', 'subscription_update'])

/** Les commissions se versent en euros : une facture dans une autre devise ne rapporte rien. */
export const DEVISE_COMMISSIONS = 'eur'

/** « Remboursable jusqu'au » : paiement + 30 jours, affiché à l'admin à titre d'information. */
export const DELAI_REMBOURSEMENT_JOURS = 30

export const NOTE_REMBOURSEE = 'Facture remboursée par le client'
export const NOTE_REMBOURSEE_APRES_PAIEMENT = 'Facture remboursée après paiement'

const FORMAT_MOIS = /^\d{4}-(0[1-9]|1[0-2])$/
const MONTANT_MAX_CENTIMES = 1_000_000

/** Mensuel : une commission par mensualité encaissée. Trimestriel, annuel : une seule fois. */
export function typeDeCommission(periode) {
  return periode === 'mensuel' ? 'mensuelle' : 'unique'
}

/** Le montant de la grille, ou null hors grille (Enterprise, formule inconnue). */
export function montantDeLaGrille(plan, periode) {
  if (typeof plan !== 'string' || !Object.hasOwn(GRILLE_COMMISSIONS_CENTIMES, plan)) return null
  const ligne = GRILLE_COMMISSIONS_CENTIMES[plan]
  return typeof periode === 'string' && Object.hasOwn(ligne, periode) ? ligne[periode] : null
}

export const cleUnique = (clientId) => `unique:${clientId}`
export const cleMensuelleStripe = (factureId) => `stripe:${factureId}`
export const cleMensuelleManuelle = (clientId, mois) => `manuel:${clientId}:${mois}`

/** Le mois en cours à Paris, au format AAAA-MM (clé des saisies manuelles). */
export function moisCourant(date = new Date()) {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).format(date)
}

/** Date limite de remboursement affichée à l'admin, ou null sans date de paiement. */
export function remboursableJusquau(payeeLe) {
  const debut = payeeLe ? Date.parse(payeeLe) : NaN
  return Number.isNaN(debut) ? null : new Date(debut + DELAI_REMBOURSEMENT_JOURS * 86_400_000).toISOString()
}

/** Les notes s'ajoutent, ne s'écrasent pas : elles racontent l'histoire de la commission. */
export function ajouterNote(avant, texte) {
  return avant ? `${avant}\n${texte}` : texte
}

/** La dernière note — le motif d'un refus ou d'une annulation, montré au closer. */
export function derniereNote(note) {
  if (!note) return null
  const lignes = String(note).split('\n').filter(Boolean)
  return lignes.length ? lignes[lignes.length - 1] : null
}

/** Totaux par statut, en centimes. */
export function totauxParStatut(commissions) {
  const totaux = Object.fromEntries(STATUTS_COMMISSION.map((s) => [s, 0]))
  for (const c of commissions || []) {
    if (Object.hasOwn(totaux, c?.statut) && Number.isInteger(c.montant_centimes)) totaux[c.statut] += c.montant_centimes
  }
  return totaux
}

/** Le montant pré-rempli d'une saisie manuelle : la grille, d'après le plan et la formule du client. */
export function montantPreRempli(client) {
  return montantDeLaGrille(client?.plan, periodeDepuisApi(client?.billing_period))
}

/**
 * Ce client est-il facturé par Stripe sur une formule du catalogue ? Ses
 * mensualités sont alors créées par le webhook, jamais à la main.
 * `billing_provider` vide = client Stripe historique (commentaire de la colonne).
 */
export function factureParStripeSurLeCatalogue(client) {
  return (client?.billing_provider ?? 'stripe') === 'stripe'
    && !!client?.stripe_subscription_id
    && montantPreRempli(client) !== null
}

/**
 * La formule d'un prix facturé. D'abord sa `lookup_key` (api/lib/formules.js,
 * qui sert aussi au paiement et ne change pas ici).
 *
 * Repli : un prix dont la clé a été transférée à un nouveau prix n'en a plus,
 * mais les abonnements existants le facturent encore. Ses métadonnées
 * `actero_plan` et `actero_periode` disent ce qu'il vend ; on ne les croit que
 * si le couple existe au catalogue ET si le rythme de facturation du prix est
 * exactement celui de la formule. Un prix « annuel » facturé chaque mois n'est
 * pas une formule annuelle.
 */
function formuleDuPrixFacture(prix) {
  const parCle = formuleDuPrix(prix)
  if (parCle) return parCle
  const plan = prix?.metadata?.actero_plan
  const periode = prix?.metadata?.actero_periode
  if (typeof plan !== 'string' || typeof periode !== 'string') return null
  const formule = formulePour(plan, periode)
  if (!formule) return null
  const rythme = prix.recurring
  if (rythme?.interval !== formule.recurring.interval || rythme?.interval_count !== formule.recurring.interval_count) return null
  return formule
}

/**
 * La formule payée d'après les lignes de la facture. Seules comptent les
 * lignes d'abonnement hors prorata ; elles doivent toutes désigner la même
 * formule du catalogue. Sinon : null, on ne devine pas.
 */
function formuleDesLignes(lignes) {
  const abonnement = (lignes || []).filter((l) => l?.parent?.type === 'subscription_item_details'
    && l.parent.subscription_item_details?.proration === false)
  if (abonnement.length === 0) return null
  let formule = null
  for (const ligne of abonnement) {
    const prix = ligne.pricing?.price_details?.price
    // Un prix non étendu n'est qu'un identifiant : sa clé est inconnue.
    const f = prix && typeof prix === 'object' ? formuleDuPrixFacture(prix) : null
    if (!f || (formule && f.lookupKey !== formule.lookupKey)) return null
    formule = f
  }
  return formule
}

/** La note posée quand la commission dépasse ce que le client a payé (code promo, remise). */
export function noteCommissionSuperieure(montantPayeCentimes) {
  return `Commission supérieure au montant payé (${eurosTexte(montantPayeCentimes)}) : à vérifier`
}

/**
 * La commission née d'une facture Stripe payée, ou la raison de son absence.
 *
 * `facture` et `lignes` ont la forme de l'API 2026-02-25.clover (celle du SDK) :
 * l'abonnement se lit dans `facture.parent.subscription_details`, le prix de
 * chaque ligne dans `ligne.pricing.price_details.price` (étendu). Une facture
 * n'y porte plus `subscription`, ni une ligne `price`.
 *
 * Raisons : rien_encaisse, hors_abonnement, sans_closer, devise, hors_grille
 * (facture, formule ou plan hors de la grille), unique_deja_versee.
 *
 * La commission garde le montant réellement payé (`montant_facture_centimes`) ;
 * si elle le dépasse, une note le signale à Actero, qui décide.
 *
 * @param {{ facture: any, lignes: any[], client: { id: string, closer_id: string|null }, uniqueDejaVersee: boolean }} p
 * @returns {{ commission: object } | { raison: string }}
 */
export function evaluerFacture({ facture, lignes, client, uniqueDejaVersee }) {
  if (typeof uniqueDejaVersee !== 'boolean') {
    // « Je ne sais pas » ne vaut jamais « pas encore versée » : ce serait une
    // seconde commission unique sur une lecture ratée.
    throw new TypeError('commissionPourFacture : uniqueDejaVersee doit être connu (true ou false)')
  }
  if (!facture || facture.status !== 'paid') return { raison: 'rien_encaisse' }
  if (!Number.isInteger(facture.amount_paid) || facture.amount_paid <= 0) return { raison: 'rien_encaisse' }
  if (facture.parent?.type !== 'subscription_details') return { raison: 'hors_abonnement' }
  if (!client?.id || !client.closer_id) return { raison: 'sans_closer' }
  if (facture.currency !== DEVISE_COMMISSIONS) return { raison: 'devise' }
  if (!RAISONS_FACTURE_COMMISSIONNEES.includes(facture.billing_reason)) return { raison: 'hors_grille' }

  const formule = formuleDesLignes(lignes)
  if (!formule) return { raison: 'hors_grille' }
  const montant = montantDeLaGrille(formule.plan, formule.periode)
  if (!montant) return { raison: 'hors_grille' }
  const type = typeDeCommission(formule.periode)
  if (type === 'unique' && uniqueDejaVersee) return { raison: 'unique_deja_versee' }

  const payeLe = facture.status_transitions?.paid_at
  return {
    commission: {
      closer_id: client.closer_id,
      client_id: client.id,
      montant_centimes: montant,
      montant_facture_centimes: facture.amount_paid,
      note: montant > facture.amount_paid ? noteCommissionSuperieure(facture.amount_paid) : null,
      plan: formule.plan,
      formule: formule.periode,
      type,
      source: 'stripe',
      source_key: type === 'unique' ? cleUnique(client.id) : cleMensuelleStripe(facture.id),
      stripe_invoice_id: facture.id,
      payee_par_client_le: Number.isInteger(payeLe) ? new Date(payeLe * 1000).toISOString() : null,
      statut: 'a_valider',
    },
  }
}

/** La commission née d'une facture Stripe payée, ou null (voir evaluerFacture). */
export function commissionPourFacture(p) {
  return evaluerFacture(p).commission ?? null
}

/**
 * Une commission saisie à la main (Shopify, Enterprise, correction), ou l'erreur.
 *
 * Le type suit la formule : mensuel → une mensualité par mois (clé
 * `manuel:<client>:<AAAA-MM>`), trimestriel ou annuel → la commission unique
 * du client (clé `unique:<client>`, partagée avec le webhook).
 *
 * @returns {{ commission: object } | { erreur: string }}
 */
export function commissionManuelle({ client, formule, montantCentimes, mois, note }) {
  if (!client?.id) return { erreur: 'client_introuvable' }
  if (!client.closer_id) return { erreur: 'client_non_rattache' }
  if (!PLANS_COMMISSIONNABLES.includes(client.plan)) return { erreur: 'plan_non_payant' }
  if (!PERIODES.includes(formule)) return { erreur: 'formule_inconnue' }
  if (!Number.isInteger(montantCentimes) || montantCentimes <= 0 || montantCentimes > MONTANT_MAX_CENTIMES) {
    return { erreur: 'montant_invalide' }
  }
  const texte = typeof note === 'string' ? note.trim() : ''
  if (texte.length < 3) return { erreur: 'note_requise' }

  const type = typeDeCommission(formule)
  let sourceKey
  if (type === 'mensuelle') {
    if (typeof mois !== 'string' || !FORMAT_MOIS.test(mois)) return { erreur: 'mois_invalide' }
    if (factureParStripeSurLeCatalogue(client)) return { erreur: 'commission_automatique' }
    sourceKey = cleMensuelleManuelle(client.id, mois)
  } else {
    sourceKey = cleUnique(client.id)
  }

  return {
    commission: {
      closer_id: client.closer_id,
      client_id: client.id,
      montant_centimes: montantCentimes,
      plan: client.plan,
      formule,
      type,
      source: 'manuel',
      source_key: sourceKey,
      stripe_invoice_id: null,
      payee_par_client_le: null,
      statut: 'a_valider',
      note: texte,
    },
  }
}

/**
 * Ce que l'admin a le droit de faire d'une commission.
 *
 * valider       a_valider → validee
 * refuser       a_valider ou validee → refusee, avec une note
 * marquer_payee validee → payee, profil de paiement du closer complet
 *
 * @returns {{ maj: object } | { erreur: string }}
 */
export function transitionCommission(commission, action, { note, profilComplet, adminId, maintenant = new Date() } = {}) {
  if (!commission) return { erreur: 'commission_introuvable' }
  const le = maintenant.toISOString()
  if (action === 'valider') {
    if (commission.statut !== 'a_valider') return { erreur: 'statut_incompatible' }
    return { maj: { statut: 'validee', validee_at: le, validee_par: adminId ?? null } }
  }
  if (action === 'refuser') {
    if (!['a_valider', 'validee'].includes(commission.statut)) return { erreur: 'statut_incompatible' }
    const texte = typeof note === 'string' ? note.trim() : ''
    if (texte.length < 3) return { erreur: 'note_requise' }
    return { maj: { statut: 'refusee', note: ajouterNote(commission.note, texte) } }
  }
  if (action === 'marquer_payee') {
    if (commission.statut !== 'validee') return { erreur: 'statut_incompatible' }
    if (profilComplet !== true) return { erreur: 'profil_incomplet' }
    return { maj: { statut: 'payee', payee_at: le } }
  }
  return { erreur: 'action_inconnue' }
}

function eurosTexte(centimes) {
  return `${(Number(centimes || 0) / 100).toFixed(2).replace('.', ',')} €`
}

/**
 * Ce que le client a récupéré, d'après les charges Stripe (API 2026-02-25.clover)
 * qui ont payé une facture — ou null si rien n'a été rendu.
 *
 * Total : chaque charge est rendue en entier (`refunded`, ou `amount_refunded`
 * au moins égal à `amount`). Une facture remboursée garde le statut `paid` :
 * seules ses charges disent qu'elle l'a été.
 *
 * @param {any[]} charges
 * @returns {{ total: boolean, rembourseCentimes: number } | null}
 */
export function remboursementDesCharges(charges) {
  const liste = (charges || []).filter((c) => c && typeof c === 'object')
  const rendu = (c) => (Number.isInteger(c.amount_refunded) && c.amount_refunded > 0 ? c.amount_refunded : 0)
  const rembourseCentimes = liste.reduce((somme, c) => somme + rendu(c), 0)
  const total = liste.length > 0
    && liste.every((c) => c.refunded === true || (Number.isInteger(c.amount) && c.amount > 0 && rendu(c) >= c.amount))
  if (!total && rembourseCentimes === 0) return null
  return { total, rembourseCentimes }
}

/**
 * Ce que devient une commission quand la facture qui l'a créée est remboursée.
 *
 * Remboursement total : annulée si elle n'est pas encore payée ; si elle l'est,
 * elle le reste et reçoit une note — aucune reprise automatique (décision 5).
 * Remboursement partiel : une note seulement, Actero décide.
 *
 * @returns {object|null} la mise à jour, ou null s'il n'y a rien à faire
 */
export function effetRemboursement(commission, { total, rembourseCentimes }) {
  if (!commission || ['refusee', 'annulee'].includes(commission.statut)) return null
  if (!total) {
    const texte = `Remboursement partiel de ${eurosTexte(rembourseCentimes)} par le client`
    if ((commission.note || '').includes(texte)) return null
    return { note: ajouterNote(commission.note, texte) }
  }
  if (commission.statut === 'a_valider' || commission.statut === 'validee') {
    return { statut: 'annulee', note: ajouterNote(commission.note, NOTE_REMBOURSEE) }
  }
  if (commission.statut === 'payee') {
    if ((commission.note || '').includes(NOTE_REMBOURSEE_APRES_PAIEMENT)) return null
    return { note: ajouterNote(commission.note, NOTE_REMBOURSEE_APRES_PAIEMENT) }
  }
  return null
}
