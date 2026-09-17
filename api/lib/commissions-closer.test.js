import { describe, it, expect } from 'vitest'
import {
  GRILLE_COMMISSIONS_CENTIMES,
  STATUTS_COMMISSION,
  LIBELLES_STATUT_COMMISSION,
  commissionPourFacture,
  commissionManuelle,
  transitionCommission,
  effetRemboursement,
  montantDeLaGrille,
  montantPreRempli,
  moisCourant,
  remboursableJusquau,
  totauxParStatut,
  derniereNote,
  NOTE_REMBOURSEE,
  NOTE_REMBOURSEE_APRES_PAIEMENT,
} from './commissions-closer.js'

/**
 * Les commissions des closers — spec 2026-09-14-closers-espace-commissions-design.md.
 *
 * Chaque test échoue si le défaut qu'il nomme revient : un montant qui dérive
 * de la note de Pablo, une facture à 0 € qui rapporte, une seconde commission
 * unique, un montant deviné pour une formule inconnue.
 *
 * Les factures ci-dessous ont la forme de l'API 2026-02-25.clover, celle du
 * SDK Stripe 20.4.1 : ni `subscription` ni `payment_intent` sur la facture,
 * l'abonnement dans `parent.subscription_details`, le prix d'une ligne dans
 * `pricing.price_details.price`.
 */

const prix = (lookup_key) => ({ id: `price_${lookup_key}`, object: 'price', lookup_key })

function ligne(lookupKey, { proration = false, prixEtendu = true } = {}) {
  return {
    id: `il_${lookupKey}_${proration}`,
    object: 'line_item',
    amount: 9900,
    parent: {
      type: 'subscription_item_details',
      invoice_item_details: null,
      subscription_item_details: { proration, proration_details: null, subscription: 'sub_1', subscription_item: 'si_1', invoice_item: null },
    },
    pricing: { type: 'price_details', unit_amount_decimal: '9900', price_details: { price: prixEtendu ? prix(lookupKey) : `price_${lookupKey}`, product: 'prod_1' } },
  }
}

function facture(over = {}) {
  return {
    id: 'in_1',
    object: 'invoice',
    status: 'paid',
    amount_paid: 9900,
    billing_reason: 'subscription_cycle',
    customer: 'cus_1',
    parent: { type: 'subscription_details', quote_details: null, subscription_details: { subscription: 'sub_1', metadata: { client_id: 'c1' } } },
    status_transitions: { finalized_at: 1_789_000_000, paid_at: 1_789_000_000, marked_uncollectible_at: null, voided_at: null },
    ...over,
  }
}

const CLIENT = { id: 'c1', closer_id: 'k1' }
const pourFacture = (f, lignes, over = {}) => commissionPourFacture({ facture: f, lignes, client: CLIENT, uniqueDejaVersee: false, ...over })

describe('la grille de commission — note de Pablo', () => {
  it.each([
    ['starter', 'mensuel', 2500],
    ['starter', 'trimestriel', 10000],
    ['starter', 'annuel', 25000],
    ['pro', 'mensuel', 10000],
    ['pro', 'trimestriel', 25000],
    ['pro', 'annuel', 60000],
  ])('%s %s rapporte %i centimes', (plan, periode, attendu) => {
    expect(montantDeLaGrille(plan, periode)).toBe(attendu)
    const c = pourFacture(facture({ billing_reason: 'subscription_create' }), [ligne(`actero_${plan}_${periode}`)])
    expect(c.montant_centimes).toBe(attendu)
    expect(c.plan).toBe(plan)
    expect(c.formule).toBe(periode)
  })

  it('la grille est figée', () => {
    expect(() => { GRILLE_COMMISSIONS_CENTIMES.pro.mensuel = 1 }).toThrow()
  })

  it('Enterprise et les clés héritées de Object ne sont pas dans la grille', () => {
    expect(montantDeLaGrille('enterprise', 'mensuel')).toBeNull()
    expect(montantDeLaGrille('toString', 'mensuel')).toBeNull()
    expect(montantDeLaGrille('pro', 'toString')).toBeNull()
  })
})

