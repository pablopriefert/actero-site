import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Un seul fournisseur, un seul modèle — garde rejouable en CI.
 *
 * Le 9 septembre 2026, la plateforme appelait des modèles Claude par cinq
 * chemins différents :
 *
 *   api/lib/llm.js                    OpenRouter + Sonnet 5      ← la référence
 *   api/client-copilot.js             SDK Anthropic, Sonnet 4.5
 *   api/lib/proactive-action.js       SDK Anthropic, Sonnet 4.5
 *   api/lib/kpi-tools.js              SDK Anthropic, Sonnet 4.5
 *   api/engine/copilot-drafts.js      SDK Anthropic, Opus 4.7
 *   api/admin/ai-terminal.js          SDK Anthropic, Sonnet 5
 *   e2b-sandbox/.../kb_deep_crawl.py  fetch direct, Sonnet 4 (mai 2025)
 *
 * Aucun de ces appels n'était en panne, et c'est précisément le problème : un
 * second chemin d'accès au modèle ne se signale jamais par une erreur. Il se
 * signale par une facture séparée, un modèle qui dérive derrière celui qu'on
 * croit utiliser, et un changement de configuration (LLM_PROVIDER,
 * OPENROUTER_MODEL) qui ne s'applique qu'à une partie du produit.
 *
 * Ce test ne juge pas la qualité des appels : il vérifie qu'il n'existe plus
 * qu'une porte de sortie vers le modèle.
 */

const RACINES = ['api', 'e2b-sandbox']

/**
 * Chaque exemption porte sa raison. Un fichier sans raison n'est pas une
 * exemption, c'est un oubli.
 */
const EXEMPTIONS = {
  'api/lib/llm.js':
    "L'abstraction fournisseur elle-même. Elle contient le chemin Anthropic natif, " +
    "emprunté uniquement si LLM_PROVIDER=anthropic.",
  'api/engine/lib/claude-client.js':
    "Client de repli du moteur : llm-client.js route openrouter → anthropic en cas " +
    "d'échec. Le repli doit pouvoir joindre Anthropic, et il est sur claude-sonnet-5.",
  'api/cron/agent-healthcheck.js':
    "Sonde de disponibilité. Elle interroge délibérément chaque fournisseur, dont " +
    "Anthropic, pour détecter une dépréciation de modèle avant les clients.",
}

function fichiersSources(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const entree of readdirSync(dir)) {
    if (entree === 'node_modules' || entree.startsWith('.')) continue
    const chemin = join(dir, entree)
    if (statSync(chemin).isDirectory()) fichiersSources(chemin, acc)
    else if (/\.(js|mjs|py)$/.test(entree) && !entree.endsWith('.test.js')) acc.push(chemin)
  }
  return acc
}

const FICHIERS = RACINES.flatMap((r) => fichiersSources(r))

function contrevenants(motif) {
  return FICHIERS.filter((f) => {
    if (EXEMPTIONS[f]) return false
    return motif.test(readFileSync(f, 'utf8'))
  })
}

describe('un seul chemin vers le modèle', () => {
  it('aucun fichier n\'importe le SDK Anthropic', () => {
    // Zéro exemption : plus rien n'utilise le SDK depuis la bascule.
    const fautifs = FICHIERS.filter((f) => /@anthropic-ai\/sdk/.test(readFileSync(f, 'utf8')))
    expect(fautifs, `Passer par api/lib/llm.js (chatComplete) : ${fautifs.join(', ')}`).toEqual([])
  })

  it('aucun fichier n\'appelle api.anthropic.com hors exemptions', () => {
    const fautifs = contrevenants(/api\.anthropic\.com/)
    expect(fautifs, `Passer par api/lib/llm.js : ${fautifs.join(', ')}`).toEqual([])
  })

  it('aucun fichier ne pose l\'en-tête x-api-key hors exemptions', () => {
    // Attrape un fetch brut vers Anthropic même si l'URL est construite.
    const fautifs = contrevenants(/['"]x-api-key['"]/)
    expect(fautifs, `En-tête Anthropic hors abstraction : ${fautifs.join(', ')}`).toEqual([])
  })

  it('aucun script sandbox ne reçoit de clé Anthropic', () => {
    const fautifs = FICHIERS
      .filter((f) => f.startsWith('e2b-sandbox'))
      .filter((f) => /ANTHROPIC_API_KEY/.test(readFileSync(f, 'utf8')))
    expect(fautifs, `Les sandbox doivent recevoir OPENROUTER_API_KEY : ${fautifs.join(', ')}`).toEqual([])
  })
})

describe('hygiène des exemptions', () => {
  it('chaque fichier exempté existe encore', () => {
    const orphelines = Object.keys(EXEMPTIONS).filter((f) => !existsSync(f))
    expect(orphelines, `Exemptions à retirer : ${orphelines.join(', ')}`).toEqual([])
  })

  it('chaque exemption porte une raison substantielle', () => {
    for (const [fichier, raison] of Object.entries(EXEMPTIONS)) {
      expect(raison.length, `Raison trop courte pour ${fichier}`).toBeGreaterThan(40)
    }
  })

  it('chaque fichier exempté justifie encore son exemption', () => {
    // Une exemption dont le motif a disparu du fichier doit être retirée,
    // sinon elle couvre silencieusement une réintroduction future.
    const inutiles = Object.keys(EXEMPTIONS).filter((f) => {
      if (!existsSync(f)) return false
      const src = readFileSync(f, 'utf8')
      return !/api\.anthropic\.com|@anthropic-ai\/sdk|['"]x-api-key['"]/.test(src)
    })
    expect(inutiles, `Exemptions devenues inutiles : ${inutiles.join(', ')}`).toEqual([])
  })
})
