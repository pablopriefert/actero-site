/**
 * Actero Engine — signaux d'escalade déterministes.
 *
 * Deux gardes qui ne dépendent pas du bon vouloir du modèle :
 *
 *  1. `asksForHuman` — le client réclame un humain. Le modèle décide déjà
 *     lui-même s'il faut escalader (`should_escalate`), mais un client qui
 *     demande explicitement un humain ne doit pas dépendre de ce jugement.
 *
 *  2. `findUngroundedReferences` — la réponse cite une référence (numéro de
 *     commande, numéro de suivi) absente des données réelles. Le prompt
 *     l'interdit déjà ; rien ne vérifiait qu'il avait été suivi.
 *
 * Les deux biaisent volontairement vers l'escalade. Un ticket escaladé à tort
 * coûte une minute d'attention ; une réponse inventée coûte un client.
 */

/** Minuscules sans accents — « transférez » et « transferez » se valent. */
function fold(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// Un humain, sous les formes où les clients l'écrivent réellement.
const HUMAIN = '(?:etre\\s+)?humain(?:e|s)?|conseill(?:er|ere)|responsable|operat(?:eur|rice)|superviseur|gestionnaire|technicien(?:ne)?|vrai(?:e)?\\s+(?:gens|personne)|personne\\s+reelle|quelqu\'?un(?:\\s+de\\s+(?:reel|vrai))?'

// Verbes par lesquels on demande à y être renvoyé.
const RENVOI = 'parler|discuter|echanger|passer|passez|repasser|transfer(?:er|ez|e)|rediriger|redirigez|mett(?:re|ez)|joindre|contacter|avoir|donner|basculer'

const MOTIFS = [
  // « je veux parler à un humain », « passez-moi un conseiller », « transférez-moi à un responsable »
  new RegExp(`(?:${RENVOI})[^.!?]{0,30}?(?:${HUMAIN})`, 'i'),
  // « un humain svp », « un vrai conseiller », « une personne réelle »
  new RegExp(`\\b(?:un|une|le|la|de)\\s+(?:vrai(?:e)?\\s+)?(?:${HUMAIN})\\b`, 'i'),
  // « je ne veux pas de robot », « arrêtez le bot », « pas une IA »
  /(?:pas|plus|stop|arret(?:er|ez|e)?|marre|assez)\b[^.!?]{0,25}?\b(?:robot|bot|chatbot|ia\b|intelligence\s+artificielle|machine|automate)/i,
  // « votre robot ne comprend rien » — le client signale que l'agent échoue
  /\b(?:robot|bot|chatbot|ia|machine)\b[^.!?]{0,30}?(?:comprend\s+(?:rien|pas)|sert\s+a\s+rien|nul|inutile|debile)/i,
  // « parler à une personne », « parler à quelqu'un » — « personne » seul est
  // ambigu en français (« il n'y a personne »), on ne l'accepte donc qu'après
  // un verbe de renvoi.
  new RegExp(`(?:${RENVOI})[^.!?]{0,35}?\\b(?:une\\s+personne|quelqu'?un)\\b`, 'i'),
  // demande explicite d'escalade / de remontée
  /\b(?:escalad|superviseur|service\s+client\s+humain|reclamation\s+formelle)/i,
]

/**
 * Le client demande-t-il explicitement un interlocuteur humain ?
 *
 * Volontairement large : rater la demande est bien plus coûteux que d'escalader
 * un ticket de trop.
 */
export function asksForHuman(message) {
  const m = fold(message)
  if (!m) return false
  return MOTIFS.some((re) => re.test(m))
}

/* -------------------------------------------------------------------------- */

// Ce qui ressemble à une référence citable dans une réponse SAV.
const REFERENCES = [
  // numéro de commande : #1042, commande 1042, commande n°1042
  /#\s*(\d{3,10})\b/g,
  /\bcommande\s*(?:n[o°]?\s*)?#?\s*(\d{3,10})\b/gi,
  // numéro de suivi : suite alphanumérique longue, typique des transporteurs
  /\b([A-Z]{2}\d{9}[A-Z]{2})\b/g,
  /\b(\d{10,20})\b/g,
  // références segmentées type ABCD-1234-EFGH. Pas de drapeau insensible à la
  // casse : « Pouvez-vous » est un mot français, pas un numéro de suivi.
  /\b([A-Z0-9]{4,}(?:-[A-Z0-9]{4,})+)\b/g,
]

/** Une référence sans aucun chiffre est un mot, pas un numéro. */
function ressembleAUneReference(ref) {
  return /\d/.test(ref)
}

/**
 * Références citées par la réponse mais absentes des données réelles.
 *
 * `grounding` est le texte des données injectées dans le prompt (commandes
 * Shopify, suivi AfterShip) plus le message du client — ce dernier compte
 * comme source légitime : reprendre le numéro que le client vient de donner
 * n'est pas une invention.
 *
 * @returns {string[]} les références non justifiées, sans doublon.
 */
export function findUngroundedReferences(response, grounding) {
  if (!response) return []
  const source = fold(grounding)
  const trouvees = new Set()

  for (const re of REFERENCES) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(response)) !== null) {
      const ref = m[1]
      if (!ref || !ressembleAUneReference(ref)) continue
      if (!source.includes(fold(ref))) trouvees.add(ref)
    }
  }
  return [...trouvees]
}
