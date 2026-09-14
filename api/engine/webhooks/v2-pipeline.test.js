import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * ACT-31 — les quatre canaux doivent passer par le pipeline V2.
 *
 * Le moteur a deux pipelines. Le widget et l'email entrant passent par
 * `brain.js` -> `executor.js` : classification, routage vers un agent
 * spécialisé, garde-fous d'escalade (références inventées, demande d'humain,
 * confiance insuffisante...). Gorgias et Zendesk passaient par l'ancien
 * `api/engine/process.js` — un seul appel monolithique au modèle, sans aucun
 * de ces garde-fous (`findUngroundedReferences`, `asksForHuman`).
 *
 * Concrètement, sur les canaux qui contournent `runBrain`, l'agent peut
 * inventer un numéro de suivi et ne passe pas la main quand un client demande
 * un humain.
 *
 * Comme pour le coupe-circuit (widget.test.js), ces routes dépendent de
 * Supabase et d'un LLM : on ne peut pas les exécuter ici. Ce test est donc une
 * analyse de source — il vérifie la propriété structurelle qui compte :
 * chaque canal appelle bien `runBrain`, et aucun ne repart sur l'ancien
 * `processMessage` de `process.js`. C'est la garde qui empêchera un
 * cinquième canal (ou une régression sur l'un des quatre) de reprendre le
 * chemin sans garde-fous.
 */

const CANAUX = {
  widget: './widget.js',
  email: './inbound-email.js',
  gorgias: './gorgias.js',
  zendesk: './zendesk.js',
}

const sources = Object.fromEntries(
  Object.entries(CANAUX).map(([nom, chemin]) => [nom, readFileSync(new URL(chemin, import.meta.url), 'utf8')])
)

describe('ACT-31 — les quatre canaux passent par le pipeline V2 (runBrain)', () => {
  for (const [nom, source] of Object.entries(sources)) {
    it(`${nom} importe runBrain depuis brain.js`, () => {
      expect(source).toMatch(/import\s*\{[^}]*\brunBrain\b[^}]*\}\s*from\s*['"]\.\.\/brain\.js['"]/)
    })

    it(`${nom} appelle réellement runBrain(...)`, () => {
      expect(source).toMatch(/\brunBrain\s*\(/)
    })

    it(`${nom} n'utilise plus l'ancien pipeline (process.js / processMessage)`, () => {
      expect(source).not.toMatch(/from\s*['"]\.\.\/process\.js['"]/)
      expect(source).not.toMatch(/\bprocessMessage\s*\(/)
    })
  }
})

describe('ACT-31 — process.js reste en place pour ses appelants restants', () => {
  // process.js ne doit pas être supprimé tant que webhook.js (endpoint
  // générique) et retry.js (cron de retraitement) s'appuient dessus — les
  // migrer est une décision séparée. On vérifie juste qu'il existe encore.
  it('process.js existe toujours', () => {
    expect(() => readFileSync(new URL('../process.js', import.meta.url), 'utf8')).not.toThrow()
  })
})
