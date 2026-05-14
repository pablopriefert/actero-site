import React from 'react'
import { Euro, Zap, Shield, ShoppingBag, Sparkles, Phone } from 'lucide-react'
import { AlternativeTemplate } from '../components/alternative/AlternativeTemplate'

/**
 * /alternative-intercom — page comparative SEO
 * Pricing concurrent (avril 2026) : Essential 29 $/seat · Advanced 85 $ · Expert 132 $.
 * Fin AI facturé 0,99 $ par outcome résolu — facture imprévisible chaque mois.
 */
export const AlternativeIntercom = ({ onNavigate }) => {
  const data = {
    competitorKey: 'intercom',
    competitorName: 'Intercom',
    comparisonDate: 'avril 2026',
    sources: 'Tarifs publics avril 2026 — Fin AI Agent facturé 0,99 $ par outcome résolu',

    seo: {
      title: 'Alternative à Intercom Fin pour Shopify — Actero | SAV IA FR',
      description:
        "Intercom Fin facture 0,99 $ par résolution + 29 $/seat. Actero forfaitise tout dès 99 €/mois — agent IA, vocal, paniers abandonnés inclus, hébergé UE. Migration en 1 jour.",
      keywords:
        'alternative intercom, intercom fin alternative, intercom vs actero, alternative intercom français, sav ia shopify, helpdesk français rgpd',
    },

    hero: {
      subtitle:
        "Intercom Fin facture 0,99 $ chaque résolution en plus du seat à 29 $. À 5 000 résolutions/mois, la facture dépasse 4 950 $ — sans plafond, imprévisible chaque mois. Actero forfaitise tout — agent IA, vocal, relance panier et dashboard ROI inclus — pour une fraction du prix.",
    },

    comparison: [
      {
        label: 'Prix d\'entrée',
        actero: { main: '0 €/mois', sub: 'Free à vie · 50 tickets' },
        competitor: { main: '29 $/seat', sub: 'Plan Essential' },
      },
      {
        label: 'Coût IA pour 1 000 résolutions',
        actero: { main: '99 €/mois', sub: 'Tout inclus, pas par résolution' },
        competitor: { main: '~990 $/mois', sub: '0,99 $ × 1 000 outcomes + seat' },
      },
      {
        label: 'Coût IA pour 5 000 résolutions',
        actero: { main: '399 €/mois', sub: 'Forfait Pro complet' },
        competitor: { main: '~4 950 $/mois', sub: 'Pricing à l\'outcome qui s\'envole' },
      },
      {
        label: 'Spécialisation e-commerce Shopify',
        actero: { main: 'Native', sub: 'OAuth + catalogue + commandes' },
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
        label: 'Interface & support en français',
        actero: true,
        competitor: 'partial',
      },
      {
        label: 'Hébergement UE + RGPD natif + opt-out TDM',
        actero: true,
        competitor: 'partial',
      },
      {
        label: 'Dashboard ROI temps réel (CA récupéré)',
        actero: { main: 'Natif', sub: 'Heures + euros' },
        competitor: 'partial',
      },
      {
        label: 'Plafond de coût mensuel',
        actero: { main: 'Prévisible', sub: 'Forfait fixe + overage 0,15 €' },
        competitor: { main: 'Imprévisible', sub: 'Pay-per-outcome sans plafond' },
      },
    ],

    whySwitch: [
      {
        icon: Euro,
        stat: '−80%',
        statLabel: 'sur la facture mensuelle',
        title: 'La fin du pricing à l\'outcome qui explose',
        desc:
          "Fin facture 0,99 $ chaque fois qu'il résout un ticket. À 1 000 résolutions/mois, ça fait 990 $ avant même de compter les seats. Actero forfaitise : 99 €/mois pour 1 000 tickets, 399 €/mois pour 5 000. Vous savez à l'avance ce que vous allez payer.",
      },
      {
        icon: ShoppingBag,
        stat: 'Shopify',
        statLabel: 'natif, pas adapté',
        title: 'Pensé e-commerce, pas SaaS B2B',
        desc:
          "Intercom est conçu pour le SaaS B2B et n'a quasiment aucune action native Shopify — vous bricolez des macros pour chaque cas e-commerce. Actero lit votre catalogue, traite vos commandes, suit les livraisons et déclenche des refunds — tout depuis l'agent, sans macros à coder.",
      },
      {
        icon: Phone,
        stat: 'Voice',
        statLabel: 'inclus + numéro FR',
        title: 'Un agent vocal, pas juste du chat',
        desc:
          "Intercom n'a pas de voice agent natif. Actero inclut un agent ElevenLabs avec numéro FR, 200 minutes incluses sur Pro, voix custom sur Enterprise. Vos clients appellent, l'agent répond comme un humain.",
      },
      {
        icon: Shield,
        stat: 'EU',
        statLabel: 'hébergement · RGPD',
        title: 'Souveraineté européenne par défaut',
        desc:
          "Données hébergées en UE (Supabase Europe + Vercel EU), DPA signable directement, opt-out TDM (Directive 2019/790 Art. 4). Intercom est US-first, votre data part outre-Atlantique sauf demande explicite.",
      },
    ],

    testimonials: [],

    faqs: [
      {
        q: 'Comment migrer mes conversations Intercom vers Actero ?',
        a: "Vos conversations historiques restent dans Intercom (lecture seule). Actero prend le relais sur les nouvelles conversations dès la connexion Shopify. Pour la base de connaissances, l'import depuis Intercom Help Center se fait via export CSV ou par scraping de votre Help Center public — quelques minutes.",
      },
      {
        q: 'Pourquoi Actero est moins cher qu\'Intercom Fin ?',
        a: "Intercom Fin est facturé à l'outcome (0,99 $/résolution) en plus des seats. Sur 1 000 résolutions/mois ça fait 990 $ avant les seats. Actero forfaitise — Starter 99 €/mois pour 1 000 tickets, Pro 399 €/mois pour 5 000. Vous payez le service, pas chaque résolution.",
      },
      {
        q: 'Mes équipes vont-elles devoir réapprendre tout le workflow ?',
        a: "Non — Actero est plus simple qu'Intercom (interface dédiée e-commerce, pas une suite SaaS générique). L'onboarding prend 15 min, le simulateur permet de tester l'agent avant la mise en production, et le dashboard ROI affiche les bons chiffres dès la première semaine.",
      },
      {
        q: 'Que devient mon Help Center Intercom ?',
        a: "Vous pouvez le garder en parallèle (le contenu est public, pas verrouillé). Actero importe automatiquement votre Help Center Shopify et votre site web pour construire sa base de connaissances. Beaucoup de clients consolident sur Actero après 2-3 mois pour ne plus payer 2 outils.",
      },
      {
        q: 'Est-ce qu\'Actero a un Copilot pour mes agents humains ?',
        a: "Oui. Le Copilot Actero suggère des réponses, classe les tickets, et apprend de vos validations. Sur Pro c'est inclus pour toute l'équipe, contrairement à Intercom qui facture le Copilot 29 $/agent en supplément.",
      },
    ],

    crosslinks: [
      { href: '/intercom-vs-actero', label: 'Intercom vs Actero — comparatif détaillé' },
      { href: '/alternative-gorgias', label: 'Alternative à Gorgias' },
      { href: '/alternative-zendesk', label: 'Alternative à Zendesk' },
      { href: '/tarifs', label: 'Voir tous les tarifs' },
    ],
  }

  return <AlternativeTemplate onNavigate={onNavigate} data={data} />
}
