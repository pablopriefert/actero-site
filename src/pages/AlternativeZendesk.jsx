import React from 'react'
import { Clock, Euro, ShoppingBag, Shield, TrendingUp, Users } from 'lucide-react'
import { AlternativeTemplate } from '../components/alternative/AlternativeTemplate'

/**
 * /alternative-zendesk
 * Target keywords :
 *   - alternative zendesk
 *   - zendesk vs actero
 *   - alternative zendesk shopify
 *   - helpdesk ia français
 */
export const AlternativeZendesk = ({ onNavigate }) => {
  const data = {
    competitorKey: 'zendesk',
    competitorName: 'Zendesk',
    comparisonDate: 'avril 2026',
    sources: 'zendesk.com/pricing, documentation Zendesk AI Agents',

    seo: {
      title: 'Alternative à Zendesk pour Shopify — Actero | IA SAV E-commerce FR',
      description:
        "Zendesk est surdimensionné et facturé par agent. Actero automatise 60 % des tickets Shopify dès 99 €/mois, sans licence par utilisateur, installé en 15 min. Français, hébergé UE, RGPD. Migration accompagnée.",
      keywords:
        'alternative zendesk, zendesk vs actero, alternative zendesk shopify, remplacer zendesk, helpdesk ia français, zendesk alternative rgpd, sav automatisé e-commerce, zendesk vs helpdesk français',
    },

    hero: {
      subtitle:
        "Zendesk est un tank enterprise facturé par agent : 55 à 155 $/agent/mois, setup en semaines, AI en option à 50 $/agent. Pour un e-commerçant Shopify, Actero résout 60 % des tickets dès 99 €/mois flat, installé en 15 minutes.",
    },

    comparison: [
      {
        label: 'Modèle de facturation',
        actero: { main: 'Flat SaaS', sub: 'Par boutique' },
        competitor: { main: 'Par agent', sub: '55–155 $/agent/mois' },
      },
      {
        label: 'Prix d\'entrée (1 000 tickets · 2 agents)',
        actero: { main: '99 €/mois', sub: 'Starter tout inclus' },
        competitor: { main: '110–230 $/mois', sub: 'Suite Team × 2 agents' },
      },
      {
        label: 'IA incluse sans add-on',
        actero: true,
        competitor: false,
      },
      {
        label: 'Temps d\'implémentation',
        actero: { main: '15 min', sub: 'OAuth Shopify 1-clic' },
        competitor: { main: '2–8 semaines', sub: 'Intégrateur recommandé' },
      },
      {
        label: 'Spécialisation Shopify native',
        actero: { main: 'Oui', sub: 'Catalogue + commandes live' },
        competitor: 'partial',
      },
      {
        label: '% tickets résolus automatiquement',
        actero: { main: '60 %', sub: 'Sans add-on' },
        competitor: { main: 'Variable', sub: 'AI Agent à 50 $/agent' },
      },
      {
        label: 'Agent vocal + numéro FR dédié',
        actero: { main: '200 min', sub: 'Dès le plan Pro' },
        competitor: 'partial',
      },
      {
        label: 'Relance paniers abandonnés IA',
        actero: true,
        competitor: false,
      },
      {
        label: 'Portail SAV self-service + branding',
        actero: { main: 'Custom domain', sub: 'Dès le plan Pro' },
        competitor: 'partial',
      },
      {
        label: 'Hébergement UE + RGPD + opt-out TDM',
        actero: true,
        competitor: 'partial',
      },
    ],

    whySwitch: [
      {
        icon: Users,
        stat: '0 €',
        statLabel: 'de licence par agent',
        title: 'Un forfait par boutique, pas une facture qui grimpe avec l\'équipe',
        desc:
          "Zendesk facture chaque agent entre 55 et 155 $/mois, plus l'AI Agent à 50 $ de plus par agent. Chez Actero, 2 membres inclus sur Starter, 5 sur Pro, illimité sur Enterprise. Embauchez sans craindre l'addition.",
      },
      {
        icon: Clock,
        stat: '15 min',
        statLabel: 'au lieu de 6 semaines',
        title: 'Vous n\'avez pas besoin d\'un intégrateur Zendesk',
        desc:
          "Les déploiements Zendesk prennent en général 2 à 8 semaines avec un consultant. Actero se connecte à Shopify en OAuth 1-clic, lit votre catalogue et vos politiques, et commence à répondre dans l'heure. Le cockpit est conçu pour être configuré par vous.",
      },
      {
        icon: ShoppingBag,
        stat: '100 %',
        statLabel: 'e-commerce, pas généraliste',
        title: 'Pensé Shopify, pas un CRM d\'entreprise',
        desc:
          "Actero répond nativement aux WISMO, retours, changements d'adresse, questions produit via la data Shopify live. Zendesk est un helpdesk généraliste — puissant mais surdimensionné pour une marque DTC de 300k € à 10M € de CA.",
      },
      {
        icon: Shield,
        stat: 'EU',
        statLabel: 'hosting · RGPD natif',
        title: 'Souveraineté et simplicité RGPD',
        desc:
          "Hébergement UE (Supabase Europe + Vercel EU), DPA signable sur demande, opt-out TDM (Directive 2019/790 Art. 4). Zendesk est US-first avec des clauses RGPD récupérables via commercial — plus lourd à cadrer juridiquement.",
      },
    ],

    testimonials: [
      {
        quote:
          "On payait Zendesk Suite Growth × 4 agents + AI Agent add-on : ~1 100 $/mois. Depuis qu'on est passé à Actero Pro, on paie 399 €/mois, l'agent résout 60 % des tickets et notre équipe SAV se concentre enfin sur les retours complexes.",
        author: '[À compléter]',
        role: 'COO · Mode DTC France',
      },
      {
        quote:
          "L'implémentation Zendesk nous avait coûté 8 semaines et 12k € de consulting. Actero, j'ai fait la mise en route seul en une matinée. Gros changement.",
        author: '[À compléter]',
        role: 'Fondateur · Mobilier design FR',
      },
      {
        quote:
          "Zendesk est puissant mais on ne pilotait rien côté ROI. Le dashboard Actero affiche les heures libérées et le CA récupéré chaque jour — c'est un outil de direction, pas juste de ticketing.",
        author: '[À compléter]',
        role: 'Directrice E-commerce · Food premium',
      },
    ],

    faqs: [
      {
        q: 'Actero gère-t-il autant de tickets par jour que Zendesk ?',
        a: "Le plan Pro Actero inclut 5 000 tickets/mois (soit ~165/jour) avec workflows illimités. Le plan Enterprise est illimité avec SLA 99,9 % contractuel. Techniquement, l'infrastructure Vercel + Supabase UE scale sans problème sur des volumes Zendesk Mid-Market. Si vous tournez à plus de 10 000 tickets/jour, parlons Enterprise.",
      },
      {
        q: 'Comment migrer mes macros, triggers et automations Zendesk ?',
        a: "Votre base de connaissances (articles help center, politiques, FAQ) s'importe depuis URL ou export CSV. Les macros Zendesk sont réécrites comme règles métier et prompts dans le ton de marque Actero — c'est plus simple : vous décrivez le comportement attendu, l'agent l'applique. Les triggers automatisés deviennent des workflows (3 sur Starter, illimités sur Pro).",
      },
      {
        q: 'Mes agents humains perdent-ils en fonctionnalités (collisions, macros, SLA) ?',
        a: "L'UX Actero est conçue pour le SAV e-commerce moderne : collision detection, historique conversation, tags, résumé IA du contexte client, escalade automatique avec confiance agent. Si vous avez besoin de SLA contractuels multi-tiers ou de reporting BI custom style Zendesk Explore, le plan Enterprise inclut rapport sur mesure et account manager dédié.",
      },
      {
        q: 'Puis-je garder Zendesk en helpdesk et utiliser Actero uniquement pour l\'IA ?',
        a: "Oui. Actero possède un connecteur Zendesk officiel (comme Gorgias). Vous laissez vos agents humains sur Zendesk et Actero traite la première ligne automatiquement : réponses directes pour les tickets simples, escalade enrichie (avec résumé client + contexte commande) pour les cas complexes. Beaucoup de clients démarrent comme ça avant de bascule complète.",
      },
      {
        q: 'Quel est le vrai coût comparé pour une marque de 5 agents et 3 000 tickets/mois ?',
        a: "Zendesk Suite Growth à 89 $/agent × 5 = 445 $/mois + AI Agent add-on ~250 $ = ~700 $/mois, hors setup. Actero Pro à 399 €/mois inclut 5 membres, 5 000 tickets, agent vocal 200 min, tous les agents spécialisés et l'agent Email natif. Écart ~40 % en coût direct, sans compter le temps d'implémentation et l'absence de consulting.",
      },
    ],

    crosslinks: [
      { href: '/alternative-gorgias', label: 'Alternative à Gorgias' },
      { href: '/alternative-tidio', label: 'Alternative à Tidio' },
      { href: '/tarifs', label: 'Voir tous les tarifs' },
      { href: '/produit', label: 'Comment fonctionne Actero' },
    ],
  }

  return <AlternativeTemplate onNavigate={onNavigate} data={data} />
}
