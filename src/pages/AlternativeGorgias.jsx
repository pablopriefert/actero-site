import React from 'react'
import { Clock, Zap, Shield, Euro, Languages, TrendingUp } from 'lucide-react'
import { AlternativeTemplate } from '../components/alternative/AlternativeTemplate'

/**
 * /alternative-gorgias
 * Target keywords :
 *   - alternative gorgias
 *   - gorgias vs actero
 *   - alternative gorgias français
 *   - remplacer gorgias shopify
 */
export const AlternativeGorgias = ({ onNavigate }) => {
  const data = {
    competitorKey: 'gorgias',
    competitorName: 'Gorgias',
    comparisonDate: 'avril 2026',
    sources: 'gorgias.com/pricing, documentation officielle Gorgias',

    seo: {
      title: 'Alternative à Gorgias pour Shopify — Actero | IA SAV E-commerce FR',
      description:
        "Cherchez une alternative à Gorgias moins chère, en français et RGPD ? Actero automatise 60 % des tickets Shopify dès 99 €/mois. Installation OAuth en 15 min, hébergé UE, opt-out TDM. Migration en 1 jour.",
      keywords:
        'alternative gorgias, gorgias vs actero, gorgias français, remplacer gorgias, alternative gorgias shopify, helpdesk ia français, sav automatisé shopify, gorgias alternative rgpd',
    },

    hero: {
      subtitle:
        "Gorgias fait bien son job de helpdesk — mais la facture grimpe vite, l'automation est payante en add-on et l'interface reste anglo-centrée. Actero automatise 60 % des tickets par défaut, en français, hébergé en UE, à partir de 99 €/mois.",
    },

    comparison: [
      {
        label: 'Prix d\'entrée',
        actero: { main: '0 €/mois', sub: 'Free à vie · 50 tickets' },
        competitor: { main: '10 $/mois', sub: 'Starter · 50 tickets' },
      },
      {
        label: 'Plan équivalent 1 000 tickets/mois',
        actero: { main: '99 €/mois', sub: 'Starter — tout inclus' },
        competitor: { main: '60–300 $/mois', sub: 'Basic à Pro · automation en add-on' },
      },
      {
        label: 'Interface & support en français',
        actero: true,
        competitor: 'partial',
      },
      {
        label: 'Temps d\'installation',
        actero: { main: '15 min', sub: 'OAuth Shopify 1-clic' },
        competitor: { main: '2–5 jours', sub: 'Setup manuel + règles' },
      },
      {
        label: '% tickets résolus automatiquement',
        actero: { main: '60 %', sub: 'Sans add-on' },
        competitor: { main: 'Variable', sub: 'Auto-reply payant' },
      },
      {
        label: 'Dashboard ROI temps réel',
        actero: { main: 'Natif', sub: 'Heures + CA récupéré' },
        competitor: 'partial',
      },
      {
        label: 'Agent vocal ElevenLabs + numéro FR',
        actero: { main: '200 min', sub: 'Dès le plan Pro' },
        competitor: false,
      },
      {
        label: 'Relance paniers abandonnés IA',
        actero: { main: 'Inclus', sub: 'Dès le plan Free' },
        competitor: false,
      },
      {
        label: 'Hébergement UE + RGPD + opt-out TDM',
        actero: true,
        competitor: 'partial',
      },
      {
        label: 'Portail SAV self-service client final',
        actero: { main: 'Custom domain', sub: 'Branding marque' },
        competitor: false,
      },
    ],

    whySwitch: [
      {
        icon: Euro,
        stat: '-60 %',
        statLabel: 'sur la facture mensuelle',
        title: 'Un prix prévisible, pas des add-ons cachés',
        desc:
          "Gorgias facture l'Automation en add-on, vend des tickets AI à l'unité et bascule vite sur Pro à 300 $/mois dès 1 000 tickets. Actero inclut agent IA, paniers abandonnés, ton de marque et dashboard ROI dès 99 €/mois — overage à 0,15 €/ticket, zéro surprise.",
      },
      {
        icon: Languages,
        stat: '100 %',
        statLabel: 'en français',
        title: 'Conçu pour le marché FR, pas traduit',
        desc:
          "Interface, support client, copywriting et agent vocal ElevenLabs conçus nativement en français. Gorgias traduit partiellement — Actero pense en français dès le premier ticket.",
      },
      {
        icon: Clock,
        stat: '15 min',
        statLabel: 'd\'installation',
        title: 'Setup express, pas un chantier de 2 semaines',
        desc:
          "OAuth Shopify 1-clic : l'agent lit votre catalogue, vos commandes et vos politiques automatiquement. Gorgias demande une configuration manuelle de règles, macros et intégrations — souvent 2 à 5 jours avec un consultant.",
      },
      {
        icon: Shield,
        stat: 'EU',
        statLabel: 'hosting · RGPD natif',
        title: 'Souveraineté européenne, pas un patch RGPD',
        desc:
          "Données hébergées en UE (Supabase Europe + Vercel EU), DPA signable, opt-out TDM (Directive 2019/790 Art. 4) : vos données n'entraînent jamais nos modèles. Gorgias est US-first avec un DPA sur demande.",
      },
    ],

    testimonials: [
      {
        quote:
          "On payait 450 $ par mois chez Gorgias avec l'add-on Automation. Passé à Actero Pro à 399 €/mois, plus cher en nominal mais l'agent vocal et les paniers sont inclus. Retour sur investissement en 3 semaines.",
        author: '[À compléter]',
        role: 'Head of CX · Marque mode DTC',
      },
      {
        quote:
          "L'équipe ne comprenait pas toutes les macros Gorgias et on avait des règles cassées partout. Actero a tout unifié : un agent, une base de connaissances, des guardrails. Plus simple, plus mesurable.",
        author: '[À compléter]',
        role: 'Fondateur · Beauté clean FR',
      },
      {
        quote:
          "La migration a pris une après-midi. On a connecté Shopify, importé la FAQ depuis Notion, testé sur 50 tickets, déployé. Gorgias tournait encore 3 jours en parallèle par sécurité — aucune régression.",
        author: '[À compléter]',
        role: 'Ops Manager · Food & supplements',
      },
    ],

    faqs: [
      {
        q: 'Comment migrer mes tickets et macros Gorgias vers Actero ?',
        a: "Actero importe votre base de connaissances (macros, politiques, FAQs) depuis URL, PDF, Google Docs ou Notion en quelques clics. Les tickets Gorgias existants restent dans Gorgias (historique) — Actero prend le relais sur les nouveaux. Vous pouvez aussi brancher Actero sur Gorgias via connecteur pour continuer à utiliser Gorgias en helpdesk et laisser Actero traiter la première ligne automatiquement.",
      },
      {
        q: 'Est-ce qu\'Actero gère les mêmes canaux que Gorgias (email, chat, Instagram DM) ?',
        a: "Actero couvre email (SMTP/IMAP ou Gmail), chat Shopify natif, Gorgias et Zendesk. Instagram DM et WhatsApp sont sur la roadmap (infrastructure de connecteurs déjà en place). Si vous avez un besoin multicanal critique, le plan Pro permet d'activer toutes les intégrations et notre équipe peut ajouter un canal custom sur Enterprise.",
      },
      {
        q: 'Le plan Starter à 99 €/mois couvre-t-il vraiment tout ?',
        a: "Oui : 1 000 tickets/mois, 3 workflows actifs, 3 intégrations (Shopify + 2), 100 entrées de base de connaissances, 2 membres d'équipe, éditeur ton de marque, simulateur, API + webhooks, portail SAV self-service, dashboard ROI complet, historique 90 jours, support email 48h, essai 7 jours. Agent vocal ElevenLabs et agents IA spécialisés arrivent sur le plan Pro à 399 €/mois.",
      },
      {
        q: 'Et si je dépasse mes 1 000 tickets/mois sur Starter ?',
        a: "Aucune coupure de service. L'overage est facturé à 0,15 €/ticket sur Starter et 0,10 €/ticket sur Pro. Vous recevez une alerte à 80 % et 100 % du quota. Si vous dépassez régulièrement, un upgrade vers Pro (5 000 tickets inclus) devient mécaniquement plus rentable.",
      },
      {
        q: 'Mon équipe SAV garde-t-elle la main sur les tickets complexes ?',
        a: "Absolument. L'agent escalade automatiquement vers un humain dès que la confiance tombe sous 60 % ou qu'un ton agressif / VIP / mécontentement est détecté. Votre équipe voit un résumé du contexte et répond depuis le dashboard Actero ou directement via Gorgias/Zendesk selon votre setup. Actero remplace le travail répétitif, pas la connexion client.",
      },
    ],

    crosslinks: [
      { href: '/alternative-zendesk', label: 'Alternative à Zendesk' },
      { href: '/alternative-tidio', label: 'Alternative à Tidio' },
      { href: '/tarifs', label: 'Voir tous les tarifs' },
      { href: '/produit', label: 'Comment fonctionne Actero' },
    ],
  }

  return <AlternativeTemplate onNavigate={onNavigate} data={data} />
}
