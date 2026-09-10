import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PLAN_FEATURES } from './plan-limits.js'
import { PLANS } from '../../src/lib/plans.js'

/**
 * ACT-35 — ce qu'on vend doit exister, et ce qui est payant doit être gardé
 * ailleurs que dans le navigateur.
 *
 * Trois défauts réels, trouvés le 10 septembre en auditant la page tarifs
 * avant la campagne publicitaire. Les trois étaient invisibles : aucun ne
 * provoquait la moindre erreur.
 */

const PLANS_ATTENDUS = ['free', 'starter', 'pro', 'enterprise']

describe('fonctionnalités par plan', () => {
  it('le miroir serveur déclare exactement les mêmes fonctionnalités que la source', () => {
    // `api/lib/plan-limits.js` s'annonce « Backend mirror of src/lib/plans.js »
    // et demande que tout changement atterrisse dans les DEUX fichiers. Rien
    // ne le vérifiait.
    //
    // Résultat au 10 septembre : `portal_enabled` et `portal_customization`
    // n'existaient tout simplement PAS côté serveur. Toute vérification
    // serveur de ces clés répondait donc « non » pour tous les plans, quoi
    // qu'annonce la source. Un miroir incomplet ment plus discrètement qu'un
    // miroir faux : on lit les deux fichiers, on voit la même chose, et la
    // clé manquante ne saute pas aux yeux.
    const divergences = []
    for (const plan of PLANS_ATTENDUS) {
      const source = PLANS[plan]?.features
      const miroir = PLAN_FEATURES[plan]
      expect(source, `src/lib/plans.js n'a pas de plan ${plan}`).toBeTruthy()
      expect(miroir, `api/lib/plan-limits.js n'a pas de plan ${plan}`).toBeTruthy()

      const cles = new Set([...Object.keys(source), ...Object.keys(miroir)])
      for (const cle of cles) {
        if (source[cle] !== miroir[cle]) {
          divergences.push(
            `${plan}.${cle} : plans.js = ${JSON.stringify(source[cle])} `
            + `≠ plan-limits.js = ${JSON.stringify(miroir[cle])}`,
          )
        }
      }
    }
    expect(divergences, `Miroir désynchronisé :\n${divergences.join('\n')}`).toEqual([])
  })

  it('le portail client est ouvert sur les plans où il est vendu', () => {
    // Il était fermé sur les QUATRE plans, Enterprise compris, pendant que la
    // page tarifs vendait « White-label du widget et du portail ». La vue
    // existait, elle était montée, elle testait ce booléen : une porte
    // verrouillée pour celui qui payait précisément pour l'ouvrir.
    //
    // Si quelqu'un le referme, c'est que la promesse doit disparaître de la
    // page tarifs en même temps — d'où ce test plutôt qu'un commentaire.
    for (const plan of ['pro', 'enterprise']) {
      expect(PLANS[plan].features.portal_enabled, `portail fermé sur ${plan}`).toBe(true)
      expect(PLANS[plan].features.portal_customization, `marque blanche fermée sur ${plan}`).toBe(true)
    }

    const tarifs = readFileSync('src/pages/PricingPage.jsx', 'utf8')
    expect(tarifs, 'le portail n\'est plus vendu sur la page tarifs').toMatch(/Portail client/)
  })

  it('activer une fonctionnalité payante est refusé côté serveur, pas seulement grisé', () => {
    // `api/client/toggle-portal.js` ne vérifiait aucun plan. Le seul obstacle
    // était le bouton grisé dans PortalSavView : n'importe quel compte, Free
    // compris, ouvrait son portail en appelant la route directement.
    //
    // Une fonctionnalité payante gardée uniquement par l'interface n'est pas
    // gardée — elle est simplement discrète.
    const src = readFileSync('api/client/toggle-portal.js', 'utf8')
    expect(src, 'toggle-portal.js n\'importe plus de vérification d\'entitlement')
      .toMatch(/import \{[^}]*clientHasEntitlement[^}]*\} from/)
    expect(src, 'toggle-portal.js n\'appelle plus clientHasEntitlement avant d\'activer')
      .toMatch(/clientHasEntitlement\(\s*supabase,\s*clientId,\s*['"]portal_enabled['"]\s*\)/)
  })
})
