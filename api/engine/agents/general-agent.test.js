import { describe, it, expect } from 'vitest'
import { generalAgent } from './general-agent.js'
import { findUngroundedReferences } from '../lib/escalation-signals.js'

/**
 * ACT-8 — les trois lignes du banc où « attendu » ≠ « obtenu ».
 *
 * Cas 12 « où en est ma commande ? », cas 13 « ma commande #99999999 n'arrive
 * pas », cas 14 « j'ai commandé la semaine dernière sous le nom de Dupont ».
 * Attendu : demander le numéro, ne rien inventer. Obtenu : « regardez dans vos
 * emails », « consultez votre espace client » — sans jamais demander le numéro,
 * et en parlant de « votre commande #99999999 » comme si elle existait.
 *
 * Cause : l'agent générique n'avait AUCUNE consigne. Les règles
 * anti-hallucination ne vivaient que dans l'agent commande. Or c'est lui qui
 * sert tous les comptes en formule gratuite — donc chaque nouvelle inscription,
 * y compris un compte de test de reviewer Shopify.
 */

describe('ACT-8 — l’agent générique sait ce qu’il ne peut pas faire', () => {
  const consignes = generalAgent.SPECIALISATION

  it('interdit d’inventer une référence', () => {
    expect(consignes).toMatch(/n'INVENTES JAMAIS/)
    expect(consignes).toMatch(/numéro de suivi/)
  })

  it('interdit de confirmer une commande qu’il ne peut pas vérifier', () => {
    // C'est le cas 13 : le client donne #99999999, l'agent répondait « votre
    // commande #99999999 » et validait implicitement son existence.
    expect(consignes).toMatch(/ne confirmes JAMAIS l'existence/)
  })

  it('interdit de prétendre avoir vérifié', () => {
    expect(consignes).toMatch(/tu n'as rien vérifié/)
  })

  it('demande explicitement le numéro au lieu de renvoyer le client ailleurs', () => {
    // Cas 12 et 14. Le renvoi vers l'espace client est une façon polie de ne
    // pas aider : l'agent doit demander ce dont il a besoin.
    expect(consignes).toMatch(/numéro de commande et de l'email/)
    expect(consignes).toMatch(/Ne te contente pas/)
  })

  it('est bien injecté dans le prompt système', () => {
    // Une consigne définie mais jamais concaténée serait exactement le motif
    // qui a produit les autres défauts de la semaine.
    const source = generalAgent.run.toString()
    expect(source).toContain('this.SPECIALISATION')
  })
})

describe('ACT-8 — l’agent générique n’a aucune donnée, donc aucune excuse', () => {
  it('toute référence absente du message du client est une invention', () => {
    // Cet agent n'a ni commande ni suivi : son seul ancrage légitime est ce que
    // le client a écrit.
    const ancrage = 'ma commande #1042 est en retard'
    expect(findUngroundedReferences('Votre commande #1042 est en cours.', ancrage)).toEqual([])
    expect(findUngroundedReferences('Votre colis LX123456789FR arrive jeudi.', ancrage)).toEqual([
      'LX123456789FR',
    ])
  })
})
