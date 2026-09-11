import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Un compte, un client Stripe. Jamais deux.
 *
 * CE QUE CE FICHIER EXISTE POUR ARRÊTER — ACT-39
 *
 * Le 10 septembre 2026, une ligne `clients` vivante a changé de
 * `stripe_customer_id` entre deux clics du même marchand, à vingt minutes
 * d'intervalle. `getOrCreateStripeCustomer` ne recrée que dans trois cas
 * précis, et aucun n'aurait dû s'appliquer.
 *
 * En cherchant, un chemin entier ne passait pas par ce helper :
 * `api/create-checkout-session.js` ouvrait une session Stripe Checkout SANS
 * `customer` ni `customer_email`. Stripe crée alors un client neuf à chaque
 * session — par conception, ce n'est pas un bug de Stripe. Deux ouvertures du
 * même lien de tunnel donnaient donc deux clients pour un prospect, et
 * `stripe_webhook.js:574` écrasait l'identifiant par le second.
 *
 * Le coût n'est pas visible tout de suite : deux historiques de facturation,
 * deux moyens de paiement possibles, et des abonnements que le produit ne
 * voit plus. Ça se découvre au premier litige de paiement.
 *
 * CE QUE CETTE GARDE NE PROUVE PAS
 *
 * Elle ne dit pas que c'est CE chemin qui a produit l'observation du 10
 * septembre — l'inspection des deux clients Stripe reste à faire, et le MCP
 * Stripe ne répond pas. Elle ferme une porte dont on sait qu'elle était
 * ouverte.
 */

function fichiersJs(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules') continue
    const full = join(dir, e)
    if (statSync(full).isDirectory()) fichiersJs(full, acc)
    else if (e.endsWith('.js') && !e.endsWith('.test.js')) acc.push(full)
  }
  return acc
}

/** Retire les commentaires : une garde qui lit du code doit lire du code. */
function sansCommentaires(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('ACT-39 — un compte ne se retrouve jamais avec deux clients Stripe', () => {
  it('toute session Checkout dit à qui elle appartient', () => {
    // La garde qui compte. Une session sans `customer` NI `customer_email`
    // fait naître un client Stripe de plus à chaque ouverture.
    const fautifs = []
    for (const f of fichiersJs('api')) {
      const src = sansCommentaires(readFileSync(f, 'utf8'))
      if (!/checkout\.sessions\.create\(/.test(src)) continue
      if (!/customer:/.test(src) && !/customer_email:/.test(src)) {
        fautifs.push(`${f} — session Checkout sans customer ni customer_email`)
      }
    }
    expect(
      fautifs,
      'Stripe crée un client NEUF pour chaque session sans destinataire. Deux '
      + 'ouvertures = deux clients pour un compte :\n  ' + fautifs.join('\n  '),
    ).toEqual([])
  })

  it('un identifiant réutilisé est vérifié avant de servir', () => {
    // L'autre moitié : réutiliser aveuglément un identifiant périmé (bascule
    // test ↔ live) ferait échouer le paiement au lieu de le dédoubler. Le
    // motif est celui de getOrCreateStripeCustomer — et, comme lui, seul
    // « introuvable » est rattrapable.
    const src = sansCommentaires(readFileSync('api/create-checkout-session.js', 'utf8'))
    expect(src, 'le client réutilisé n’est pas vérifié').toMatch(/customers\.retrieve\(/)
    expect(src, 'une erreur autre qu’introuvable est avalée — une panne réseau '
      + 'produirait alors un client en double')
      .toMatch(/resource_missing[\s\S]{0,120}throw err/)
  })

  it('l’essai se décide sur le vrai client, pas sur un objet fabriqué', () => {
    // `joursEssaiPour` teste `trial_ends_at` EN PREMIER, pour qu'un essai déjà
    // consommé l'emporte sur tous les drapeaux. Lui passer un littéral rend ce
    // garde-fou inopérant : le marchand repasse par un lien de tunnel et
    // repart pour un essai.
    const src = sansCommentaires(readFileSync('api/create-checkout-session.js', 'utf8'))
    expect(src, 'la route ne lit pas trial_ends_at du client rattaché')
      .toMatch(/\.select\('trial_ends_at/)
    expect(src, 'joursEssaiPour reçoit encore un objet construit sur place')
      .not.toMatch(/joursEssaiPour\(\{/)
  })
})
