import { describe, it, expect } from 'vitest'
import { etapeDepuisEvenementStripe, formuleDeLaFacture, formuleDeLaCle } from './evenements-stripe.js'
import { TYPES_EVENEMENT } from './familles-evenements.js'
import { filtrerDetails } from './evenements-closer.js'

/**
 * Ce que devient un événement Stripe dans le fil d'activité des closers.
 *
 * Les factures sont écrites sous les deux formes que le webhook peut recevoir
 * (l'endpoint a sa propre version d'API) : 2026-02-25.clover, celle du SDK, et
 * 2024-12-18.acacia, celle du client du webhook.
 */

const CREE_LE = 1_789_000_000

const evenement = (type, object, extra = {}) => ({ id: 'evt_1', type, created: CREE_LE, data: { object, ...extra } })

const PRIX = {
  starterMensuel: { id: 'price_sm', lookup_key: 'actero_starter_mensuel', recurring: { interval: 'month', interval_count: 1 } },
  proMensuel: { id: 'price_pm', lookup_key: 'actero_pro_mensuel', recurring: { interval: 'month', interval_count: 1 } },
  proAnnuel: { id: 'price_pa', lookup_key: 'actero_pro_annuel', recurring: { interval: 'year', interval_count: 1 } },
  surMesure: { id: 'price_x', lookup_key: null, recurring: { interval: 'month', interval_count: 1 } },
}

/** Une ligne de facture, forme clover. */
const ligneClover = (prix, { prorata = false, montant = 39900 } = {}) => ({
  amount: montant,
  parent: { type: 'subscription_item_details', subscription_item_details: { proration: prorata, subscription: 'sub_1' } },
  pricing: { type: 'price_details', price_details: { price: prix, product: 'prod_1' } },
})

/** Une ligne de facture, forme acacia. */
const ligneAcacia = (prix, { prorata = false, montant = 39900 } = {}) => ({
  amount: montant, type: prorata ? 'invoiceitem' : 'subscription', proration: prorata, price: prix,
})

const facture = (raison, lignes, extra = {}) => ({
  id: 'in_1', object: 'invoice', status: 'paid', amount_paid: 39900, billing_reason: raison, lines: { data: lignes }, ...extra,
})

describe('invoice.paid', () => {
  it('première facture payée : abonnement démarré, avec plan, formule et plateforme', () => {
    expect(etapeDepuisEvenementStripe(evenement('invoice.paid', facture('subscription_create', [ligneClover(PRIX.proAnnuel)])))).toEqual({
      type: 'abonnement_demarre',
      details: { plan: 'pro', formule: 'annuel', plateforme: 'stripe' },
      sourceKey: 'stripe:evt_1',
      survenuLe: CREE_LE,
    })
  })

  it('renouvellement et changement de formule, sous les deux formes de facture', () => {
    for (const ligne of [ligneClover, ligneAcacia]) {
      expect(etapeDepuisEvenementStripe(evenement('invoice.paid', facture('subscription_cycle', [ligne(PRIX.proMensuel)]))))
        .toMatchObject({ type: 'renouvellement_paye', details: { plan: 'pro', formule: 'mensuel' } })
      // Un changement facturé tout de suite ne porte que du prorata : la ligne positive est le nouveau prix.
      expect(etapeDepuisEvenementStripe(evenement('invoice.paid', facture('subscription_update', [
        ligne(PRIX.starterMensuel, { prorata: true, montant: -9900 }),
        ligne(PRIX.proMensuel, { prorata: true, montant: 39900 }),
      ])))).toMatchObject({ type: 'formule_changee', details: { plan: 'pro', formule: 'mensuel' } })
    }
  })

  it('rien de payé, ou une facture hors abonnement : aucune étape', () => {
    expect(etapeDepuisEvenementStripe(evenement('invoice.paid', facture('subscription_create', [], { amount_paid: 0 })))).toBeNull()
    expect(etapeDepuisEvenementStripe(evenement('invoice.paid', facture('subscription_cycle', [], { amount_paid: null })))).toBeNull()
    for (const raison of ['manual', 'subscription_threshold', 'upcoming', 'toString', null]) {
      expect(etapeDepuisEvenementStripe(evenement('invoice.paid', facture(raison, [ligneClover(PRIX.proMensuel)]))), String(raison)).toBeNull()
    }
  })

  it('le détail ne porte jamais de montant', () => {
    const etape = etapeDepuisEvenementStripe(evenement('invoice.paid', facture('subscription_create', [ligneClover(PRIX.proAnnuel)])))
    expect(filtrerDetails(etape.details)).toEqual(etape.details)
    expect(JSON.stringify(etape)).not.toMatch(/39900|amount/)
  })
})

