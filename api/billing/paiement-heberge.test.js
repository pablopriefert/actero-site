import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

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
  it('la page tarifs mémorise la formule choisie avant l’inscription', () => {
    const src = sansCommentaires(readFileSync('src/pages/PricingPage.jsx', 'utf8'))
    expect(src).toMatch(/memoriserFormuleChoisie\(/)
    expect(src).toMatch(/<SelecteurFormule/)
    expect(src, 'le vieux toggle mensuel/annuel est toujours là').not.toMatch(/isAnnual/)
  })

  it('la page de choix du plan ne code plus la période en dur', () => {
    const src = sansCommentaires(readFileSync('src/pages/PlanSelectionPage.jsx', 'utf8'))
    expect(src).not.toMatch(/billingPeriod: "monthly"|billing_period: "monthly"|billingPeriod="monthly"/)
    expect(src).toMatch(/lireFormuleChoisie\(/)
    expect(src).toMatch(/PERIODE_API\[/)
  })
})

describe('plus de remise annuelle de 20 %', () => {
  it('aucun texte n’annonce encore l’ancien annuel', () => {
    const fautifs = []
    for (const f of ['src/pages/PricingPage.jsx', 'src/pages/FaqPage.jsx', 'src/components/landing/PricingA.jsx', 'src/components/client/ClientBillingView.jsx']) {
      const src = sansCommentaires(readFileSync(f, 'utf8'))
      if (/-\s?20\s?%|20\s?% de réduction|économiser 20/.test(src)) fautifs.push(`${f} : remise de 20 %`)
      if (/\b(79|319)\s?€\/mois en annuel|948\s?€\/an|3\s?828\s?€\/an/.test(src)) fautifs.push(`${f} : ancien prix annuel`)
    }
    expect(fautifs).toEqual([])
  })
})

function fichiersSource(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) fichiersSource(p, acc)
    else if (/\.(jsx?|mjs)$/.test(e) && !e.includes('.test.')) acc.push(p)
  }
  return acc
}

// Toutes les formes sous lesquelles le site promettait un essai de 7 jours le
// 14 septembre 2026.
const PROMESSE_ESSAI = /essai (gratuit )?(de )?7 jours|7 jours gratuits|7 jours d.essai|essai 7 ?j\b|jours de trial|trial gratuit|essai gratuit sur starter|p[ée]riode d.essai de 7 jours|pendant sept jours|commencer mon essai gratuit|d[ée]marrer l.essai gratuit|essai gratuit · annulable/i

describe('plus d’essai gratuit de 7 jours', () => {
  it('aucune page ne le promet encore', () => {
    // Décision du 14 septembre 2026 : le mensuel se paie dès l'inscription. Seul
    // le mois offert (campagne, parrainage) reste — ses bandeaux « Essai
    // gratuit — J-x » du tableau de bord sont légitimes.
    const fautifs = []
    for (const f of [...fichiersSource('src'), ...fichiersSource('scripts')]) {
      const m = sansCommentaires(readFileSync(f, 'utf8')).match(PROMESSE_ESSAI)
      if (m) fautifs.push(`${f} : « ${m[0]} »`)
    }
    // Ce que lisent les assistants IA (llms.txt) et les réseaux sociaux (le
    // texte de l'image de partage, dont og-image.png est générée).
    for (const f of ['public/llms.txt', 'public/og-image.svg']) {
      const m = readFileSync(f, 'utf8').match(PROMESSE_ESSAI)
      if (m) fautifs.push(`${f} : « ${m[0]} »`)
    }
    expect(fautifs).toEqual([])
  })

  it('la documentation ne promet plus d’essai ni l’ancien annuel', () => {
    const fautifs = []
    for (const f of ['docs/essentials/quickstart.mdx', 'docs/essentials/facturation.mdx']) {
      const src = readFileSync(f, 'utf8')
      const m = src.match(PROMESSE_ESSAI)
      if (m) fautifs.push(`${f} : « ${m[0]} »`)
      if (/-\s?20\s?%/.test(src)) fautifs.push(`${f} : remise annuelle de 20 %`)
    }
    expect(fautifs).toEqual([])
  })

  it('les plans payants n’ont plus d’essai', () => {
    const src = sansCommentaires(readFileSync('src/lib/plans.js', 'utf8'))
    expect(src).not.toMatch(/\btrial:\s*\{/)
  })
})
