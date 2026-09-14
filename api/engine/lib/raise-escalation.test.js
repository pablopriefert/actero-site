import { describe, it, expect } from 'vitest'
import { reviewMeriteAlerte } from './raise-escalation.js'

/**
 * ACT-8 — une mise en revue grave doit alerter le marchand.
 *
 * `gateway.js` n'exécute le plan d'action que si `needsReview` est faux.
 * L'étape `escalate` — qui crée le ticket et notifie — ne tournait donc jamais
 * quand le moteur estimait qu'un humain était nécessaire. Le message allait
 * dans `engine_reviews_v2`, table que rien ne surveille et qui ne notifie
 * personne : plus le message était grave, moins le marchand en était averti.
 *
 * Le doseur ci-dessous est le cœur du correctif. Il doit alerter sur les vrais
 * signaux, et se taire sur `low_confidence` seul : sur le banc du 9 septembre,
 * six cas sur vingt étaient dans ce cas, et six notifications par vingt
 * messages apprendraient au marchand à toutes les ignorer.
 */

describe('ACT-8 — quand une revue doit alerter le marchand', () => {
  it('alerte sur un client agressif', () => {
    expect(reviewMeriteAlerte({ reviewReason: 'aggressive', actionPlan: ['send_reply'] })).toBe(true)
  })

  it('alerte sur une réponse tronquée', () => {
    expect(reviewMeriteAlerte({ reviewReason: 'reponse_tronquee', actionPlan: ['send_reply'] })).toBe(true)
  })

  it('alerte sur une référence inventée, malgré le suffixe variable', () => {
    expect(
      reviewMeriteAlerte({ reviewReason: 'references_inventees:LX123456789FR', actionPlan: ['send_reply'] }),
    ).toBe(true)
  })

  it('alerte dès que le plan d’action réclame une escalade', () => {
    expect(
      reviewMeriteAlerte({ reviewReason: 'low_confidence', actionPlan: ['send_reply', 'escalate'] }),
    ).toBe(true)
  })

  it('se tait sur un classifieur qui hésite', () => {
    expect(reviewMeriteAlerte({ reviewReason: 'low_confidence', actionPlan: ['send_reply'] })).toBe(false)
  })

  it('se tait quand il n’y a aucune raison', () => {
    expect(reviewMeriteAlerte({ reviewReason: null, actionPlan: ['send_reply'] })).toBe(false)
    expect(reviewMeriteAlerte({})).toBe(false)
  })
})
