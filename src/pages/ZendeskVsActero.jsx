import React from 'react'
import { VsTemplate } from '../components/alternative/VsTemplate'

/**
 * /zendesk-vs-actero — page comparative SEO
 * Pricing concurrent (avril 2026) :
 *   Suite Team 55 $ · Growth 89 $ · Pro 115 $ · Enterprise 169 $+ par agent.
 *   Advanced AI add-on facturé +50 $ par agent en supplément.
 */
export const ZendeskVsActero = ({ onNavigate }) => {
  const data = {
    competitorKey: 'zendesk',
    competitorName: 'Zendesk',
    comparisonDate: 'avril 2026',
    sources: 'Tarifs publics avril 2026 — Suite plans + Advanced AI add-on facturé 50 $ par agent/mois',

    seo: {
      title: 'Zendesk vs Actero — Comparatif 2026 pour PME e-commerce | Verdict',
      description:
        "Zendesk vise l'enterprise (55-169 $/agent + 50 $ AI). Actero est forfaitaire pour PME Shopify (99 €/mois tout compris). Comparatif détaillé prix et features.",
      keywords:
        'zendesk vs actero, alternative zendesk pme, zendesk ou actero, zendesk shopify comparatif, agent ia français',
    },

    hero: {
      subtitle:
        "Zendesk facture par agent, empile les add-ons IA payants et impose des semaines voire des mois d'implementation. Actero est forfaitaire, pensé Shopify-first, démarre en 15 minutes et inclut un agent vocal natif. Pour une PME e-commerce FR, l'écart de coût et de complexité est massif.",
    },

    verdict: {
      winner: 'actero',
      headline: 'Pour une PME Shopify française : Actero, sans hésiter.',
      body:
        "Zendesk est une suite enterprise lourde, anglophone, facturée par agent avec des add-ons IA en supplément et des frais d'implementation. Actero divise le coût par 5 à 10, démarre en 15 minutes au lieu de 3 mois, parle français nativement, héberge en UE et inclut un agent vocal — pas un add-on Zendesk Talk vieillissant.",
    },

    comparison: [
      {
        label: 'Prix d\'entrée',
        competitor: { main: '55 $/agent', sub: 'Suite Team' },
        actero: { main: '0 €/mois', sub: 'Free à vie · 50 tickets' },
      },
      {
        label: 'Plan + AI pour 5 agents',
        competitor: { main: '525 $/mois', sub: 'Growth 89 $ + AI 50 $ × 5' },
        actero: { main: '99 €/mois', sub: 'Starter Actero, IA illimitée' },
      },
      {
        label: 'Coût annuel · 5 agents · 5 000 tickets/mois',
        competitor: { main: '~6 300 $/an', sub: 'Hors implementation fees' },
        actero: { main: '4 788 €/an', sub: 'Pro Actero tout inclus' },
      },
      {
        label: 'Spécialisation e-commerce Shopify',
        competitor: 'partial',
        actero: { main: 'Native', sub: 'OAuth + catalogue + commandes' },
      },
      {
        label: 'Agent vocal natif (numéro FR)',
        competitor: { main: 'Zendesk Talk', sub: 'Add-on payant' },
        actero: { main: '200 min', sub: 'ElevenLabs inclus dès Pro' },
      },
      {
        label: 'Relance panier abandonné conversationnelle',
        competitor: false,
        actero: { main: 'Inclus', sub: 'Dès Free' },
      },
      {
        label: 'Setup time',
        competitor: { main: 'Semaines/mois', sub: 'Implementation expert' },
        actero: { main: '15 min', sub: 'OAuth Shopify auto' },
      },
      {
        label: 'Modèle de pricing',
        competitor: { main: 'Per-agent + add-ons', sub: 'Facture variable' },
        actero: { main: 'Forfait simple', sub: 'Pas par agent' },
      },
      {
        label: 'Hébergement UE + RGPD natif + opt-out TDM',
        competitor: 'partial',
        actero: true,
      },
      {
        label: 'Dashboard ROI partageable',
        competitor: 'partial',
        actero: { main: 'URL signée', sub: 'Read-only public' },
      },
      {
        label: 'Intégrations marketplace',
        competitor: { main: '1 500+', sub: 'Écosystème massif' },
        actero: { main: 'Templates communauté', sub: 'Marketplace Actero' },
      },
    ],

    whenCompetitor: [
      'Vous acceptez de payer chaque agent au mois plus 50 $ d\'add-on IA en supplément.',
      'Vous tolérez 3 à 6 mois d\'implementation avec un consultant avant de voir le premier ticket résolu.',
      'Vous n\'êtes pas e-commerce et n\'avez pas besoin d\'actions Shopify natives.',
      'Vos clients et équipes sont anglophones et l\'expérience FR n\'est pas critique.',
      'Vous êtes prêt à payer des frais d\'implementation à 4 ou 5 chiffres avant la première résolution.',
    ],

    whenActero: [
      'Vous êtes marchand Shopify avec 1-20 agents et l\'IA est votre levier de scaling.',
      'Vous voulez un coût mensuel forfaitaire — pas un per-agent qui grimpe.',
      'Vos clients sont francophones et vous voulez un agent qui parle vraiment FR.',
      'Vous voulez démarrer en 15 minutes, pas en 3 mois d\'implementation.',
      'Un agent vocal natif (numéro FR) est utile pour vos clients qui appellent.',
      'Vous voulez prouver le ROI au CFO avec un dashboard partageable.',
    ],

    faqs: [
      {
        q: 'Zendesk a 1 500 intégrations — Actero peut-il rivaliser ?',
        a: "Non, Actero n'a pas l'écosystème Zendesk. Mais pour un marchand Shopify, 95% des intégrations utiles sont Shopify, Klaviyo, Loop Returns, ReCharge — toutes natives Actero ou accessibles via webhooks/MCP. Le 'choix infini' Zendesk devient inutile quand le besoin est ciblé e-commerce.",
      },
      {
        q: 'Combien coûte vraiment Zendesk pour 5 agents avec IA ?',
        a: "Suite Growth (89 $/agent) + Advanced AI add-on (50 $/agent) = 139 $/agent/mois × 5 agents = 695 $/mois ≈ 645 €/mois. Plus implementation fees (souvent 2-10 k$ initial). Actero Pro à 399 €/mois couvre la même charge avec voice et IA illimitée.",
      },
      {
        q: 'Migration depuis Zendesk — c\'est faisable ?',
        a: "Oui. Vos tickets historiques restent dans Zendesk (lecture seule pour audit). Actero importe la KB par scraping ou export. Le simulateur permet de tester l'agent contre des cas réels avant déploiement. La plupart des marchands gardent Zendesk 2-4 semaines en parallèle.",
      },
      {
        q: 'Zendesk a un meilleur support des langues globales ?',
        a: "Zendesk supporte 40+ langues — table-stakes pour enterprise. Actero supporte FR, EN, IT, ES, DE en qualité native (pas du Google Translate). Si vous opérez 10+ pays exotiques, Zendesk garde l'avantage. Pour FR + voisins EU, Actero suffit largement.",
      },
      {
        q: 'L\'agent vocal Actero remplace-t-il Zendesk Talk ?',
        a: "Pour la majorité des cas oui. Actero embarque ElevenLabs avec numéro FR, latence < 800 ms, voix custom Enterprise, inbound + outbound. Zendesk Talk reste plus mature côté IVR complexe et reporting d'opérateur — pertinent pour 50+ agents support téléphone, surdimensionné pour une PME Shopify.",
      },
    ],

    crosslinks: [
      { href: '/alternative-zendesk', label: 'Alternative à Zendesk — pourquoi switcher' },
      { href: '/gorgias-vs-actero', label: 'Gorgias vs Actero' },
      { href: '/intercom-vs-actero', label: 'Intercom vs Actero' },
      { href: '/tidio-vs-actero', label: 'Tidio vs Actero' },
      { href: '/tarifs', label: 'Voir tous les tarifs' },
    ],
  }

  return <VsTemplate onNavigate={onNavigate} data={data} />
}
