import { describe, it, expect } from 'vitest'
import { commissionAnnoncee, dateCourte, lienDAbonnement, montant, LIBELLES_STATUT_COMMISSION } from './affichage-closer.js'
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
