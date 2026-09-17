import { describe, it, expect } from 'vitest'
import {
  commissionAnnoncee, dateCourte, lienDAbonnement, montant, LIBELLES_STATUT_COMMISSION,
  dateRelative, evenementAlerte, FILTRES_ACTIVITE, grouperParJour, heureDuFil, jourDuFil, libelleEvenement, offreEnClair, PASTILLE_FAMILLE,
} from './affichage-closer.js'
import { FAMILLES, TYPES_EVENEMENT } from '../../api/lib/familles-evenements.js'
import { euros } from './affichage-formules.js'

describe('affichage de l’espace closer', () => {
  it('le lien d’abonnement, avec ou sans offre convenue', () => {
    expect(lienDAbonnement('https://actero.fr/', 'ACT-AB2CD')).toBe('https://actero.fr/c/ACT-AB2CD')
    expect(lienDAbonnement('https://actero.fr', 'ACT-AB2CD', { plan: 'pro', formule: 'annuel' }))
      .toBe('https://actero.fr/c/ACT-AB2CD?plan=pro&formule=annuel')
  })

  it('ce que rapporte une formule, d’après la grille', () => {
    expect(commissionAnnoncee('pro', 'annuel')).toBe(`${euros(60000)} une fois`)
    expect(commissionAnnoncee('starter', 'mensuel')).toBe(`${euros(2500)} par mois payé`)
    expect(commissionAnnoncee('enterprise', 'mensuel')).toBeNull()
    expect(commissionAnnoncee('pro', 'toString')).toBeNull()
  })

  it('montants et dates, avec un tiret quand il n’y a rien', () => {
    expect(montant(10000)).toBe(euros(10000))
    expect(montant(null)).toBe('—')
    expect(dateCourte(null)).toBe('—')
    expect(dateCourte('pas une date')).toBe('—')
    expect(dateCourte('2026-09-16T10:00:00Z')).toMatch(/2026/)
  })

  it('un libellé pour chaque statut', () => {
    expect(Object.keys(LIBELLES_STATUT_COMMISSION)).toEqual(['a_valider', 'validee', 'payee', 'refusee', 'annulee'])
  })
})

describe('fil d’activité — libellés', () => {
  it.each([
    [{ type: 'lien_ouvert' }, 'A ouvert votre lien'],
    [{ type: 'inscription' }, 'S’est inscrit'],
    [{ type: 'paiement_ouvert', details: { plan: 'pro', formule: 'annuel', plateforme: 'stripe' } }, 'A choisi Pro annuel et ouvert le paiement'],
    [{ type: 'paiement_ouvert', details: {} }, 'A ouvert le paiement'],
    [{ type: 'paiement_abandonne', details: { plan: 'starter', formule: 'trimestriel' } }, 'Paiement non finalisé (Starter trimestriel)'],
    [{ type: 'paiement_abandonne', details: {} }, 'Paiement non finalisé'],
    [{ type: 'abonnement_demarre', details: { plan: 'pro', formule: 'mensuel', plateforme: 'shopify' } }, 'S’est abonné (Pro mensuel)'],
    [{ type: 'renouvellement_paye', details: { plan: 'starter' } }, 'Renouvellement payé (Starter)'],
    [{ type: 'paiement_echoue' }, 'Paiement échoué'],
    [{ type: 'formule_changee', details: { plan: 'enterprise', formule: 'annuel' } }, 'Est passé à Enterprise annuel'],
    [{ type: 'formule_changee', details: null }, 'A changé de formule'],
    [{ type: 'resiliation_programmee' }, 'A programmé sa résiliation'],
    [{ type: 'resiliation_annulee' }, 'A annulé sa résiliation'],
    [{ type: 'abonnement_termine', details: { plateforme: 'shopify' } }, 'Abonnement terminé'],
    [{ type: 'rembourse', details: { partiel: true } }, 'Remboursé en partie'],
    [{ type: 'rembourse', details: { partiel: false } }, 'Remboursé en totalité'],
    [{ type: 'rembourse', details: {} }, 'Remboursé'],
    [{ type: 'app_desinstallee' }, 'A désinstallé l’application Shopify'],
    [{ type: 'boutique_connectee', details: { plateforme: 'shopify' } }, 'A connecté sa boutique Shopify'],
    [{ type: 'boutique_connectee', details: { plateforme: 'woocommerce' } }, 'A connecté sa boutique WooCommerce'],
    [{ type: 'boutique_connectee', details: { plateforme: 'webflow' } }, 'A connecté sa boutique Webflow'],
    [{ type: 'boutique_connectee', details: { plateforme: 'toString' } }, 'A connecté sa boutique'],
    [{ type: 'agent_premiere_reponse' }, 'L’agent a envoyé sa première réponse'],
    [{ type: 'agent_en_pause' }, 'A mis l’agent en pause'],
    [{ type: 'agent_reactive' }, 'A réactivé l’agent'],
    [{ type: 'type_de_demain' }, 'Nouvelle étape'],
    [{ type: 'constructor' }, 'Nouvelle étape'],
    [undefined, 'Nouvelle étape'],
  ])('%o → %s', (evenement, attendu) => {
    expect(libelleEvenement(evenement)).toBe(attendu)
  })

  it('un libellé à chaque type de la bibliothèque', () => {
    for (const type of TYPES_EVENEMENT) expect(libelleEvenement({ type }), type).not.toBe('Nouvelle étape')
  })

  it('l’offre en clair, sans rien lire hors des tables', () => {
    expect(offreEnClair({ plan: 'starter', formule: 'trimestriel' })).toBe('Starter trimestriel')
    expect(offreEnClair({ plan: 'pro', formule: 'toString' })).toBe('Pro')
    expect(offreEnClair({ plan: 'toString', formule: 'annuel' })).toBeNull()
    expect(offreEnClair()).toBeNull()
  })

  it('orange pour les cinq étapes à surveiller, et elles seules', () => {
    expect(TYPES_EVENEMENT.filter(evenementAlerte))
      .toEqual(['paiement_abandonne', 'paiement_echoue', 'resiliation_programmee', 'app_desinstallee', 'agent_en_pause'])
    expect(evenementAlerte(undefined)).toBe(false)
  })

  it('une pastille par famille ; un filtre par famille, après « Tout »', () => {
    expect(Object.keys(PASTILLE_FAMILLE).sort()).toEqual([...FAMILLES].sort())
    expect(FILTRES_ACTIVITE[0]).toEqual({ famille: null, libelle: 'Tout' })
    expect(FILTRES_ACTIVITE.slice(1).map((f) => f.famille).sort()).toEqual([...FAMILLES].sort())
  })
})

