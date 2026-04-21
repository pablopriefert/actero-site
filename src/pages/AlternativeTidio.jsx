import React from 'react'
import { ShoppingBag, Zap, TrendingUp, Shield, Sparkles, Euro } from 'lucide-react'
import { AlternativeTemplate } from '../components/alternative/AlternativeTemplate'

/**
 * /alternative-tidio
 * Target keywords :
 *   - alternative tidio
 *   - tidio vs actero
 *   - alternative tidio français
 *   - chatbot shopify français ia
 */
export const AlternativeTidio = ({ onNavigate }) => {
  const data = {
    competitorKey: 'tidio',
    competitorName: 'Tidio',
    comparisonDate: 'avril 2026',
    sources: 'tidio.com/pricing, documentation Lyro AI officielle',

    seo: {
      title: 'Alternative à Tidio pour Shopify — Actero | IA SAV E-commerce FR',
      description:
        "Tidio est un chatbot générique. Actero est un agent IA spécialisé Shopify qui résout 60 % des tickets, relance les paniers abandonnés et affiche un ROI temps réel. Dès 99 €/mois, en français, hébergé UE. Migration en 1 jour.",
      keywords:
        'alternative tidio, tidio vs actero, alternative tidio français, chatbot ia shopify français, remplacer tidio, lyro ai alternative, sav automatisé shopify, alternative chatbot rgpd',
    },

    hero: {
      subtitle:
        "Tidio fait un chatbot sympa, mais reste un outil générique greffé à votre boutique. Actero est pensé Shopify d'abord : l'agent lit votre catalogue, traite les commandes, relance les paniers et mesure le ROI — pas juste un widget de chat.",
    },

    comparison: [
      {
        label: 'Prix d\'entrée',
        actero: { main: '0 €/mois', sub: 'Free à vie · 50 tickets' },
        competitor: { main: '0 $/mois', sub: 'Free · 50 convos' },
      },
      {
        label: 'Spécialisation e-commerce Shopify',
        actero: { main: 'Native', sub: 'OAuth + data commande' },
        competitor: 'partial',
      },
      {
        label: 'Agent IA inclus dès le premier plan payant',
        actero: true,
        competitor: false,
      },
      {
        label: 'Coût IA (plan 1 000 conversations)',
        actero: { main: '99 €/mois', sub: 'Starter tout inclus' },
        competitor: { main: '59 + 39 $/mois', sub: 'Growth + Lyro add-on' },
      },
      {
        label: 'Relance paniers abandonnés IA',
        actero: { main: 'Inclus', sub: '3 relances personnalisées' },
        competitor: 'partial',
      },
      {
        label: 'Agent vocal + numéro FR',
        actero: { main: '200 min', sub: 'Dès le plan Pro' },
        competitor: false,
      },
      {
        label: 'Dashboard ROI (heures, CA récupéré)',
        actero: { main: 'Natif', sub: 'Export PDF mensuel' },
        competitor: 'partial',
      },
      {
        label: 'Portail SAV self-service + custom domain',
        actero: true,
        competitor: false,
      },
      {
        label: 'Interface & support FR natif',
        actero: true,
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
        icon: ShoppingBag,
        stat: 'Shopify',
        statLabel: 'natif, pas greffé',
        title: 'Un agent qui lit vos commandes, pas juste un chatbot',
        desc:
          "Actero consomme en temps réel votre catalogue, vos commandes et vos politiques Shopify via OAuth. Tidio reste un chatbot générique qu'il faut gaver de scripts et d'intégrations tierces pour atteindre le même niveau de précision.",
      },
      {
        icon: TrendingUp,
        stat: '+15 %',
        statLabel: 'de paniers récupérés',
        title: '3 relances IA incluses, pas un module à part',
        desc:
          "Actero relance les paniers abandonnés avec 3 emails personnalisés (15 min, 24h, 72h), produit exact, réduction conditionnelle et lien checkout direct — inclus dès le plan Free. Tidio fait du chatbot, pas de la reconquête panier IA.",
      },
      {
        icon: Euro,
        stat: '1 plan',
        statLabel: 'au lieu de Growth + Lyro',
        title: 'Fini la tarification à tiroirs',
        desc:
          "Chez Tidio, l'IA Lyro est un add-on séparé à ~39 $/mois en plus du plan Growth à 59 $/mois. Actero regroupe l'agent IA, les relances panier, le dashboard ROI et les intégrations dans un seul abonnement lisible dès 99 €/mois.",
      },
      {
        icon: Shield,
        stat: 'RGPD',
        statLabel: 'natif · opt-out TDM',
        title: 'Souveraineté des données, pas un DPA à quémander',
        desc:
          "Hébergement UE (Supabase Europe + Vercel EU), chiffrement AES-256, DPA signable, opt-out TDM Directive 2019/790 Art. 4 : vos données client n'entraînent jamais les modèles d'Actero. Tidio reste une solution polonaise US-first côté infra.",
      },
    ],

    testimonials: [
      {
        quote:
          "On avait Tidio + Lyro depuis 2 ans. Ça répondait sur le chat, mais rien sur email et pas de suivi du ROI. Avec Actero on a unifié email, chat Shopify et relance panier — et on voit enfin combien l'IA nous fait économiser.",
        author: '[À compléter]',
        role: 'Co-fondatrice · Cosmétique FR',
      },
      {
        quote:
          "Tidio répondait à 25 % des questions, Actero monte à 60 % parce qu'il connaît le catalogue et les commandes. La différence entre un chatbot et un vrai agent IA métier.",
        author: '[À compléter]',
        role: 'Responsable SAV · Sport & outdoor',
      },
      {
        quote:
          "Le portail SAV avec notre propre nom de domaine, branché au dashboard Actero, c'est ce qui nous a décidés. Tidio nous imposait son branding.",
        author: '[À compléter]',
        role: 'E-commerce Manager · Food DTC',
      },
    ],

    faqs: [
      {
        q: 'Quelle est la vraie différence entre Lyro AI (Tidio) et l\'agent Actero ?',
        a: "Lyro est un chatbot IA générique qu'il faut nourrir de FAQs. L'agent Actero se connecte en OAuth à Shopify et lit automatiquement votre catalogue, votre stock, vos commandes et vos politiques. Résultat : il peut répondre à « Où est ma commande ? », « Puis-je retourner la taille M ? », « La crème X est-elle en rupture ? » avec les vraies données de votre boutique, sans configuration manuelle.",
      },
      {
        q: 'Comment récupérer l\'historique de mes conversations Tidio ?',
        a: "Actero n'importe pas les conversations Tidio (elles restent chez eux comme archive). En revanche, votre base de connaissances (FAQ, politiques retour, infos livraison) est importable en 2 clics depuis URL, PDF, Google Docs ou Notion. La plupart des clients basculent en laissant Tidio tourner 48h en parallèle pour sécurité avant de le couper.",
      },
      {
        q: 'Actero remplace-t-il complètement le widget de chat sur mon site ?',
        a: "Oui. Actero installe un widget de chat Shopify natif en 1 clic (OAuth), entièrement personnalisable aux couleurs de votre marque. Sur le plan Pro, vous débloquez le custom domain pour votre portail SAV self-service. Dès Free, vous avez le widget chat + l'email + l'intégration Gorgias/Zendesk si vous en avez déjà un.",
      },
      {
        q: 'Combien je paie réellement si je fais 2 000 conversations/mois ?',
        a: "Sur Actero Pro (399 €/mois) : 5 000 tickets inclus, aucun add-on. Sur Tidio équivalent : Growth à 59 $/mois + Lyro à 39 $/mois + frais supplémentaires au-delà des limites Lyro ≈ 100–150 $/mois — mais sans agent vocal, sans portail SAV, sans dashboard ROI e-commerce. Le prix nominal est proche, la couverture est incomparable.",
      },
      {
        q: 'Combien de temps prend la migration depuis Tidio ?',
        a: "Environ 1 journée pour une boutique moyenne. Étape 1 (15 min) : connecter Shopify en OAuth et configurer le ton de marque. Étape 2 (30 min) : importer votre FAQ Tidio. Étape 3 (2h) : tester l'agent dans le simulateur Actero avec vos tickets types. Étape 4 : déployer le nouveau widget. Vous pouvez laisser Tidio tourner en parallèle quelques jours pour comparer.",
      },
    ],

    crosslinks: [
      { href: '/alternative-gorgias', label: 'Alternative à Gorgias' },
      { href: '/alternative-zendesk', label: 'Alternative à Zendesk' },
      { href: '/tarifs', label: 'Voir tous les tarifs' },
      { href: '/produit', label: 'Comment fonctionne Actero' },
    ],
  }

  return <AlternativeTemplate onNavigate={onNavigate} data={data} />
}
