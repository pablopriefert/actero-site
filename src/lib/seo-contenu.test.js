// @ts-check
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// `vitest.config.js` n'embarque pas le plugin @vitejs/plugin-react (contrairement à
// vite.config.js) : son transform JSX esbuild par défaut compile en `React.createElement`
// (runtime « classic »), qui a besoin de `React` en portée globale. Plusieurs composants
// partagés (ex. src/components/SEO.jsx) ne l'importent pas eux-mêmes, en confiance dans le
// runtime automatique du build réel — ce fichier de test n'est pas le lieu pour y toucher.
globalThis.React = React
import { HelmetProvider } from 'react-helmet-async'
import { Check } from 'lucide-react'
import { FaqPage } from '../pages/FaqPage.jsx'
import { AlternativeTemplate } from '../components/alternative/AlternativeTemplate.jsx'
import { PricingPage } from '../pages/PricingPage.jsx'
import { ProductPage } from '../pages/ProductPage.jsx'
import { FORMULES } from '../../api/lib/formules.js'

/**
 * Garde-fous de l'audit SEO (septembre 2026) :
 *  1. les réponses de FAQ (FaqPage, AlternativeTemplate) restent dans le DOM
 *     une fois fermées — Google ne clique pas.
 *  2. un seul discours sur le taux d'automatisation dans la FAQ.
 *  3. le titre/description de /faq matchent le pré-rendu.
 *  4. les pages légales gardent leurs accents.
 *  5-7. les données structurées (tarifs, produit, alternatives) suivent le
 *     catalogue FORMULES et n'annoncent plus une offre Enterprise sans prix.
 */

const lire = (chemin) => readFileSync(chemin, 'utf8')

/** renderToStaticMarkup échappe le texte (apostrophe → &#x27;, etc.) : on
 * décode pour comparer à du texte source brut. */
const decoderEntites = (s) =>
  s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

/**
 * Rend un élément enveloppé de <HelmetProvider> et en extrait { html, schemas,
 * title, description }.
 *
 * Vérifié empiriquement (pas dans la doc react-helmet-async v3) : sous
 * `renderToStaticMarkup` sans <head> réel à gérer, <Helmet> rend ses balises
 * (title, meta, script) EN LIGNE, à l'endroit où <SEO> est monté — le
 * `context` fourni à <HelmetProvider> reste vide (`{}`). C'est donc le HTML
 * renvoyé par renderToStaticMarkup lui-même qu'il faut lire, pas le contexte.
 */
function rendreAvecHelmet(element) {
  const html = renderToStaticMarkup(createElement(HelmetProvider, null, element))
  // <SEO schemaData={...}> accepte un objet OU un tableau de schémas (un seul
  // <script> dans les deux cas, via JSON.stringify) : on aplatit pour que
  // `schemas` soit toujours une liste plate d'objets `{ '@type': ... }`.
  const schemas = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]))
    .flatMap((bloc) => (Array.isArray(bloc) ? bloc : [bloc]))
  const title = decoderEntites(html.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] || '')
  const description = decoderEntites(html.match(/<meta name="description" content="([^"]*)"/)?.[1] || '')
  return { html, schemas, title, description }
}

const DONNEES_ALTERNATIVE_TEST = {
  competitorKey: 'test-competitor',
  competitorName: 'TestCompetitor',
  comparisonDate: 'avril 2026',
  sources: 'Source de test',
  seo: { title: 'Titre de test', description: 'Description de test', keywords: 'a, b' },
  hero: { subtitle: 'Sous-titre de test' },
  comparison: [{ label: 'Prix', actero: true, competitor: false }],
  whySwitch: [{ icon: Check, stat: '1', statLabel: 'label', title: 'titre', desc: 'description' }],
  testimonials: [],
  crosslinks: [{ href: '/alternative-autre', label: 'Autre' }],
  faqs: [
    { q: 'Question de test un ?', a: 'Réponse de test un, suffisamment longue pour être vérifiée.' },
    { q: 'Question de test deux ?', a: 'Réponse de test deux, suffisamment longue pour être vérifiée.' },
  ],
}

