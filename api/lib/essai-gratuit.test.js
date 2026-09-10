import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { joursEssaiPour, ESSAI_STANDARD_JOURS, ESSAI_PARRAINAGE_JOURS } from './essai-gratuit.js'

/**
 * ACT-33 — un seul essai gratuit, quel que soit le bouton cliqué.
 *
 * Le 10 septembre 2026, trois chemins menaient à un abonnement Stripe et
 * accordaient trois essais différents : 30 jours si parrainage, sinon 7 jours
 * sur deux d'entre eux et **aucun essai** sur le troisième. Les valeurs
 * avaient dérivé séparément, et rien ne les tenait ensemble.
 *
 * Ce qui rend le défaut coûteux, c'est la campagne publicitaire : une
 * publicité qui promet un mois gratuit et un produit qui en donne sept jours,
 * c'est la première chose que le marchand vérifie.
 */

const CHEMINS = [
  'api/create-checkout-session.js',
  'api/billing/create-subscription.js',
  'api/billing/upgrade.js',
]

describe('durée de l\'essai gratuit', () => {
  it('un parrainage donne un mois', () => {
    expect(joursEssaiPour({ referral_first_month_free: true })).toBe(ESSAI_PARRAINAGE_JOURS)
  })

  it('un nouveau marchand a l\'essai standard', () => {
    expect(joursEssaiPour({})).toBe(ESSAI_STANDARD_JOURS)
    expect(joursEssaiPour({ trial_ends_at: null })).toBe(ESSAI_STANDARD_JOURS)
  })

  it('un marchand qui a déjà eu un essai n\'en a pas un second', () => {
    // Même expiré : `trial_ends_at` est la trace qui empêche de réclamer un
    // nouvel essai en résiliant puis en se réabonnant.
    expect(joursEssaiPour({ trial_ends_at: '2026-01-01T00:00:00Z' })).toBeUndefined()
  })

  it('le parrainage l\'emporte sur un essai déjà consommé', () => {
    expect(joursEssaiPour({ referral_first_month_free: true, trial_ends_at: '2026-01-01T00:00:00Z' }))
      .toBe(ESSAI_PARRAINAGE_JOURS)
  })

  it('« pas d\'essai » vaut undefined, jamais 0', () => {
    // Stripe traite `trial_period_days: 0` autrement que l'absence du champ :
    // l'abonnement est facturé tout de suite mais marqué comme sortant
    // d'essai, ce qui fausse `trial_ends_at` et donc l'éligibilité future.
    expect(joursEssaiPour({ trial_ends_at: '2026-01-01T00:00:00Z' })).not.toBe(0)
  })

  it('aucun chemin de paiement ne redéfinit sa propre durée', () => {
    // C'est la garde qui compte. Trois fichiers, une seule source : si l'un
    // d'eux réécrit un nombre de jours en dur, la divergence recommence — et
    // elle ne se voit pas, parce que chaque chemin marche très bien tout seul.
    const fautifs = []
    for (const f of CHEMINS) {
      const src = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      if (/trial_period_days\s*[:=]\s*\d/.test(src)) fautifs.push(`${f} : durée écrite en dur`)
      if (!/joursEssaiPour\(/.test(src)) fautifs.push(`${f} : n'utilise pas joursEssaiPour()`)
    }
    expect(fautifs, `Divergence des essais :\n${fautifs.join('\n')}`).toEqual([])
  })

  it('l\'email de fin d\'essai part bien du webhook Stripe', () => {
    // Une durée alignée ne sert à rien si le marchand n'est pas prévenu : le
    // rappel « votre essai se termine le … » est envoyé sur l'événement
    // trial_will_end, trois jours avant.
    const src = readFileSync('api/stripe-webhook.js', 'utf8')
    expect(src, 'plus personne n\'écoute la fin d\'essai').toMatch(/customer\.subscription\.trial_will_end/)
  })
})
