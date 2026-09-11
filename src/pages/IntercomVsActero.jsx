import React from 'react'
import { VsTemplate } from '../components/alternative/VsTemplate'

/**
 * /intercom-vs-actero — page comparative SEO
 * Pricing concurrent (avril 2026) :
 *   Essential 29 $ · Advanced 85 $ · Expert 132 $ par seat.
 *   Fin AI facturé 0,99 $ par outcome résolu — facture imprévisible.
 */
export const IntercomVsActero = ({ onNavigate }) => {
  const data = {
    competitorKey: 'intercom',
    competitorName: 'Intercom',
    comparisonDate: 'avril 2026',
    sources: 'Tarifs publics avril 2026 — Essential 29 $/seat + Fin AI facturé 0,99 $ par outcome résolu',

    seo: {
      title: 'Intercom vs Actero — Comparatif 2026 | Lequel choisir pour Shopify',
      description:
        "Intercom Fin facture 0,99 $ par outcome + 29 $/seat. Actero forfaitise dès 99 €/mois — IA, paniers inclus. Sur 5 000 résolutions, Actero divise par 12.",
      keywords:
        'intercom vs actero, fin ai vs actero, intercom ou actero, intercom shopify comparatif, agent ia ecommerce',
    },

    hero: {
      subtitle:
        "Intercom Fin facture chaque outcome à 0,99 $ en plus du seat à 29 $ — la facture explose dès le 1 000ᵉ ticket et reste imprévisible chaque mois. Le produit est conçu pour les SaaS B2B, pas pour le e-commerce Shopify. Actero forfaitise tout et exécute des actions Shopify natives.",
    },

    verdict: {
      winner: 'actero',
      headline: 'Pour un marchand Shopify français : Actero, sans appel.',
      body:
        "Intercom Fin est conçu pour les SaaS B2B anglophones avec ARPU élevé. À volume e-commerce, la facture à l'outcome explose : 1 000 résolutions = ~990 $/mois, 5 000 résolutions = ~4 950 $/mois. Actero forfaitise tout dès 99 €/mois et exécute des actions Shopify natives — division par 8 à 12 sur la facture, en français.",
    },

    comparison: [
      {
        label: 'Prix d\'entrée',
        competitor: { main: '29 $/seat', sub: 'Essential' },
        actero: { main: '0 €/mois', sub: 'Free à vie · 50 tickets' },
      },
      {
        label: 'Coût pour 1 000 résolutions IA',
        competitor: { main: '~990 $/mois', sub: '0,99 $ × 1 000 + seats' },
        actero: { main: '99 €/mois', sub: 'Forfait Starter complet' },
      },
      {
        label: 'Coût pour 5 000 résolutions IA',
        competitor: { main: '~4 950 $/mois', sub: '0,99 $ × 5 000 + seats' },
        actero: { main: '399 €/mois', sub: 'Forfait Pro complet' },
      },
      {
        label: 'Plafond mensuel prévisible',
        competitor: { main: 'Non', sub: 'Pay-per-outcome' },
        actero: { main: 'Oui', sub: 'Forfait + overage 0,15 €' },
      },
      {
        label: 'Spécialisation Shopify (refund, échange, WISMO)',
        competitor: 'partial',
        actero: { main: 'Native', sub: 'Actions agentic OAuth' },
      },
      {
        label: 'Relance panier abandonné conversationnelle',
        competitor: 'partial',
        actero: { main: 'Inclus', sub: 'Proactive Engine dès Free' },
      },
      {
        label: 'Copilot pour agents humains',
        competitor: { main: '+29 $/agent', sub: 'Add-on Copilot' },
        actero: { main: 'Inclus', sub: 'AiCopilotPanel natif' },
      },
      {
        label: 'Hébergement UE + RGPD natif + opt-out TDM',
        competitor: 'partial',
        actero: true,
      },
      {
        label: 'Dashboard ROI partageable (CA récupéré)',
        competitor: 'partial',
        actero: { main: 'URL signée', sub: 'Read-only public' },
      },
      {
        label: 'Marketplace + Academy + Partners',
        competitor: 'partial',
        actero: true,
      },
    ],

    whenCompetitor: [
      'Vous n\'êtes pas e-commerce et n\'avez aucun besoin d\'actions Shopify natives (refund, échange, WISMO).',
      'Vous acceptez de payer 0,99 $ chaque résolution sans plafond mensuel — facture imprévisible chaque mois.',
      'Vos clients et équipes sont anglophones et l\'expérience FR n\'est pas critique.',
      'Vous êtes prêt à payer le Copilot 29 $/agent en supplément alors qu\'il est inclus ailleurs.',
    ],

    whenActero: [
      'Vous êtes marchand Shopify et avez besoin d\'actions Shopify natives (refund, échange, WISMO).',
      'Vous voulez un coût mensuel prévisible — pas de pay-per-outcome qui s\'envole.',
      'Vous opérez en France et la conformité RGPD + hébergement UE est non-négociable.',
      'Vous voulez démarrer en 15 minutes sans intégrateur ni audit préalable.',
      'Le ROI dashboard partageable au CFO est un must pour vous.',
    ],

    faqs: [
      {
        q: 'Combien coûte vraiment Intercom Fin pour 5 000 résolutions/mois ?',
        a: "Plan Essential à 29 $/seat × 3 seats = 87 $. Fin à 0,99 $ × 5 000 = 4 950 $. Total ≈ 5 037 $/mois (~4 685 €/mois). Actero Pro couvre la même charge à 399 €/mois — environ 12× moins cher, avec IA illimitée incluse.",
      },
      {
        q: 'Qu\'est-ce qu\'un "outcome" chez Intercom Fin ?',
        a: "Un outcome est une conversation où le client confirme la résolution (ou ne revient pas dans les X heures). Chaque outcome = 0,99 $ facturé, peu importe le nombre de messages. C'est plus juste qu'à la résolution stricte mais ça reste imprévisible — contrairement au forfait Actero.",
      },
      {
        q: 'Migration depuis Intercom — combien de temps ?',
        a: "Une après-midi pour la majorité des marchands. Vos conversations Intercom restent en lecture seule. Actero importe la KB par scraping ou export Help Center. Le simulateur permet de tester avant production. Plusieurs clients gardent Intercom 2 semaines en parallèle.",
      },
      {
        q: 'Et la qualité conversationnelle ? Fin est réputé excellent.',
        a: "Fin et Actero utilisent tous deux des LLM de pointe (Claude / GPT). La différence : Actero exécute des actions Shopify natives et inclut des guardrails configurables (no refund > 100 € sans humain pour non-VIP). Sur Shopify, exécuter une action vaut mieux qu'une réponse parfaite qui dit 'contactez-nous'.",
      },
      {
        q: 'Intercom a un Help Center et des Tours produit — Actero aussi ?',
        a: "Actero embarque la base de connaissances importée + un Portail SAV self-service brandable (custom domain) où vos clients peuvent suivre leurs commandes, échanger, retourner. Pas de Tours produit (c'est un autre métier que le SAV). Si Tours est critique, Intercom + Actero peuvent cohabiter.",
      },
    ],

    crosslinks: [
      { href: '/alternative-intercom', label: 'Alternative à Intercom — pourquoi switcher' },
      { href: '/gorgias-vs-actero', label: 'Gorgias vs Actero' },
      { href: '/zendesk-vs-actero', label: 'Zendesk vs Actero' },
      { href: '/tidio-vs-actero', label: 'Tidio vs Actero' },
      { href: '/tarifs', label: 'Voir tous les tarifs' },
    ],
  }

  return <VsTemplate onNavigate={onNavigate} data={data} />
}