describe('FAQ — les réponses restent dans le DOM (fermées ou non)', () => {
  it('FaqPage ne monte plus une réponse sous condition d’ouverture', () => {
    const src = lire('src/pages/FaqPage.jsx')
    expect(src).not.toMatch(/\{openFaq === uniqueId && \(/)
  })

  it('AlternativeTemplate ne monte plus une réponse sous condition d’ouverture', () => {
    const src = lire('src/components/alternative/AlternativeTemplate.jsx')
    expect(src).not.toMatch(/\{isOpen && \(/)
  })

  it('toutes les réponses de la FAQ sont dans le HTML dès le premier rendu', () => {
    const nbQuestionsSource = (lire('src/pages/FaqPage.jsx').match(/^\s*q: ["']/gm) || []).length
    expect(nbQuestionsSource).toBeGreaterThan(0)

    const { html } = rendreAvecHelmet(createElement(FaqPage, { onNavigate: () => {} }))
    const nbReponsesDom = (html.match(/id="faq-answer-/g) || []).length

    expect(nbReponsesDom).toBe(nbQuestionsSource)
  })

  it('AlternativeTemplate : toutes les réponses FAQ sont dans le HTML dès le premier rendu', () => {
    const { html } = rendreAvecHelmet(
      createElement(AlternativeTemplate, { onNavigate: () => {}, data: DONNEES_ALTERNATIVE_TEST }),
    )
    for (const faq of DONNEES_ALTERNATIVE_TEST.faqs) {
      expect(html).toContain(faq.a)
    }
  })

  it('les boutons FAQ gardent aria-expanded / aria-controls, et les réponses un id', () => {
    const { html } = rendreAvecHelmet(createElement(FaqPage, { onNavigate: () => {} }))
    expect(html).toMatch(/aria-expanded="(true|false)"/)
    expect(html).toMatch(/aria-controls="faq-answer-/)
  })
})

describe('FAQ — un seul discours sur le taux d’automatisation', () => {
  it('ne contient ni « en moyenne 60% » ni « 50 à 70 »', () => {
    const src = lire('src/pages/FaqPage.jsx')
    // Pas un blanket `/60\s?%/` : « score de confiance inférieur à 60% » (seuil
    // d'escalade, ailleurs dans la FAQ) est une configuration système réelle,
    // pas une promesse de taux de résolution — hors sujet ici.
    expect(src).not.toMatch(/en moyenne 60/)
    expect(src).not.toMatch(/50 à 70/)
  })

  it('renvoie vers le simulateur (qui existe côté marchand)', () => {
    const src = lire('src/pages/FaqPage.jsx')
    expect(src.toLowerCase()).toContain('simulateur')
  })
})

describe('FAQ — titre et description alignés sur le pré-rendu', () => {
  it('le <SEO> de FaqPage reprend le titre et la description du pré-rendu', () => {
    const prerender = lire('scripts/prerender-routes.mjs')
    const bloc = prerender.slice(prerender.indexOf("path: '/faq'"), prerender.indexOf("path: '/faq'") + 400)
    // `[^']+` s'arrêtait sur l'apostrophe ÉCHAPPÉE de « l\'agent » : il faut
    // autoriser `\\.` (tout caractère échappé) dans la capture, puis déséchapper.
    const titrePrerendu = bloc.match(/title: '((?:\\.|[^'\\])*)'/)?.[1]?.replace(/\\(.)/g, '$1')
    const descriptionPrerendu = bloc.match(/description: '((?:\\.|[^'\\])*)'/)?.[1]?.replace(/\\(.)/g, '$1')

    const { title, description } = rendreAvecHelmet(createElement(FaqPage, { onNavigate: () => {} }))

    expect(titrePrerendu).toBeTruthy()
    expect(title).toContain(titrePrerendu)
    expect(description).toBe(descriptionPrerendu)
  })
})

describe('Pages légales — accents rétablis', () => {
  const fichiers = {
    'src/pages/LegalPage.jsx': 'LegalPage',
    'src/pages/PrivacyPage.jsx': 'PrivacyPage',
    'src/pages/TermsPage.jsx': 'TermsPage',
  }

  for (const [chemin, nom] of Object.entries(fichiers)) {
    it(`${nom} ne contient plus de fautes d'accents connues`, () => {
      const src = lire(chemin)
      expect(src).not.toMatch(/Derniere mise a jour/)
      expect(src).not.toMatch(/Siege social/)
      expect(src).not.toMatch(/Duree/)
    })
  }

  it('PrivacyPage : la description dit « protège », plus « protégé »', () => {
    const src = lire('src/pages/PrivacyPage.jsx')
    expect(src).not.toMatch(/protégé vos données/)
    expect(src).toMatch(/protège vos données/)
  })

  it('TermsPage : la section 7 (Tarification et paiement) reste intacte', () => {
    const src = lire('src/pages/TermsPage.jsx')
    expect(src).toContain('Les tarifs du Service sont communiques sur devis après un audit gratuit.')
  })
})

describe('Tarifs — données structurées suivent le catalogue FORMULES', () => {
  it('PricingPage.jsx ne déclare plus de type \'Product\' dans son schéma', () => {
    const src = lire('src/pages/PricingPage.jsx')
    expect(src).not.toMatch(/"@type":\s*"Product"/)
    expect(src).not.toMatch(/'@type':\s*'Product'/)
  })

  it('PricingPage.jsx s’appuie sur FORMULES', () => {
    const src = lire('src/pages/PricingPage.jsx')
    expect(src).toMatch(/FORMULES/)
  })

  it('le schéma rendu est un tableau SoftwareApplication + BreadcrumbList, une offre par formule', () => {
    const { schemas } = rendreAvecHelmet(createElement(PricingPage, { onNavigate: () => {} }))
    expect(Array.isArray(schemas)).toBe(true)

    const app = schemas.find((s) => s['@type'] === 'SoftwareApplication')
    expect(app).toBeTruthy()
    expect(schemas.some((s) => s['@type'] === 'Product')).toBe(false)

    const offres = app.offers || []
    // Free (0€) + une offre par entrée du catalogue FORMULES, aucune Enterprise.
    expect(offres.length).toBe(FORMULES.length + 1)
    expect(offres.some((o) => Number(o.price) === 0)).toBe(true)
    expect(offres.some((o) => /enterprise/i.test(o.name || ''))).toBe(false)

    for (const f of FORMULES) {
      const attendu = f.periode === 'mensuel' ? 'P1M' : f.periode === 'trimestriel' ? 'P3M' : 'P1Y'
      const offre = offres.find(
        (o) => Math.abs(Number(o.price) - f.montantCentimes / 100) < 0.01
          && o.priceSpecification?.billingDuration,
      )
      expect(offre, `offre manquante pour ${f.plan} ${f.periode}`).toBeTruthy()
      expect(offre.priceSpecification['@type']).toBe('UnitPriceSpecification')
      expect(offre.priceSpecification.billingDuration).toBe(attendu)
    }

    const breadcrumb = schemas.find((s) => s['@type'] === 'BreadcrumbList')
    expect(breadcrumb).toBeTruthy()
    expect(breadcrumb.itemListElement).toHaveLength(2)
    expect(breadcrumb.itemListElement[1].item).toBe('https://actero.fr/tarifs')
  })
})

describe('Produit — données structurées réellement vérifiées', () => {
  it('ProductPage.jsx déclare un SoftwareApplication sans WhatsApp', () => {
    const { schemas } = rendreAvecHelmet(createElement(ProductPage, { onNavigate: () => {} }))
    const app = schemas.find((s) => s['@type'] === 'SoftwareApplication')
    expect(app).toBeTruthy()
    expect((app.featureList || []).join(' | ')).not.toMatch(/whatsapp/i)

    const offre = app.offers
    expect(offre?.['@type']).toBe('AggregateOffer')
    expect(Number(offre.lowPrice)).toBe(0)
    expect(Number(offre.highPrice)).toBe(3950.10)
    expect(offre.priceCurrency).toBe('EUR')

    const breadcrumb = schemas.find((s) => s['@type'] === 'BreadcrumbList')
    expect(breadcrumb).toBeTruthy()
    expect(breadcrumb.itemListElement).toHaveLength(2)
    expect(breadcrumb.itemListElement[1].name).toMatch(/Produit/i)
  })
})

describe('Alternatives — breadcrumb à deux niveaux, offres agrégées', () => {
  it('AlternativeTemplate.jsx ne mentionne plus « Comparaisons » dans son breadcrumb', () => {
    const src = lire('src/components/alternative/AlternativeTemplate.jsx')
    expect(src).not.toMatch(/Comparaisons/)
  })

  it('le breadcrumb rendu a deux niveaux et les offres sont un AggregateOffer', () => {
    const { schemas } = rendreAvecHelmet(
      createElement(AlternativeTemplate, { onNavigate: () => {}, data: DONNEES_ALTERNATIVE_TEST }),
    )
    const breadcrumb = schemas.find((s) => s['@type'] === 'BreadcrumbList')
    expect(breadcrumb).toBeTruthy()
    expect(breadcrumb.itemListElement).toHaveLength(2)
    expect(breadcrumb.itemListElement.map((i) => i.name).join(' | ')).not.toMatch(/Comparaisons/)

    const app = schemas.find((s) => s['@type'] === 'SoftwareApplication')
    expect(app.offers?.['@type']).toBe('AggregateOffer')
    expect(Number(app.offers.lowPrice)).toBe(0)
    expect(Number(app.offers.highPrice)).toBe(3950.10)
    expect(app.offers.priceCurrency).toBe('EUR')
  })
})
