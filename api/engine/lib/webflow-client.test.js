import { describe, it, expect } from 'vitest'
import { versFormeCommune } from './webflow-client.js'
import { formatOrder } from './order-format.js'

/**
 * Ce qu'on AFFIRME au client final à partir d'une commande Webflow.
 *
 * POURQUOI CES TESTS PLUTÔT QUE D'AUTRES
 *
 * Le connecteur a été écrit contre la documentation de l'API v2, sans
 * boutique Webflow pour l'exécuter. Deux risques, très inégaux :
 *
 *   un nom de champ qui a dérivé  → la valeur devient `null`, l'agent dit
 *                                   « je ne sais pas ». Gênant, pas grave.
 *   un statut mal projeté          → l'agent annonce « expédiée » à quelqu'un
 *                                   dont la commande est en litige. Grave, et
 *                                   invisible jusqu'à la réclamation.
 *
 * Le second est du calcul pur, donc entièrement testable sans réseau. C'est
 * lui qu'on garde ici. Le premier ne se vérifiera qu'à la première connexion
 * réelle, et le fichier le dit en tête.
 *
 * LA RÈGLE : une donnée absente ne devient jamais une affirmation.
 *
 * order-format.js la porte déjà, apprise sur WooCommerce : « un statut
 * d'expédition absent n'est PAS un statut non expédié ». Un statut
 * WooCommerce non reconnu faisait annoncer « non expédié » à quelqu'un qui
 * avait déjà reçu son colis.
 */

/** Une commande Webflow minimale, à laquelle on greffe ce qu'on veut tester. */
function commande(extra = {}) {
  return {
    orderId: '4fc3d',
    status: 'fulfilled',
    acceptedOn: '2026-09-01T10:00:00Z',
    customerPaid: { unit: 'EUR', value: 4990 },
    customerInfo: { email: 'client@exemple.fr' },
    purchasedItems: [{ productName: 'Bougie', variantName: 'Ambre', count: 2, rowTotal: { value: 4990 } }],
    ...extra,
  }
}

describe('statuts Webflow — projetés, jamais devinés', () => {
  const attendu = [
    // statut Webflow   paiement     expédition
    ['pending', 'pending', 'unfulfilled'],
    ['unfulfilled', 'paid', 'unfulfilled'],
    ['fulfilled', 'paid', 'fulfilled'],
    ['refunded', 'refunded', null],
    ['disputed', null, null],
    ['dispute-lost', null, null],
  ]

  for (const [statut, paiement, expedition] of attendu) {
    it(`« ${statut} » → paiement ${paiement ?? 'inconnu'}, expédition ${expedition ?? 'inconnue'}`, () => {
      const r = versFormeCommune(commande({ status: statut }))
      expect(r.financial_status).toBe(paiement)
      expect(r.fulfillment_status).toBe(expedition)
    })
  }

  it('un statut INCONNU ne devient pas « non expédiée »', () => {
    // Le cas qui a coûté cher sur WooCommerce. Webflow peut ajouter des
    // statuts, ou en renommer un : la seule réponse sûre est « je ne sais
    // pas ». `null` ici, « inconnu » pour l'IA.
    const r = versFormeCommune(commande({ status: 'en-cours-de-preparation' }))
    expect(r.fulfillment_status, 'un statut inconnu est affirmé comme non expédié').toBeNull()
    expect(r.financial_status).toBeNull()
    // `formatOrder` traduit pour l'IA : le mot exact importe moins que le
    // fait qu'il dise « inconnu » et pas « non expédiée ».
    expect(formatOrder(r).fulfillmentStatus).toMatch(/inconnu/i)
    expect(formatOrder(r).fulfillmentStatus).not.toMatch(/non expedi|non expédi/i)
  })

  it('une commande en litige n’est annoncée ni payée ni en attente', () => {
    // « disputed » = une contestation bancaire est ouverte. Dire « payée »
    // serait faux, dire « en attente » aussi.
    const f = formatOrder(versFormeCommune(commande({ status: 'disputed' })))
    expect(f.financialStatus).toMatch(/inconnu/i)
    expect(f.financialStatus, 'un litige annoncé comme payé').not.toMatch(/pay/i)
  })
})

describe('montants et articles', () => {
  it('les centimes deviennent des euros', () => {
    const r = versFormeCommune(commande())
    expect(r.total_price).toBe('49.90')
    expect(r.currency).toBe('EUR')
    expect(r.line_items[0]).toMatchObject({ title: 'Bougie', variant_title: 'Ambre', quantity: 2 })
  })

  it('un montant d’une forme inattendue reste vide plutôt que faux', () => {
    // Si `customerPaid` change de forme, on préfère ne rien dire du prix
    // qu'annoncer « 4990 € » ou « 0 € » à un client.
    expect(versFormeCommune(commande({ customerPaid: '49.90' })).total_price).toBeNull()
    expect(versFormeCommune(commande({ customerPaid: undefined })).total_price).toBeNull()
  })

  it('une commande vide ne fait pas planter la conversion', () => {
    // lookupOrder tourne en plein traitement d'un message client : une
    // exception ferait échouer toute la réponse, pas seulement la commande.
    expect(() => versFormeCommune({})).not.toThrow()
    expect(() => versFormeCommune(null)).not.toThrow()
    expect(versFormeCommune(null).line_items).toEqual([])
  })
})

describe('suivi de colis — le vrai apport face à WooCommerce', () => {
  it('un numéro de suivi remonte avec son transporteur et son lien', () => {
    const f = formatOrder(versFormeCommune(commande({
      shippingTracking: '6A123456789',
      shippingProvider: 'Colissimo',
      shippingTrackingURL: 'https://laposte.fr/6A123456789',
    })))
    expect(f.trackingInfo).toHaveLength(1)
    expect(f.trackingInfo[0]).toMatchObject({
      trackingNumber: '6A123456789',
      carrier: 'Colissimo',
      trackingUrl: 'https://laposte.fr/6A123456789',
    })
  })

  it('sans numéro de suivi, aucune entrée fabriquée', () => {
    // Une entrée vide brouillerait le contexte envoyé à l'IA et pourrait lui
    // faire croire qu'un suivi existe.
    expect(versFormeCommune(commande()).fulfillments).toEqual([])
    expect(formatOrder(versFormeCommune(commande())).trackingInfo).toEqual([])
  })

  it('un transporteur manquant n’empêche pas de donner le numéro', () => {
    const f = formatOrder(versFormeCommune(commande({ shippingTracking: 'XYZ' })))
    expect(f.trackingInfo[0].trackingNumber).toBe('XYZ')
    expect(f.trackingInfo[0].carrier).toBeNull()
  })
})