describe('commissionPourFacture', () => {
  it('une mensualité : clé stripe:<facture>, statut a_valider, date de paiement', () => {
    expect(pourFacture(facture(), [ligne('actero_pro_mensuel')])).toEqual({
      closer_id: 'k1',
      client_id: 'c1',
      montant_centimes: 10000,
      plan: 'pro',
      formule: 'mensuel',
      type: 'mensuelle',
      source: 'stripe',
      source_key: 'stripe:in_1',
      stripe_invoice_id: 'in_1',
      payee_par_client_le: new Date(1_789_000_000 * 1000).toISOString(),
      statut: 'a_valider',
    })
  })

  it('trimestriel et annuel : une commission unique, clé unique:<client>', () => {
    for (const periode of ['trimestriel', 'annuel']) {
      const c = pourFacture(facture({ billing_reason: 'subscription_create' }), [ligne(`actero_starter_${periode}`)])
      expect(c.type, periode).toBe('unique')
      expect(c.source_key, periode).toBe('unique:c1')
    }
  })

  it('facture à 0 € : rien (mois offert, coupon à 100 %)', () => {
    expect(pourFacture(facture({ amount_paid: 0 }), [ligne('actero_pro_mensuel')])).toBeNull()
  })

  it('facture non payée : rien', () => {
    for (const status of ['open', 'draft', 'void', 'uncollectible', undefined]) {
      expect(pourFacture(facture({ status }), [ligne('actero_pro_mensuel')]), String(status)).toBeNull()
    }
  })

  it('commission unique déjà versée : rien — la mensualité, elle, continue', () => {
    expect(pourFacture(facture(), [ligne('actero_pro_annuel')], { uniqueDejaVersee: true })).toBeNull()
    expect(pourFacture(facture(), [ligne('actero_pro_mensuel')], { uniqueDejaVersee: true })).not.toBeNull()
  })

  it('« déjà versée ? » inconnu : on lève plutôt que de payer deux fois', () => {
    expect(() => commissionPourFacture({ facture: facture(), lignes: [ligne('actero_pro_annuel')], client: CLIENT })).toThrow(/uniqueDejaVersee/)
  })

  it('formule inconnue : rien plutôt qu’un montant deviné', () => {
    expect(pourFacture(facture(), [ligne('actero_enterprise_sur_mesure')])).toBeNull()
    expect(pourFacture(facture(), [{ ...ligne('x'), pricing: { type: 'price_details', price_details: { price: { id: 'price_x', lookup_key: null } } } }])).toBeNull()
    expect(pourFacture(facture(), [ligne('actero_pro_mensuel', { prixEtendu: false })])).toBeNull()
    expect(pourFacture(facture(), [])).toBeNull()
  })

  it('les lignes de prorata ne comptent pas ; deux formules différentes, si', () => {
    const avecProrata = [ligne('actero_starter_mensuel', { proration: true }), ligne('actero_pro_mensuel')]
    expect(pourFacture(facture(), avecProrata).montant_centimes).toBe(10000)
    expect(pourFacture(facture(), [ligne('actero_starter_mensuel'), ligne('actero_pro_mensuel')])).toBeNull()
  })

  it('changement de plan : la grille suit ce qui est payé', () => {
    // Un client Starter passé Pro : sa facture de renouvellement porte le prix Pro.
    expect(pourFacture(facture(), [ligne('actero_pro_mensuel')]).montant_centimes).toBe(10000)
  })

  it('seules la première facture et les renouvellements rapportent', () => {
    for (const billing_reason of ['subscription_update', 'manual', 'subscription_threshold', 'upcoming', null]) {
      expect(pourFacture(facture({ billing_reason }), [ligne('actero_pro_mensuel')]), String(billing_reason)).toBeNull()
    }
  })

  it('une facture hors abonnement, ou un client sans closer : rien', () => {
    expect(pourFacture(facture({ parent: null }), [ligne('actero_pro_mensuel')])).toBeNull()
    expect(pourFacture(facture(), [ligne('actero_pro_mensuel')], { client: { id: 'c1', closer_id: null } })).toBeNull()
  })
})