describe('formuleDeLaFacture', () => {
  it('les lignes hors prorata l’emportent sur le prorata', () => {
    expect(formuleDeLaFacture(facture('subscription_update', [
      ligneClover(PRIX.proMensuel, { prorata: true, montant: -39900 }),
      ligneClover(PRIX.proAnnuel),
    ]))).toEqual({ plan: 'pro', formule: 'annuel' })
  })

  it('on ne devine pas : prix hors catalogue, lignes qui se contredisent, lignes lisibles en partie', () => {
    expect(formuleDeLaFacture(facture('subscription_cycle', [ligneClover(PRIX.surMesure)]))).toEqual({})
    expect(formuleDeLaFacture(facture('subscription_cycle', [ligneClover(PRIX.proMensuel), ligneClover(PRIX.proAnnuel)]))).toEqual({})
    expect(formuleDeLaFacture(facture('subscription_cycle', [ligneClover(PRIX.proMensuel), ligneClover('price_pm')]))).toEqual({})
  })

  it('prix non étendus : la formule posée sur l’abonnement, sauf pour un changement de formule', () => {
    const lignes = [ligneClover('price_pa')]
    const clover = { parent: { type: 'subscription_details', subscription_details: { metadata: { formule: 'pro_annuel' }, subscription: 'sub_1' } } }
    const acacia = { subscription: 'sub_1', subscription_details: { metadata: { formule: 'starter_trimestriel' } } }
    expect(formuleDeLaFacture(facture('subscription_create', lignes, clover))).toEqual({ plan: 'pro', formule: 'annuel' })
    expect(formuleDeLaFacture(facture('subscription_cycle', [], acacia))).toEqual({ plan: 'starter', formule: 'trimestriel' })
    // La copie des métadonnées précède l'écriture de la nouvelle formule : elle dirait l'ancienne.
    expect(formuleDeLaFacture(facture('subscription_update', lignes, clover))).toEqual({})
  })

  it('une clé de formule hors catalogue ne donne rien', () => {
    expect(formuleDeLaCle('pro_annuel')).toEqual({ plan: 'pro', formule: 'annuel' })
    for (const cle of ['enterprise_annuel', 'pro_hebdo', 'pro_annuel_x', 'pro', '', null, 42]) {
      expect(formuleDeLaCle(cle), String(cle)).toEqual({})
    }
  })
})

describe('checkout.session.expired', () => {
  const session = (extra = {}) => ({
    id: 'cs_1', object: 'checkout.session', mode: 'subscription', expires_at: CREE_LE - 10,
    metadata: { actero_client_id: 'c1', upgrade_from: 'free', upgrade_to: 'pro', formule: 'pro_trimestriel' },
    ...extra,
  })

  it('page d’abonnement expirée à son heure : paiement abandonné, avec plan et formule', () => {
    expect(etapeDepuisEvenementStripe(evenement('checkout.session.expired', session()))).toEqual({
      type: 'paiement_abandonne',
      details: { plan: 'pro', formule: 'trimestriel' },
      sourceKey: 'stripe:evt_1',
      survenuLe: CREE_LE,
    })
  })

  it('sans clé de formule : le plan seul, lu dans upgrade_to', () => {
    const etape = etapeDepuisEvenementStripe(evenement('checkout.session.expired', session({ metadata: { upgrade_to: 'starter' } })))
    expect(filtrerDetails(etape.details)).toEqual({ plan: 'starter' })
  })

  it('page fermée par la route avant son heure, ou achat de crédits : aucune étape', () => {
    expect(etapeDepuisEvenementStripe(evenement('checkout.session.expired', session({ expires_at: CREE_LE + 86_000 })))).toBeNull()
    expect(etapeDepuisEvenementStripe(evenement('checkout.session.expired', session({ mode: 'payment' })))).toBeNull()
  })
})

