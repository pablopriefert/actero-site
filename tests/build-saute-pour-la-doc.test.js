import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

/**
 * Le robot de documentation ne doit plus reconstruire l'application.
 *
 * CE QUE CE FICHIER PROTÈGE
 *
 * Le 10 septembre 2026, Pablo attendait ses déploiements : vingt minutes pour
 * trente secondes de compilation. Relevé sur deux builds terminés :
 *
 *   compilation du site (Vite)        ~30 s
 *   prégénération des 27 pages SEO     ~1 s
 *   empaquetage de 343 fonctions   13-15 min   ← aucun journal pendant ce temps
 *   téléversement                    5-6 min
 *
 * Vingt déploiements en quatre-vingt-seize minutes, dont sept lancés par le
 * robot Mintlify. Les builds ne ralentissaient pas, ils ATTENDAIENT : sur
 * l'écran de Vercel, la durée affichée était exactement l'âge du déploiement.
 *
 * Le robot a produit CENT commits et ne touche que `docs/`. Rien dans
 * `vite.config.js`, `index.html`, `src/` ou `api/` ne lit ce dossier — la
 * documentation est hébergée par Mintlify, pas par cette application. Chacun de
 * ces cent commits reconstruisait donc 343 fonctions pour un `.mdx` qui n'entre
 * dans aucun bundle.
 *
 * La règle qui l'empêche tient dans un fichier de quinze lignes utiles. Elle
 * peut disparaître d'un `vercel.json` sans que rien ne casse : les
 * déploiements repartiraient simplement à vingt minutes, et il faudrait de
 * nouveau une demi-journée pour comprendre pourquoi.
 */

const SCRIPT = 'scripts/vercel-ignore-build.sh'

/** Lance le script comme Vercel le ferait, et renvoie son code de sortie. */
function codeDeSortie(env) {
  try {
    execFileSync('sh', [SCRIPT], { env: { ...process.env, ...env }, stdio: 'pipe' })
    return 0
  } catch (e) {
    return typeof e.status === 'number' ? e.status : -1
  }
}

describe('le build est sauté pour la documentation, et seulement pour elle', () => {
  it('vercel.json branche encore la règle', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
    expect(vercel.ignoreCommand, 'plus rien ne filtre les builds inutiles')
      .toMatch(/vercel-ignore-build\.sh/)
  })

  it('le script existe et reste exécutable', () => {
    expect(existsSync(SCRIPT), `${SCRIPT} a disparu`).toBe(true)
    // Sans le bit d'exécution, `sh script` marche encore — mais un futur passage
    // à `./script` échouerait, et Vercel construirait tout, en silence.
    expect(statSync(SCRIPT).mode & 0o111, 'le script n\'est plus exécutable').toBeGreaterThan(0)
  })

  it('une branche du robot saute le build', () => {
    expect(codeDeSortie({ VERCEL_GIT_COMMIT_REF: 'mintlify/40721bed' })).toBe(0)
  })

  it('la branche principale construit', () => {
    // HEAD porte du code applicatif : il faut construire.
    expect(codeDeSortie({ VERCEL_GIT_COMMIT_REF: 'main' })).toBe(1)
  })

  it('en cas de doute, on construit — jamais l\'inverse', () => {
    // C'est la propriété qui rend cette optimisation sûre. Un dépôt sans
    // historique (clone superficiel, premier commit) fait échouer `git diff` ;
    // le script doit alors demander un build, pas en sauter un.
    const source = readFileSync(SCRIPT, 'utf8')
    expect(source.trimEnd().endsWith('exit 1'), 'le script ne finit pas par construire')
      .toBe(true)
  })

  it('rien dans l\'application ne lit docs/', () => {
    // Toute la règle repose là-dessus. Si un jour une page importait un `.mdx`
    // de `docs/`, sauter le build deviendrait un moyen de déployer du contenu
    // périmé — et ça ne se verrait qu'en production.
    const config = readFileSync('vite.config.js', 'utf8') + readFileSync('index.html', 'utf8')
    expect(config).not.toMatch(/['"`][^'"`]*\bdocs\//)
  })
})
