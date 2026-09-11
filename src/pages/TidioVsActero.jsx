import React from 'react'
import { VsTemplate } from '../components/alternative/VsTemplate'

/**
 * /tidio-vs-actero — page comparative SEO
 * Pricing concurrent (avril 2026) : Free · Starter 24,17 $ (100c) · Growth 49,17 $ (250c) · Plus 749 $ · Premium custom.
 * Lyro AI : 32,50 $/mois pour seulement 50 conversations, crédits IA plafonnés.
 */
export const TidioVsActero = ({ onNavigate }) => {
  const data = {
    competitorKey: 'tidio',
    competitorName: 'Tidio',
    comparisonDate: 'avril 2026',
    sources: 'Tarifs publics avril 2026 — Lyro AI à partir de 32,50 $/mois pour seulement 50 conversations',

    seo: {
      title: 'Tidio vs Actero — Comparatif IA SAV Shopify 2026 | Lequel choisir',
      description:
        "Tidio Lyro est un chatbot IA léger, Actero est un agent autonome spécialisé Shopify avec actions natives. Comparatif détaillé prix, features, ROI.",
      keywords:
        'tidio vs actero, lyro ai vs actero, tidio ou actero, tidio shopify comparatif, agent ia ecommerce français',
    },

    hero: {
      subtitle:
        "Tidio Lyro plafonne dès les cas complexes (refund, échange, suivi colis) et facture par conversation IA avec des crédits qui s'épuisent. Actero est un agent autonome qui exécute des actions Shopify natives et ne plafonne jamais. Pour un store sérieux, le choix est évident.",
    },

    verdict: {
      winner: 'actero',
      headline: 'Pour un site Shopify français sérieux : Actero, point.',
      body:
        "Tidio Lyro reste un chatbot FAQ qui redirige vers un humain dès que ça se complique, avec des crédits IA qui s'épuisent vite. Actero exécute des actions Shopify (refund, échange, WISMO) et un dashboard ROI partageable — sans crédit qui s'épuise, sans plafond IA, en français natif.",
    },

    comparison: [
      {
        label: 'Prix d\'entrée payant',
        competitor: { main: '24,17 $/mois', sub: 'Starter · 100 conv' },
        actero: { main: '99 €/mois', sub: 'Starter · 1 000 tickets, IA illimitée' },
      },
      {
        label: 'IA pour 1 000 conversations/mois',
        competitor: { main: '~149 $/mois', sub: 'Growth + Lyro 250 conv + add-on' },
        actero: { main: '99 €/mois', sub: 'IA illimitée incluse' },
      },
      {
        label: 'Spécialisation Shopify (catalogue, commandes, refund)',
        competitor: 'partial',
        actero: { main: 'Native', sub: 'OAuth + actions agentic' },
      },
      {
        label: 'Relance panier abandonné conversationnelle',
        competitor: 'partial',
        actero: { main: 'Inclus', sub: 'Dès Free' },
      },
      {
        label: 'Quota IA',
        competitor: { main: 'Par conversation', sub: '50-3 000 conv selon plan' },
        actero: { main: 'Illimitée', sub: 'Compté par tickets traités' },
      },
      {
        label: 'Interface & support en français',
        competitor: 'partial',
        actero: true,
      },
      {
        label: 'Hébergement UE + RGPD natif + opt-out TDM',
        competitor: 'partial',
        actero: true,
      },
      {
        label: 'Dashboard ROI partageable (CA récupéré)',
        competitor: false,
        actero: { main: 'URL signée', sub: 'Read-only public' },
      },
      {
        label: 'Marketplace + Academy + Partners',
        competitor: false,
        actero: true,
      },
    ],

    whenCompetitor: [
      'Votre volume est minuscule (< 100 tickets/mois) et vous acceptez de plafonner à 50 conversations IA dans le plan d\'entrée.',
      'Vous tolérez un chatbot qui redirige vers un humain dès que la question dépasse une FAQ basique.',
      'Vous acceptez que vos crédits IA s\'épuisent en milieu de mois sans alerte ni plafond clair.',
      'Vous n\'avez aucun besoin d\'actions Shopify natives, de dashboard ROI ni de conformité RGPD stricte.',
    ],

    whenActero: [
      'Vous voulez un agent qui exécute des actions Shopify (refund, échange, WISMO).',
      'Vous traitez 500+ tickets/mois et le coût par conversation Tidio Lyro vous freine.',
      'Vous voulez prouver le ROI au CFO avec un dashboard partageable.',
      'Vous opérez en France ou EU et la conformité RGPD est non-négociable.',
      'Vous voulez démarrer en 15 minutes sans réinventer un système de macros.',
    ],

    faqs: [
      {
        q: 'Lyro AI vs Actero — qu\'est-ce qui change vraiment ?',
        a: "Lyro répond aux questions FAQ et redirige vers un humain pour le reste. Actero exécute des actions Shopify (refund, échange, modification adresse) et escalade quand la confiance baisse. C'est la différence entre un assistant et un agent autonome.",
      },
      {
        q: 'Combien coûte Tidio + Lyro pour 1 000 conversations IA/mois ?',
        a: "Plan Growth (250 conversations) à 49,17 $ + Lyro pour gérer 1 000 conversations IA = environ 149 $/mois (l'add-on Lyro grimpe avec le volume). Actero Starter à 99 €/mois couvre 1 000 tickets avec IA illimitée — moins cher et sans plafond IA.",
      },
      {
        q: 'Migration depuis Tidio — c\'est compliqué ?',
        a: "Non. Vos conversations Tidio restent dans Tidio (lecture seule). Actero importe la KB depuis votre site Shopify, vous configurez l'agent dans le simulateur, vous déployez. La majorité des marchands gardent Tidio 1 semaine en parallèle pour valider.",
      },
      {
        q: 'Tidio est moins cher à l\'entrée — quand devient-il plus cher ?',
        a: "Dès 200 conversations IA/mois, Lyro + plan helpdesk dépassent 100 $/mois. Au-delà de 500 tickets, Actero devient mécaniquement plus rentable (tout inclus). Plus le volume monte, plus l'écart se creuse.",
      },
      {
        q: 'Tidio fonctionne hors Shopify — Actero aussi ?',
        a: "Actero est centré Shopify (l'avantage : actions natives sur commandes/catalogue). Si vous opérez sur WooCommerce ou Prestashop, contactez-nous — Actero peut s'adapter via webhooks et MCP, mais Shopify reste le sweet spot.",
      },
    ],

    crosslinks: [
      { href: '/alternative-tidio', label: 'Alternative à Tidio — pourquoi switcher' },
      { href: '/gorgias-vs-actero', label: 'Gorgias vs Actero' },
      { href: '/intercom-vs-actero', label: 'Intercom vs Actero' },
      { href: '/zendesk-vs-actero', label: 'Zendesk vs Actero' },
      { href: '/tarifs', label: 'Voir tous les tarifs' },
    ],
  }

  return <VsTemplate onNavigate={onNavigate} data={data} />
}
