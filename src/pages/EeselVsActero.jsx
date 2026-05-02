import React from 'react'
import { VsTemplate } from '../components/alternative/VsTemplate'

/**
 * /eesel-vs-actero — page comparative SEO face-à-face
 *
 * Veille concurrentielle 2026-05-02 : eesel AI mène une offensive SEO active
 * sur les comparatifs e-commerce (« 6 best AI chatbots for e-commerce 2026 »,
 * « eesel vs Gorgias / Kustomer / Dixa »). Cette page absorbe le trafic FR.
 *
 * Pricing eesel (mai 2026) : pay-as-you-go 0,40 $/ticket régulier, essai 50 $
 * sans carte. Société US, anglais natif, hébergé US, multi-plateformes
 * (Shopify, WooCommerce, Magento, BigCommerce).
 */
export const EeselVsActero = ({ onNavigate }) => {
  const data = {
    competitorKey: 'eesel',
    competitorName: 'eesel AI',
    comparisonDate: 'mai 2026',
    sources: 'Tarifs publics mai 2026 — Pay-as-you-go 0,40 $ par ticket régulier traité, essai gratuit à 50 $ sans carte bancaire.',

    seo: {
      title: 'eesel AI vs Actero — Comparatif détaillé 2026 | Lequel choisir ?',
      description:
        "Comparatif factuel eesel AI vs Actero : pricing PAYG vs forfait fixe, RGPD, langue, spécialisation Shopify. Sur 5 000 tickets/mois, eesel coûte ~2 000 $/mois, Actero 399 €/mois. Verdict détaillé pour marchands Shopify FR.",
      keywords:
        'eesel ai vs actero, eesel vs actero, eesel ai français, comparatif eesel actero, eesel ai pricing, agent ia shopify comparatif',
    },

    hero: {
      subtitle:
        "eesel AI mise sur le pay-as-you-go (0,40 $ par ticket) — séduisant à l'entrée, imprévisible au scaling. Société US, anglais, hébergement US, multi-plateformes. Actero est forfait fixe en français, hébergé UE, RGPD natif, spécialisé Shopify avec agent vocal et ROI prouvable. Voici les chiffres concrets.",
    },

    verdict: {
      winner: 'actero',
      headline: 'Pour un marchand Shopify français : Actero, le choix prévisible.',
      body:
        "eesel AI est attractif à l'entrée (essai 50 $, pay-as-you-go) mais devient cher au scaling : 5 000 tickets/mois coûtent ~2 000 $ chez eesel vs 399 €/mois chez Actero (4,5× moins cher). Plus, eesel est US, anglais, hébergé US — un risque RGPD à éviter pour une marque DTC France. Actero est conçu pour la France et la croissance prévisible. Le seul scénario où eesel tient : marchand US/UK qui veut tester sans engagement initial.",
    },

    comparison: [
      {
        label: 'Modèle de pricing',
        competitor: { main: 'Pay-as-you-go', sub: '0,40 $ par ticket' },
        actero: { main: 'Forfait fixe', sub: 'Coût prévisible au scaling' },
      },
      {
        label: 'Coût pour 1 000 tickets/mois',
        competitor: { main: '~400 $/mois', sub: '1 000 × 0,40 $' },
        actero: { main: '99 €/mois', sub: 'Starter — tout inclus' },
      },
      {
        label: 'Coût pour 3 000 tickets/mois',
        competitor: { main: '~1 200 $/mois', sub: '3 000 × 0,40 $' },
        actero: { main: '399 €/mois', sub: 'Pro — tout inclus' },
      },
      {
        label: 'Coût pour 5 000 tickets/mois',
        competitor: { main: '~2 000 $/mois', sub: '5 000 × 0,40 $' },
        actero: { main: '399 €/mois', sub: 'Pro — tout inclus' },
      },
      {
        label: 'Coût annuel à 3 000 tickets/mois',
        competitor: { main: '~14 400 $/an', sub: '~13 200 €/an' },
        actero: { main: '4 788 €/an', sub: 'Économie ~8 400 €/an' },
      },
      {
        label: 'Interface & support en français',
        competitor: false,
        actero: true,
      },
      {
        label: 'Hébergement UE + RGPD natif',
        competitor: false,
        actero: true,
      },
      {
        label: 'Opt-out TDM (Art. 4 EU 2019/790)',
        competitor: false,
        actero: true,
      },
      {
        label: 'SMTP du marchand (réponses brandées)',
        competitor: false,
        actero: { main: 'Natif', sub: 'Depuis votre domaine' },
      },
      {
        label: 'Lookup Shopify live (tracking Colissimo)',
        competitor: 'partial',
        actero: { main: 'Natif', sub: 'En temps réel' },
      },
      {
        label: 'Agent vocal natif (numéro FR)',
        competitor: false,
        actero: { main: '200 min', sub: 'Inclus dès Pro' },
      },
      {
        label: 'Relance panier abandonné conversationnelle',
        competitor: false,
        actero: { main: 'Inclus', sub: 'Dès Free' },
      },
      {
        label: 'Dashboard ROI temps réel (heures + €)',
        competitor: 'partial',
        actero: { main: 'Natif', sub: 'Partageable au CFO' },
      },
      {
        label: 'Spécialisation',
        competitor: { main: 'Multi-plateformes', sub: 'Shopify + Woo + Magento + BC' },
        actero: { main: 'Shopify-first', sub: 'Agents spécialisés DTC' },
      },
      {
        label: 'Temps d\'installation',
        competitor: { main: '~1-2 jours', sub: 'Setup multi-stack' },
        actero: { main: '15 min', sub: 'OAuth Shopify 1-clic' },
      },
    ],

    faqs: [
      {
        q: 'Le pay-as-you-go d\'eesel n\'est-il pas plus juste qu\'un forfait fixe ?',
        a: "Sur le papier oui — vous ne payez que ce que vous consommez. En pratique, c'est un piège budgétaire : vous ne savez pas combien vous paierez le mois prochain. À 3 000 tickets/mois, eesel facture ~1 200 $ vs 399 € chez Actero (3× moins cher) — et vous savez exactement combien tomber sur la facture. Le forfait fixe est le bon choix pour un marchand qui veut maîtriser son P&L.",
      },
      {
        q: 'eesel couvre Shopify + WooCommerce + Magento + BigCommerce — c\'est mieux non ?',
        a: "C'est l'inverse — eesel répartit ses efforts entre 4 plateformes, Actero est mono-stack Shopify et y excelle : OAuth en 15 min, lecture native du catalogue, lookup commandes Colissimo en temps réel, refund automatique selon la politique de la boutique. Pour un marchand Shopify DTC, un spécialiste bat un généraliste sur tous les terrains.",
      },
      {
        q: 'Mes données client sont-elles protégées chez eesel ?',
        a: "eesel est une société US avec hébergement US. Pour une marque DTC France, c'est un double risque : transferts hors-UE en zone grise post-Schrems II, pas de DPA en français, pas d'opt-out TDM clair. Actero est français, hébergé Supabase + Vercel UE, DPA signable en français, opt-out TDM explicite (Art. 4 Directive EU 2019/790) — vos données client n'entraînent jamais nos modèles.",
      },
      {
        q: 'Comment migrer d\'eesel vers Actero ?',
        a: "Pas de migration de tickets nécessaire — Actero prend le relais sur les nouveaux tickets. Pour la knowledge base, nous importons depuis URL, PDF, Google Docs ou Notion en quelques clics. Setup OAuth Shopify en 15 min. Total : 1 jour de migration, pas plus.",
      },
      {
        q: 'L\'essai gratuit à 50 $ sans carte chez eesel est attractif — Actero a quoi ?',
        a: "Un plan Free à vie, sans carte bancaire, 50 tickets/mois, 1 workflow, intégration Shopify. Vous testez avec votre vrai catalogue, sans engagement, sans paiement, sans expiration de crédits. Vous décidez d'upgrader uniquement quand l'agent prouve sa valeur sur vos données réelles.",
      },
    ],

    crosslinks: [
      { href: '/alternative-eesel', label: 'Page alternative à eesel AI' },
      { href: '/gorgias-vs-actero', label: 'Gorgias vs Actero' },
      { href: '/intercom-vs-actero', label: 'Intercom Fin vs Actero' },
      { href: '/zendesk-vs-actero', label: 'Zendesk vs Actero' },
      { href: '/tarifs', label: 'Voir tous les tarifs' },
    ],
  }

  return <VsTemplate onNavigate={onNavigate} data={data} />
}
