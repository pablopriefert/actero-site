import { describe, it, expect } from 'vitest'
import { INTEGRATIONS, ALL_INTEGRATIONS, INTEGRATION_CATEGORIES } from './integrations'

/**
 * Une intégration qu'aucune catégorie ne réclame ne s'affiche nulle part.
 *
 * CE QUE CE FICHIER EXISTE POUR ARRÊTER
 *
 * `ClientIntegrationsView.jsx` construit l'écran des intégrations en partant
 * des CATÉGORIES, pas des intégrations :
 *
 *     const categories = INTEGRATION_CATEGORIES.map((cat) => ({ … cat.ids … }))
 *
 * Une intégration absente de tous les `ids` existe donc dans le code, se
 * connecte peut-être, et n'apparaît sur aucun écran. Aucune erreur : une
 * absence ne se signale pas.
 *
 * LA SECONDE TAXONOMIE, RETIRÉE LE 11 SEPTEMBRE 2026
 *
 * Chaque intégration portait aussi un champ `category`, et il ne valait jamais
 * un identifiant de `INTEGRATION_CATEGORIES` : les douze entrées se
 * répartissaient entre `'ecommerce'` et `'général'`, quand les catégories
 * déclarées s'appellent `ecommerce_platform`, `helpdesk`, `messaging`, `email`,
 * `knowledge` et `product_ops`.
 *
 * Gorgias, Zendesk et Intercom y étaient donc annoncés `'ecommerce'` alors que
 * ce sont des helpdesks — et le groupe `helpdesk` les listait correctement par
 * ailleurs. Deux vérités contradictoires sur la même étagère, dont une seule
 * s'affichait.
 *
 * Le champ n'était lu par personne (trois fichiers importent ce module, aucun
 * ne le touche). Il a été retiré plutôt que corrigé : corriger un champ que
 * rien ne lit ne fait qu'un plus joli mensonge. Ce test garde la taxonomie qui
 * reste — celle dont l'écran se sert.
 */

const TOUTES = ALL_INTEGRATIONS || Object.values(INTEGRATIONS || {}).flat()

describe('catalogue des intégrations', () => {
  it('chaque intégration appartient à une catégorie affichée', () => {
    // La garde qui compte : sans elle, ajouter une intégration sans la ranger
    // la rend invisible, et c'est le genre de défaut qu'on ne voit qu'en
    // cherchant pourquoi un marchand ne trouve pas un connecteur.
    const rangees = new Set(INTEGRATION_CATEGORIES.flatMap((c) => c.ids))
    const orphelines = TOUTES.map((i) => i.id).filter((id) => !rangees.has(id))
    expect(
      orphelines,
      'Intégrations qu’aucune catégorie ne liste — elles n’apparaîtront sur '
      + 'aucun écran :\n  ' + orphelines.join('\n  '),
    ).toEqual([])
  })

  it('aucune catégorie ne réclame une intégration qui n’existe pas', () => {
    // L'autre sens : un identifiant resté dans une catégorie après la
    // suppression du connecteur produit une case vide dans l'écran.
    const existantes = new Set(TOUTES.map((i) => i.id))
    const fantomes = INTEGRATION_CATEGORIES
      .flatMap((c) => c.ids.map((id) => [c.id, id]))
      .filter(([, id]) => !existantes.has(id))
      .map(([cat, id]) => `${cat} → ${id}`)
    expect(fantomes, 'Catégorie listant une intégration inexistante :\n  ' + fantomes.join('\n  ')).toEqual([])
  })

  it('aucune intégration n’est rangée dans deux catégories', () => {
    const vues = new Map()
    const doublons = []
    for (const cat of INTEGRATION_CATEGORIES) {
      for (const id of cat.ids) {
        if (vues.has(id)) doublons.push(`${id} : ${vues.get(id)} et ${cat.id}`)
        else vues.set(id, cat.id)
      }
    }
    expect(doublons, 'Intégration rangée deux fois :\n  ' + doublons.join('\n  ')).toEqual([])
  })

  it('la seconde taxonomie n’est pas revenue', () => {
    // Un champ `category` sur une intégration ne serait lu par personne et
    // recommencerait à diverger du groupe qui, lui, s'affiche.
    const revenues = TOUTES.filter((i) => 'category' in i).map((i) => i.id)
    expect(
      revenues,
      'Champ `category` réintroduit sur une intégration. L’écran groupe via '
      + 'INTEGRATION_CATEGORIES[].ids ; un second classement ne serait pas lu '
      + 'et finirait par le contredire :\n  ' + revenues.join('\n  '),
    ).toEqual([])
  })

  it('le catalogue n’est pas vide — sinon les gardes ci-dessus ne gardent rien', () => {
    // Si l'export change de forme, TOUTES devient [] et les quatre tests
    // passent au vert sans rien vérifier.
    expect(TOUTES.length, 'aucune intégration lue depuis le module').toBeGreaterThan(8)
    expect(INTEGRATION_CATEGORIES.length, 'aucune catégorie lue').toBeGreaterThan(3)
  })
})
