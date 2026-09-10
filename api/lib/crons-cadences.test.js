import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * ACT-23 — la cadence d'un cron est déclarée trois fois.
 *
 *   vercel.json                 ce que la plateforme déclenche réellement
 *   withCronMonitor(...)        ce que Sentry attend, et donc ce sur quoi il alerte
 *   docs/crons-cadences.md      pourquoi cette cadence, et quand la changer
 *
 * Rien ne vérifiait qu'elles s'accordent. La divergence est particulièrement
 * vicieuse entre les deux premières : `api/lib/cron-monitor.js` dit
 * explicitement « Sentry will alert if the job misses its expected schedule ».
 * Ralentir un cron dans `vercel.json` en oubliant son moniteur ne casse rien —
 * ça produit une fausse alerte à chaque exécution manquée, jusqu'à ce que plus
 * personne ne regarde les alertes.
 *
 * Le troisième fichier est là pour une raison différente. Trois des cadences
 * actuelles ont été calibrées sur un système vide (zéro playbook actif, zéro
 * événement produit). Une cadence choisie pour un système vide devient un
 * défaut silencieux quand il ne l'est plus : le cron tourne, ne renvoie pas
 * d'erreur, et fait simplement son travail trop tard. La condition pour la
 * remettre doit être écrite quelque part, et rester à jour.
 */

const CRONS_VERCEL = JSON.parse(readFileSync('vercel.json', 'utf8')).crons
const DOC = readFileSync('docs/crons-cadences.md', 'utf8')

/** Cadence déclarée dans le withCronMonitor de chaque fichier de cron. */
function cadencesDesFichiers() {
  const trouvees = {}
  for (const fichier of readdirSync('api/cron')) {
    if (!fichier.endsWith('.js') || fichier.endsWith('.test.js')) continue
    const src = readFileSync(join('api/cron', fichier), 'utf8')
    const m = src.match(/withCronMonitor\(\s*'[^']+',\s*'([^']+)'/)
    if (m) trouvees[`/api/cron/${fichier.replace(/\.js$/, '')}`] = m[1]
  }
  return trouvees
}

describe('cadences des crons — trois déclarations, une seule vérité', () => {
  const duFichier = cadencesDesFichiers()

  it('chaque cron de vercel.json a un moniteur Sentry', () => {
    const sansMoniteur = CRONS_VERCEL.map((c) => c.path).filter((p) => !duFichier[p])
    expect(sansMoniteur, `Sans withCronMonitor : ${sansMoniteur.join(', ')}`).toEqual([])
  })

  it('la cadence du moniteur est celle que Vercel déclenche', () => {
    // Une divergence ici ne casse rien à l'exécution : elle fabrique des
    // fausses alertes Sentry, ce qui est pire qu'une absence d'alerte.
    const divergences = CRONS_VERCEL
      .filter((c) => duFichier[c.path] && duFichier[c.path] !== c.schedule)
      .map((c) => `${c.path} : vercel.json "${c.schedule}" ≠ moniteur "${duFichier[c.path]}"`)
    expect(divergences, divergences.join('\n')).toEqual([])
  })

  it('chaque cron est documenté avec sa cadence et sa raison', () => {
    const absents = CRONS_VERCEL
      .map((c) => ({ nom: c.path.split('/').pop(), schedule: c.schedule }))
      .filter(({ nom, schedule }) =>
        // N'importe quelle ligne du document doit porter les deux : le
        // document contient plusieurs tableaux, dont un de mesure qui cite les
        // crons sans leur cadence.
        !DOC.split('\n').some((l) => l.includes(`\`${nom}\``) && l.includes(`\`${schedule}\``)),
      )
      .map(({ nom, schedule }) => `${nom} (${schedule})`)
    expect(
      absents,
      `Absents de docs/crons-cadences.md, ou avec une cadence périmée : ${absents.join(', ')}`,
    ).toEqual([])
  })

  it('aucune cadence sous la minute', () => {
    // Une erreur de frappe (`* * * * *` au lieu de `*/5 * * * *`) multiplie les
    // invocations par cinq sans que rien ne le signale.
    const trop = CRONS_VERCEL.filter((c) => c.schedule.startsWith('* '))
    expect(trop.map((c) => c.path), 'Cadence à la minute').toEqual([])
  })
})