describe('fil d’activité — dates, à l’heure de Paris', () => {
  const MAINTENANT = new Date('2026-09-17T12:00:00Z') // jeudi, 14 h à Paris

  it.each([
    ['2026-09-17T11:59:30Z', 'à l’instant'],
    ['2026-09-17T12:00:30Z', 'à l’instant'],
    ['2026-09-17T11:55:00Z', 'il y a 5 min'],
    ['2026-09-17T11:00:30Z', 'il y a 59 min'],
    ['2026-09-17T10:00:00Z', 'il y a 2 h'],
    ['2026-09-16T22:30:00Z', 'il y a 13 h'],
    ['2026-09-16T12:05:00Z', 'hier à 14 h 05'],
    ['2026-09-16T07:05:00Z', 'hier à 9 h 05'],
    ['2026-09-12T08:00:00Z', 'le 12 septembre'],
    ['2026-09-01T08:00:00Z', 'le 1er septembre'],
    ['2025-12-31T08:00:00Z', 'le 31 décembre 2025'],
    [null, '—'],
    ['pas une date', '—'],
  ])('dateRelative(%s) → %s', (iso, attendu) => {
    expect(dateRelative(iso, MAINTENANT)).toBe(attendu)
  })

  it('la veille se compte à minuit, à Paris : 23 h vu à 0 h 30 → « hier »', () => {
    expect(dateRelative('2026-09-16T21:00:00Z', new Date('2026-09-16T22:30:00Z'))).toBe('hier à 23 h 00')
  })

  it.each([
    ['2026-09-17T05:00:00Z', 'Aujourd’hui'],
    ['2026-09-16T22:00:00Z', 'Aujourd’hui'],
    ['2026-09-16T21:59:00Z', 'Hier'],
    ['2026-09-14T10:00:00Z', 'Lundi 14 septembre'],
    ['2026-09-01T10:00:00Z', 'Mardi 1er septembre'],
    ['2025-09-15T10:00:00Z', 'Lundi 15 septembre 2025'],
    ['pas une date', '—'],
  ])('jourDuFil(%s) → %s', (iso, attendu) => {
    expect(jourDuFil(iso, MAINTENANT)).toBe(attendu)
  })

  it('le passage à l’heure d’hiver ne décale pas le jour', () => {
    // 25 octobre 2026 : 0 h 30 (heure d'été) et 23 h 30 (heure d'hiver), 24 h d'écart, même jour.
    expect(jourDuFil('2026-10-24T22:30:00Z', new Date('2026-10-25T22:30:00Z'))).toBe('Aujourd’hui')
    expect(dateRelative('2026-10-24T22:30:00Z', new Date('2026-10-25T22:30:00Z'))).toBe('il y a 24 h')
  })

  it('l’heure d’une ligne du fil', () => {
    expect(heureDuFil('2026-09-16T07:05:00Z')).toBe('9 h 05')
    expect(heureDuFil(null)).toBe('—')
  })

  it('les étapes regroupées par jour, dans leur ordre', () => {
    const e = (id, survenu_le) => ({ id, survenu_le })
    const groupes = grouperParJour([
      e('a', '2026-09-17T11:00:00Z'),
      e('b', '2026-09-17T08:00:00Z'),
      e('c', '2026-09-16T08:00:00Z'),
      e('d', '2026-09-14T08:00:00Z'),
    ], MAINTENANT)
    expect(groupes.map((g) => [g.jour, g.evenements.map((x) => x.id)])).toEqual([
      ['Aujourd’hui', ['a', 'b']],
      ['Hier', ['c']],
      ['Lundi 14 septembre', ['d']],
    ])
    expect(grouperParJour([], MAINTENANT)).toEqual([])
  })
})
