import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Un webhook livré correctement s'acquitte, même quand on n'a rien à en faire.
 *
 * CE QUI A ÉTÉ CONSTATÉ LE 11 SEPTEMBRE 2026
 *
 * Le Dev Dashboard de Shopify affichait, sur l'app en cours d'examen, un taux
 * d'échec des webhooks de **33,3 %** sur sept jours. Trois abonnements hors
 * conformité, un qui échoue systématiquement : le compte tombe juste.
 *
 * Le fautif était `api/engine/webhooks/shopify-cart.js`, seul des six
 * gestionnaires à renvoyer un code d'erreur pour une condition MÉTIER :
 *
 *     if (!connection) return res.status(404).json({ error: 'Client not found' })
 *
 * Shopify compte tout code non-2xx comme une livraison ratée. Il réessaie,
 * fait monter le taux affiché, et finit par RETIRER l'abonnement — donc par
 * couper la relance de panier abandonné, en silence.
 *
 * Or le cas est parfaitement normal : une boutique désinstalle l'app, Shopify
 * livre un `checkouts/create` encore en file d'attente, et la connexion
 * n'existe plus. Constaté le 8 septembre — `appstoretest9` installée à 17:13,
 * désinstallée à 17:14.
 *
 * LA RÈGLE
 *
 * Un échec doit signifier « réessaie, ça peut marcher » : corps illisible,
 * signature invalide, panne de notre côté. Tout le reste s'acquitte avec un
 * 200 et une raison. Le fichier le faisait déjà pour « pas d'email client »
 * et « playbook inactif » — il était incohérent avec lui-même.
 */

const GESTIONNAIRES = [
  'api/engine/webhooks/shopify-cart.js',
  'api/shopify/webhooks/app/uninstalled.js',
  'api/shopify/webhooks/app/subscriptions-update.js',
  'api/shopify/webhooks/customers/data-request.js',
  'api/shopify/webhooks/customers/redact.js',
  'api/shopify/webhooks/shop/redact.js',
]

/** Retire les commentaires : une garde qui lit du code doit lire du code. */
function sansCommentaires(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** Ce qui légitime un code d'échec : un problème de transport, pas de métier. */
const MOTIFS_LEGITIMES = /hmac|signature|secret|method not allowed|read request body|invalid json|internal_error/i

describe('acquittement des webhooks Shopify', () => {
  it('aucun gestionnaire ne renvoie d\'échec pour une raison métier', () => {
    const fautifs = []
    for (const f of GESTIONNAIRES) {
      const src = sansCommentaires(readFileSync(f, 'utf8'))
      for (const m of src.matchAll(/res\.status\((4\d\d|5\d\d)\)[^\n]*/g)) {
        if (!MOTIFS_LEGITIMES.test(m[0])) {
          fautifs.push(`${f} → ${m[0].trim().slice(0, 80)}`)
        }
      }
    }
    expect(
      fautifs,
      'Shopify compte ces réponses comme des livraisons ratées : il réessaie, '
      + 'puis retire l\'abonnement. Acquittez avec 200 + une raison :\n' + fautifs.join('\n'),
    ).toEqual([])
  })

  it('le gestionnaire de panier acquitte une boutique non rattachée', () => {
    // Le cas exact qui produisait les 33,3 %.
    const src = sansCommentaires(readFileSync('api/engine/webhooks/shopify-cart.js', 'utf8'))
    const bloc = src.slice(src.indexOf('if (!connection)'), src.indexOf('if (!connection)') + 220)
    expect(bloc, 'une boutique inconnue est encore traitée comme un échec')
      .toMatch(/status\(200\)/)
  })

  it('une panne de notre côté reste un échec, pour que Shopify réessaie', () => {
    // La nuance qui compte : tout acquitter serait aussi faux. Une erreur
    // interne doit provoquer une nouvelle tentative.
    const src = sansCommentaires(readFileSync('api/engine/webhooks/shopify-cart.js', 'utf8'))
    expect(src, 'le bloc catch devrait renvoyer 500 pour déclencher un réessai')
      .toMatch(/catch[\s\S]{0,200}status\(500\)/)
  })

  it('aucun message d\'erreur interne ne part chez Shopify', () => {
    // `res.status(500).json({ error: err.message })` exposait nos messages
    // d'exception dans une réponse publique.
    const fautifs = []
    for (const f of GESTIONNAIRES) {
      const src = sansCommentaires(readFileSync(f, 'utf8'))
      if (/status\(5\d\d\)[^\n]*err(or)?\.message/.test(src)) fautifs.push(f)
    }
    expect(fautifs, 'Message d\'exception renvoyé à Shopify :\n' + fautifs.join('\n')).toEqual([])
  })
})
