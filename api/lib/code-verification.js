import crypto from 'node:crypto'

/**
 * Les codes à 6 chiffres envoyés par e-mail à l'inscription — marchand ou closer.
 *
 * Une seule table, `email_verification_codes`, pour deux inscriptions qui ne
 * créent pas du tout la même chose : un marchand (clients, client_users) ou un
 * closer (closers). `payload.kind` les distingue, et CHAQUE vérification
 * refuse le code de l'autre — sans quoi un code d'inscription closer créerait
 * un compte marchand, et inversement (spec closers, « Données »).
 *
 * Le tri se fait dans la requête (`COLONNE_TYPE_CODE`), pas après : filtrer
 * en JavaScript derrière un `.limit(5)` laissait cinq codes récents de
 * l'autre parcours masquer le bon. Les codes marchands n'ont pas de type :
 * leur route demande `payload->>kind IS NULL` — et non `<> 'closer'`, qui
 * vaut NULL, donc faux, pour une ligne sans type.
 */

export const TYPE_CODE_CLOSER = 'closer'
export const COLONNE_TYPE_CODE = 'payload->>kind'
export const DUREE_CODE_MS = 15 * 60 * 1000
export const ESSAIS_MAX = 5

/**
 * Quotas par ADRESSE, en plus du quota par IP de chaque route. Sans eux,
 * chaque IP d'un réseau de machines dispose de son propre quota sur la même
 * adresse : bombardement d'une boîte, ou essais multipliés sur ses codes.
 *
 * Les clés ne nomment pas le parcours : une adresse a un seul quota, que les
 * demandes viennent de l'inscription marchand ou closer. Le refus est la
 * réponse du refus par IP, mot pour mot : il ne dit rien de l'adresse.
 */
export const UNE_HEURE_MS = 60 * 60 * 1000
export const ENVOIS_PAR_ADRESSE = 5
export const VERIFICATIONS_PAR_ADRESSE = 10
export const cleEnvoisParAdresse = (adresse) => `code:${adresse}`
export const cleVerificationsParAdresse = (adresse) => `verif:${adresse}`

/** Six chiffres, zéros de tête compris. */
export function genererCodeVerification() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

/** Le code n'est jamais stocké : seulement son empreinte. */
export function empreinteCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex')
}
