import React from 'react'
import { VsTemplate } from '../components/alternative/VsTemplate'
import { GorgiasCostCalculator } from '../components/landing/GorgiasCostCalculator'

/**
 * /gorgias-vs-actero — page comparative SEO
 * Pricing concurrent (avril 2026) :
 *   Starter 10 $ (50t) · Basic 60 $ (300t) · Pro 360 $ (2k) · Advanced 900 $ (5k).
 *   AI Agent facturé 0,90-1,00 $/résolution.
 *   Voice add-on 0,40-1,20 $/ticket · SMS 0,41-0,80 $/ticket.
 */
export const GorgiasVsActero = ({ onNavigate }) => {
  const data = {
    competitorKey: 'gorgias',
    competitorName: 'Gorgias',
    comparisonDate: 'avril 2026',
    sources: 'Tarifs publics avril 2026 — Helpdesk + AI Agent add-on facturé 0,95 $ par résolution',

    seo: {
      title: 'Gorgias vs Actero — Comparatif détaillé 2026 | Lequel choisir ?',
      description:
        "Comparatif factuel Gorgias vs Actero : prix, features, IA, voice, RGPD. Sur 1 000 tickets/mois, Gorgias coûte ~1 280 $/mois (Pro + AI), Actero 99 €/mois. Verdict détaillé.",
      keywords:
        'gorgias vs actero, comparatif gorgias actero, gorgias ou actero, gorgias pricing, agent ia shopify comparatif',
    },

    hero: {
      subtitle:
        "Gorgias facture chaque résolution IA et empile les add-ons (voice, SMS, automation). Actero forfaitise tout, parle français nativement et héberge en UE. Voici les chiffres réels — pour les marchands Shopify FR, la décision est sans appel.",
    },

    verdict: {
      winner: 'actero',
      headline: 'Pour un marchand Shopify français : Actero, sans hésitation.',
      body:
        "Gorgias est anglo-centré, facture à la résolution et coûte 3 à 8 fois plus cher pour la même charge. Actero divise la facture, parle français nativement, héberge en UE et démarre en 15 minutes — pas en 2 à 5 jours. Le seul scénario où Gorgias tient encore : équipes anglophones de 50+ agents enfermées dans leur stack historique.",
    },

    comparison: [
      {
        label: 'Prix d\'entrée',
        competitor: { main: '10 $/mois', sub: 'Starter · 50 tickets' },
        actero: { main: '0 €/mois', sub: 'Free à vie · 50 tickets' },
      },
      {
        label: 'Plan helpdesk pour 1 000 tickets',
        competitor: { main: '60 $/mois', sub: 'Basic (300t) + overage' },
        actero: { main: '99 €/mois', sub: 'Starter complet' },
      },
      {
        label: 'AI Agent — 600 résolutions/mois',
        competitor: { main: '+570 $/mois', sub: '0,95 $ × 600 résolutions' },
        actero: { main: 'Inclus', sub: 'Pas de tarif par résolution' },
      },
      {
        label: 'Coût réel total 1 000 tickets · 60% IA',
        competitor: { main: '~630 $/mois', sub: '~7 030 € / an' },
        actero: { main: '99 €/mois', sub: '1 188 € / an' },
      },
      {
        label: 'Coût réel total 5 000 tickets · 60% IA',
        competitor: { main: '~3 200 $/mois', sub: '~35 700 € / an' },
        actero: { main: '399 €/mois', sub: '4 788 € / an' },
      },
      {
        label: 'Relance panier abandonné conversationnelle',
        competitor: false,
        actero: { main: 'Inclus', sub: 'Dès Free' },
      },
      {
        label: 'Interface & support en français',
        competitor: 'partial',
        actero: true,
      },
      {
        label: 'Hébergement UE + RGPD natif + opt-out TDM',
        competitor: 'partial',
        actero: true,
      },
      {
        label: 'Marketplace de templates communautaire',
        competitor: { main: 'Macros', sub: 'Pas de marketplace' },
        actero: true,
      },
      {
        label: 'Dashboard ROI partageable',
        competitor: 'partial',
        actero: { main: 'URL signée', sub: 'Read-only public' },
      },
      {
        label: 'Setup time',
        competitor: { main: '2-5 jours', sub: 'Macros + intégrations manuelles' },
        actero: { main: '15 min', sub: 'OAuth Shopify auto' },
      },
    ],

    whenCompetitor: [
      'Vos clients et équipes sont 100 % anglophones et vous tolérez une interface non-française.',
      'Vous acceptez de payer chaque résolution IA en plus du plan, sans plafond mensuel prévisible.',
      'Vous voulez attendre 2 à 5 jours d\'installation avec un consultant pour configurer macros et règles.',
      'L\'hébergement UE et l\'opt-out TDM RGPD ne font pas partie de vos exigences.',
      'Vous êtes prêt à payer voice et SMS en add-on supplémentaire au-dessus du forfait helpdesk.',
    ],

    whenActero: [
      'Vous êtes marchand Shopify FR, IT ou ES et voulez un agent qui pense dans votre langue.',
      'Vous voulez un coût mensuel prévisible — pas un pricing à la résolution qui s\'envole.',
      'Vous voulez la relance de paniers abandonnés dans la même conversation que le SAV.',
      'Vous valorisez l\'hébergement UE, le DPA signable, l\'opt-out TDM par défaut.',
      'Vous voulez un dashboard ROI prouvable au CFO (CA récupéré, heures économisées).',
      'Vous voulez démarrer en 15 minutes sans intégrateur ni audit préalable.',
    ],

    faqs: [
      {
        q: 'Combien coûte vraiment Gorgias pour 1 000 tickets/mois avec IA ?',
        a: "Plan Basic (300 tickets inclus) à 60 $/mois + 700 tickets overage à 40 $/100 = ~340 $. Si 60 % résolus par AI Agent (600 résolutions × 0,95 $) = +570 $. Total ≈ 910 $/mois soit ~10 200 € / an. Actero Starter à 99 €/mois couvre la même charge — 8× moins cher.",
      },
      {
        q: 'Le pricing Actero est forfaitaire — qu\'arrive-t-il si je dépasse ?',
        a: "Aucune coupure. Overage à 0,15 €/ticket sur Starter, 0,10 €/ticket sur Pro. Vous recevez une alerte à 80 % et 100 % du quota. Si vous dépassez régulièrement, l'upgrade vers Pro devient mécaniquement plus rentable.",
      },
      {
        q: 'Migration depuis Gorgias — combien de temps ?',
        a: "Une après-midi pour la majorité des marchands. Connexion OAuth Shopify, import de la base de connaissances (FAQs, politiques), configuration des guardrails, test de l'agent dans le simulateur. Vos tickets Gorgias existants restent dans Gorgias en lecture seule.",
      },
      {
        q: 'Mes équipes peuvent-elles continuer à utiliser Gorgias en parallèle ?',
        a: "Oui. Beaucoup de clients gardent Gorgias 1-2 semaines en parallèle pour valider Actero sans risque, puis basculent. Actero peut aussi se brancher sur Gorgias en pre-processing : Actero traite l'IA, Gorgias garde le ticketing humain.",
      },
      {
        q: 'Et la qualité des réponses face à AI Agent de Gorgias ?',
        a: "Les deux utilisent des LLM modernes. La différence : Actero exécute des actions Shopify natives (refund segmenté, échange, modification commande) et inclut des guardrails configurables (jamais de remboursement > 100 € sans humain pour les non-VIP). Gorgias AI Agent reste plus orienté réponse texte que action exécutée.",
      },
    ],

    crosslinks: [
      { href: '/alternative-gorgias', label: 'Alternative à Gorgias — pourquoi switcher' },
      { href: '/intercom-vs-actero', label: 'Intercom vs Actero' },
      { href: '/zendesk-vs-actero', label: 'Zendesk vs Actero' },
      { href: '/tidio-vs-actero', label: 'Tidio vs Actero' },
      { href: '/calculateur-gorgias', label: 'Calculateur de coût Gorgias' },
      { href: '/tarifs', label: 'Voir tous les tarifs' },
    ],
  }

  return (
    <VsTemplate onNavigate={onNavigate} data={data}>
      <GorgiasCostCalculator onNavigate={onNavigate} source="vs_gorgias" />
    </VsTemplate>
  )
}
