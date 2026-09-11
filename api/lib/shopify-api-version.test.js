import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { SHOPIFY_API_VERSION } from './shopify-api-version.js'

/**
 * La version de l'API Shopify est déclarée à deux endroits qui doivent
 * s'accorder — et rien ne les tenait ensemble.
 *
 *   shopify.app.actero.toml   `api_version`   décide du format des webhooks
 *                                             que Shopify nous ENVOIE
 *   api/lib/shopify-api-version.js             décide de la version à laquelle
 *                                             on INTERROGE l'API Admin
 *
 * CE QUI A ÉTÉ CONSTATÉ LE 11 SEPTEMBRE 2026
 *
 * Le Dev Dashboard de Shopify affichait deux alertes sur l'app en examen :
 * « appels effectués avec des jetons hors ligne obsolètes » et un taux d'échec
 * des webhooks de 33,3 %.
 *
 *   TOML                      2026-04
 *   code                      2025-01, à douze endroits
 *   revoke-integrations.js    2025-07, une exception isolée
 *
 * Shopify maintient chaque version douze mois : `2025-01` était hors support
 * depuis huit mois. Les webhooks arrivaient au format 2026-04 pendant que le
 * code interrogeait l'API en 2025-01.
 *
 * POURQUOI PERSONNE NE L'AVAIT VU
 *
 * Une version qui dérive ne casse rien tout de suite. Les champs demandés
 * existent encore, les réponses arrivent, et l'écart ne se manifeste qu'au
 * moment où Shopify retire un champ — ou dans un tableau de bord que personne
 * ne consulte. C'est la forme habituelle : deux valeurs qui doivent s'accorder,
 * et aucune des deux ne sait que l'autre existe.
 */

const TOML = 'shopify.app.actero.toml'

function fichiersApi(dir = 'api', acc = []) {
  for (const entree of readdirSync(dir)) {
    const chemin = join(dir, entree)
    if (statSync(chemin).isDirectory()) fichiersApi(chemin, acc)
    else if (entree.endsWith('.js') && !entree.includes('.test.')) acc.push(chemin)
  }
  return acc
}

/** Retire les commentaires : une garde qui lit du code doit lire du code. */
function sansCommentaires(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('version de l\'API Shopify', () => {
  it('le code interroge la même version que celle des webhooks du TOML', () => {
    const toml = readFileSync(TOML, 'utf8')
    const declaree = toml.match(/^\s*api_version\s*=\s*"([^"]+)"/m)?.[1]

    expect(declaree, `${TOML} ne déclare aucune api_version`).toBeTruthy()
    expect(
      SHOPIFY_API_VERSION,
      `Désaccord : le TOML reçoit les webhooks en ${declaree}, le code interroge `
      + `l'API en ${SHOPIFY_API_VERSION}. C'est l'écart qui a produit 33 % d'échec `
      + `de webhooks le 11 septembre.`,
    ).toBe(declaree)
  })

  it('aucune route ne réécrit une version en dur', () => {
    // Douze fichiers la portaient en dur, dont un avec sa propre exception.
    // Sans cette garde, le treizième arrive sans que personne ne le remarque.
    const fautifs = []
    for (const f of fichiersApi()) {
      if (f.endsWith('shopify-api-version.js')) continue
      const src = sansCommentaires(readFileSync(f, 'utf8'))
      if (/\/admin\/api\/20\d\d-\d\d\//.test(src)) {
        fautifs.push(`${f} — version Shopify écrite en dur dans une URL`)
      }
      if (/(GRAPHQL_API_VERSION|SHOPIFY_API_UNINSTALL)\s*=\s*['"]20\d\d-\d\d['"]/.test(src)) {
        fautifs.push(`${f} — constante de version locale`)
      }
    }
    expect(
      fautifs,
      'La version Shopify doit venir de api/lib/shopify-api-version.js :\n' + fautifs.join('\n'),
    ).toEqual([])
  })

  it('la version reste dans la fenêtre de support de Shopify', () => {
    // Shopify publie une version par trimestre et en maintient chacune douze
    // mois. Une version vieille de plus d'un an n'est plus supportée : c'est
    // l'état dans lequel `2025-01` a passé huit mois sans que rien ne le dise.
    //
    // La date de référence est figée : un test ne doit pas dépendre de l'heure
    // à laquelle on le lance. À réajuster en même temps que la version.
    const AUJOURDHUI = new Date('2026-09-11')
    const [an, mois] = SHOPIFY_API_VERSION.split('-').map(Number)
    const sortie = new Date(Date.UTC(an, mois - 1, 1))
    const moisEcoules = (AUJOURDHUI - sortie) / (1000 * 60 * 60 * 24 * 30.44)

    expect(
      moisEcoules,
      `${SHOPIFY_API_VERSION} a ${Math.round(moisEcoules)} mois — hors de la `
      + `fenêtre de support de douze mois. Montez la version ET l'api_version du TOML.`,
    ).toBeLessThan(12)
  })

  it('les requêtes n\'utilisent aucun champ retiré des versions récentes', () => {
    // Vérifié avant la montée de 2025-01 à 2026-04 : `fulfillmentStatus`,
    // `financialStatus` et `totalPrice` sont dépréciés sur Order. Les requêtes
    // emploient déjà `displayFulfillmentStatus`, `displayFinancialStatus` et
    // `totalPriceSet` — c'est ce qui a rendu la montée sûre.
    //
    // Les mêmes mots existent comme propriétés de NOS objets JavaScript : on ne
    // regarde donc qu'à l'intérieur des requêtes GraphQL.
    const fautifs = []
    for (const f of fichiersApi()) {
      const src = readFileSync(f, 'utf8')
      for (const [, bloc] of src.matchAll(/`([^`]*(?:query|mutation)\s[^`]*)`/g)) {
        for (const champ of ['fulfillmentStatus', 'financialStatus', 'totalPrice']) {
          if (new RegExp(`^\\s*${champ}\\s*$`, 'm').test(bloc)) {
            fautifs.push(`${f} — champ déprécié « ${champ} » dans une requête`)
          }
        }
      }
    }
    expect(
      fautifs,
      'Champ retiré ou déprécié dans une requête GraphQL :\n' + fautifs.join('\n'),
    ).toEqual([])
  })
})
