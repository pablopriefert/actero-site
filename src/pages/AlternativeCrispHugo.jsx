import React from 'react'
import { Lock, Shield, Mail, ShoppingBag, BarChart3, Phone } from 'lucide-react'
import { AlternativeTemplate } from '../components/alternative/AlternativeTemplate'

/**
 * /alternative-crisp-hugo — page comparative SEO
 *
 * Crisp Hugo AI Agent lancé le 22 avril 2026, #1 ProductHunt à son lancement.
 * IA conversationnelle end-to-end, mais verrouillée derrière le plan Crisp Plus
 * à 295 €/mois. Limitée à 50 usages/mois sur Essentials (95 €).
 *
 * Distinct de la page /alternative-crisp existante (qui couvre l'offre Crisp
 * historique sans Hugo). Cette page cible spécifiquement les marchands attirés
 * par Hugo AI mais bloqués par le pricing Plus 295 €.
 */
export const AlternativeCrispHugo = ({ onNavigate }) => {
  const data = {
    competitorKey: 'crisp-hugo',
    competitorName: 'Crisp Hugo AI',
    comparisonDate: 'mai 2026',
    sources: 'Lancement 22 avril 2026 (#1 Product Hunt). Hugo AI Agent illimité uniquement sur Crisp Plus 295 €/mois. Limité à ~50 usages/mois sur Essentials 95 €.',

    seo: {
      title: 'Alternative à Crisp Hugo AI — Actero | Agent IA Shopify FR',
      description:
        "Crisp Hugo AI séduit, mais l'usage illimité est verrouillé derrière le plan Plus 295 €/mois. Actero offre un agent IA autonome spécialisé Shopify dès 99 €/mois, IA illimitée, voice inclus, ROI prouvable. RGPD natif, hébergé UE.",
      keywords:
        'alternative crisp hugo, hugo ai alternative, crisp hugo ai vs actero, agent ia conversation alternative, crisp plus alternative, hugo ai français',
    },

    hero: {
      subtitle:
        "Hugo AI est l'agent que Crisp a lancé le 22 avril 2026 pour rivaliser avec les agents IA spécialisés — il a fait #1 sur Product Hunt. Mais l'usage illimité est verrouillé derrière le plan Crisp Plus à 295 €/mois. Actero est un agent IA autonome spécialisé Shopify, IA illimitée incluse dès 99 €/mois, avec voice agent natif et ROI prouvable au CFO.",
    },

    comparison: [
      {
        label: 'Prix d\'entrée IA illimitée',
        actero: { main: '99 €/mois', sub: 'Starter — IA illimitée' },
        competitor: { main: '295 €/mois', sub: 'Plus — Hugo illimité' },
      },
      {
        label: 'Plan inférieur (limites)',
        actero: { main: '0 €/mois', sub: 'Free 50 tickets — IA illimitée' },
        competitor: { main: '95 €/mois', sub: 'Essentials — Hugo limité ~50 usages' },
      },
      {
        label: 'Spécialisation Shopify (catalogue, refund, échange)',
        actero: { main: 'Native', sub: 'OAuth + actions agentic' },
        competitor: 'partial',
      },
      {
        label: 'Lookup Shopify live (vrai tracking)',
        actero: { main: 'Natif', sub: 'Numéro Colissimo en temps réel' },
        competitor: false,
      },
      {
        label: 'SMTP du marchand (réponses brandées)',
        actero: { main: 'Natif', sub: 'Depuis votre domaine' },
        competitor: false,
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
        label: 'Dashboard ROI temps réel (heures + €)',
        actero: { main: 'Natif', sub: 'Partageable au CFO' },
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
    ],

    whySwitch: [
      {
        icon: Lock,
        stat: '295 €',
        statLabel: 'pour Hugo illimité',
        title: 'IA illimitée à 99 € au lieu de 295 €',
        desc:
          "Hugo AI est puissant, mais Crisp réserve l'usage illimité au plan Plus à 295 €/mois. Sur Essentials (95 €), vous êtes limité à ~50 usages Hugo par mois — autant dire pas un agent IA en production. Actero est IA illimitée dès Starter à 99 €/mois.",
      },
      {
        icon: ShoppingBag,
        stat: 'Shopify',
        statLabel: 'spécialiste',
        title: 'Conçu pour Shopify, pas un chat universel',
        desc:
          "Hugo est l'IA d'un chat live généraliste (Crisp). Actero est conçu Shopify-first : OAuth en 15 min, l'agent lit votre catalogue, vos commandes, vos politiques, et exécute des actions agentic (refund, échange, suivi colis) sans macro à coder. Hugo doit être configuré case par case.",
      },
      {
        icon: Mail,
        stat: 'SMTP',
        statLabel: 'du marchand',
        title: 'Réponses depuis votre marque, 100 % invisibles',
        desc:
          "Actero envoie les réponses email depuis contact@votreboutique.com avec votre signature et votre logo. Crisp Hugo répond depuis l'interface chat Crisp, branded Crisp. Vos clients ne savent pas qu'un agent IA répond — l'expérience reste celle de votre marque.",
      },
      {
        icon: Phone,
        stat: 'Voice',
        statLabel: 'inclus',
        title: 'Agent vocal natif, Hugo ne fait pas de téléphone',
        desc:
          "Actero embarque ElevenLabs avec numéro FR, 200 min incluses sur Pro. Inbound (le client appelle), outbound (l'agent relance), unifié au reste du SAV. Crisp Hugo reste cantonné au chat et email.",
      },
      {
        icon: BarChart3,
        stat: 'ROI',
        statLabel: 'CFO-grade',
        title: 'Dashboard qui parle aux décideurs',
        desc:
          "Actero affiche le CA récupéré (paniers + LTV), les heures économisées (× coût horaire support) et la projection annuelle — partageables en lien public. Crisp affiche des metrics chat (CSAT, temps de réponse) mais pas un ROI financier prouvable.",
      },
      {
        icon: Shield,
        stat: 'RGPD',
        statLabel: 'natif',
        title: 'Opt-out TDM clair, hébergé UE',
        desc:
          "Crisp est français aussi (bonne nouvelle). Actero va plus loin : opt-out TDM explicite (Art. 4 Directive EU 2019/790) inscrit dans le DPA, audit log admin, isolation tenant via RLS Supabase. Pour les marques qui veulent un dossier RGPD béton, c'est gagnant.",
      },
    ],

    testimonials: [
      {
        quote:
          "On a testé Hugo AI à son lancement Product Hunt, mais à 50 usages/mois sur Essentials c'était inutilisable, et 295 €/mois pour Plus on n'y était pas prêts. Actero à 99 € avec IA illimitée et lookup Shopify live, c'était évident.",
        author: '[À compléter]',
        role: 'Founder · Marque DTC beauté FR',
      },
    ],

    faqs: [
      {
        q: 'Hugo AI a fait #1 Product Hunt, c\'est sérieux ?',
        a: "Sérieux côté hype. Côté pricing, Crisp réserve l'usage illimité de Hugo au plan Plus à 295 €/mois — au-delà du budget de la majorité des marchands DTC France. Actero offre une IA illimitée, spécialisée Shopify, dès 99 €/mois.",
      },
      {
        q: 'Crisp est français, Actero est français — quelle vraie différence ?',
        a: "Crisp est une messagerie chat avec une IA en option (Hugo) verrouillée derrière le plan Plus. Actero est un agent IA autonome spécialisé Shopify avec actions natives (refund, échange, WISMO via lookup live), voice agent inclus, dashboard ROI partageable, et SMTP du marchand. Pour un marchand Shopify sérieux, Actero est de plusieurs niveaux au-dessus.",
      },
      {
        q: 'Puis-je utiliser Hugo et Actero ensemble ?',
        a: "Techniquement oui — Crisp pour le chat live humain, Actero pour l'agent IA autonome via webhooks. Mais à 295 € de Crisp Plus + 99 € d'Actero, le combo est cher. La majorité de nos clients utilisent uniquement Actero (qui inclut le widget chat embeddable) et économisent 295 €/mois.",
      },
      {
        q: 'Combien de temps pour migrer de Crisp Hugo vers Actero ?',
        a: "Aucune migration des conversations existantes — Actero prend le relais sur les nouveaux tickets. Pour la knowledge base, nous importons depuis URL, PDF, Google Docs ou Notion en quelques clics. Setup OAuth Shopify en 15 min. Total : 1 demi-journée, pas plus.",
      },
    ],

    crosslinks: [
      { href: '/alternative-crisp', label: 'Alternative à Crisp (vue générale)' },
      { href: '/alternative-gorgias', label: 'Alternative à Gorgias' },
      { href: '/alternative-tidio', label: 'Alternative à Tidio' },
      { href: '/tarifs', label: 'Voir tous les tarifs' },
    ],
  }

  return <AlternativeTemplate onNavigate={onNavigate} data={data} />
}
