import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Une plateforme qu'on propose doit savoir répondre « où est ma commande ».
 *
 * CE QUE CE FICHIER EXISTE POUR ARRÊTER
 *
 * Le 11 septembre 2026, en cherchant s'il fallait une extension WooCommerce
 * pour que l'agent voie les commandes — il n'en faut pas, le flux d'API REST
 * officiel suffit et il est déjà branché.
 *
 * Mais l'aiguilleur de `api/engine/lib/shopify-client.js` ne connaît que deux
 * plateformes :
 *
 *     if (platform === 'shopify')     return lookupShopifyOrder(...)
 *     if (platform === 'woocommerce') return lookupWooCommerceOrder(...)
 *     return null  // Aucune plateforme e-commerce connectée
 *
 * Or le catalogue en propose TROIS. Un marchand Webflow connecte sa boutique,
 * voit « Connecté », et chaque recherche de commande renvoie `null`. L'agent
 * ne peut répondre à aucune question « où est ma commande » — c'est-à-dire à
 * la question la plus fréquente d'un service après-vente e-commerce.
 *
 * Aucune erreur nulle part. Le commentaire dit même « aucune plateforme
 * e-commerce connectée », alors qu'il y en a une : simplement pas une de
 * celles qu'on sait lire.
 *
 * C'est ACT-40 (Intercom se connectait et ne recevait jamais rien) transposé
 * à la plateforme e-commerce, et c'est un cran plus grave : sans commandes,
 * l'agent n'a plus de produit du tout.
 *
 * POURQUOI DEUX VÉRIFICATIONS ET PAS UNE
 *
 * Lire les commandes demande DEUX choses, dans deux fonctions différentes du
 * même fichier : être détecté comme plateforme connectée
 * (`detectConnectedPlatform`) ET avoir une branche dans l'aiguilleur
 * (`lookupOrder`). Une seule des deux et le marchand obtient `null` — avec, à
 * chaque fois, une raison différente et invisible.
 */

const AIGUILLEUR = readFileSync('api/engine/lib/shopify-client.js', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const CATALOGUE = readFileSync('src/config/integrations.js', 'utf8')

/**
 * Plateformes proposées sans lecture de commandes, chacune avec sa raison.
 * Ajouter une entrée ici est un choix explicite, pas un contournement.
 */
const LACUNES_CONNUES = {
  // (vide — et c'est le but)
}

/** Les plateformes e-commerce proposées au marchand, d'après le catalogue. */
function plateformesProposees() {
  const groupe = CATALOGUE.match(/id: 'ecommerce_platform',[\s\S]*?ids: \[([^\]]*)\]/)
  if (!groupe) return null
  return [...groupe[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
}

describe('plateformes e-commerce — proposer, c’est savoir lire les commandes', () => {
  it('le catalogue des plateformes a bien été lu', () => {
    // Sans ça, la garde ci-dessous itère sur une liste vide et passe au vert
    // sans rien vérifier. Un test qui ne peut pas échouer rassure à tort.
    const p = plateformesProposees()
    expect(p, 'le groupe ecommerce_platform est introuvable dans le catalogue').not.toBeNull()
    expect(p.length, 'aucune plateforme lue').toBeGreaterThan(1)
  })

  it('chaque plateforme proposée est DÉTECTÉE comme connectée', () => {
    // `detectConnectedPlatform` décide quelle plateforme interroger. Une
    // plateforme qu'elle ne connaît pas renvoie `null` : le marchand a beau
    // être connecté, il n'existe pas pour le moteur.
    const detection = AIGUILLEUR.slice(AIGUILLEUR.indexOf('async function detectConnectedPlatform'))
    const absentes = (plateformesProposees() || [])
      .filter((p) => !LACUNES_CONNUES[p])
      .filter((p) => !new RegExp(`['"\`]${p}['"\`]`).test(detection))
    expect(
      absentes,
      'Plateforme proposée au marchand que detectConnectedPlatform ignore — '
      + 'il se connecte, et le moteur ne voit aucune boutique :\n  ' + absentes.join('\n  '),
    ).toEqual([])
  })

  it('chaque plateforme détectée a une branche qui lit ses commandes', () => {
    // La garde qui compte. « Où est ma commande » est la question la plus
    // fréquente d'un SAV e-commerce : sans cette branche, l'agent n'a pas de
    // produit.
    const aiguillage = AIGUILLEUR.slice(
      AIGUILLEUR.indexOf('export async function lookupOrder'),
      AIGUILLEUR.indexOf('async function detectConnectedPlatform'),
    )
    const sansBranche = (plateformesProposees() || [])
      .filter((p) => !LACUNES_CONNUES[p])
      .filter((p) => !new RegExp(`platform === ['"\`]${p}['"\`]`).test(aiguillage))
    expect(
      sansBranche,
      'Plateforme proposée sans lecture de commandes. Le marchand voit '
      + '« Connecté » et l’agent répond `null` à chaque « où est ma commande », '
      + 'sans une erreur pour le signaler :\n  ' + sansBranche.join('\n  '),
    ).toEqual([])
  })

  it('toute lacune assumée porte une raison écrite', () => {
    // Même règle que canaux-entrants.test.js : une dispense sans raison est
    // un contournement, et une raison que plus personne ne relit autorise
    // silencieusement le retour du défaut.
    const muettes = Object.entries(LACUNES_CONNUES)
      .filter(([, raison]) => !raison || String(raison).trim().length < 15)
      .map(([p]) => p)
    expect(muettes, 'Lacune sans raison lisible :\n  ' + muettes.join('\n  ')).toEqual([])
  })

  it('aucune lacune n’est orpheline', () => {
    // Une dispense pour une plateforme qu'on ne propose plus traîne et finit
    // par couvrir autre chose que ce qu'elle décrivait.
    const proposees = new Set(plateformesProposees() || [])
    const orphelines = Object.keys(LACUNES_CONNUES).filter((p) => !proposees.has(p))
    expect(
      orphelines,
      'Lacune à supprimer, cette plateforme n’est plus proposée :\n  ' + orphelines.join('\n  '),
    ).toEqual([])
  })
})
