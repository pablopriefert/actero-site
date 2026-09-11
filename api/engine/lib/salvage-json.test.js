import { describe, it, expect } from 'vitest'
import { looksLikeTruncatedEnvelope, salvageResponseText } from './salvage-json.js'

/**
 * ACT-8 — une enveloppe JSON tronquée ne doit pas partir au client.
 *
 * Cas 13 du banc du 9 septembre : « ma commande #99999999 n'arrive pas ».
 * Classé `suivi_commande` à 0,90 — donc au-dessus du seuil, donc envoyé sans
 * revue humaine. Le client a reçu :
 *
 *     { "response": "Je comprends votre inquietude concernant votre commande
 *     #99999999. Vous devriez avoir recu un email avec un lien de suivi lors
 *     de l expedition ; vous pouvez aussi consulter le statut dans votre
 *     espace clie
 *
 * Cause : `maxTokens: 400` coupe la réponse en pleine chaîne. `JSON.parse`
 * échoue, la recherche d'accolade fermante échoue aussi, et le repli des deux
 * clients LLM plaçait `rawText` entier dans le champ `response`.
 */

const TRONQUEE = '{ "response": "Je comprends votre inquietude concernant votre commande #99999999. Vous devriez avoir recu un email avec un lien de suivi lors de l expedition ; vous pouvez aussi consulter le statut dans votre espace clie'

describe('ACT-8 — enveloppe JSON tronquée', () => {
  it('reconnaît une enveloppe coupée', () => {
    expect(looksLikeTruncatedEnvelope(TRONQUEE)).toBe(true)
  })

  it('ne confond pas un JSON valide avec une troncature', () => {
    const valide = JSON.stringify({ response: 'Votre colis arrive jeudi.', confidence: 0.9 })
    expect(looksLikeTruncatedEnvelope(valide)).toBe(false)
  })

  it('ne confond pas une réponse en texte simple avec une troncature', () => {
    // Un modèle qui répond en clair au lieu de JSON : c'est utilisable tel
    // quel, il ne faut pas escalader pour autant.
    expect(looksLikeTruncatedEnvelope('Bonjour, votre colis arrive jeudi.')).toBe(false)
  })

  it('ne prend pas un objet JSON quelconque pour notre contrat', () => {
    expect(looksLikeTruncatedEnvelope('{ "foo": "bar"')).toBe(false)
  })

  it('récupère la dernière phrase complète et jette le fragment', () => {
    const texte = salvageResponseText(TRONQUEE)
    expect(texte).toBe('Je comprends votre inquietude concernant votre commande #99999999.')
    // Ce qui compte : plus d'accolade, plus de nom de champ, plus de moitié
    // de phrase.
    expect(texte).not.toContain('{')
    expect(texte).not.toContain('"response"')
    expect(texte).not.toContain('espace clie')
  })

  it('restitue les échappements', () => {
    const brut = '{ "response": "Ligne un.\\nLigne \\"deux\\". Fin.'
    expect(salvageResponseText(brut)).toBe('Ligne un.\nLigne "deux". Fin.')
  })

  it('renvoie null quand il n’y a rien à sauver', () => {
    expect(salvageResponseText('{ "confidence": 0.5')).toBeNull()
  })
})
