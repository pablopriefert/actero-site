import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * ACT-35 — après connexion, le client doit pouvoir atteindre ses commandes.
 *
 * Trouvé le 10 septembre en parcourant le portail pour de vrai, en production,
 * sur le compte de démonstration. Aucun test ne pouvait l'attraper : les
 * routes répondaient toutes 200, la session était valide, la page des
 * conversations s'affichait correctement. Il manquait simplement la barre de
 * navigation, et rien ne le signalait.
 *
 * La mécanique : `PortalLayout` est monté par `PortalApp` autour de la page
 * courante, donc il l'est déjà quand la page de vérification tourne — c'est-
 * à-dire AVANT que le cookie de session existe. Son `usePortalAuth` répond
 * « non connecté », et ne redemande jamais : `PortalApp` ne remplace que la
 * page intérieure, jamais la coquille. Le client arrivait donc sur ses
 * conversations sans barre de navigation et sans déconnexion, avec pour seul
 * remède un rechargement manuel qu'il n'a aucune raison de tenter.
 *
 * Conséquence : il ne pouvait pas atteindre ses commandes — la seule raison
 * d'ouvrir un espace SAV.
 */

const VERIFY = readFileSync('src/pages/portal/PortalVerifyPage.jsx', 'utf8')
const LAYOUT = readFileSync('src/pages/portal/PortalLayout.jsx', 'utf8')

describe('navigation du portail après connexion', () => {
  it('la connexion réussie provoque une navigation complète, pas interne', () => {
    // La ligne fautive était : if (r.ok) { setState('ok'); navigate('/portal/tickets') }
    const brut = VERIFY.match(/if \(r\.ok\) \{[\s\S]*?\n      \}/)?.[0] || ''
    expect(brut, 'bloc de succès de la vérification introuvable').toBeTruthy()
    // Les commentaires sont retirés avant l'analyse : celui qui explique ce
    // correctif cite `navigate()` pour dire de ne pas s'en servir, et faisait
    // échouer ce test. Même piège que les gardes écrites le 8 septembre —
    // un test qui lit du code doit lire du code, pas de la prose.
    const reussite = brut.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    expect(reussite, 'la navigation interne laisse la coquille sur un état « non connecté »')
      .not.toMatch(/\bnavigate\(/)
    expect(reussite, 'il faut une navigation complète pour que PortalLayout se remonte avec le cookie')
      .toMatch(/window\.location\.(assign|replace|href)/)
  })

  it('la coquille montre bien une navigation aux clients connectés', () => {
    // Si quelqu'un retire ces entrées, le correctif ci-dessus ne sert plus à
    // rien : le client serait de nouveau sans issue vers ses commandes.
    expect(LAYOUT).toMatch(/\/portal\/orders/)
    expect(LAYOUT).toMatch(/Commandes/)
    expect(LAYOUT).toMatch(/Déconnexion/)
  })
})
