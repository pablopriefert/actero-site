import { describe, it, expect } from 'vitest'
import { asksForHuman, findUngroundedReferences } from './escalation-signals.js'

/**
 * ACT-8 — banc des cas tordus.
 *
 * Le ticket demande vingt messages clients difficiles (colère, hors sujet,
 * multi-demandes, commande introuvable) et la garantie qu'un cas non couvert
 * escalade au lieu d'inventer une réponse.
 *
 * Ce fichier couvre la partie DÉTERMINISTE de cette garantie : ce que le moteur
 * décide indépendamment du modèle. La qualité de rédaction du modèle, elle, se
 * mesure avec `scripts/act8-banc-agent.mjs`, qui appelle le vrai LLM.
 *
 * La version précédente du détecteur était une seule expression construite
 * autour du verbe « parler », sans gestion des accents. Sur les douze premières
 * formulations ci-dessous elle en reconnaissait trois.
 */

/* -------------------------------------------------------------------------- */
/*  1. Le client réclame un humain                                            */
/* -------------------------------------------------------------------------- */

const DEMANDES_HUMAIN = [
  'je veux parler à un humain',
  'passez-moi un humain',
  'je veux un vrai conseiller',
  'mettez-moi en relation avec quelqu\'un',
  'arrêtez le robot',
  'je ne veux pas parler à une IA',
  'un être humain svp',
  'je peux avoir quelqu\'un de réel ?',
  'transférez-moi au service client humain',
  'je veux parler a un responsable',
  'STOP. Un humain.',
  'votre bot est nul, donnez-moi un opérateur',
  'j\'en ai marre du chatbot',
  'je voudrais parler à une personne',
  'votre robot ne comprend rien',
  'je demande un superviseur',
]

describe('ACT-8 — le client réclame un humain', () => {
  it.each(DEMANDES_HUMAIN)('escalade : %s', (message) => {
    expect(asksForHuman(message)).toBe(true)
  })
})

/**
 * Le détecteur biaise vers l'escalade, mais pas au point d'escalader tout le
 * SAV : une question de suivi ordinaire doit rester traitée par l'agent.
 * « personne » est le piège — en français il veut aussi dire « aucun ».
 */
const MESSAGES_ORDINAIRES = [
  'où est ma commande #1042 ?',
  'quand serai-je livré ?',
  'je veux retourner mon pull, il est trop petit',
  'avez-vous ce produit en taille M ?',
  'bonjour, merci pour votre aide',
  'ma commande est arrivée cassée',
  'combien coûte la livraison en Belgique ?',
  'je n\'ai reçu personne à la livraison',
  'le colis n\'a jamais été remis à personne',
]

describe('ACT-8 — les demandes ordinaires ne partent pas en escalade', () => {
  it.each(MESSAGES_ORDINAIRES)('traité par l\'agent : %s', (message) => {
    expect(asksForHuman(message)).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/*  2. L'agent invente une référence                                          */
/* -------------------------------------------------------------------------- */

describe('ACT-8 — une référence inventée déclenche l\'escalade', () => {
  it('numéro de suivi sorti de nulle part', () => {
    const refs = findUngroundedReferences(
      'Votre colis LX123456789FR est en cours d\'acheminement, livraison prévue jeudi.',
      'DONNEES COMMANDE: aucune commande trouvee',
    )
    expect(refs).toEqual(['LX123456789FR'])
  })

  it('numéro de commande sorti de nulle part', () => {
    const refs = findUngroundedReferences(
      'J\'ai bien retrouvé votre commande #4471, elle a été expédiée hier.',
      'DONNEES COMMANDE: aucune commande trouvee',
    )
    expect(refs).toEqual(['4471'])
  })

  it('référence segmentée inventée', () => {
    expect(
      findUngroundedReferences('Votre suivi est ABCD-1234-EFGH.', 'aucune donnee'),
    ).toEqual(['ABCD-1234-EFGH'])
  })
})

describe('ACT-8 — ce qui est réellement ancré passe', () => {
  it('reprend un suivi présent dans les données AfterShip', () => {
    expect(
      findUngroundedReferences(
        'Votre colis LX123456789FR arrive jeudi.',
        'TRACKING TEMPS REEL: Colis LX123456789FR (Colissimo) Statut: en transit',
      ),
    ).toEqual([])
  })

  it('reprend le numéro que le client vient de donner', () => {
    // Le message du client est une source légitime : le répéter n'est pas
    // l'inventer.
    expect(
      findUngroundedReferences(
        'Votre commande #1042 est en préparation.',
        'Message client: bonjour, où en est ma commande #1042 ?',
      ),
    ).toEqual([])
  })

  it('une réponse honnête qui n\'affirme rien ne déclenche rien', () => {
    expect(
      findUngroundedReferences(
        'Je ne retrouve pas votre commande. Pouvez-vous me donner votre numéro de commande ?',
        'DONNEES COMMANDE: aucune commande trouvee',
      ),
    ).toEqual([])
  })

  it('ne confond pas un montant avec une référence', () => {
    expect(
      findUngroundedReferences(
        'Le montant est de 49,90 € et la livraison de 4,90 €.',
        'DONNEES COMMANDE: total 49.90',
      ),
    ).toEqual([])
  })

  it('ne confond pas un mot composé français avec un numéro de suivi', () => {
    // « Pouvez-vous », « Rendez-vous » : le motif des références segmentées
    // était insensible à la casse et les attrapait.
    expect(
      findUngroundedReferences(
        'Rendez-vous sur votre espace client, c\'est très simple.',
        'aucune donnee',
      ),
    ).toEqual([])
  })
})
