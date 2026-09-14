/**
 * Récupération d'une réponse d'agent quand le contrat JSON n'a pas tenu.
 *
 * Les agents demandent au modèle un objet JSON (`JSON_OUTPUT_CONTRACT`). Quand
 * `JSON.parse` échoue, les deux clients LLM retombaient sur le même repli :
 * mettre `rawText` — l'enveloppe entière — dans le champ `response`. Le client
 * recevait donc littéralement :
 *
 *     { "response": "Je comprends votre inquietude concernant votre commande…
 *
 * Constaté sur le banc du 9 septembre, cas 13, envoyé sans revue humaine.
 *
 * La cause n'est pas un modèle capricieux mais `maxTokens: 400` : la réponse
 * est coupée en pleine chaîne, le JSON n'a plus d'accolade fermante, et aucune
 * des tentatives d'extraction ne peut aboutir.
 *
 * Deux gardes ici :
 *   1. on récupère la valeur de "response" même dans une enveloppe tronquée ;
 *   2. si l'enveloppe était bien du JSON coupé, on escalade — une réponse
 *      amputée en milieu de phrase n'est pas envoyable telle quelle.
 */

/** L'enveloppe ressemble-t-elle à notre contrat JSON, en morceaux ? */
export function looksLikeTruncatedEnvelope(rawText) {
  const t = (rawText || '').trim()
  if (!t.startsWith('{')) return false
  // Le contrat commence toujours par la clé "response".
  if (!/"response"\s*:/.test(t)) return false
  try {
    JSON.parse(t)
    return false // parsable : ce n'est pas une troncature
  } catch {
    return true
  }
}

/**
 * Extrait le texte destiné au client d'une enveloppe JSON tronquée.
 *
 * @returns {string|null} le texte, ou null si rien d'exploitable.
 */
export function salvageResponseText(rawText) {
  const t = (rawText || '').trim()
  const m = t.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)/)
  if (!m || !m[1]) return null

  let texte = m[1]
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .trim()

  // La troncature coupe en plein milieu : on s'arrête à la dernière phrase
  // complète plutôt que de livrer un fragment.
  const finPhrase = Math.max(texte.lastIndexOf('. '), texte.lastIndexOf('! '), texte.lastIndexOf('? '))
  const dernierPoint = /[.!?]$/.test(texte)
  if (!dernierPoint && finPhrase > 40) {
    texte = texte.slice(0, finPhrase + 1)
  }

  return texte || null
}
