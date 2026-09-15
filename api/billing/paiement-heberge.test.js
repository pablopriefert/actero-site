import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Gardes du chantier « formules + Checkout hébergé » (14 septembre 2026).
 * Chacune vise un défaut qui passait sans bruit.
 */
function sansCommentaires(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('le MRR de l’admin', () => {
  it('ne lit plus l’intervalle seul', () => {
    // `interval === 'month'` comptait un trimestriel de 297 € comme 297 € de MRR.
    const src = sansCommentaires(readFileSync('api/stripe-billing.js', 'utf8'))
    expect(src).not.toMatch(/interval === 'month'\) return/)
    expect(src).toMatch(/mensualiteCentimes\(/)
  })
})

describe('la facturation du tableau de bord', () => {
  it('propose les trois formules et attend le webhook après un changement immédiat', () => {
    const src = sansCommentaires(readFileSync('src/components/client/ClientBillingView.jsx', 'utf8'))
    expect(src).toMatch(/<SelecteurFormule/)
    expect(src).toMatch(/PERIODE_API\[/)
    expect(src, 'l’ancien toggle mensuel/annuel est toujours là').not.toMatch(/setBillingPeriod|billingPeriod ===|\[billingPeriod\]/)
    expect(src, 'le badge « -20% » est toujours là').not.toMatch(/-20%/)
    // Même règle d'éligibilité que le serveur, pour le badge, le détail du
    // trimestre et le bouton mensuel : sinon la page annoncerait un −50 % ou un
    // mois offert que Checkout refuserait.
    expect(src).toMatch(/peutAvoirUneOffreDeBienvenue\(client\)/)
    expect(src).toMatch(/'mensuel' && offreBienvenue && boutiqueShopify === false \? joursEssaiPour\(client\)/)
  })
})

describe('la formule suit le visiteur', () => {
  it('la page de choix du plan ne code plus la période en dur', () => {
    const src = sansCommentaires(readFileSync('src/pages/PlanSelectionPage.jsx', 'utf8'))
    expect(src).not.toMatch(/billingPeriod: "monthly"|billing_period: "monthly"|billingPeriod="monthly"/)
    expect(src).toMatch(/lireFormuleChoisie\(/)
    expect(src).toMatch(/PERIODE_API\[/)
  })
})
