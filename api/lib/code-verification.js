import crypto from 'node:crypto'

/**
 * Les codes à 6 chiffres envoyés par e-mail à l'inscription — marchand ou closer.
 *
 * Une seule table, `email_verification_codes`, pour deux inscriptions qui ne
 * créent pas du tout la même chose : un marchand (clients, client_users) ou un
 * closer (closers). `payload.kind` les distingue, et CHAQUE vérification
 * refuse le code de l'autre — sans quoi un code d'inscription closer créerait
 * un compte marchand, et inversement (spec closers, « Données »).
 */

export const TYPE_CODE_CLOSER = 'closer'
export const DUREE_CODE_MS = 15 * 60 * 1000
export const ESSAIS_MAX = 5

/** Six chiffres, zéros de tête compris. */
export function genererCodeVerification() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

/** Le code n'est jamais stocké : seulement son empreinte. */
export function empreinteCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex')
}

/** Ce code a-t-il été envoyé par l'inscription closer ? */
export function estCodeCloser(payload) {
  return payload?.kind === TYPE_CODE_CLOSER
}
