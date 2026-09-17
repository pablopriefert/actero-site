/**
 * Les coordonnées de paiement d'un closer : validation et masquage.
 *
 * L'IBAN n'est jamais écrit ni renvoyé en clair par une route closer : il est
 * chiffré à l'écriture (encryptToken, api/lib/crypto.js), et seuls ses quatre
 * derniers caractères ressortent. Seule /api/admin/closer-iban le lit en
 * clair, au moment de payer, et chaque lecture est journalisée.
 */

export function normaliserIban(brut) {
  return typeof brut === 'string' ? brut.replace(/\s+/g, '').toUpperCase() : ''
}

/** Format ISO 13616 et clé de contrôle modulo 97. */
export function ibanValide(brut) {
  const iban = normaliserIban(brut)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  const reordonne = iban.slice(4) + iban.slice(0, 4)
  let reste = 0
  for (const signe of reordonne) {
    const chiffres = signe >= 'A' && signe <= 'Z' ? String(signe.charCodeAt(0) - 55) : signe
    for (const c of chiffres) reste = (reste * 10 + Number(c)) % 97
  }
  return reste === 1
}

/** « •••• 0189 », ou null. */
export function ibanMasque(iban) {
  const propre = normaliserIban(iban)
  return propre.length >= 4 ? `•••• ${propre.slice(-4)}` : null
}

export function normaliserSiret(brut) {
  return typeof brut === 'string' ? brut.replace(/\s+/g, '') : ''
}

/** 14 chiffres, comme la contrainte SQL. */
export function siretValide(brut) {
  return /^\d{14}$/.test(normaliserSiret(brut))
}

/** 6 à 20 caractères (contrainte SQL), chiffres et séparateurs usuels. */
export function telephoneValide(brut) {
  return typeof brut === 'string' && /^(?=.{6,20}$)\+?[0-9 .()-]+$/.test(brut.trim())
}

/** 2 à 120 caractères (contrainte SQL). */
export function titulaireValide(brut) {
  const t = typeof brut === 'string' ? brut.trim() : ''
  return t.length >= 2 && t.length <= 120
}
