// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { affichagePrix, equivalentMensuel, memoriserFormuleChoisie, lireFormuleChoisie, PERIODES_AFFICHEES } from './affichage-formules.js'

const norme = (s) => s.replace(/[\u202f\u00a0]/g, ' ')

describe('affichage des formules', () => {
  beforeEach(() => localStorage.clear())

  it('mensuel : sans engagement, sans essai', () => {
    const a = affichagePrix('starter', 'mensuel')
    expect(norme(a.principal)).toBe('99 €')
    expect(a.suffixe).toBe('/mois')
    expect(a.detail).toBeNull()
    expect(a.offre).toBe('Sans engagement')
  })

  it('trimestriel : prix du trimestre et premier paiement', () => {
    const a = affichagePrix('pro', 'trimestriel')
    expect(norme(a.principal)).toBe('1 197 €')
    expect(a.suffixe).toBe('/3 mois')
    expect(norme(a.detail)).toBe('1er trimestre : 997,50 €')
    expect(a.offre).toBe('−50 % sur le premier mois')
  })

  it('trimestriel pour un client qui n’a plus droit à l’offre de bienvenue : prix plein, sans −50 %', () => {
    const a = affichagePrix('pro', 'trimestriel', { offreBienvenue: false })
    expect(norme(a.principal)).toBe('1 197 €')
    expect(a.detail).toBeNull()
    expect(a.offre).toBe('Payé tous les 3 mois')
  })

  it('annuel : 12 mois pour le prix de 11, et l’équivalent mensuel', () => {
    const a = affichagePrix('starter', 'annuel')
    expect(norme(a.principal)).toBe('980,10 €')
    expect(a.suffixe).toBe('/an')
    expect(norme(a.detail)).toBe('soit 81,68 € par mois')
    expect(a.offre).toBe('12 mois pour le prix de 11')
    expect(norme(equivalentMensuel('pro', 'annuel'))).toBe('329,18 €')
    expect(norme(affichagePrix('pro', 'annuel').principal)).toBe('3 950,10 €')
  })

  it('pas de formule pour Free et Enterprise', () => {
    expect(affichagePrix('free', 'mensuel')).toBeNull()
    expect(affichagePrix('enterprise', 'annuel')).toBeNull()
  })

  it('trois périodes proposées, dans l’ordre', () => {
    expect(PERIODES_AFFICHEES.map((p) => p.id)).toEqual(['mensuel', 'trimestriel', 'annuel'])
  })

  it('la formule de l’URL l’emporte', () => {
    expect(lireFormuleChoisie(new URLSearchParams('?plan=pro&formule=annuel'))).toEqual({ plan: 'pro', periode: 'annuel' })
  })

  it('sinon, la formule choisie sur /tarifs survit à l’inscription', () => {
    // L'inscription (code par e-mail ou Google) perd la chaîne de requête.
    memoriserFormuleChoisie({ plan: 'starter', periode: 'trimestriel' })
    expect(lireFormuleChoisie(new URLSearchParams(''))).toEqual({ plan: 'starter', periode: 'trimestriel' })
  })

  it('une valeur inconnue retombe sur le mensuel', () => {
    expect(lireFormuleChoisie(new URLSearchParams('?formule=hebdo'))).toEqual({ plan: null, periode: 'mensuel' })
  })
})
