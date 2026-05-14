import React from 'react'
import { Euro, Languages, Phone, Shield, Sparkles, TrendingUp } from 'lucide-react'
import { AlternativeTemplate } from '../components/alternative/AlternativeTemplate'

/**
 * /alternative-reamaze — page comparative SEO
 * Pricing concurrent (avril 2026) : Basic 29 $/agent · Pro 49 $ · Plus 69 $.
 * 20 à 100 résolutions IA incluses par agent puis 0,85 $/résolution overage.
 */
export const AlternativeReamaze = ({ onNavigate }) => {
  const data = {
    competitorKey: 'reamaze',
    competitorName: 'Re:amaze',
    comparisonDate: 'avril 2026',
    sources: 'Tarifs publics avril 2026 — AI Cortex limité à 20-100 résolutions/agent puis 0,85 $ d\'overage par résolution',

    seo: {
      title: 'Alternative à Re:amaze pour Shopify FR — Actero | Agent IA SAV',
      description:
        "Re:amaze facture par agent + 0,85 $ par résolution IA en overage. Actero forfaitise dès 99 €/mois, en français, hébergé UE, voice inclus. Migration en 1 jour.",
      keywords:
        'alternative reamaze, reamaze vs actero, reamaze français, reamaze shopify, sav ia français, alternative reamaze rgpd',
    },

    hero: {
      subtitle:
        "Re:amaze cumule prix par agent ET overage IA à 0,85 $/résolution dès le 21ᵉ ticket — la facture grimpe vite et reste anglophone. Actero forfaitise tout, parle français nativement, héberge en UE et inclut un agent vocal — sans pénalité par-agent ni overage IA caché.",
    },

    comparison: [
      {
        label: 'Prix d\'entrée',
        actero: { main: '0 €/mois', sub: 'Free à vie · 50 tickets' },
        competitor: { main: '29 $/agent', sub: 'Plan Basic, 20 résolutions IA' },
      },
      {
        label: 'Plan équivalent 1 000 tickets/mois',
        actero: { main: '99 €/mois', sub: 'Tout inclus' },
        competitor: { main: '~870 $/mois', sub: 'Plus + 1 000 résolutions overage' },
      },
      {
        label: 'IA résolutions illimitées',
        actero: true,
        competitor: false,
      },
      {
        label: 'Interface & support en français',
        actero: true,
        competitor: false,
      },
      {
        label: 'Agent vocal natif (numéro FR)',
        actero: { main: '200 min', sub: 'Inclus dès Pro' },
        competitor: 'partial',
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
        label: 'Hébergement UE + RGPD natif + opt-out TDM',
        actero: true,
        competitor: 'partial',
      },
      {
        label: 'Marketplace templates + Academy + Partners',
        actero: true,
        competitor: false,
      },
      {
        label: 'Modèle de pricing',
        actero: { main: 'Forfait + ticket', sub: 'Prévisible' },
        competitor: { main: 'Per-agent + overage IA', sub: 'Variable' },
      },
    ],

    whySwitch: [
      {
        icon: Euro,
        stat: '−70%',
        statLabel: 'sur la facture mensuelle',
        title: 'Pas de pénalité par-agent ni d\'overage IA',
        desc:
          "Re:amaze cumule prix par agent ET overage à 0,85 $/résolution dès le 21e ticket IA. Actero forfaitise tickets et IA dans un seul plan : 99 €/mois jusqu'à 1 000 tickets, avec ou sans 10 agents en interne.",
      },
      {
        icon: Languages,
        stat: '100%',
        statLabel: 'français natif',
        title: 'Pensé FR, pas traduit',
        desc:
          "Re:amaze est anglo-saxon : interface, support, ton de l'agent. Actero pense en français — la copy de la landing, les guardrails, le dashboard, jusqu'aux prompts par défaut adaptés au e-commerce français.",
      },
      {
        icon: Phone,
        stat: 'Voice',
        statLabel: 'natif + outbound',
        title: 'Voice agent vraiment intégré',
        desc:
          "Re:amaze a du voice via add-on. Actero embarque ElevenLabs nativement avec numéro FR, latence < 800 ms, voix custom Enterprise. Inbound (client appelle), outbound (relance panier vocale) unifiés au texte.",
      },
      {
        icon: TrendingUp,
        stat: 'ROI',
        statLabel: 'partageable',
        title: 'Dashboard que vous pouvez envoyer au CFO',
        desc:
          "Actero affiche le CA récupéré, les heures économisées, le coût par ticket — partageable en URL signée à votre équipe ou direction. Re:amaze a des reports basiques mais pas de ROI activable comme outil interne.",
      },
    ],

    testimonials: [],

    faqs: [
      {
        q: 'Re:amaze a une intégration Shopify — qu\'est-ce qu\'Actero fait en plus ?',
        a: "L'intégration Re:amaze remonte les commandes en lecture. Actero exécute des actions natives Shopify (refund, échange, modification adresse, suivi colis, RMA) avec règles configurables (segment VIP, montant max). C'est la différence entre 'voir' et 'agir'.",
      },
      {
        q: 'Comment migrer mes tickets et macros depuis Re:amaze ?',
        a: "Vos tickets historiques restent dans Re:amaze (lecture seule). Actero importe la base de connaissances par scraping de votre Help Center public ou via export CSV. La migration prend une après-midi — la plupart des clients gardent Re:amaze 1 semaine en parallèle pour la sécurité.",
      },
      {
        q: 'Combien coûte vraiment Re:amaze pour 1 000 tickets/mois ?',
        a: "Plan Plus à 69 $/agent × 5 agents = 345 $. Plus 100 résolutions IA incluses, donc 900 résolutions facturées à 0,85 $ = 765 $. Total ≈ 1 110 $/mois. Actero Starter : 99 €/mois, ou Pro 399 €/mois si vous voulez le voice. C'est 8-10× moins cher.",
      },
      {
        q: 'Et la latence de réponse ?',
        a: "Actero répond typiquement en 2-4 secondes en chat, < 800 ms en voice. Re:amaze ne publie pas de SLA de latence IA. Les guardrails Actero garantissent qu'aucune réponse n'est envoyée si la confiance < 60 % — escalade humaine immédiate.",
      },
    ],

    crosslinks: [
      { href: '/alternative-gorgias', label: 'Alternative à Gorgias' },
      { href: '/alternative-tidio', label: 'Alternative à Tidio' },
      { href: '/alternative-zendesk', label: 'Alternative à Zendesk' },
      { href: '/tarifs', label: 'Voir tous les tarifs' },
    ],
  }

  return <AlternativeTemplate onNavigate={onNavigate} data={data} />
}
