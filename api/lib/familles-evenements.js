/**
 * Les types d'étape du fil d'activité des closers, et leur famille.
 * Spec : docs/superpowers/specs/2026-09-17-closers-fil-activite-design.md
 *
 * Sans dépendance Node : importé par les routes serveur ET par l'espace closer.
 * La liste est aussi écrite dans la contrainte de la table closer_evenements ;
 * api/lib/closer-evenements-migration.test.js vérifie qu'elles sont identiques.
 */

export const FAMILLES = ['lien', 'inscription', 'paiement', 'abonnement', 'mise_en_route']

export const FAMILLE_DU_TYPE = Object.freeze({
  lien_ouvert: 'lien',
  inscription: 'inscription',
  paiement_ouvert: 'paiement',
  paiement_abandonne: 'paiement',
  abonnement_demarre: 'paiement',
  renouvellement_paye: 'paiement',
  paiement_echoue: 'paiement',
  formule_changee: 'abonnement',
  resiliation_programmee: 'abonnement',
  resiliation_annulee: 'abonnement',
  abonnement_termine: 'abonnement',
  rembourse: 'abonnement',
  app_desinstallee: 'abonnement',
  boutique_connectee: 'mise_en_route',
  agent_premiere_reponse: 'mise_en_route',
  agent_en_pause: 'mise_en_route',
  agent_reactive: 'mise_en_route',
})

export const TYPES_EVENEMENT = Object.freeze(Object.keys(FAMILLE_DU_TYPE))

/** Les types d'une famille. */
export function typesDeLaFamille(famille) {
  return TYPES_EVENEMENT.filter((type) => FAMILLE_DU_TYPE[type] === famille)
}
