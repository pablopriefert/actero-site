import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { joursEssaiPour, ESSAI_STANDARD_JOURS, ESSAI_PARRAINAGE_JOURS, ESSAI_CAMPAGNE_JOURS } from './essai-gratuit.js'

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

  it('un marchand venu de la campagne a un mois', () => {
    // Décision du 10 septembre : la pub annonce « 1 mois gratuit », mais
    // seulement pour ceux qui arrivent par elle.
    expect(joursEssaiPour({ campaign_first_month_free: true })).toBe(ESSAI_CAMPAGNE_JOURS)
    expect(ESSAI_CAMPAGNE_JOURS).toBe(30)
  })

  it('celui qui trouve Actero autrement garde l\'essai standard', () => {
    expect(joursEssaiPour({ campaign_first_month_free: false })).toBe(ESSAI_STANDARD_JOURS)
    expect(ESSAI_STANDARD_JOURS).toBe(7)
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

  it('les chemins qui lisent le drapeau de campagne le sélectionnent aussi', () => {
    // Le piège de gorgias.js, transposé : lire `client.campaign_first_month_free`
    // sans le ramener dans le `.select()` donnerait TOUJOURS undefined. Le
    // marchand venu de la pub aurait sept jours au lieu de trente, et rien
    // n'échouerait — la campagne aurait simplement l'air de ne pas marcher.
    for (const f of ['api/billing/create-subscription.js', 'api/billing/upgrade.js']) {
      const src = readFileSync(f, 'utf8')
      if (!/client\.campaign_first_month_free/.test(src)) continue
      expect(src, `${f} lit le drapeau sans le sélectionner`)
        .toMatch(/\.select\(\s*'[^']*campaign_first_month_free/)
    }
  })

  it('le mois de campagne se consomme, comme celui du parrainage', () => {
    // Sans ça, un marchand qui résilie et se réabonne le réclame à chaque fois.
    for (const f of ['api/billing/create-subscription.js', 'api/billing/upgrade.js']) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} ne remet jamais campaign_first_month_free à false`)
        .toMatch(/campaign_first_month_free:\s*false/)
    }
  })

  it('le code de campagne est validé côté serveur, jamais cru sur parole', () => {
    // Offrir un mois sur la foi d'un paramètre que le navigateur envoie, c'est
    // un cadeau à qui devine le mot. Le code doit être confronté à une
    // variable d'environnement.
    const src = readFileSync('api/auth/signup.js', 'utf8')
    expect(src, 'signup.js ne valide pas le code de campagne')
      .toMatch(/process\.env\.CAMPAIGN_TRIAL_CODES/)
    expect(src, 'le drapeau doit être écrit côté serveur après validation')
      .toMatch(/campaign_first_month_free:\s*true/)
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
