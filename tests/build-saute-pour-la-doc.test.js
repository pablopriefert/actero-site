import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, readFileSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'

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
function codeDeSortie(env, cwd = process.cwd()) {
  // Les variables VERCEL_* de la machine ne doivent pas fausser le verdict.
  const propre = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('VERCEL_GIT_')))
  try {
    execFileSync('sh', [resolve(SCRIPT)], { cwd, env: { ...propre, ...env }, stdio: 'pipe' })
    return 0
  } catch (e) {
    return typeof e.status === 'number' ? e.status : -1
  }
}

/**
 * Un dépôt git jetable, pour juger le script sur un historique qu'on maîtrise.
 *
 * La première version de ce fichier lançait le script sur le VRAI dépôt, donc
 * sur le dernier commit du moment. Le verdict dépendait de ce que ce commit
 * touchait : sur un commit vide, le test échouait en local. En CI, il passait
 * pour une mauvaise raison — le clone y est superficiel, `HEAD^` n'existe pas,
 * et le script construit par défaut. La comparaison n'était jamais exercée.
 */
const depots = []
afterEach(() => {
  while (depots.length) rmSync(depots.pop(), { recursive: true, force: true })
})

function depot() {
  const dir = mkdtempSync(join(tmpdir(), 'ignore-build-'))
  depots.push(dir)
  const git = (...args) => execFileSync('git', ['-c', 'user.email=test@actero.fr', '-c', 'user.name=Test', ...args], { cwd: dir, stdio: 'pipe' }).toString().trim()
  git('init', '-q', '-b', 'main')
  const commit = (fichiers = {}, message = 'commit') => {
    for (const [chemin, contenu] of Object.entries(fichiers)) {
      mkdirSync(dirname(join(dir, chemin)), { recursive: true })
      writeFileSync(join(dir, chemin), contenu)
    }
    git('add', '-A')
    git('commit', '-q', '--allow-empty', '-m', message)
    return git('rev-parse', 'HEAD')
  }
  commit({ 'src/app.js': 'v1', 'docs/guide.mdx': 'v1' }, 'initial')
  return { dir, commit }
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

  it('un changement de l’application construit', () => {
    const { dir, commit } = depot()
    commit({ 'api/route.js': 'nouveau' })
    expect(codeDeSortie({ VERCEL_GIT_COMMIT_REF: 'main' }, dir)).toBe(1)
  })

  it('un changement limité à docs/ saute le build', () => {
    const { dir, commit } = depot()
    commit({ 'docs/guide.mdx': 'v2' })
    expect(codeDeSortie({ VERCEL_GIT_COMMIT_REF: 'main' }, dir)).toBe(0)
  })

  it('un commit vide construit : c’est une relance volontaire', () => {
    // 14 septembre 2026 : Vercel n'avait pas pris le push d'un correctif de
    // sécurité. Le commit vide poussé pour relancer a été SAUTÉ — aucune
    // différence, donc « limité à docs/ » aux yeux du script. C'est pourtant
    // le geste standard pour redéployer, par exemple après avoir changé une
    // variable d'environnement. « Rien n'a changé » n'est pas « seule la doc a
    // changé ».
    const { dir, commit } = depot()
    commit({}, 'relance')
    expect(codeDeSortie({ VERCEL_GIT_COMMIT_REF: 'main' }, dir),
      'un commit vide est sauté : impossible de forcer un redéploiement').toBe(1)
  })

  it('un push de plusieurs commits est jugé depuis le dernier déploiement, pas depuis le dernier commit', () => {
    // Vercel passe `VERCEL_GIT_PREVIOUS_SHA` : le commit du dernier déploiement
    // réussi. Comparer seulement HEAD^ et HEAD ignore tout ce qui précède : un
    // correctif de l'application suivi d'un commit de doc, poussés ensemble,
    // n'étaient jamais déployés.
    const { dir, commit } = depot()
    const dejaDeploye = commit({ 'src/app.js': 'v2' }, 'déployé')
    commit({ 'api/securite.js': 'correctif' }, 'correctif')
    commit({ 'docs/guide.mdx': 'v2' }, 'doc')
    expect(codeDeSortie({ VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_PREVIOUS_SHA: dejaDeploye }, dir),
      'le correctif poussé avant un commit de doc ne serait jamais déployé').toBe(1)
  })

  it('depuis le dernier déploiement, que de la doc : le build est sauté', () => {
    const { dir, commit } = depot()
    const dejaDeploye = commit({ 'src/app.js': 'v2' }, 'déployé')
    commit({ 'docs/guide.mdx': 'v2' }, 'doc 1')
    commit({ 'docs/autre.mdx': 'v1' }, 'doc 2')
    expect(codeDeSortie({ VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_PREVIOUS_SHA: dejaDeploye }, dir)).toBe(0)
  })

  it('un dernier déploiement introuvable dans le clone : on construit', () => {
    // Clone superficiel : le commit du dernier déploiement peut manquer. On ne
    // sait alors pas ce qui a changé depuis — donc on construit.
    const { dir, commit } = depot()
    commit({ 'docs/guide.mdx': 'v2' })
    expect(codeDeSortie({ VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_PREVIOUS_SHA: 'f'.repeat(40) }, dir)).toBe(1)
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
