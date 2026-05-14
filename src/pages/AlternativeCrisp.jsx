import React from 'react'
import { ShoppingBag, Sparkles, TrendingUp, Phone, Shield, Zap } from 'lucide-react'
import { AlternativeTemplate } from '../components/alternative/AlternativeTemplate'

/**
 * /alternative-crisp — page comparative SEO
 * Pricing concurrent (avril 2026) : Free · Mini 45 $/mo · Essentials 95 $/mo · Plus 295 $/mo
 * IA limitée par crédits (~450 conv/mois sur Essentials).
 */
export const AlternativeCrisp = ({ onNavigate }) => {
  const data = {
    competitorKey: 'crisp',
    competitorName: 'Crisp',
    comparisonDate: 'avril 2026',
    sources: 'Tarifs publics avril 2026 — Crédits AI Essentials limités à environ 450 conversations/mois',

    seo: {
      title: 'Alternative à Crisp pour Shopify — Actero | Agent IA SAV FR',
      description:
        "Crisp est un super chat français mais l'IA est limitée par crédits. Actero est un vrai agent IA spécialisé Shopify, voix incluse, dashboard ROI. Dès 99 €/mois, hébergé UE.",
      keywords:
        'alternative crisp, crisp vs actero, crisp français alternative, crisp shopify ia, sav ia français, magicreply alternative',
    },

    hero: {
      subtitle:
        "Crisp est un chat live généraliste dont l'IA fonctionne par crédits limités (~450 conversations sur Essentials). Pas de spécialisation Shopify, pas d'actions agentic, pas d'agent vocal. Actero est un agent IA autonome qui lit vos commandes, déclenche refunds et échanges, et embarque le voice — sans crédit qui s'épuise.",
    },

    comparison: [
      {
        label: 'Prix d\'entrée',
        actero: { main: '0 €/mois', sub: 'Free à vie · 50 tickets' },
        competitor: { main: '0 $/mois', sub: 'Free · 2 seats sans IA' },
      },
      {
        label: 'Plan équivalent ~1 000 conv IA/mois',
        actero: { main: '99 €/mois', sub: '1 000 tickets, IA illimitée' },
        competitor: { main: '295 $/mois', sub: 'Plus · ~1 350 conv en crédits' },
      },
      {
        label: 'IA — modèle de quota',
        actero: { main: 'Tickets', sub: 'Pas de crédit qui s\'épuise' },
        competitor: { main: 'Crédits', sub: 'Crédits AI épuisables' },
      },
      {
        label: 'Spécialisation Shopify (catalogue, commandes, refund)',
        actero: { main: 'Native', sub: 'OAuth + actions agentic' },
        competitor: 'partial',
      },
      {
        label: 'Agent vocal natif (numéro FR)',
        actero: { main: '200 min', sub: 'Inclus dès Pro' },
        competitor: false,
      },
      {
        label: 'Relance panier abandonné conversationnelle',
        actero: { main: 'Inclus', sub: 'Dès Free' },
        competitor: false,
      },
      {
        label: 'Dashboard ROI temps réel (CA récupéré)',
        actero: { main: 'Natif', sub: 'Heures + euros' },
        competitor: 'partial',
      },
      {
        label: 'Hébergement UE + RGPD natif',
        actero: true,
        competitor: true,
      },
      {
        label: 'Marketplace templates + Academy',
        actero: true,
        competitor: false,
      },
      {
        label: 'API + Webhooks + MCP',
        actero: true,
        competitor: 'partial',
      },
    ],

    whySwitch: [
      {
        icon: ShoppingBag,
        stat: 'Shopify',
        statLabel: 'natif',
        title: 'Pensé pour le e-commerce, pas un chat universel',
        desc:
          "Crisp est un chat omnicanal généraliste sans spécialisation Shopify. Actero est conçu Shopify-first : OAuth en 1 clic, l'agent lit votre catalogue, vos commandes, vos politiques, et exécute des actions (refund, échange, suivi colis) sans macro à coder.",
      },
      {
        icon: Sparkles,
        stat: 'Sans',
        statLabel: 'crédit qui s\'épuise',
        title: 'Pricing par tickets, pas par crédits IA',
        desc:
          "Crisp Essentials donne ~450 conversations IA/mois en crédits — au-delà, vous payez ou l'IA s'arrête. Actero compte par tickets traités, IA illimitée incluse, overage prévisible à 0,15 €/ticket.",
      },
      {
        icon: Phone,
        stat: 'Voice',
        statLabel: '+ outbound téléphonique',
        title: 'Un agent vocal inclus, Crisp ne l\'a pas',
        desc:
          "Crisp ne fait pas de téléphone. Actero embarque ElevenLabs avec numéro FR, 200 min incluses sur Pro, voix custom Enterprise. Inbound (le client appelle), outbound (l'agent appelle pour relancer), unifié au reste.",
      },
      {
        icon: TrendingUp,
        stat: 'ROI',
        statLabel: 'CFO-grade',
        title: 'Dashboard qui parle aux décideurs',
        desc:
          "Actero affiche le CA récupéré (paniers + LTV), les heures économisées et la projection annuelle — partageables en lien public. Crisp affiche des metrics chat (CSAT, temps de réponse) mais pas un ROI prouvable au CFO.",
      },
    ],

    testimonials: [],

    faqs: [
      {
        q: 'Puis-je garder Crisp pour le chat live et utiliser Actero pour l\'IA ?',
        a: "Oui. Beaucoup de clients utilisent Crisp en chat humain et brodent Actero par-dessus pour l'agent IA, le voice et la relance panier. Actero expose des webhooks et un MCP qui se branchent sur Crisp pour synchroniser les conversations.",
      },
      {
        q: 'Crisp et Actero sont tous les deux français — quelle différence ?',
        a: "Crisp est une messagerie chat généraliste avec une IA limitée par crédits qui s'épuisent. Actero est un agent IA autonome spécialisé Shopify avec actions natives (refund, échange, WISMO), voice agent inclus et dashboard ROI partageable. Pour un marchand Shopify sérieux, Actero est de plusieurs niveaux au-dessus.",
      },
      {
        q: 'Mon équipe doit-elle apprendre une nouvelle interface ?',
        a: "L'interface Actero est volontairement simple (Setup Wizard 15 min, simulateur, dashboard unique). L'adoption est rapide — beaucoup plus rapide qu'une plateforme messagerie complexe avec ses macros, triggers et dépendances Crisp.",
      },
      {
        q: 'Que vaut l\'IA Actero face à Crisp MagicReply ?',
        a: "MagicReply se contente de suggérer des réponses à un agent humain — c'est un assistant qui consomme vos crédits sans agir seul. Actero répond en autonomie, exécute des actions Shopify, escalade quand la confiance baisse. Vos clients reçoivent une réponse même la nuit, sans plafond IA.",
      },
    ],

    crosslinks: [
      { href: '/alternative-gorgias', label: 'Alternative à Gorgias' },
      { href: '/alternative-tidio', label: 'Alternative à Tidio' },
      { href: '/alternative-intercom', label: 'Alternative à Intercom' },
      { href: '/tarifs', label: 'Voir tous les tarifs' },
    ],
  }

  return <AlternativeTemplate onNavigate={onNavigate} data={data} />
}
