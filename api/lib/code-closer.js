import crypto from 'node:crypto'

/**
 * Le code d'un closer, au format ACT-XXXXX — celui de son lien d'abonnement.
 *
 * Tiré par crypto.randomBytes, jamais par Math.random : un code prévisible
 * permettrait de s'attribuer les clients d'un autre (le défaut que
 * api/ambassador/register.js corrigeait déjà).
 */

/**
 * 32 signes, sans 0/O ni 1/I qu'on confond à la lecture. 256 est un multiple
 * de 32 : un octet modulo 32 ne favorise aucun signe.
 */
export const ALPHABET_CODE_CLOSER = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Même format que la contrainte SQL et que src/lib/code-closer.js. */
export const FORMAT_CODE_CLOSER = /^ACT-[A-Z0-9]{5}$/

/** @param {(n: number) => Uint8Array} [octetsAleatoires] — injectable pour les tests */
export function genererCodeCloser(octetsAleatoires = crypto.randomBytes) {
  const octets = octetsAleatoires(5)
  let code = 'ACT-'
  for (let i = 0; i < 5; i++) code += ALPHABET_CODE_CLOSER[octets[i] % ALPHABET_CODE_CLOSER.length]
  return code
}

/** Le code tel que la base le connaît, ou null s'il ne peut pas en être un. */
export function normaliserCodeCloser(brut) {
  if (typeof brut !== 'string') return null
  const code = brut.trim().toUpperCase()
  return FORMAT_CODE_CLOSER.test(code) ? code : null
}