describe('abonnement', () => {
  const abonnement = (extra = {}) => ({ id: 'sub_1', object: 'subscription', status: 'active', cancel_at_period_end: false, metadata: {}, ...extra })

  it('résiliation programmée, puis levée', () => {
    expect(etapeDepuisEvenementStripe(evenement('customer.subscription.updated',
      abonnement({ cancel_at_period_end: true }), { previous_attributes: { cancel_at_period_end: false } })))
      .toEqual({ type: 'resiliation_programmee', details: {}, sourceKey: 'stripe:evt_1', survenuLe: CREE_LE })
    expect(etapeDepuisEvenementStripe(evenement('customer.subscription.updated',
      abonnement(), { previous_attributes: { cancel_at_period_end: true } })))
      .toMatchObject({ type: 'resiliation_annulee' })
  })

  it('un changement de prix ou de métadonnées ne fait pas d’étape : la facture s’en charge', () => {
    expect(etapeDepuisEvenementStripe(evenement('customer.subscription.updated',
      abonnement(), { previous_attributes: { items: { data: [] }, plan: {} } }))).toBeNull()
    expect(etapeDepuisEvenementStripe(evenement('customer.subscription.updated',
      abonnement({ cancel_at_period_end: true }), { previous_attributes: { metadata: {} } }))).toBeNull()
    expect(etapeDepuisEvenementStripe(evenement('customer.subscription.updated', abonnement()))).toBeNull()
  })

  it('l’essai que la route remplace par Checkout : ni sa neutralisation ni sa levée ne font d’étape', () => {
    const marque = { status: 'trialing', metadata: { remplace_par_checkout: 'true' } }
    expect(etapeDepuisEvenementStripe(evenement('customer.subscription.updated',
      abonnement({ ...marque, cancel_at_period_end: true }), { previous_attributes: { cancel_at_period_end: false } }))).toBeNull()
    expect(etapeDepuisEvenementStripe(evenement('customer.subscription.updated',
      abonnement(marque), { previous_attributes: { cancel_at_period_end: true } }))).toBeNull()
    // Le même abonnement devenu actif : c'est le sien.
    expect(etapeDepuisEvenementStripe(evenement('customer.subscription.updated',
      abonnement({ metadata: marque.metadata, cancel_at_period_end: true }), { previous_attributes: { cancel_at_period_end: false } })))
      .toMatchObject({ type: 'resiliation_programmee' })
  })

  it('abonnement supprimé : abonnement terminé, plateforme Stripe', () => {
    expect(etapeDepuisEvenementStripe(evenement('customer.subscription.deleted', abonnement({ status: 'canceled' }))))
      .toEqual({ type: 'abonnement_termine', details: { plateforme: 'stripe' }, sourceKey: 'stripe:evt_1', survenuLe: CREE_LE })
  })

  it('paiement échoué', () => {
    expect(etapeDepuisEvenementStripe(evenement('invoice.payment_failed', facture('subscription_cycle', [], { status: 'open', amount_paid: 0 }))))
      .toEqual({ type: 'paiement_echoue', details: {}, sourceKey: 'stripe:evt_1', survenuLe: CREE_LE })
  })
})

describe('charge.refunded', () => {
  const charge = (extra) => ({ id: 'ch_1', object: 'charge', amount: 39900, amount_refunded: 39900, refunded: true, ...extra })

  it('remboursée en totalité, ou en partie', () => {
    expect(etapeDepuisEvenementStripe(evenement('charge.refunded', charge())))
      .toEqual({ type: 'rembourse', details: { partiel: false }, sourceKey: 'stripe:evt_1', survenuLe: CREE_LE })
    expect(etapeDepuisEvenementStripe(evenement('charge.refunded', charge({ amount_refunded: 10000, refunded: false }))))
      .toMatchObject({ type: 'rembourse', details: { partiel: true } })
  })

  it('rien de rendu : aucune étape', () => {
    expect(etapeDepuisEvenementStripe(evenement('charge.refunded', charge({ amount_refunded: 0, refunded: false })))).toBeNull()
  })
})

describe('le reste', () => {
  it('un événement sans étape, ou illisible : null', () => {
    expect(etapeDepuisEvenementStripe(evenement('checkout.session.completed', { id: 'cs_1' }))).toBeNull()
    expect(etapeDepuisEvenementStripe(evenement('customer.subscription.trial_will_end', { id: 'sub_1' }))).toBeNull()
    expect(etapeDepuisEvenementStripe({ type: 'invoice.payment_failed', data: { object: {} } })).toBeNull()
    expect(etapeDepuisEvenementStripe({ id: 'evt_1', type: 'invoice.payment_failed' })).toBeNull()
    expect(etapeDepuisEvenementStripe(null)).toBeNull()
  })

  it('chaque type rendu existe dans la liste du fil', () => {
    const rendus = [
      evenement('invoice.paid', facture('subscription_create', [])),
      evenement('invoice.paid', facture('subscription_cycle', [])),
      evenement('invoice.paid', facture('subscription_update', [])),
      evenement('invoice.payment_failed', facture('subscription_cycle', [])),
      evenement('checkout.session.expired', { mode: 'subscription' }),
      evenement('customer.subscription.updated', { cancel_at_period_end: true }, { previous_attributes: { cancel_at_period_end: false } }),
      evenement('customer.subscription.updated', { cancel_at_period_end: false }, { previous_attributes: { cancel_at_period_end: true } }),
      evenement('customer.subscription.deleted', { status: 'canceled' }),
      evenement('charge.refunded', { amount: 100, amount_refunded: 100 }),
    ].map((e) => etapeDepuisEvenementStripe(e)?.type)
    expect(rendus.every((t) => TYPES_EVENEMENT.includes(t))).toBe(true)
    expect(new Set(rendus).size).toBe(9)
  })
})
