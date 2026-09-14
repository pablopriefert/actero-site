import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { canAccessFeature } from '../../lib/plan-limits.js'
import { resolveAvgTicketTimeSec, CONSERVATIVE_AVG_TICKET_TIME_MIN } from './config-loader.js'

/**
 * ACT-8 — le plan du client doit atteindre brain.js.
 *
 * `brain.js` choisit entre un agent spécialisé (order, return, product,
 * escalation) et l'agent générique avec :
 *
 *   clientConfig?.settings?.plan || clientConfig?.client?.plan || 'free'
 *
 * Or `config-loader.js` ne sélectionnait pas `plan` sur la table `clients`, et
 * `client_settings` n'a pas de colonne `plan`. Les deux termes valaient donc
 * `undefined`, la résolution retombait sur `'free'`, et
 * `canAccessFeature('free', 'specialized_agents')` est faux.
 *
 * Conséquence mesurée sur le banc du 9 septembre : les vingt messages ont été
 * traités par l'agent `general`, y compris les cinq classés `suivi_commande`
 * sur un client `enterprise`. L'agent commande — son outil `lookup_order`, son
 * enrichissement AfterShip et ses règles anti-hallucination — n'a jamais tourné
 * en production.
 */

describe('ACT-8 — le plan atteint le moteur', () => {
  it('config-loader sélectionne la colonne plan', () => {
    const source = readFileSync(new URL('./config-loader.js', import.meta.url), 'utf8')
    const select = source.match(/\.from\('clients'\)\s*\n\s*(?:\/\/[^\n]*\n\s*)*\.select\('([^']+)'\)/)
    expect(select, 'le select sur la table clients est introuvable').toBeTruthy()
    expect(
      select[1].split(',').map((c) => c.trim()),
      'sans `plan`, tous les clients passent pour du free et les agents spécialisés ne tournent jamais',
    ).toContain('plan')
  })

  it('un plan payant débloque bien les agents spécialisés', () => {
    expect(canAccessFeature('pro', 'specialized_agents')).toBe(true)
    expect(canAccessFeature('enterprise', 'specialized_agents')).toBe(true)
  })

  it('et un plan absent retombe sur free, donc agent générique', () => {
    // C'est le comportement qui masquait le bug : silencieux, et jamais faux
    // du point de vue du code.
    expect(canAccessFeature(undefined, 'specialized_agents')).toBe(false)
    expect(canAccessFeature('free', 'specialized_agents')).toBe(false)
  })
})

/**
 * ACT-12 — mode conservateur.
 *
 * Il n'existe pas de barème par type de demande dans ce dépôt (order_tracking
 * vs return_exchange, etc.) : `logger.js` mappe bien le type de ticket via
 * `mapTicketType()`, mais ne s'en sert jamais pour le calcul du temps
 * économisé — un seul chiffre, `client_settings.avg_ticket_time_min`,
 * s'applique à tous les types. Le mode conservateur plafonne donc CE chiffre
 * unique, il ne choisit pas entre plusieurs barèmes par type qui n'existent
 * pas.
 */
describe('ACT-12 — resolveAvgTicketTimeSec (mode conservateur)', () => {
  it('sans réglage client, retombe sur le défaut 5 min', () => {
    expect(resolveAvgTicketTimeSec()).toBe(5 * 60)
    expect(resolveAvgTicketTimeSec({})).toBe(5 * 60)
  })

  it('mode conservateur désactivé : utilise le réglage du client tel quel', () => {
    expect(resolveAvgTicketTimeSec({ avg_ticket_time_min: 8 })).toBe(8 * 60)
  })

  it('mode conservateur activé : plafonne au plancher défendable', () => {
    expect(resolveAvgTicketTimeSec({ avg_ticket_time_min: 8, roi_conservative_mode: true }))
      .toBe(CONSERVATIVE_AVG_TICKET_TIME_MIN * 60)
  })

  it('mode conservateur activé, sans réglage : plafonne le défaut aussi', () => {
    expect(resolveAvgTicketTimeSec({ roi_conservative_mode: true }))
      .toBe(CONSERVATIVE_AVG_TICKET_TIME_MIN * 60)
  })

  it('mode conservateur activé : ne relève jamais une valeur déjà plus basse que le plancher', () => {
    // Un client qui a lui-même saisi 2 min garde SA valeur — le mode
    // conservateur plafonne, il ne remplace pas.
    expect(resolveAvgTicketTimeSec({ avg_ticket_time_min: 2, roi_conservative_mode: true })).toBe(2 * 60)
  })
})
