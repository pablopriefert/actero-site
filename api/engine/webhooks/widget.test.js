import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Le coupe-circuit du marchand doit couper pour de vrai.
 *
 * `client_settings.agent_enabled` existait, et n'était lu que par
 * widget-config.js — donc par le navigateur. Le widget se cachait, mais
 * l'endpoint continuait de répondre : pages déjà ouvertes, widget en cache,
 * appel direct. Un marchand qui coupait son agent parce qu'il disait n'importe
 * quoi croyait l'avoir arrêté.
 *
 * Un coupe-circuit qui ne coupe rien est pire qu'aucun coupe-circuit.
 *
 * Ce test est une analyse de source : la route dépend de Supabase et d'un LLM,
 * on ne peut pas l'exécuter ici. Il vérifie donc la propriété structurelle qui
 * compte — le contrôle existe et précède tout traitement.
 */

const widget = readFileSync(new URL('./widget.js', import.meta.url), 'utf8')
const email = readFileSync(new URL('../../lib/email.js', import.meta.url), 'utf8')

describe('coupe-circuit côté serveur — canal widget', () => {
  it('la route lit agent_enabled', () => {
    expect(widget).toMatch(/\.select\('agent_enabled'\)/)
  })

  it('le contrôle précède la lecture du message', () => {
    // Vérifier après avoir traité le message ne servirait à rien : le coût LLM
    // serait déjà payé et la réponse déjà calculée.
    const iControle = widget.indexOf("agent_enabled === false")
    const iMessage = widget.indexOf('const { message, email, name, session_id')
    expect(iControle).toBeGreaterThan(-1)
    expect(iControle).toBeLessThan(iMessage)
  })

  it('ne bloque que sur un false explicite', () => {
    // Un réglage absent doit laisser l'agent actif, comme partout ailleurs
    // dans le code. Bloquer sur `undefined` couperait tous les clients qui
    // n'ont jamais touché ce réglage.
    expect(widget).toMatch(/agent_enabled === false/)
    expect(widget).not.toMatch(/!reglages\?\.agent_enabled\s*\)/)
  })

  it('répond au client sans mentionner de panne technique', () => {
    // Le visiteur n'a pas à savoir que le marchand a coupé son agent.
    expect(widget).toMatch(/momentanément indisponible/)
  })
})

describe('coupe-circuit côté serveur — canal email', () => {
  it('celui-ci était déjà appliqué, et le reste', () => {
    // Référence : c'est le comportement que le canal widget vient de rejoindre.
    expect(email).toMatch(/email_agent_enabled/)
    expect(email).toMatch(/reason: 'agent_disabled'/)
  })
})
