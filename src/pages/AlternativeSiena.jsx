import React from 'react'
import { Euro, Languages, Shield, Zap, Phone, ShoppingBag } from 'lucide-react'
import { AlternativeTemplate } from '../components/alternative/AlternativeTemplate'

/**
 * /alternative-siena — page comparative SEO
 * Pricing concurrent (avril 2026) : 750 $/mois platform fee + 0,90 $/ticket, sales-led, pas de prix affichés.
 */
export const AlternativeSiena = ({ onNavigate }) => {
  const data = {
    competitorKey: 'siena',
    competitorName: 'Siena AI',
    comparisonDate: 'avril 2026',
    sources: 'Tarifs publics avril 2026 — 750 $/mois platform fee + 0,90 $/ticket sur démo commerciale',

    seo: {
      title: 'Alternative à Siena AI pour e-commerce FR — Actero | SAV IA',
      description:
        "Siena AI demande 750 $/mois plateforme + 0,90 $/ticket et un appel commercial. Actero affiche ses prix, parle français et héberge en UE — agent IA, vocal et relance dès 99 €/mois.",
      keywords:
        'alternative siena, siena ai français, siena vs actero, alternative siena ai shopify, sav ia ecommerce dtc, agent ia français',
    },

    hero: {
      subtitle:
        "Siena AI demande 750 $/mois de platform fee + 0,90 $/ticket et impose un appel commercial avant tout chiffrage. C'est anglophone, US-hosted, sans agent vocal et sans plan Free. Actero affiche ses prix, parle français nativement, héberge en UE et inclut un agent vocal — accessible en 1 clic dès aujourd'hui.",
    },

    comparison: [
      {
        label: 'Prix affiché publiquement',
        actero: { main: 'Oui', sub: '0 € · 99 € · 399 €' },
        competitor: { main: 'Non', sub: 'Sales call obligatoire' },
      },
      {
        label: 'Coût plancher mensuel',
        actero: { main: '0 €', sub: 'Free à vie · 50 tickets' },
        competitor: { main: '750 $/mois', sub: 'Platform fee + 0,90 $/ticket' },
      },
      {
        label: 'Coût pour 1 000 tickets/mois',
        actero: { main: '99 €/mois', sub: 'Plan Starter complet' },
        competitor: { main: '~1 650 $/mois', sub: '750 $ + 1 000 × 0,90 $' },
      },
      {
        label: 'Interface & support en français',
        actero: true,
        competitor: false,
      },
      {
        label: 'Agent vocal natif (numéro FR)',
        actero: { main: '200 min', sub: 'Inclus dès Pro' },
        competitor: false,
      },
      {
        label: 'Hébergement UE + RGPD natif + opt-out TDM',
        actero: true,
        competitor: 'partial',
      },
      {
        label: 'Agentic actions Shopify (refund, échange, WISMO)',
        actero: true,
        competitor: true,
      },
      {
        label: 'Onboarding sans intégrateur',
        actero: { main: '15 min', sub: 'OAuth Shopify auto' },
        competitor: { main: '2-4 semaines', sub: 'Implementation expert' },
      },
      {
        label: 'Plan Free permanent',
        actero: true,
        competitor: false,
      },
      {
        label: 'Marketplace de templates communautaires',
        actero: true,
        competitor: false,
      },
    ],

    whySwitch: [
      {
        icon: Euro,
        stat: '−85%',
        statLabel: 'sur le coût mensuel',
        title: 'Pricing transparent, pas un sales call',
        desc:
          "Siena demande 750 $/mois de platform fee, plus 0,90 $ par ticket. À 1 000 tickets c'est 1 650 $/mois — soit 15× plus qu'Actero Starter (99 €). Les prix Actero sont sur le site, pas dans un PDF après 3 réunions.",
      },
      {
        icon: Languages,
        stat: 'FR',
        statLabel: 'natif, pas traduit',
        title: 'Un agent qui pense en français',
        desc:
          "Siena est conçu pour le DTC US (Crocs, Selkie, Eight Sleep). Le ton, les politiques retour, les attentes RGPD sont anglo-saxons. Actero comprend les codes du e-commerce français : tutoiement vs vouvoiement, ton sobre vs casual, conformité légale FR.",
      },
      {
        icon: Phone,
        stat: 'Voice',
        statLabel: 'inclus + numéro FR',
        title: 'Inbound + outbound téléphonique inclus',
        desc:
          "Siena ne fait pas de voice. Actero embarque ElevenLabs avec un numéro FR offert, 200 min incluses sur Pro, voix de marque sur Enterprise. Vos clients qui préfèrent appeler trouvent un agent qui répond comme un humain.",
      },
      {
        icon: Shield,
        stat: 'EU',
        statLabel: 'hébergement souverain',
        title: 'Données européennes, DPA signable',
        desc:
          "Siena est US-hosted (AWS US). Actero héberge sur Supabase EU + Vercel EU, signe un DPA dès le plan Free, et active l'opt-out TDM par défaut. Vos données ne quittent pas l'Europe et n'entraînent jamais nos modèles.",
      },
    ],

    testimonials: [],

    faqs: [
      {
        q: 'Siena AI est-il disponible en France ?',
        a: "Siena opère depuis les US et accepte des clients EU, mais sans interface FR ni support FR natif, et sans hébergement UE. Pour un marchand français, la conformité RGPD demande un setup spécifique et l'expérience reste US-centric (ton, politiques, fuseaux).",
      },
      {
        q: 'Quelle différence d\'architecture entre Siena et Actero ?',
        a: "Les deux sont des plateformes d'agents autonomes pour le e-commerce avec actions Shopify. Siena est plus mature sur Instagram DM ; Actero est plus mature sur la voix (ElevenLabs natif), la conformité EU, et inclut un agent vocal dans tous les plans payants.",
      },
      {
        q: 'Pourquoi Siena ne publie pas ses prix ?',
        a: "Siena pratique le sales-led pricing (modulé selon volume et stack). Cela rallonge le cycle d'achat (3-6 semaines de négociation typique). Actero applique le product-led pricing : prix affichés, plan Free permanent, inscription auto-service en 1 minute.",
      },
      {
        q: 'Que vaut l\'agent vocal Actero face à Siena ?',
        a: "Siena n'a pas d'agent vocal SAV intégré. Actero embarque ElevenLabs avec numéro FR, latence < 800 ms, voix premium de marque sur Enterprise. C'est un avantage net si vos clients téléphonent encore — fréquent en France et en Italie.",
      },
    ],

    crosslinks: [
      { href: '/alternative-gorgias', label: 'Alternative à Gorgias' },
      { href: '/alternative-intercom', label: 'Alternative à Intercom' },
      { href: '/alternative-tidio', label: 'Alternative à Tidio' },
      { href: '/tarifs', label: 'Voir tous les tarifs' },
    ],
  }

  return <AlternativeTemplate onNavigate={onNavigate} data={data} />
}