describe('commissionManuelle — Shopify, Enterprise, corrections', () => {
  const SHOPIFY = { id: 'c2', closer_id: 'k1', plan: 'pro', billing_period: 'monthly', billing_provider: 'shopify', stripe_subscription_id: null }
  const STRIPE = { id: 'c3', closer_id: 'k1', plan: 'starter', billing_period: 'monthly', billing_provider: 'stripe', stripe_subscription_id: 'sub_9' }
  const saisie = (over = {}) => commissionManuelle({ client: SHOPIFY, formule: 'mensuel', montantCentimes: 10000, mois: '2026-09', note: 'Shopify septembre', ...over })

  it('une mensualité Shopify : clé manuel:<client>:<mois>', () => {
    expect(saisie().commission).toMatchObject({
      closer_id: 'k1', client_id: 'c2', montant_centimes: 10000, plan: 'pro', formule: 'mensuel',
      type: 'mensuelle', source: 'manuel', source_key: 'manuel:c2:2026-09', statut: 'a_valider', note: 'Shopify septembre',
    })
  })

  it('annuel ou trimestriel : la commission unique du client, même clé que le webhook', () => {
    expect(saisie({ formule: 'annuel', mois: undefined }).commission).toMatchObject({ type: 'unique', source_key: 'unique:c2' })
  })

  it('le montant pré-rempli suit la grille, quand elle s’applique', () => {
    expect(montantPreRempli({ plan: 'pro', billing_period: 'annual' })).toBe(60000)
    expect(montantPreRempli({ plan: 'starter', billing_period: 'monthly' })).toBe(2500)
    expect(montantPreRempli({ plan: 'enterprise', billing_period: 'monthly' })).toBeNull()
    expect(montantPreRempli({ plan: 'pro', billing_period: null })).toBeNull()
  })

  it('une mensualité manuelle est refusée pour un client Stripe du catalogue', () => {
    expect(saisie({ client: STRIPE, montantCentimes: 2500 })).toEqual({ erreur: 'commission_automatique' })
    // Client Stripe historique (billing_provider vide) : même règle.
    expect(saisie({ client: { ...STRIPE, billing_provider: null }, montantCentimes: 2500 })).toEqual({ erreur: 'commission_automatique' })
    // L'unique reste saisissable : c'est le recours d'un client rattaché après son paiement.
    expect(saisie({ client: STRIPE, formule: 'annuel', montantCentimes: 25000 }).commission.source_key).toBe('unique:c3')
  })

  it('Enterprise : hors grille, saisie libre', () => {
    const enterprise = { id: 'c4', closer_id: 'k1', plan: 'enterprise', billing_period: null, billing_provider: null, stripe_subscription_id: null }
    expect(saisie({ client: enterprise, montantCentimes: 45000 }).commission).toMatchObject({ plan: 'enterprise', montant_centimes: 45000 })
  })

  it('refus : note, mois, montant, formule, client', () => {
    expect(saisie({ note: '  ' })).toEqual({ erreur: 'note_requise' })
    expect(saisie({ mois: '2026-13' })).toEqual({ erreur: 'mois_invalide' })
    expect(saisie({ montantCentimes: 0 })).toEqual({ erreur: 'montant_invalide' })
    expect(saisie({ montantCentimes: 99.5 })).toEqual({ erreur: 'montant_invalide' })
    expect(saisie({ formule: 'hebdomadaire' })).toEqual({ erreur: 'formule_inconnue' })
    expect(saisie({ client: { ...SHOPIFY, closer_id: null } })).toEqual({ erreur: 'client_non_rattache' })
    expect(saisie({ client: { ...SHOPIFY, plan: 'free' } })).toEqual({ erreur: 'plan_non_payant' })
    expect(saisie({ client: null })).toEqual({ erreur: 'client_introuvable' })
  })

  it('le montant saisi est plafonné à 10 000 € : une faute de frappe ne se paie pas', () => {
    expect(saisie({ montantCentimes: 1_000_001 })).toEqual({ erreur: 'montant_invalide' })
    expect(saisie({ montantCentimes: 1_000_000 }).commission.montant_centimes).toBe(1_000_000)
  })
})

describe('transitionCommission — valider, refuser, payer', () => {
  const LE = new Date('2026-09-20T10:00:00Z')

  it('valider : a_valider → validee, avec l’admin et la date', () => {
    expect(transitionCommission({ statut: 'a_valider' }, 'valider', { adminId: 'admin-1', maintenant: LE }))
      .toEqual({ maj: { statut: 'validee', validee_at: LE.toISOString(), validee_par: 'admin-1' } })
    expect(transitionCommission({ statut: 'payee' }, 'valider')).toEqual({ erreur: 'statut_incompatible' })
  })

  it('refuser exige une note, qui s’ajoute aux précédentes', () => {
    expect(transitionCommission({ statut: 'a_valider' }, 'refuser', { note: '' })).toEqual({ erreur: 'note_requise' })
    expect(transitionCommission({ statut: 'validee', note: 'Saisie de septembre' }, 'refuser', { note: 'Doublon' }))
      .toEqual({ maj: { statut: 'refusee', note: 'Saisie de septembre\nDoublon' } })
    expect(transitionCommission({ statut: 'payee' }, 'refuser', { note: 'Trop tard' })).toEqual({ erreur: 'statut_incompatible' })
  })

  it('marquer payée : seulement une commission validée, profil de paiement complet', () => {
    expect(transitionCommission({ statut: 'validee' }, 'marquer_payee', { profilComplet: false })).toEqual({ erreur: 'profil_incomplet' })
    expect(transitionCommission({ statut: 'validee' }, 'marquer_payee', { profilComplet: undefined })).toEqual({ erreur: 'profil_incomplet' })
    expect(transitionCommission({ statut: 'a_valider' }, 'marquer_payee', { profilComplet: true })).toEqual({ erreur: 'statut_incompatible' })
    expect(transitionCommission({ statut: 'validee' }, 'marquer_payee', { profilComplet: true, maintenant: LE }))
      .toEqual({ maj: { statut: 'payee', payee_at: LE.toISOString() } })
  })

  it('action inconnue ou commission absente', () => {
    expect(transitionCommission({ statut: 'a_valider' }, 'supprimer')).toEqual({ erreur: 'action_inconnue' })
    expect(transitionCommission(null, 'valider')).toEqual({ erreur: 'commission_introuvable' })
  })
})

