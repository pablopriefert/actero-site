import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * La politique de confidentialité prévient les marchands de ce que voit un
 * closer. Spec : docs/superpowers/specs/2026-09-17-closers-fil-activite-design.md
 */

const PAGE = readFileSync('src/pages/PrivacyPage.jsx', 'utf8')
const PHRASE = 'Si vous créez votre compte à partir du lien d\'un closer partenaire d\'Actero, ce closer voit l\'avancement de votre inscription et de votre abonnement (étapes et dates). Il ne voit jamais les données de votre boutique, vos conversations, ni vos montants.'

describe('politique de confidentialité — le fil d’activité des closers', () => {
  it('dit exactement ce que voit le closer, parmi les destinataires des données', () => {
    const position = PAGE.indexOf(PHRASE)
    expect(position).toBeGreaterThan(PAGE.indexOf('5. Destinataires des données'))
    expect(position).toBeLessThan(PAGE.indexOf('6. Durée de conservation'))
  })

  it('porte la date de ce changement', () => {
    expect(PAGE).toContain('Dernière mise à jour : 17 septembre 2026')
  })
})
