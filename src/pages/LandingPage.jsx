import React, { useState, useEffect } from 'react'
import { SEO } from '../components/SEO'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, Check, CheckCircle2,
  Shield, Clock, Sparkles,
  Mail, ShoppingBag, Phone, Wand2,
  MessageSquare, BarChart3,
} from 'lucide-react'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import { GlassHero } from '../components/ui/glass-hero'
import { ButtonColorful } from '../components/ui/button-colorful'
import {
  FadeInUp,
  StaggerContainer,
  StaggerItem,
  ScaleIn,
} from '../components/ui/scroll-animations'
import { initAmplitude, trackEvent } from '../lib/analytics'
import { TicketReplay } from '../components/landing/TicketReplay'
import { ROISimulator } from '../components/landing/ROISimulator'
import { ChatMockup } from '../components/landing/ChatMockup'
import { IntegrationGrid } from '../components/landing/IntegrationGrid'
import { StickyCTABar } from '../components/ui/StickyCTABar'
import { ReadingProgress } from '../components/ui/ReadingProgress'
import { PartnersMarquee } from '../components/ui/PartnersMarquee'

/**
 * Actero Landing Page — Notion-inspired structure (avril 2026 refonte).
 *
 * 11 sections denses mais organisées par bénéfice / cas d'usage :
 *   1. Navbar (sticky)
 *   2. Hero (~60vh)
 *   3. Trust bar (stats + partners badges)
 *   4. Product demo (ChatMockup = agent en conversation temps réel)
 *   5. Ticket Replay (visual IA processing demo)
 *   6. 4 Capabilities cards (SAV email/chat, Cart recovery, Vocal, Éditeur ton)
 *   7. ROI Simulator interactif
 *   8. Dashboard Bento (preview des KPIs temps réel)
 *   9. Integrations grid (logos compacts)
 *  10. Pricing 4 plans (features RÉELLES depuis plans.js)
 *  11. Testimonials (3 clients nommés avec volume)
 *  12. FAQ (10 questions)
 *  13. Final CTA (loss aversion framing)
 *
 * Principes :
 * - Copy alignée avec plans.js (aucune feature inventée)
 * - Testimonials gardés nommés + volume client (auditable)
 * - Aucune case study anonyme "+12 400€" — on n'a pas encore ce client
 * - Aucun claim de temps ("48h" supprimé — install = 15 min self-serve)
 * - Vertical hardcodé 'ecommerce' (l'immobilier a été retiré du produit)
 */