describe('effetRemboursement — charge.refunded', () => {
  it('avant paiement : annulée', () => {
    expect(effetRemboursement({ statut: 'a_valider', note: null }, { total: true })).toEqual({ statut: 'annulee', note: NOTE_REMBOURSEE })
    expect(effetRemboursement({ statut: 'validee', note: 'x' }, { total: true })).toEqual({ statut: 'annulee', note: `x\n${NOTE_REMBOURSEE}` })
  })

  it('après paiement : reste payée, reçoit une note — une seule fois', () => {
    expect(effetRemboursement({ statut: 'payee', note: null }, { total: true })).toEqual({ note: NOTE_REMBOURSEE_APRES_PAIEMENT })
    expect(effetRemboursement({ statut: 'payee', note: NOTE_REMBOURSEE_APRES_PAIEMENT }, { total: true })).toBeNull()
  })

  it('remboursement partiel : une note, le statut ne bouge pas', () => {
    const maj = effetRemboursement({ statut: 'a_valider', note: null }, { total: false, rembourseCentimes: 1000 })
    expect(maj).toEqual({ note: 'Remboursement partiel de 10,00 € par le client' })
    expect(maj).not.toHaveProperty('statut')
  })

  it('remboursement partiel reçu deux fois : une seule note ; un nouveau montant s’ajoute', () => {
    const note = 'Remboursement partiel de 10,00 € par le client'
    expect(effetRemboursement({ statut: 'validee', note }, { total: false, rembourseCentimes: 1000 })).toBeNull()
    expect(effetRemboursement({ statut: 'validee', note }, { total: false, rembourseCentimes: 2500 }))
      .toEqual({ note: `${note}\nRemboursement partiel de 25,00 € par le client` })
  })

  it('refusée ou annulée : rien', () => {
    expect(effetRemboursement({ statut: 'refusee' }, { total: true })).toBeNull()
    expect(effetRemboursement({ statut: 'annulee' }, { total: true })).toBeNull()
  })
})

describe('petites fonctions', () => {
  it('les statuts sont ceux de la spec, et chacun a son libellé', () => {
    expect(STATUTS_COMMISSION).toEqual(['a_valider', 'validee', 'payee', 'refusee', 'annulee'])
    for (const s of STATUTS_COMMISSION) expect(LIBELLES_STATUT_COMMISSION[s], s).toBeTruthy()
  })

  it('remboursable jusqu’au : paiement + 30 jours', () => {
    expect(remboursableJusquau('2026-09-01T10:00:00.000Z')).toBe('2026-10-01T10:00:00.000Z')
    expect(remboursableJusquau(null)).toBeNull()
  })

  it('le mois de saisie est celui de Paris', () => {
    expect(moisCourant(new Date('2026-09-30T22:30:00Z'))).toBe('2026-10')
    expect(moisCourant(new Date('2026-01-15T10:00:00Z'))).toBe('2026-01')
  })

  it('totaux par statut, en centimes', () => {
    expect(totauxParStatut([
      { statut: 'a_valider', montant_centimes: 2500 },
      { statut: 'a_valider', montant_centimes: 10000 },
      { statut: 'payee', montant_centimes: 60000 },
      { statut: 'inconnu', montant_centimes: 1 },
    ])).toEqual({ a_valider: 12500, validee: 0, payee: 60000, refusee: 0, annulee: 0 })
  })

  it('la dernière note est le motif', () => {
    expect(derniereNote('Saisie\nDoublon')).toBe('Doublon')
    expect(derniereNote(null)).toBeNull()
  })
})
