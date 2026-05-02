import React from 'react'
import { Wallet, ShoppingBag, Mail, Shield, BarChart3, Phone } from 'lucide-react'
import { AlternativeTemplate } from '../components/alternative/AlternativeTemplate'

/**
 * /alternative-eesel — page comparative SEO
 *
 * Pricing concurrent (mai 2026) : pay-as-you-go 0,40 $/ticket, essai 50 $ sans carte.
 * Couvre Shopify + WooCommerce + Magento + BigCommerce. Marché US, anglais natif.
 *
 * Veille concurrentielle 2026-05-02 : eesel mène une offensive SEO active sur les
 * mots-clés ICP Actero (« best AI chatbots for e-commerce 2026 », comparatifs
 * Gorgias / Kustomer / Dixa). Cette page existe pour absorber le trafic
 * français qu'eesel pourrait capter avant nous.
 */
export const AlternativeEesel = ({ onNavigate }) => {
  const data = {
    competitorKey: 'eesel',
    competitorName: 'eesel AI',
    comparisonDate: 'mai 2026',
    sources: 'Tarifs publics mai 2026 — Modèle pay-as-you-go 0,40 $ par ticket régulier traité, sans abonnement fixe.',

    seo: {
      title: 'Alternative à eesel AI pour Shopify — Actero | Forfait fixe FR',
      description:
        "eesel AI facture 0,40 $/ticket en pay-as-you-go : facture imprévisible au scaling, anglais, hébergé US. Actero est un forfait fixe en français, hébergé UE, RGPD natif, dès 99 €/mois. SMTP du marchand, lookup Shopify live et ROI prouvable inclus.",
      keywords:
        'alternative eesel ai, eesel ai vs actero, eesel français, eesel rgpd, eesel shopify alternative, agent ia ecommerce français, ai chatbot e-commerce alternative',
    },

    hero: {
      subtitle:
        "eesel AI mise sur le pay-as-you-go (0,40 $ par ticket) — séduisant à l'entrée, mais imprévisible une fois que vous traitez 1 000 ou 5 000 tickets/mois. Solution multi-plateformes (Shopify, WooCommerce, Magento, BigCommerce) sans spécialisation, marché US, anglais natif. Actero est un forfait fixe français : pas de surprise sur la facture, ROI prouvable en direct, RGPD natif, agent vocal inclus.",
    },

    comparison: [
      {
        label: 'Modèle de pricing',
        actero: { main: 'Forfait fixe', sub: 'Pas de surprise au scaling' },
        competitor: { main: 'Pay-as-you-go', sub: '0,40 $/ticket régulier' },
      },
      {
        label: 'Coût pour 1 000 tickets/mois',
        actero: { main: '99 €/mois', sub: 'Starter — tout inclus' },
        competitor: { main: '~400 $/mois', sub: '1 000 × 0,40 $' },
      },
      {
        label: 'Coût pour 5 000 tickets/mois',
        actero: { main: '399 €/mois', sub: 'Pro — tout inclus' },
        competitor: { main: '~2 000 $/mois', sub: '5 000 × 0,40 $' },
      },
      {
        label: 'Interface & support en français',
        actero: true,
        competitor: false,
      },
      {
        label: 'Hébergement UE + RGPD natif',
        actero: true,
        competitor: false,
      },
      {
        label: 'SMTP du marchand (réponses brandées)',
        actero: { main: 'Natif', sub: 'Réponses depuis votre domaine' },
        competitor: false,
      },
      {
        label: 'Lookup Shopify live (vrai tracking)',
        actero: { main: 'Natif', sub: 'Numéro Colissimo en temps réel' },
        competitor: 'partial',
      },
      {
        label: 'Agent vocal natif (numéro FR)',
        actero: { main: '200 min', sub: 'Inclus dès Pro' },
        competitor: false,
      },
      {
        label: 'Dashboard ROI temps réel (heures + €)',
        actero: { main: 'Natif', sub: 'Partageable au CFO' },
        competitor: 'partial',
      },
      {
        label: 'Spécialisation Shopify e-commerce DTC',
        actero: { main: 'Native', sub: 'OAuth + agents spécialisés' },
        competitor: { main: 'Multi-plateformes', sub: 'Shopify + Woo + Magento + BC' },
      },
      {
        label: 'Opt-out TDM (Art. 4 EU 2019/790)',
        actero: true,
        competitor: false,
      },
    ],

    whySwitch: [
      {
        icon: Wallet,
        stat: 'Forfait',
        statLabel: 'fixe vs PAYG',
        title: 'Coût prévisible, pas un compteur qui tourne',
        desc:
          "Le pay-as-you-go d'eesel paraît bon marché à 50 tickets, mais devient cher au scaling : 5 000 tickets/mois = ~2 000 $ chez eesel vs 399 €/mois forfait Actero. Pas de surprise sur la facture, pas de gestion de quotas à anticiper.",
      },
      {
        icon: Shield,
        stat: 'France',
        statLabel: 'first',
        title: 'RGPD natif, hébergé UE, en français',
        desc:
          "eesel est une boîte US, anglophone, hébergement US. Actero est français, hébergé Supabase + Vercel UE, support en français, DPA signable, opt-out TDM (Art. 4 Directive EU 2019/790) — vos données n'entraînent jamais nos modèles. Critique pour une marque DTC France.",
      },
      {
        icon: Mail,
        stat: 'SMTP',
        statLabel: 'du marchand',
        title: 'Réponses brandées, 100 % invisibles',
        desc:
          "Actero envoie les réponses depuis votre propre adresse (contact@votreboutique.com) avec votre signature, votre logo. eesel envoie depuis ses propres domaines. Vos clients ne savent pas qu'un agent IA répond — l'expérience reste celle de votre marque.",
      },
      {
        icon: ShoppingBag,
        stat: 'Shopify',
        statLabel: 'spécialiste',
        title: 'Pensé pour Shopify DTC, pas multi-plateformes',
        desc:
          "eesel essaie de couvrir Shopify + WooCommerce + Magento + BigCommerce — au prix d'une spécialisation diluée. Actero est Shopify-first : OAuth en 15 min, agents spécialisés (order / return / product / general / escalation), lookup live des commandes Colissimo, refund automatique selon votre politique.",
      },
      {
        icon: Phone,
        stat: 'Voice',
        statLabel: 'inclus',
        title: 'Agent vocal natif, eesel ne l\'a pas',
        desc:
          "Actero embarque ElevenLabs avec numéro FR et voix naturelle — inbound (le client appelle), outbound (l'agent relance), 200 min incluses sur Pro. eesel reste sur le chat / email uniquement.",
      },
      {
        icon: BarChart3,
        stat: 'ROI',
        statLabel: 'prouvable',
        title: 'Dashboard CFO-grade, pas seulement des metrics CSAT',
        desc:
          "Actero affiche en direct les heures économisées (× coût horaire support), le CA récupéré sur paniers abandonnés et la projection annuelle. Lien public partageable au CFO ou aux investisseurs. eesel propose des analytics support, pas un ROI prouvable financièrement.",
      },
    ],

    testimonials: [
      {
        quote:
          "On testait eesel en pay-as-you-go, mais à 3 000 tickets/mois ça devenait 1 200 $ et on perdait toute prévisibilité budget. Avec Actero, c'est forfait fixe et on facture en euros, hébergé en France. Beaucoup plus serein.",
        author: '[À compléter]',
        role: 'CEO · Marque DTC mode FR',
      },
    ],

    faqs: [
      {
        q: 'eesel facture 0,40 $/ticket — c\'est moins cher qu\'Actero, non ?',
        a: "À petite volume oui, à scaling non. À 1 000 tickets/mois eesel facture ~400 $ vs 99 € chez Actero (3,5× moins). À 5 000 tickets/mois eesel facture ~2 000 $ vs 399 € chez Actero (4,5× moins). Le pay-as-you-go est piégeux : il favorise le démarrage, punit la croissance.",
      },
      {
        q: 'Mes données sont-elles protégées chez eesel ?',
        a: "eesel est une société US avec hébergement US. Pour une marque DTC France soucieuse du RGPD, c'est un risque : transferts hors-UE, pas d'opt-out TDM clair, pas de DPA en français. Actero est français, hébergé UE (Supabase + Vercel EU), DPA signable et opt-out TDM (Art. 4 Directive EU 2019/790) — vos données n'entraînent jamais nos modèles.",
      },
      {
        q: 'Est-ce qu\'eesel comprend mieux Shopify parce qu\'il fait Woo et Magento aussi ?',
        a: "C'est l'inverse — eesel répartit ses efforts entre 4 plateformes, Actero est mono-stack Shopify et y excelle : OAuth en 15 min, lecture native du catalogue, lookup commandes Colissimo en temps réel, refund automatique selon la politique de la boutique. Pour un marchand Shopify DTC, un spécialiste bat un généraliste.",
      },
      {
        q: 'Comment migrer d\'eesel vers Actero ?',
        a: "Aucune migration de tickets nécessaire — Actero prend le relais sur les nouveaux tickets. Pour la knowledge base, nous importons depuis URL, PDF, Google Docs ou Notion en quelques clics. Total : 1 jour de setup, pas plus.",
      },
      {
        q: 'L\'essai gratuit d\'eesel ($50 sans carte) est tentant — Actero a quoi ?',
        a: "Un plan Free à vie sans carte bancaire — 50 tickets/mois, 1 workflow, intégration Shopify. Pour tester avec votre vrai catalogue, sans engagement, sans paiement. Vous décidez d'upgrader uniquement quand l'agent prouve sa valeur.",
      },
    ],

    crosslinks: [
      { href: '/alternative-gorgias', label: 'Alternative à Gorgias' },
      { href: '/alternative-intercom', label: 'Alternative à Intercom Fin' },
      { href: '/alternative-zendesk', label: 'Alternative à Zendesk' },
      { href: '/alternative-siena', label: 'Alternative à Siena AI' },
      { href: '/tarifs', label: 'Voir tous les tarifs' },
    ],
  }

  return <AlternativeTemplate onNavigate={onNavigate} data={data} />
}