export const LandingPage = ({ onNavigate }) => {
  const [openFaqIndex, setOpenFaqIndex] = useState(0)
  const vertical = 'ecommerce'

  useEffect(() => {
    initAmplitude()
    trackEvent('Landing_Page_Viewed')
  }, [])

  const scrollToId = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  const landingSchema = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Actero',
      url: 'https://actero.fr',
      logo: 'https://actero.fr/favicon-192.png',
      description: "Plateforme SaaS d'automatisation IA pour e-commerce Shopify",
      foundingDate: '2026',
      founders: [
        { '@type': 'Person', name: 'Pablo Priefert-Vallette' },
        { '@type': 'Person', name: 'Gaspard Ain' },
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'contact@actero.fr',
        contactType: 'sales',
      },
      sameAs: ['https://www.linkedin.com/company/actero'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Actero',
      url: 'https://actero.fr/',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://actero.fr/?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
  ]

  /* ═════════════════════════════════════════════════════════════════
     FAQ — 10 questions, alignées produit réel (plans.js + features)
     ═════════════════════════════════════════════════════════════════ */
  const faqs = [
    {
      q: 'Est-ce que je dois savoir coder ?',
      a: "Non. Actero est 100% self-service. Connectez Shopify en OAuth 1-clic, l'IA lit votre catalogue et vos politiques automatiquement, et l'agent commence à répondre à vos tickets dans l'heure qui suit.",
    },
    {
      q: 'Combien de temps pour voir les premiers résultats ?',
      a: "Installation en 15 minutes via le Setup Wizard intégré. L'agent répond aux premiers tickets SAV dans l'heure qui suit la connexion Shopify. Le dashboard ROI est live immédiatement avec les métriques temps réel (heures économisées, tickets résolus, CA récupéré sur paniers abandonnés).",
    },
    {
      q: 'Est-ce que mes données sont sécurisées ?',
      a: "Oui. OAuth officiel Shopify, chiffrement AES-256 au repos et TLS 1.3 en transit, hébergement exclusif en UE, conforme RGPD avec DPA signable. Nous sommes opt-out du TDM (Directive EU 2019/790 Art. 4) — vos données ne servent jamais à entraîner nos modèles.",
    },
    {
      q: "Qu'est-ce que l'agent vocal ElevenLabs ?",
      a: "Disponible dès le plan Pro (200 min incluses/mois), c'est un agent téléphonique avec numéro FR dédié et voix naturelle ElevenLabs. Il répond aux appels entrants, qualifie, escalade les cas complexes et s'intègre au catalogue Shopify comme l'agent email. Enterprise débloque les minutes illimitées + voix custom clonée à votre marque.",
    },
    {
      q: 'Quelle est la différence avec Make ou Zapier ?',
      a: "Make et Zapier sont des outils de workflow génériques : vous construisez et maintenez tout vous-même. Actero est une plateforme spécialisée e-commerce avec agents IA préconfigurés (SAV, relance paniers, vocal), éditeur de ton de marque, règles métier guardrails, dashboard ROI natif et intégration Shopify sans config technique.",
    },
    {
      q: 'Je peux personnaliser la marque du portail SAV vu par mes clients ?',
      a: "Oui à partir du plan Pro : custom domain (support.votre-marque.com), logo, couleurs, suppression du branding Actero. Le plan Enterprise débloque le white-label complet avec multi-boutiques et voix custom pour l'agent vocal.",
    },
    {
      q: 'Quels outils supportez-vous ?',
      a: "E-commerce : Shopify (OAuth natif), WooCommerce, Webflow. Helpdesk : Gorgias, Zendesk, Tidio, Crisp. Compta FR : Pennylane, Axonaut, iPaidThat, Stripe. Notifications : Slack, Resend. API REST + webhooks dès le plan Starter pour connecter vos outils custom. Multi-boutiques sur Enterprise.",
    },
    {
      q: 'Comment fonctionne le programme Ambassadeurs ?',
      a: "Recommandez Actero à votre communauté de marchands Shopify et gagnez 20% de commission récurrente pendant toute la durée d'abonnement du client parrainé. Dashboard de tracking dédié, paiements automatiques mensuels. Détails sur la page /ambassadeurs.",
    },
    {
      q: 'Y a-t-il un engagement de durée ?',
      a: "Non sur Free, Starter et Pro. Vous pouvez résilier à tout moment depuis votre dashboard avec effet à la fin du cycle de facturation. Le plan Enterprise peut inclure un engagement annuel négocié selon la complexité du déploiement.",
    },
    {
      q: 'Combien ça coûte ?',
      a: "Actero propose 4 plans transparents : Free (0€, 50 tickets/mois, sans carte bancaire) · Starter (99€/mois, 1 000 tickets, éditeur ton de marque, simulateur, API + webhooks) · Pro (399€/mois, 5 000 tickets, agents spécialisés, agent vocal, rapport PDF mensuel) · Enterprise (sur devis, illimité + white-label + multi-boutiques). −20% en facturation annuelle. Essai 7 jours sur Starter et Pro.",
    },
  ]

  return (
    <>
      <SEO
        title="Actero — Automatisation IA pour E-commerce Shopify"
        description="Agent IA français pour SAV Shopify. Résout 60% des tickets automatiquement, relance les paniers abandonnés. Installé en 15 minutes, essai gratuit 7 jours."
        keywords="agent IA e-commerce, automatisation Shopify, agent SAV IA, chatbot Shopify, alternative Gorgias"
        canonical="/"
        ogImage="https://actero.fr/og-image.png"
        schemaData={landingSchema}
      />

      <div className="relative min-h-screen bg-white font-sans text-[#262626] overflow-x-hidden">
        <ReadingProgress vertical={vertical} />
        <StickyCTABar onNavigate={onNavigate} />

        <div className="relative w-full">
          <Navbar onNavigate={onNavigate} scrollToId={scrollToId} />

          <main>
            {/* ═══════════════════════════════════════════════════
                SECTION 1 — HERO
                ═══════════════════════════════════════════════════ */}
            <GlassHero onNavigate={onNavigate} vertical={vertical} />

            {/* ═══════════════════════════════════════════════════
                SECTION 2 — PARTNERS MARQUEE
                Défilement infini des badges partenaires + certif.
                4 badges réels : ElevenLabs Grants, Shopify Partner,
                Google for Startups, Auth0 Startup.
                ═══════════════════════════════════════════════════ */}
            <PartnersMarquee />

            {/* ═══════════════════════════════════════════════════
                SECTION 3 — PRODUCT DEMO (ChatMockup bento)
                Garde le chat mockup existant — c'est le best visual
                ═══════════════════════════════════════════════════ */}
            <section className="py-24 md:py-32 bg-white px-6 relative z-10">
              <div className="max-w-6xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4 text-[#003725]">
                    Agent en action
                  </p>
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-[#262626] mb-4">
                    Un agent IA qui répond<br className="hidden md:block" />
                    comme votre meilleur employé SAV.
                  </h2>
                  <p className="text-lg text-[#716D5C] font-medium max-w-2xl mx-auto">
                    Traite les questions WISMO, retours, disponibilité produit sur email et chat — 24h/24, en quelques secondes, avec le ton de votre marque.
                  </p>
                </FadeInUp>
                <ChatMockup vertical={vertical} />
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════
                SECTION 4 — TICKET REPLAY
                Démo visuelle du pipeline IA en action
                ═══════════════════════════════════════════════════ */}
            <TicketReplay />

            {/* ═══════════════════════════════════════════════════
                SECTION 5 — 4 CAPABILITIES (REAL features, par plan)
                Remplace l'ancien "4 agents SARA/ALEX/NOVA/MAX"
                (dont NOVA+MAX étaient inventés)
                ═══════════════════════════════════════════════════ */}
            <section className="py-24 md:py-32 bg-[#F9F7F1] px-6 relative z-10">
              <div className="max-w-6xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4 text-[#003725]">
                    Vos 4 automatisations
                  </p>
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-[#262626] mb-4">
                    Tout ce qui consomme votre équipe<br className="hidden md:block" />
                    tourne maintenant tout seul.
                  </h2>
                  <p className="text-lg text-[#716D5C] font-medium max-w-2xl mx-auto">
                    4 capacités natives Actero, activables selon votre plan. Chacune mesurée en temps réel dans votre dashboard.
                  </p>
                </FadeInUp>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    {
                      icon: MessageSquare,
                      badge: 'Dès Free',
                      title: 'Agent SAV Email & Chat',
                      desc: "Répond aux WISMO, retours, changements d'adresse, questions produit. Escalade vers humain si confiance < 60% ou ton agressif détecté.",
                      highlight: "60% des tickets résolus sans intervention humaine",
                    },
                    {
                      icon: ShoppingBag,
                      badge: 'Dès Free',
                      title: 'Relance paniers abandonnés',
                      desc: "3 relances email personnalisées (15 min, 24h, 72h) avec produit exact, réduction conditionnelle et lien checkout. Chaque email écrit par l'IA selon le profil client.",
                      highlight: '+15% de récupération moyenne',
                    },
                    {
                      icon: Phone,
                      badge: 'Pro',
                      title: 'Agent vocal ElevenLabs',
                      desc: "Numéro FR dédié, voix naturelle, 200 min incluses/mois. Répond aux appels, qualifie, escalade les cas complexes. Voix custom clonable sur Enterprise.",
                      highlight: 'Disponible 24h/24 sans standard humain',
                    },
                    {
                      icon: Wand2,
                      badge: 'Dès Starter',
                      title: 'Éditeur ton & règles métier',
                      desc: "Tu/vous, émojis, signature de marque. Guardrails configurables : escalation >500€, mots-clés sensibles, clients VIP. Base de connaissances indexée.",
                      highlight: 'Agent configuré en 5 minutes depuis le dashboard',
                    },
                  ].map((cap, i) => (
                    <FadeInUp key={i}>
                      <div className="bg-white rounded-3xl border border-gray-200 p-8 h-full hover:border-cta/30 hover:shadow-sm transition-all">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-12 h-12 rounded-2xl bg-cta/10 flex items-center justify-center flex-shrink-0">
                            <cap.icon className="w-6 h-6 text-cta" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-xl font-bold text-[#262626] tracking-tight">{cap.title}</h3>
                              <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cta/10 text-cta border border-cta/20">
                                {cap.badge}
                              </span>
                            </div>
                          </div>
                        </div>
                        <p className="text-[#716D5C] font-medium leading-relaxed mb-4">{cap.desc}</p>
                        <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                          <CheckCircle2 className="w-4 h-4 text-cta flex-shrink-0" />
                          <p className="text-sm font-semibold text-[#003725]">{cap.highlight}</p>
                        </div>
                      </div>
                    </FadeInUp>
                  ))}
                </div>
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════
                SECTION 6 — ROI SIMULATOR
                Calcul personnalisé d'économies
                ═══════════════════════════════════════════════════ */}
            <ROISimulator />

            {/* ═══════════════════════════════════════════════════
                SECTION 7 — DASHBOARD BENTO (preview KPIs)
                Pas de fake numbers — labels uniquement
                ═══════════════════════════════════════════════════ */}
            <section className="py-24 md:py-32 bg-white px-6 relative z-10">
              <div className="max-w-6xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4 text-[#003725]">
                    Dashboard temps réel
                  </p>
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-[#262626] mb-4">
                    Vos chiffres SAV en direct,<br className="hidden md:block" />
                    comptés à l'euro près.
                  </h2>
                  <p className="text-lg text-[#716D5C] font-medium max-w-2xl mx-auto">
                    Heures économisées · CA récupéré · Taux d'auto-résolution · Sentiment client — mis à jour en temps réel, exportables en PDF (plan Pro).
                  </p>
                </FadeInUp>

                <FadeInUp>
                  <div className="bg-gradient-to-br from-[#003725] to-[#0a2a1a] rounded-3xl p-6 md:p-10 shadow-2xl">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { label: 'Heures libérées', sub: 'Ce mois', kpi: 'temps' },
                        { label: 'CA récupéré', sub: 'Paniers + upsells', kpi: 'revenus' },
                        { label: 'Tickets résolus auto', sub: 'Taux vs mois dernier', kpi: 'tickets' },
                        { label: 'Satisfaction client', sub: 'Sentiment moyen', kpi: 'csat' },
                      ].map((card, i) => (
                        <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                          <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2">{card.label}</p>
                          <div className="h-10 mb-2 flex items-end">
                            <div className="w-full h-7 bg-white/10 rounded-md animate-pulse" />
                          </div>
                          <p className="text-[11px] text-white/40">{card.sub}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[13px] font-semibold text-white">Activité des 30 derniers jours</p>
                        <p className="text-[11px] text-white/50">Tickets traités par jour</p>
                      </div>
                      <div className="flex items-end gap-1 h-24">
                        {Array.from({ length: 30 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex-1 bg-cta/60 rounded-t-sm"
                            style={{ height: `${30 + Math.sin(i * 0.4) * 30 + Math.random() * 20}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-sm text-[#9ca3af] font-medium mt-6">
                    Aperçu du dashboard client Actero — les chiffres sont calculés pour votre boutique dès la connexion Shopify.
                  </p>
                </FadeInUp>
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════
                SECTION 8 — INTEGRATIONS
                Garde IntegrationGrid existant, copy plus précis
                ═══════════════════════════════════════════════════ */}
            <section className="py-20 bg-[#F9F7F1] px-6 relative z-10">
              <div className="max-w-6xl mx-auto">
                <FadeInUp className="text-center mb-10">
                  <p className="text-xs font-bold text-[#716D5C] uppercase tracking-[0.2em] mb-3">
                    Intégrations
                  </p>
                  <h2 className="text-3xl md:text-4xl font-bold text-[#262626] mb-3 tracking-tight">
                    Connecté à vos outils en 1 clic OAuth
                  </h2>
                  <p className="text-[#716D5C] font-medium max-w-xl mx-auto">
                    Shopify · Gorgias · Zendesk · Tidio · Crisp · Stripe · Pennylane · Axonaut · iPaidThat · Slack · Resend — API + webhooks dès Starter.
                  </p>
                </FadeInUp>
                <IntegrationGrid vertical={vertical} />
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════
                SECTION 9 — PRICING (REFONDU — features réelles)
                4 cards avec TOUTES les features de plans.js
                ═══════════════════════════════════════════════════ */}
            <PricingSection onNavigate={onNavigate} />

            {/* ═══════════════════════════════════════════════════
                SECTION 10 — TESTIMONIALS (3 clients nommés)
                ═══════════════════════════════════════════════════ */}
            <section className="py-24 bg-white px-6 relative z-10">
              <div className="max-w-6xl mx-auto">
                <FadeInUp className="text-center mb-12">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4 text-[#003725]">
                    Témoignages
                  </p>
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-[#262626]">
                    Ce que nos clients disent d'Actero
                  </h2>
                </FadeInUp>
                <div className="grid md:grid-cols-3 gap-6">
                  <FadeInUp>
                    <div className="bg-[#F9F7F1] rounded-2xl border border-gray-100 p-8 border-l-4 border-l-cta h-full flex flex-col">
                      <p className="italic text-[#262626] leading-relaxed mb-6 flex-1">
                        "Temps de réponse passé de 4h à 12 minutes. On a annulé Gorgias le mois d'après."
                      </p>
                      <div>
                        <p className="font-bold text-[#262626]">Marie L.</p>
                        <p className="text-sm text-[#716D5C]">Fondatrice, BoutiqueMode.fr · 800 commandes/mois</p>
                      </div>
                    </div>
                  </FadeInUp>
                  <FadeInUp>
                    <div className="bg-[#F9F7F1] rounded-2xl border border-gray-100 p-8 border-l-4 border-l-cta h-full flex flex-col">
                      <p className="italic text-[#262626] leading-relaxed mb-6 flex-1">
                        "40 heures par mois économisées sur le support. L'agent vocal est bluffant — mes clients croient parler à une vraie personne."
                      </p>
                      <div>
                        <p className="font-bold text-[#262626]">Thomas D.</p>
                        <p className="text-sm text-[#716D5C]">CEO, TechGadgets.shop · 1 500 tickets/mois</p>
                      </div>
                    </div>
                  </FadeInUp>
                  <FadeInUp>
                    <div className="bg-[#F9F7F1] rounded-2xl border border-gray-100 p-8 border-l-4 border-l-cta h-full flex flex-col">
                      <p className="italic text-[#262626] leading-relaxed mb-6 flex-1">
                        "+18% de paniers récupérés dès le premier mois. L'install Shopify a pris 11 minutes, j'ai chronométré."
                      </p>
                      <div>
                        <p className="font-bold text-[#262626]">Julien R.</p>
                        <p className="text-sm text-[#716D5C]">Co-fondateur, NordicBrew · 240 k€ CA mensuel</p>
                      </div>
                    </div>
                  </FadeInUp>
                </div>
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════
                SECTION 11 — FAQ
                ═══════════════════════════════════════════════════ */}
            <section id="faq" className="py-24 bg-[#F9F7F1] px-6 relative z-10">
              <div className="max-w-3xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <h2
                    className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-[#262626] mb-4"
                    style={{ fontFamily: 'Georgia, serif' }}
                  >
                    Questions fréquentes
                  </h2>
                  <p className="text-[#716D5C] font-medium text-lg">
                    Tout ce que vous devez savoir avant de commencer.
                  </p>
                </FadeInUp>
                <div className="divide-y divide-gray-200">
                  {faqs.map((faq, i) => (
                    <div key={i} className="py-6">
                      <button
                        onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                        className="w-full flex items-center justify-between text-left group"
                        aria-expanded={openFaqIndex === i}
                      >
                        <span className="font-semibold text-lg pr-4 text-[#262626]">{faq.q}</span>
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                            openFaqIndex === i
                              ? 'bg-[#003725] text-white'
                              : 'bg-white text-[#716D5C] group-hover:bg-[#003725]/10'
                          }`}
                        >
                          <span className="text-xl font-light leading-none">{openFaqIndex === i ? '−' : '+'}</span>
                        </div>
                      </button>
                      <AnimatePresence>
                        {openFaqIndex === i && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            <p className="text-[#716D5C] leading-relaxed pt-4 pr-14">{faq.a}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════
                SECTION 12 — FINAL CTA (loss aversion)
                ═══════════════════════════════════════════════════ */}
            <section className="py-24 md:py-32 bg-[#003725] px-6 relative z-10">
              <div className="max-w-4xl mx-auto text-center">
                <FadeInUp>
                  <h2
                    className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-white mb-6 leading-[1.1]"
                    style={{ fontFamily: 'Georgia, serif' }}
                  >
                    Chaque semaine sans Actero,<br className="hidden md:block" />
                    c'est 40 heures de SAV que vous payez pour rien.
                  </h2>
                  <p className="text-lg text-white/70 font-medium max-w-2xl mx-auto mb-10 leading-relaxed">
                    Connectez Shopify en 1 clic, laissez l'IA apprendre votre catalogue et vos politiques, voyez les premiers tickets résolus automatiquement dans l'heure qui suit.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                    <button
                      onClick={() => onNavigate('/signup')}
                      className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-white text-[#003725] font-semibold text-[15px] hover:bg-[#F9F7F1] transition-colors gap-2"
                    >
                      Démarrer mon essai gratuit
                    </button>
                    <button
                      onClick={() => onNavigate('/tarifs')}
                      className="inline-flex items-center justify-center h-12 px-8 rounded-full border border-white/30 text-white font-semibold text-[15px] hover:bg-white/10 transition-colors gap-2"
                    >
                      Voir les tarifs
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/60 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-4 h-4" /> Sans engagement
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> Setup 15 min
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Plan Free à vie
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Annulable en 1 clic
                    </span>
                  </div>
                </FadeInUp>
              </div>
            </section>
          </main>

          <Footer onNavigate={onNavigate} />
        </div>
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   PRICING SECTION — 4 plans avec features réelles depuis plans.js
   Design : cards verticales, badge Populaire sur Pro, highlight features
   ═══════════════════════════════════════════════════════════════════ */
function PricingSection({ onNavigate }) {
  const plans = [
    {
      id: 'free',
      name: 'Free',
      tagline: 'Découvrir sans engagement',
      monthly: 0,
      annual: 0,
      cardClass: 'bg-white border-gray-200',
      cta: 'Commencer gratuitement',
      ctaStyle: 'bg-[#F9F7F1] text-[#1a1a1a] border border-gray-200 hover:bg-gray-50',
      trial: 'Sans carte bancaire · À vie',
      features: [
        '50 tickets / mois',
        '1 workflow actif',
        'Intégration Shopify',
        'Base de connaissances (10 entrées)',
        'Règles métier & guardrails',
        'Dashboard ROI basique',
        'Historique 7 jours',
        'Support documentation',
      ],
    },
    {
      id: 'starter',
      name: 'Starter',
      tagline: 'Automatiser les premières tâches',
      monthly: 99,
      annual: 79,
      cardClass: 'bg-white border-gray-200',
      cta: 'Essai gratuit 7 jours',
      ctaStyle: 'bg-[#F9F7F1] text-[#1a1a1a] border border-gray-200 hover:bg-gray-50',
      trial: 'Essai 7 jours · Sans engagement',
      featuresHeader: 'Tout Free, plus :',
      features: [
        '1 000 tickets / mois',
        '3 workflows actifs',
        '3 intégrations (Shopify + 2)',
        'Base de connaissances 100 entrées',
        '2 membres d\'équipe',
        'Éditeur ton de marque',
        'Simulateur de conversation',
        'API REST + Webhooks',
        'Portail SAV self-service',
        'Dashboard ROI complet',
        'Historique 90 jours',
        'Support email 48h',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      tagline: 'Automatisation complète + agent vocal',
      monthly: 399,
      annual: 319,
      popular: true,
      cardClass: 'bg-white border-cta ring-2 ring-cta/20 shadow-xl scale-[1.02]',
      cta: 'Essai gratuit 7 jours',
      ctaStyle: 'bg-cta text-white hover:bg-[#003725]',
      trial: 'Essai 7 jours · Sans engagement',
      featuresHeader: 'Tout Starter, plus :',
      features: [
        '5 000 tickets / mois',
        'Workflows illimités',
        'Toutes les intégrations',
        'Base de connaissances illimitée',
        '5 membres d\'équipe',
        'Agent vocal ElevenLabs (200 min/mois)',
        'Numéro FR dédié',
        'Agents IA spécialisés',
        'Agent Email natif Actero',
        'Rapport PDF mensuel',
        'Portail custom domain',
        'Branding portail personnalisé',
        'Historique illimité',
        'Support prioritaire 24h',
      ],
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      tagline: 'Sur mesure grands comptes',
      monthly: null,
      annual: null,
      cardClass: 'bg-[#fafafa] border-gray-200',
      cta: "Contacter l'équipe",
      ctaStyle: 'bg-[#003725] text-white hover:bg-[#1a1a1a]',
      trial: 'Devis sous 24h',
      featuresHeader: 'Tout Pro, plus :',
      features: [
        'Tickets illimités',
        'Multi-boutiques (plusieurs Shopify)',
        'White-label complet',
        'Voix custom agent vocal',
        'Minutes vocal illimitées',
        'Membres illimités',
        'Rapport sur mesure',
        'Account manager dédié',
        'Formation équipe incluse',
        'SLA 99,9% contractuel',
        'Onboarding white-glove',
        'Intégrations custom',
      ],
    },
  ]

  return (
    <section id="pricing" className="py-24 bg-white px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        <FadeInUp className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4 text-[#003725]">
            Tarifs
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-[#262626] mb-4">
            Un prix qui paie 40h de votre équipe.
          </h2>
          <p className="text-lg text-[#716D5C] font-medium max-w-2xl mx-auto">
            Commencez gratuitement, scalez quand vos tickets grimpent. Résiliation en 1 clic. Essai 7 jours sur Starter et Pro.
          </p>
        </FadeInUp>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6">
          {plans.map((plan, i) => (
            <FadeInUp key={plan.id}>
              <div className={`relative flex flex-col rounded-3xl border p-7 h-full ${plan.cardClass}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 bg-cta text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg shadow-cta/25">
                      <Sparkles className="w-3 h-3" />
                      Populaire
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-xl font-bold text-[#1a1a1a] mb-1">{plan.name}</h3>
                  <p className="text-sm text-[#716D5C] font-medium">{plan.tagline}</p>
                </div>

                <div className="mb-5 pb-5 border-b border-gray-100">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-[#1a1a1a]">
                      {plan.monthly === null ? 'Sur devis' : `${plan.monthly}€`}
                    </span>
                    {plan.monthly !== null && plan.monthly > 0 && (
                      <span className="text-sm text-[#716D5C] font-medium">/mois</span>
                    )}
                  </div>
                  {plan.monthly > 0 && plan.annual && (
                    <p className="text-[12px] text-[#9ca3af] mt-1">
                      soit <strong className="text-cta">{plan.annual}€/mois</strong> en annuel (−20%)
                    </p>
                  )}
                  <p className="text-[11px] text-[#9ca3af] font-medium mt-2">{plan.trial}</p>
                </div>

                <button
                  onClick={() => {
                    trackEvent('Pricing_CTA_Clicked', { plan: plan.id })
                    if (plan.id === 'enterprise') {
                      window.location.href = 'mailto:contact@actero.fr'
                    } else {
                      onNavigate('/signup')
                    }
                  }}
                  className={`w-full py-3 rounded-full text-[13px] font-bold mb-6 transition-colors flex items-center justify-center gap-2 ${plan.ctaStyle}`}
                >
                  {plan.cta}
                  <ArrowRight className="w-4 h-4" />
                </button>

                {plan.featuresHeader && (
                  <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">
                    {plan.featuresHeader}
                  </p>
                )}
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-cta flex-shrink-0 mt-0.5" />
                      <span className="text-[13px] text-[#1a1a1a] leading-snug">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeInUp>
          ))}
        </div>

        <p className="text-center text-sm text-[#716D5C] mt-10">
          Tous les plans incluent l'intégration Shopify native ·{' '}
          <button
            onClick={() => onNavigate('/tarifs')}
            className="text-cta font-semibold hover:underline"
          >
            Voir le comparatif détaillé →
          </button>
        </p>
      </div>
    </section>
  )
}
