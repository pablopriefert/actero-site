import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  planUpdateFromSubscription,
  formuleDeLAbonnement,
  doitResoudreLaCarte,
  ecritureAutorisee,
} from './subscription-plan.js'

const PRO_MENSUEL = { id: 'price_pm', lookup_key: 'actero_pro_mensuel' }
const sub = (over = {}, price = PRO_MENSUEL) => ({ status: 'active', items: { data: [{ price }] }, ...over })
const CARTE = { aUneCarte: true }
const SANS_CARTE = { aUneCarte: false }

function sansCommentaires(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('planUpdateFromSubscription', () => {
  it('n’accorde rien à un essai sans carte', () => {
    const u = planUpdateFromSubscription(sub({ status: 'trialing' }), SANS_CARTE)
    expect(u.plan).toBeUndefined()
    expect(u.status).toBeUndefined()
  })

  it('accorde en essai avec une carte', () => {
    const u = planUpdateFromSubscription(sub({ status: 'trialing', trial_end: 1893456000 }), CARTE)
    expect(u.plan).toBe('pro')
    expect(u.status).toBe('active')
    expect(u.trial_ends_at).toBeTruthy()
  })

  it('accorde un abonnement actif avec une carte', () => {
    expect(planUpdateFromSubscription(sub(), CARTE).plan).toBe('pro')
  })

  it('n’accorde rien sans carte', () => {
    expect(planUpdateFromSubscription(sub(), SANS_CARTE).plan).toBeUndefined()
  })

  it('sans information de carte, n’accorde rien', () => {
    expect(planUpdateFromSubscription(sub()).plan).toBeUndefined()
  })

  it('n’accorde rien pour incomplete', () => {
    expect(planUpdateFromSubscription(sub({ status: 'incomplete' }), CARTE).plan).toBeUndefined()
  })

  it('rétrograde en free sur canceled / unpaid, carte ou pas', () => {
    expect(planUpdateFromSubscription(sub({ status: 'canceled' }), SANS_CARTE).plan).toBe('free')
    expect(planUpdateFromSubscription(sub({ status: 'unpaid' }), CARTE).plan).toBe('free')
  })

  it('un prix trimestriel et un prix annuel donnent leur plan, sans variable d’environnement', () => {
    expect(planUpdateFromSubscription(sub({}, { id: 'p1', lookup_key: 'actero_starter_trimestriel' }), CARTE))
      .toMatchObject({ plan: 'starter', status: 'active', billing_period: 'quarterly', billing_provider: 'stripe' })
    expect(planUpdateFromSubscription(sub({}, { id: 'p2', lookup_key: 'actero_pro_annuel' }), CARTE))
      .toMatchObject({ plan: 'pro', billing_period: 'annual' })
  })

  it('un prix hors catalogue n’accorde aucun plan', () => {
    expect(planUpdateFromSubscription(sub({}, { id: 'price_sur_mesure', lookup_key: null }), CARTE).plan).toBeUndefined()
  })

  it('past_due ne rétrograde pas et n’accorde rien : rien à écrire', () => {
    expect(planUpdateFromSubscription(sub({ status: 'past_due' }), CARTE)).toEqual({})
  })

  it('incomplete_expired rétrograde en free', () => {
    expect(planUpdateFromSubscription(sub({ status: 'incomplete_expired' }), CARTE).plan).toBe('free')
  })

  it('une rétrogradation ne pose ni billing_provider ni billing_period', () => {
    const u = planUpdateFromSubscription(sub({ status: 'canceled' }), SANS_CARTE)
    expect(u).not.toHaveProperty('billing_provider')
    expect(u).not.toHaveProperty('billing_period')
  })

  it('trial_end à null : pas de clé trial_ends_at', () => {
    const u = planUpdateFromSubscription(sub({ status: 'trialing', trial_end: null }), SANS_CARTE)
    expect(u).not.toHaveProperty('trial_ends_at')
  })
})

describe('formuleDeLAbonnement', () => {
  it('formule connue', () => {
    expect(formuleDeLAbonnement(sub())?.plan).toBe('pro')
  })

  it('formule inconnue (hors catalogue)', () => {
    expect(formuleDeLAbonnement(sub({}, { id: 'price_sur_mesure', lookup_key: null }))).toBeNull()
  })
})

describe('doitResoudreLaCarte', () => {
  it('active + formule connue → true', () => {
    expect(doitResoudreLaCarte(sub({ status: 'active' }))).toBe(true)
  })

  it('trialing + formule connue → true', () => {
    expect(doitResoudreLaCarte(sub({ status: 'trialing' }))).toBe(true)
  })

  it('past_due → false', () => {
    expect(doitResoudreLaCarte(sub({ status: 'past_due' }))).toBe(false)
  })

  it('canceled → false', () => {
    expect(doitResoudreLaCarte(sub({ status: 'canceled' }))).toBe(false)
  })

  it('hors catalogue → false', () => {
    expect(doitResoudreLaCarte(sub({ status: 'active' }, { id: 'price_sur_mesure', lookup_key: null }))).toBe(false)
  })
})

describe('ecritureAutorisee', () => {
  const abonnementCourant = { id: 'sub_B' }
  const ancienAbonnement = { id: 'sub_A' }

  it('rien à écrire → null', () => {
    expect(ecritureAutorisee({}, { stripe_subscription_id: 'sub_B' }, abonnementCourant)).toBeNull()
  })

  it('rétrogradation d’un abonnement qui n’est plus le courant → null', () => {
    // Un ancien abonnement A impayé ne doit pas couper un client qui paie B.
    const miseAJour = { plan: 'free', status: 'inactive' }
    expect(ecritureAutorisee(miseAJour, { stripe_subscription_id: 'sub_B' }, ancienAbonnement)).toBeNull()
  })

  it('rétrogradation de l’abonnement courant → la rétrogradation', () => {
    const miseAJour = { plan: 'free', status: 'inactive' }
    expect(ecritureAutorisee(miseAJour, { stripe_subscription_id: 'sub_B' }, abonnementCourant)).toEqual(miseAJour)
  })

  it('rétrogradation quand aucun abonnement n’est enregistré → la rétrogradation', () => {
    const miseAJour = { plan: 'free', status: 'inactive' }
    expect(ecritureAutorisee(miseAJour, { stripe_subscription_id: null }, ancienAbonnement)).toEqual(miseAJour)
  })

  it('accord avec stripe_subscription_id vide → ajoute l’identifiant', () => {
    const miseAJour = { plan: 'pro', status: 'active' }
    expect(ecritureAutorisee(miseAJour, { stripe_subscription_id: null }, abonnementCourant))
      .toEqual({ ...miseAJour, stripe_subscription_id: 'sub_B' })
  })

  it('accord de l’abonnement courant → inchangé', () => {
    const miseAJour = { plan: 'pro', status: 'active' }
    expect(ecritureAutorisee(miseAJour, { stripe_subscription_id: 'sub_B' }, abonnementCourant)).toEqual(miseAJour)
  })
})

describe('le webhook s’en sert comme prévu', () => {
  const webhook = sansCommentaires(readFileSync('api/stripe-webhook.js', 'utf8'))

  // Bornée au `case` suivant : sans ça, les gardes ci-dessous retrouvent
  // l'appel `resolveCustomerCard(` de `trial_will_end`, plus bas dans le
  // fichier, et restent vertes même si ce bloc-ci régresse.
  function blocSubscriptionUpdated() {
    const debut = webhook.indexOf("case 'customer.subscription.updated'")
    expect(debut).toBeGreaterThan(-1)
    return webhook.slice(debut, webhook.indexOf("case '", debut + 1))
  }

  it('plus aucune table de prix construite depuis STRIPE_PRICE_*', () => {
    expect(webhook).not.toMatch(/STRIPE_PRICE_/)
  })

  it('la carte est résolue en mode strict, et c’est son résultat qui décide du plan', () => {
    // Seul `subscription.default_payment_method` comptait autrefois : une
    // carte rangée sur le client Stripe n'accordait jamais le plan. Et sans
    // le mode strict, une panne Stripe valait « aucune carte » au lieu de
    // lever — voir stripe-customer.js. Le \1 vérifie que c'est bien la MÊME
    // variable qui nourrit `aUneCarte`, pas seulement une variable quelconque.
    const bloc = blocSubscriptionUpdated()
    expect(bloc).toMatch(/(\w+) = await resolveCustomerCard\([^)]*\{\s*strict:\s*true\s*\}\)[\s\S]*planUpdateFromSubscription\(subscription,\s*\{\s*aUneCarte:\s*!!\1\s*\}/)
  })

  it('un abonnement payé hors catalogue laisse une trace', () => {
    // Offre sur mesure ou clé mal posée : aucun plan n'est accordé, et sans
    // trace, personne ne le verrait.
    const bloc = blocSubscriptionUpdated()
    expect(bloc).toMatch(/hors catalogue/)
  })

  it('l’écriture passe par ecritureAutorisee', () => {
    // Sans ce garde-fou, un ancien abonnement impayé peut rétrograder un
    // client qui paie un abonnement plus récent — voir subscription-plan.js.
    const bloc = blocSubscriptionUpdated()
    expect(bloc).toMatch(/ecritureAutorisee\(/)
  })

  it('une erreur libère la réservation de l’événement et répond 500', () => {
    // Sinon Stripe ne réessaie jamais : l'événement est marqué traité alors
    // que rien n'a été écrit.
    const bloc = blocSubscriptionUpdated()
    expect(bloc).toMatch(/webhook_events_processed/)
    expect(bloc).toMatch(/status\(500\)/)
  })
})
