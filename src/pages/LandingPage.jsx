import React, { useState, useEffect } from 'react'
import { SEO } from '../components/SEO'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  TrendingDown,
  Clock,
  BarChart2,
  ArrowRight,
  MessageSquare,
  ShoppingCart,
  Activity,
  Zap,
  CheckCircle2,
  Users,
  Target,
  BarChart3,
  Headphones,
  RefreshCw,
  Eye,
  Shield,
  CalendarCheck,
  Calendar,
  FileText,
  UserCheck,
  Building2,
  Phone,
  Home
} from 'lucide-react'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import { GlassHero } from '../components/ui/glass-hero'
import { RevenueCalculator } from '../components/ui/revenue-calculator'
import { ButtonColorful } from '../components/ui/button-colorful'
import { MagneticButton } from '../components/ui/magnetic-button'
import { ScrollCounter } from '../components/ui/ScrollCounter'
import {
  FadeInUp,
  StaggerContainer,
  StaggerItem,
  ScaleIn,
  SlideInLeft
} from '../components/ui/scroll-animations'
import { initAmplitude, trackEvent } from '../lib/analytics'
import { BeforeAfterSlider } from '../components/landing/BeforeAfterSlider'
import { TicketReplay } from '../components/landing/TicketReplay'
import { ROISimulator } from '../components/landing/ROISimulator'
import { AgentCarousel } from '../components/landing/AgentCarousel'
import { ChatMockup } from '../components/landing/ChatMockup'
import { IntegrationGrid } from '../components/landing/IntegrationGrid'
import { ProcessSteps } from '../components/landing/ProcessSteps'
import { AnnouncementBar } from '../components/layout/AnnouncementBar'
import { StickyCTA } from '../components/ui/StickyCTA'
import { LiveTicker } from '../components/ui/LiveTicker'
import { ReadingProgress } from '../components/ui/ReadingProgress'
import { GlowCard } from '../components/ui/GlowCard'

export const LandingPage = ({ onNavigate }) => {
  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [vertical, setVertical] = useState('ecommerce');

  useEffect(() => {
    initAmplitude();
    trackEvent("Landing_Page_Viewed");
  }, []);

  const landingSchema = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Actero",
      "url": "https://actero.fr",
      "logo": "https://actero.fr/favicon-192.png",
      "description": "Actero déploie des agents IA autonomes pour automatiser le SAV e-commerce Shopify et qualifier les leads immobiliers.",
      "sameAs": []
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Actero",
      "url": "https://actero.fr/",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://actero.fr/?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    }
  ];

  return (
    <>
      <SEO
        title="Actero | Automatisation IA pour E-commerce Shopify & Agences Immobilières"
        description="Actero déploie des agents IA autonomes pour automatiser le SAV e-commerce Shopify et qualifier les leads immobiliers. ROI mesurable dès le premier mois."
        canonical="/"
        schemaData={landingSchema}
      />
    <div className="relative min-h-screen bg-[#030303] font-sans text-white selection:bg-emerald-500/20 selection:text-white">
      <ReadingProgress vertical={vertical} />
      <StickyCTA onNavigate={onNavigate} vertical={vertical} />
      {/* GLOBAL BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="/moody_landscape_bg.png"
          alt=""
          className="w-full h-full object-cover object-[center_70%] opacity-40 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#030303]/20 via-[#030303]/70 to-[#030303]/90"></div>
      </div>

      <div className="relative z-10 w-full">
        {/* NAVBAR */}
        <Navbar
          onNavigate={onNavigate}
          onAuditOpen={() => onNavigate("/audit")}
          scrollToId={scrollToId}
        />

        <main>
          {/* ============================================ */}
          {/* SECTION 1 — HERO                            */}
          {/* ============================================ */}
          <GlassHero onNavigate={onNavigate} vertical={vertical} onVerticalChange={setVertical} />

          <div className="relative w-full z-10">

            {/* ============================================ */}
            {/* SECTION 2 — LA DOULEUR                      */}
            {/* ============================================ */}
            <section className="py-24 md:py-32 bg-transparent px-6 relative z-10">
              <FadeInUp className="max-w-5xl mx-auto text-center">
                <p className="text-xs font-bold text-red-400/80 uppercase tracking-[0.2em] mb-6">
                  Ce que vous perdez chaque mois
                </p>
                {vertical === 'ecommerce' ? (
                  <>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-white mb-6">
                      Votre croissance est freinée<br className="hidden md:block" />
                      par des problèmes invisibles.
                    </h2>
                    <p className="text-xl md:text-2xl text-gray-300 font-medium max-w-3xl mx-auto leading-relaxed mb-20">
                      Des paniers abandonnés sans relance. Un support qui noie votre équipe.
                      <br className="hidden md:block" />
                      Des milliers d'euros qui s'évaporent chaque mois — sans que personne ne les chiffre.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-white mb-6">
                      Vos agents perdent du temps<br className="hidden md:block" />
                      sur des tâches à faible valeur.
                    </h2>
                    <p className="text-xl md:text-2xl text-gray-300 font-medium max-w-3xl mx-auto leading-relaxed mb-20">
                      Des prospects jamais relancés. Des documents collectés à la main.
                      <br className="hidden md:block" />
                      Des heures englouties en administratif au lieu de conclure des ventes.
                    </p>
                  </>
                )}

                <StaggerContainer className="grid md:grid-cols-3 gap-12 lg:gap-16 text-center">
                  {(vertical === 'ecommerce' ? [
                    {
                      icon: <ShoppingCart className="w-8 h-8 text-red-400/70" />,
                      stat: "70%",
                      title: "des paniers jamais relancés",
                      desc: "7 acheteurs sur 10 abandonnent leur panier. Sans séquence de relance automatisée, chaque panier oublié est une vente en moins sur votre P&L.",
                    },
                    {
                      icon: <Clock className="w-8 h-8 text-red-400/70" />,
                      stat: "40h+",
                      title: "englouties en support chaque mois",
                      desc: "\"Où est ma commande ?\", \"Je veux un remboursement.\" Votre équipe traite les mêmes demandes en boucle au lieu de faire croître le business.",
                    },
                    {
                      icon: <Eye className="w-8 h-8 text-red-400/70" />,
                      stat: "0",
                      title: "visibilité sur vos fuites de marge",
                      desc: "Pas de tableau de bord consolidé. Vous ne savez pas combien vous perdez, ni où. Impossible d'optimiser ce qu'on ne mesure pas.",
                    },
                  ] : [
                    {
                      icon: <Phone className="w-8 h-8 text-red-400/70" />,
                      stat: "60%",
                      title: "des prospects jamais rappelés",
                      desc: "Un prospect non recontacté dans les 24h a 6 fois moins de chances de signer. Sans relance automatique, chaque lead oublié est un mandat perdu.",
                    },
                    {
                      icon: <Clock className="w-8 h-8 text-red-400/70" />,
                      stat: "30h+",
                      title: "perdues en administratif par mois",
                      desc: "Collecte de documents, relances manuelles, prises de rendez-vous par téléphone. Vos agents passent plus de temps à gérer qu'à vendre.",
                    },
                    {
                      icon: <Eye className="w-8 h-8 text-red-400/70" />,
                      stat: "0",
                      title: "suivi des prospects inactifs",
                      desc: "Pas de système de relance automatisé. Les prospects refroidis tombent dans l'oubli alors qu'un simple suivi pourrait les réactiver.",
                    },
                  ]).map((block, i) => (
                    <StaggerItem
                      key={`${vertical}-${i}`}
                      className="flex flex-col items-center group"
                    >
                      <div className="mb-4 opacity-60 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-300">
                        {block.icon}
                      </div>
                      <p className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight">
                        {block.stat}
                      </p>
                      <h3 className="text-lg font-bold text-white mb-3">
                        {block.title}
                      </h3>
                      <p className="text-base text-gray-400 font-medium leading-relaxed max-w-xs">
                        {block.desc}
                      </p>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </FadeInUp>
            </section>

            {/* ============================================ */}
            {/* INTÉGRATIONS — Grille de cards              */}
            {/* ============================================ */}
            <section className="py-20 bg-transparent relative z-10 px-6">
              <div className="max-w-6xl mx-auto">
                <FadeInUp className="text-center mb-10">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em] mb-3">
                    Intégrations
                  </p>
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                    Connecté à vos outils en quelques clics
                  </h2>
                  <p className="text-gray-500 font-medium text-sm">
                    {vertical === 'ecommerce' ? '+12 intégrations disponibles' : '+10 intégrations disponibles'}
                  </p>
                </FadeInUp>
                <IntegrationGrid vertical={vertical} />
                <div className="flex justify-center mt-10">
                  <LiveTicker vertical={vertical} />
                </div>
              </div>
            </section>

            {/* ============================================ */}
            {/* SECTION 3 — CE QUE FAIT ACTERO (Résultats)  */}
            {/* ============================================ */}
            <section className="py-24 md:py-32 bg-transparent px-6 relative z-10">
              <div className="max-w-6xl mx-auto">
                <FadeInUp className="text-center mb-20">
                  <p className={`text-xs font-bold uppercase tracking-[0.2em] mb-6 ${vertical === 'immobilier' ? 'text-violet-400/80' : 'text-emerald-400/80'}`}>
                    {vertical === 'ecommerce' ? 'Ce que vous récupérez' : 'Vos 3 agents IA'}
                  </p>
                  {vertical === 'ecommerce' ? (
                    <>
                      <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-white mb-6">
                        Quatre leviers concrets<br className="hidden md:block" />
                        pour reprendre le contrôle.
                      </h2>
                      <p className="text-lg text-gray-400 font-medium max-w-2xl mx-auto">
                        Pas des outils à configurer. Des résultats business déployés et mesurés pour vous.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-white mb-6">
                        Trois agents IA qui travaillent<br className="hidden md:block" />
                        pour votre agence 24h/24.
                      </h2>
                      <p className="text-lg text-gray-400 font-medium max-w-2xl mx-auto">
                        Chaque agent gère une tâche chronophage de votre quotidien. Vous vous concentrez sur la vente.
                      </p>
                    </>
                  )}
                </FadeInUp>

                <AgentCarousel
                  vertical={vertical}
                  agents={vertical === 'ecommerce' ? [
                    {
                      icon: <Headphones className="w-6 h-6" />,
                      iconColor: "text-emerald-400",
                      iconBg: "bg-emerald-500/10 border-emerald-500/20",
                      agentName: "SARA",
                      title: "Libérez votre équipe du support répétitif",
                      result: "80% des tickets résolus sans intervention humaine",
                      desc: "Un agent IA formé sur vos données prend en charge les demandes récurrentes : suivi de commande, retours, remboursements. Votre équipe se concentre enfin sur ce qui fait croître le business.",
                    },
                    {
                      icon: <RefreshCw className="w-6 h-6" />,
                      iconColor: "text-cyan-400",
                      iconBg: "bg-cyan-500/10 border-cyan-500/20",
                      agentName: "ALEX",
                      title: "Récupérez les ventes abandonnées",
                      result: "Jusqu'à +15% de taux de récupération paniers",
                      desc: "Des séquences de relance personnalisées par email et SMS, déclenchées au bon moment. L'IA adapte le message au profil et au comportement de chaque client.",
                    },
                    {
                      icon: <BarChart3 className="w-6 h-6" />,
                      iconColor: "text-amber-400",
                      iconBg: "bg-amber-500/10 border-amber-500/20",
                      agentName: "NOVA",
                      title: "Détectez les problèmes avant qu'ils ne coûtent",
                      result: "Alertes en temps réel sur vos KPIs critiques",
                      desc: "Actero surveille votre Shopify et Stripe en continu. Baisse de conversion, anomalie de stock, pic de tickets : vous êtes alerté avant que la marge ne s'évapore.",
                    },
                    {
                      icon: <Zap className="w-6 h-6" />,
                      iconColor: "text-violet-400",
                      iconBg: "bg-violet-500/10 border-violet-500/20",
                      agentName: "MAX",
                      title: "Éliminez les tâches manuelles qui freinent votre croissance",
                      result: "Vos process manuels transformés en flux automatiques",
                      desc: "Synchronisation CRM, tagging client, facturation, reporting. On identifie vos goulots d'étranglement opérationnels et on les supprime.",
                    },
                  ] : [
                    {
                      icon: <Calendar className="w-6 h-6" />,
                      iconColor: "text-violet-400",
                      iconBg: "bg-violet-500/10 border-violet-500/20",
                      agentName: "LÉA",
                      title: "Agent Prise de Rendez-vous",
                      result: "+30% de rendez-vous confirmés",
                      desc: "L'agent qualifie chaque prospect entrant (type de bien, budget, localisation), propose des créneaux disponibles et confirme automatiquement les rendez-vous. Synchronisation directe avec votre agenda.",
                    },
                    {
                      icon: <FileText className="w-6 h-6" />,
                      iconColor: "text-purple-400",
                      iconBg: "bg-purple-500/10 border-purple-500/20",
                      agentName: "DOC",
                      title: "Agent Collecte de Documents",
                      result: "-50% de temps administratif",
                      desc: "L'agent identifie les documents requis selon le type de transaction (vente, achat, location), envoie les demandes personnalisées et relance automatiquement jusqu'à réception complète du dossier.",
                    },
                    {
                      icon: <UserCheck className="w-6 h-6" />,
                      iconColor: "text-fuchsia-400",
                      iconBg: "bg-fuchsia-500/10 border-fuchsia-500/20",
                      agentName: "REX",
                      title: "Agent Relance Prospects",
                      result: "+10% de prospects réactivés",
                      desc: "L'agent détecte les prospects inactifs depuis 7, 14 ou 30 jours et envoie des relances progressives et personnalisées par email et SMS. Chaque message est adapté au profil et à l'historique du prospect.",
                    },
                  ]}
                />
              </div>
            </section>

            {/* ============================================ */}
            {/* SECTION — AGENT EN ACTION (Chat Mockup)      */}
            {/* ============================================ */}
            <section className="py-24 md:py-32 bg-transparent px-6 relative z-10">
              <div className="max-w-6xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <p className={`text-xs font-bold uppercase tracking-[0.2em] mb-4 ${vertical === 'immobilier' ? 'text-violet-400/80' : 'text-emerald-400/80'}`}>
                    En action 24h/24
                  </p>
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-4">
                    Votre agent IA répond<br className="hidden md:block" />
                    en quelques secondes.
                  </h2>
                  <p className="text-lg text-gray-400 font-medium max-w-xl mx-auto">
                    Chaque message est traité instantanément, 24h/24, 7j/7 — sans intervention humaine.
                  </p>
                </FadeInUp>
                <ChatMockup vertical={vertical} />
              </div>
            </section>

            {/* ============================================ */}
            {/* SECTION — BEFORE / AFTER                     */}
            {/* ============================================ */}
            {vertical === 'ecommerce' && <BeforeAfterSlider />}

            {/* ============================================ */}
            {/* SECTION 4 — COMMENT ÇA MARCHE               */}
            {/* ============================================ */}
            <section id="comment-ca-marche" className="py-24 md:py-32 bg-transparent px-6 relative overflow-hidden z-10">
              <div className="max-w-5xl mx-auto relative z-10">
                <FadeInUp className="text-center mb-20">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em] mb-6">
                    Déploiement
                  </p>
                  <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-white mb-6">
                    Opérationnel en 7 jours.<br className="hidden md:block" />
                    Vous ne touchez à rien.
                  </h2>
                  <p className="text-lg text-gray-400 font-medium max-w-2xl mx-auto">
                    {vertical === 'ecommerce'
                      ? "Pas de setup technique de votre côté. On audite, on déploie, on optimise. Vous validez les résultats."
                      : "On analyse votre agence, on déploie vos 3 agents IA, et on optimise en continu. Zéro compétence technique requise."
                    }
                  </p>
                </FadeInUp>

                <ProcessSteps vertical={vertical} onNavigate={onNavigate} />

                <FadeInUp delay={0.5} className="mt-10">
                  <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] rounded-[28px] p-8 md:p-10 border border-white/[0.08]">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Résultat</p>
                        <p className="text-xl md:text-2xl font-bold text-white leading-snug">
                          {vertical === 'ecommerce'
                            ? <>Un système qui tourne <span className="text-zinc-400">24h/24</span>, optimise vos marges en continu, <br className="hidden md:block" />piloté par un account manager dédié.</>
                            : <>3 agents IA qui travaillent <span className="text-zinc-400">24h/24</span> pour votre agence, <br className="hidden md:block" />pilotés par un account manager dédié.</>
                          }
                        </p>
                      </div>
                      <MagneticButton
                        onClick={() => onNavigate("/audit")}
                        className="flex-shrink-0 bg-white text-black px-8 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-200 transition-colors"
                      >
                        Réserver mon audit <ArrowRight className="w-4 h-4" />
                      </MagneticButton>
                    </div>
                  </div>
                </FadeInUp>
              </div>
            </section>

            {/* ============================================ */}
            {/* SECTION — TICKET REPLAY IA                   */}
            {/* ============================================ */}
            {vertical === 'ecommerce' && <TicketReplay />}

            {/* ============================================ */}
            {/* SECTION 5 — SIMULATEUR ROI                   */}
            {/* ============================================ */}
            {vertical === 'ecommerce' && <ROISimulator onNavigate={onNavigate} />}

            {/* ============================================ */}
            {/* SECTION 6 — PREUVES / RÉSULTATS              */}
            {/* ============================================ */}
            <section id="proof" className="py-24 bg-transparent px-6 relative z-10">
              <div className="max-w-6xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em] mb-6">
                    Résultats mesurés
                  </p>
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-6">
                    Des résultats concrets,<br className="hidden md:block" />
                    pas des promesses.
                  </h2>
                  <p className="text-lg text-gray-400 font-medium max-w-2xl mx-auto">
                    Chaque déploiement est suivi et optimisé. Voici ce que nos premiers clients constatent.
                  </p>
                </FadeInUp>

                {/* Metrics */}
                <FadeInUp className="mb-16">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 max-w-4xl mx-auto">
                    {(vertical === 'ecommerce' ? [
                      { value: 120, prefix: "+", suffix: "h", label: "Libérées par mois côté support", color: "text-white" },
                      { value: 15, prefix: "+", suffix: "%", label: "De revenus récupérés via relances", color: "text-emerald-400" },
                      { value: 80, prefix: "", suffix: "%", label: "Des demandes traitées sans humain", color: "text-white" },
                    ] : [
                      { value: 30, prefix: "+", suffix: "%", label: "De rendez-vous confirmés", color: "text-white" },
                      { value: 50, prefix: "-", suffix: "%", label: "De temps administratif", color: "text-violet-400" },
                      { value: 10, prefix: "+", suffix: "%", label: "De prospects réactivés", color: "text-white" },
                    ]).map((stat, i) => (
                      <div key={i} className={`flex flex-col items-center justify-center py-6 ${i < 2 ? "md:border-r border-white/5" : ""}`}>
                        <ScrollCounter
                          value={stat.value}
                          prefix={stat.prefix}
                          suffix={stat.suffix}
                          className={`text-6xl lg:text-[5rem] font-bold tracking-tighter ${stat.color} mb-2 leading-none`}
                        />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center">{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </FadeInUp>

                {/* Case Study */}
                <ScaleIn className="max-w-4xl mx-auto">
                  <div className="bg-[#030303] rounded-[32px] p-8 md:p-12 border border-white/10 shadow-xl relative overflow-hidden">
                    <div className="relative z-10">
                      {vertical === 'ecommerce' ? (
                        <>
                          <div className="flex items-center gap-3 mb-10">
                            <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-bold uppercase tracking-widest text-emerald-400 shadow-sm">Exemple de déploiement</div>
                            <span className="text-white font-bold">Marque e-commerce Beauté — Shopify</span>
                          </div>
                          <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="space-y-8">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Problème identifié</p>
                                <p className="text-xl font-bold text-white leading-tight">Support saturé (60+ tickets/jour) et taux d'abandon panier à 78%.</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Solution déployée</p>
                                <p className="text-base text-gray-300 font-medium leading-relaxed">Agent IA support N1 + séquences de relance personnalisées + dashboard de monitoring en temps réel.</p>
                              </div>
                              <div className="flex gap-12">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Avant</p>
                                  <p className="text-2xl font-bold text-gray-400 line-through">AOV 65 €</p>
                                </div>
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">Après 30 jours</p>
                                  <p className="text-3xl font-bold text-white tracking-tight">AOV 82 €</p>
                                </div>
                              </div>
                            </div>
                            <div className="bg-[#0a0a0a] rounded-3xl p-8 border border-white/5 shadow-sm text-center">
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Impact net en 30 jours</p>
                              <p className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-emerald-600 tracking-tighter mb-2">+ 12 400 €</p>
                              <p className="text-sm text-gray-500 font-medium mb-6">de revenus supplémentaires récupérés</p>
                              <button onClick={() => onNavigate("/audit")} className="text-sm font-bold text-white border-b-2 border-white/20 hover:border-white transition-colors pb-0.5 inline-flex items-center gap-1">
                                Obtenir le même résultat <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-3 mb-10">
                            <div className="px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full text-xs font-bold uppercase tracking-widest text-violet-400 shadow-sm">Exemple de déploiement</div>
                            <span className="text-white font-bold">Agence immobilière — Île-de-France</span>
                          </div>
                          <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="space-y-8">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Problème identifié</p>
                                <p className="text-xl font-bold text-white leading-tight">50% des leads non recontactés sous 24h, collecte documentaire manuelle, zéro relance systématique.</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Solution déployée</p>
                                <p className="text-base text-gray-300 font-medium leading-relaxed">3 agents IA : qualification + prise de RDV automatique, collecte documentaire intelligente, relance progressive des prospects inactifs.</p>
                              </div>
                              <div className="flex gap-12">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Avant</p>
                                  <p className="text-2xl font-bold text-gray-400 line-through">12 RDV/mois</p>
                                </div>
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-1">Après 30 jours</p>
                                  <p className="text-3xl font-bold text-white tracking-tight">19 RDV/mois</p>
                                </div>
                              </div>
                            </div>
                            <div className="bg-[#0a0a0a] rounded-3xl p-8 border border-white/5 shadow-sm text-center">
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Impact en 30 jours</p>
                              <p className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-violet-400 to-purple-600 tracking-tighter mb-2">+58%</p>
                              <p className="text-sm text-gray-500 font-medium mb-6">de rendez-vous qualifiés supplémentaires</p>
                              <button onClick={() => onNavigate("/audit")} className="text-sm font-bold text-white border-b-2 border-white/20 hover:border-white transition-colors pb-0.5 inline-flex items-center gap-1">
                                Obtenir le même résultat <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </ScaleIn>
              </div>
            </section>

            {/* ============================================ */}
            {/* SECTION 7 — DIFFÉRENCIATION / COMPARAISON    */}
            {/* ============================================ */}
            <section className="py-24 bg-transparent border-t border-white/[0.06] px-6 relative z-10">
              <div className="max-w-4xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em] mb-6">
                    Pourquoi Actero
                  </p>
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-6 leading-tight">
                    Pas un outil de plus à gérer.
                    <br />
                    <span className={`text-transparent bg-clip-text bg-gradient-to-r ${vertical === 'immobilier' ? 'from-violet-400 to-purple-400' : 'from-emerald-400 to-cyan-400'}`}>
                      {vertical === 'ecommerce' ? 'Votre équipe opérations IA, externalisée.' : 'Votre assistant digital, clé en main.'}
                    </span>
                  </h2>
                  <p className="text-lg text-gray-400 font-medium max-w-2xl mx-auto">
                    {vertical === 'ecommerce'
                      ? "Make et Zapier vous laissent tout construire seul. Actero audite, déploie, maintient et optimise — vous ne gérez rien."
                      : "Les CRM classiques vous laissent tout configurer seul. Actero déploie vos agents IA et les optimise — vous vous concentrez sur la vente."
                    }
                  </p>
                </FadeInUp>

                <SlideInLeft>
                <GlowCard color={vertical === 'immobilier' ? 'violet' : 'white'} glowSize={300} className="bg-[#0d0d0d] rounded-[32px] border border-white/[0.12] overflow-hidden">
                  <div className="grid grid-cols-2 border-b border-white/[0.10] bg-white/[0.06]">
                    <div className="p-6 md:p-8 border-r border-white/[0.10]">
                      <p className="text-lg font-bold tracking-tight text-gray-400 line-through">Outils en self-service</p>
                    </div>
                    <div className="p-6 md:p-8">
                      <p className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full animate-pulse ${vertical === 'immobilier' ? 'bg-violet-400' : 'bg-emerald-400'}`}></span>
                        Actero
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-white/[0.08]">
                    {(vertical === 'ecommerce' ? [
                      { old: "Vous construisez vos flux vous-même", new: "On déploie et on gère pour vous" },
                      { old: "Pas de stratégie, juste des connecteurs", new: "Audit + recommandation + exécution" },
                      { old: "Maintenance et debug à votre charge", new: "Monitoring et auto-réparation 24/7" },
                      { old: "Aucun suivi du retour sur investissement", new: "Dashboard ROI en temps réel" },
                      { old: "Support communautaire / docs", new: "Account manager dédié" },
                    ] : [
                      { old: "Relances manuelles par téléphone", new: "Relances automatiques multi-canal (email + SMS)" },
                      { old: "Collecte de documents par email/courrier", new: "Agent IA qui collecte et relance automatiquement" },
                      { old: "Prise de RDV manuelle", new: "Qualification + planification automatique" },
                      { old: "Aucun suivi des prospects inactifs", new: "Détection et réactivation intelligente" },
                      { old: "Pas de visibilité sur la performance", new: "Dashboard temps réel + account manager" },
                    ]).map((row, i) => (
                      <div key={i} className="grid grid-cols-2 group hover:bg-white/[0.04] transition-colors">
                        <div className="p-6 md:p-8 border-r border-white/[0.08] flex items-center">
                          <p className="text-[15px] font-medium text-gray-400">{row.old}</p>
                        </div>
                        <div className="p-6 md:p-8 flex items-center gap-3">
                          <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${vertical === 'immobilier' ? 'text-violet-400' : 'text-emerald-400'}`} />
                          <p className="text-[15px] font-bold text-white">{row.new}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlowCard>
                </SlideInLeft>
              </div>
            </section>

            {/* ============================================ */}
            {/* SECTION 8 — OFFRE PACKAGÉE                   */}
            {/* ============================================ */}
            <section className="py-24 md:py-32 bg-transparent px-6 relative z-10">
              <div className="max-w-5xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-6">
                    Le programme
                  </p>
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-6">
                    Un système conçu pour être<br className="hidden md:block" />
                    rentable dès le premier mois.
                  </h2>
                </FadeInUp>

                <FadeInUp delay={0.1}>
                  <div className="bg-[#0d0d0d] rounded-[32px] border border-white/[0.12] overflow-hidden relative">
                    {/* Glow */}
                    <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-[120px] pointer-events-none ${vertical === 'immobilier' ? 'bg-violet-500/10' : 'bg-emerald-500/10'}`}></div>

                    <div className="grid md:grid-cols-2 relative z-10">
                      {/* Left — Offer details */}
                      <div className="p-8 md:p-12 border-b md:border-b-0 md:border-r border-white/[0.10]">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-6 uppercase tracking-widest ${vertical === 'immobilier' ? 'bg-violet-500/10 border border-violet-500/20 text-violet-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}`}>
                          <Zap className="w-3.5 h-3.5" /> Done-for-you
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-3 tracking-tight">
                          {vertical === 'ecommerce' ? 'Programme Actero' : 'Programme Actero Immobilier'}
                        </h3>
                        <p className="text-gray-400 font-medium leading-relaxed mb-8">
                          {vertical === 'ecommerce'
                            ? "Un déploiement sur mesure, adapté à votre boutique, vos outils et vos objectifs de croissance. Pas de template. Pas de self-service."
                            : "Un déploiement sur mesure avec 3 agents IA configurés pour votre agence. Zéro setup technique. Résultats dès le premier mois."
                          }
                        </p>

                        <div className="space-y-4 mb-8">
                          {(vertical === 'ecommerce' ? [
                            "Audit complet de votre e-commerce",
                            "Agent IA support client niveau 1",
                            "Relances paniers abandonnés automatisées",
                            "Intégrations Shopify + CRM + support",
                            "Dashboard de performance en temps réel",
                            "Account manager dédié",
                            "Optimisation et reporting continus",
                            "Alertes WhatsApp & Slack en temps réel",
                          ] : [
                            "Audit complet de votre agence",
                            "Agent IA prise de rendez-vous",
                            "Agent IA collecte de documents",
                            "Agent IA relance de prospects",
                            "Intégrations CRM + Agenda + Email + SMS",
                            "Dashboard de performance en temps réel",
                            "Account manager dédié",
                            "Alertes WhatsApp & Slack en temps réel",
                          ]).map((feature, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${vertical === 'immobilier' ? 'text-violet-500' : 'text-emerald-500'}`} />
                              <span className="text-sm font-medium text-gray-300">{feature}</span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-6 border-t border-white/[0.10]">
                          <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">À partir de</span>
                          </div>
                          <div className="flex items-baseline gap-2 mb-3">
                            <span className={`text-4xl font-bold tracking-tight ${vertical === 'immobilier' ? 'text-violet-400' : 'text-emerald-400'}`}>800€</span>
                            <span className="text-gray-300 font-medium text-lg">/mois</span>
                            <span className="text-gray-500 text-sm font-medium">HT</span>
                          </div>
                          <p className="text-sm text-gray-400 font-medium">
                            {vertical === 'ecommerce'
                              ? "Tarif selon la taille de votre boutique et le périmètre. L'audit initial est gratuit et sans engagement."
                              : "Tarif selon la taille de votre agence et le nombre d'agents déployés. La démo est gratuite."
                            }
                          </p>
                        </div>
                      </div>

                      {/* Right — Pour qui + CTA */}
                      <div className="p-8 md:p-12 flex flex-col justify-between">
                        <div>
                          <h4 className="text-lg font-bold text-white mb-6">C'est fait pour vous si :</h4>
                          <div className="space-y-5 mb-10">
                            {(vertical === 'ecommerce' ? [
                              {
                                icon: <ShoppingCart className="w-5 h-5 text-emerald-400" />,
                                text: "Vous êtes sur Shopify avec +30K€/mois de CA"
                              },
                              {
                                icon: <Users className="w-5 h-5 text-cyan-400" />,
                                text: "Votre équipe support est débordée par des demandes répétitives"
                              },
                              {
                                icon: <TrendingDown className="w-5 h-5 text-amber-400" />,
                                text: "Vous perdez des ventes mais ne savez pas combien ni où"
                              },
                              {
                                icon: <Target className="w-5 h-5 text-violet-400" />,
                                text: "Vous voulez scaler votre CA sans multiplier vos coûts opérationnels"
                              },
                            ] : [
                              {
                                icon: <Building2 className="w-5 h-5 text-violet-400" />,
                                text: "Vous gérez une agence immobilière avec +5 agents"
                              },
                              {
                                icon: <Phone className="w-5 h-5 text-purple-400" />,
                                text: "Vos agents passent trop de temps en tâches administratives"
                              },
                              {
                                icon: <TrendingDown className="w-5 h-5 text-fuchsia-400" />,
                                text: "Vous perdez des prospects faute de suivi systématique"
                              },
                              {
                                icon: <Target className="w-5 h-5 text-violet-400" />,
                                text: "Vous voulez augmenter vos mandats sans recruter"
                              },
                            ]).map((item, i) => (
                              <div key={i} className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center flex-shrink-0 mt-0.5">
                                  {item.icon}
                                </div>
                                <p className="text-gray-300 font-medium leading-relaxed text-[15px]">{item.text}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <MagneticButton
                            onClick={() => onNavigate("/audit")}
                            className="w-full bg-white text-black px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors mb-4"
                          >
                            Réserver un audit gratuit <ArrowRight className="w-4 h-4" />
                          </MagneticButton>
                          <p className="text-center text-xs text-gray-500 font-medium">
                            15 minutes. Sans engagement. On vous dit exactement ce qu'on peut automatiser.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </FadeInUp>
              </div>
            </section>

            {/* ============================================ */}
            {/* SECTION 9 — FAQ                              */}
            {/* ============================================ */}
            <section id="faq" className="py-24 bg-transparent px-6 relative z-10">
              <div className="max-w-3xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white mb-4">Questions fréquentes</h2>
                  <p className="text-gray-400 font-medium">Tout ce que vous devez savoir avant de commencer.</p>
                </FadeInUp>
                <div className="space-y-4">
                  {(vertical === 'ecommerce' ? [
                    {
                      q: "Est-ce que je dois savoir coder ?",
                      a: "Non. Actero est 100% done-for-you. On configure, déploie et maintient tout. Vous n'avez aucune action technique à faire."
                    },
                    {
                      q: "Combien de temps pour voir les premiers résultats ?",
                      a: "Le déploiement prend 7 jours ouvrés. Les premiers résultats (tickets automatisés, premières relances) sont visibles dès la première semaine de mise en production."
                    },
                    {
                      q: "Est-ce que mes données sont sécurisées ?",
                      a: "Oui. Connexion via les protocoles OAuth officiels de Shopify. On ne stocke que le strict nécessaire. Vos données clients ne sont jamais partagées avec des tiers."
                    },
                    {
                      q: "Quel retour sur investissement attendre ?",
                      a: "Chaque déploiement est conçu pour être rentabilisé dès le premier mois. Le ROI exact dépend de votre volume de tickets et de votre taux d'abandon panier. L'audit gratuit vous donne une estimation précise avant de démarrer."
                    },
                    {
                      q: "Quels outils supportez-vous ?",
                      a: "Shopify, Klaviyo, Gorgias, Zendesk, Intercom, HubSpot, Stripe, Slack, et bien d'autres. Si votre outil n'est pas dans la liste, on trouve un moyen de le connecter."
                    },
                    {
                      q: "Quelle est la différence avec Make ou Zapier ?",
                      a: "Make et Zapier sont du self-service : vous construisez et maintenez tout vous-même. Actero est un service géré : audit, déploiement, maintenance et optimisation continue, avec un account manager dédié. Vous ne touchez à rien."
                    },
                    {
                      q: "Combien ça coûte ?",
                      a: "À partir de 800€/mois HT selon le périmètre d'automatisation. L'audit initial est gratuit et inclut une estimation du ROI attendu avant tout engagement."
                    },
                  ] : [
                    {
                      q: "Est-ce que mes agents doivent être formés ?",
                      a: "Non. Les agents IA sont déployés et configurés par notre équipe. Vos collaborateurs n'ont rien à installer ni à apprendre. Les agents IA travaillent en autonomie."
                    },
                    {
                      q: "Combien de temps pour voir les premiers résultats ?",
                      a: "Le déploiement prend 7 jours ouvrés. Dès la première semaine, l'agent RDV qualifie et planifie automatiquement, l'agent documents envoie ses premières demandes, et l'agent relance contacte vos prospects inactifs."
                    },
                    {
                      q: "Est-ce que les données de mes clients sont sécurisées ?",
                      a: "Oui. Les données sont hébergées en Europe, chiffrées et ne sont jamais partagées avec des tiers. Nos agents IA accèdent uniquement aux informations nécessaires via des connexions sécurisées."
                    },
                    {
                      q: "Quels CRM immobiliers sont compatibles ?",
                      a: "Nous nous connectons à la plupart des CRM du marché : HubSpot, Salesforce, et les CRM spécialisés immobilier. Si votre outil n'est pas dans la liste, on trouve un moyen de le connecter."
                    },
                    {
                      q: "Comment fonctionnent les relances automatiques ?",
                      a: "L'agent détecte les prospects inactifs (7, 14, 30 jours sans interaction) et envoie des messages progressifs par email et SMS. Chaque message est personnalisé selon le profil, le type de bien recherché et l'historique des échanges."
                    },
                    {
                      q: "L'agent peut-il gérer les documents pour les ventes ET les achats ?",
                      a: "Oui. L'agent adapte automatiquement la liste des documents requis selon le type de transaction : vente, achat ou location. Il gère aussi les cas particuliers (SCI, indivision, etc.)."
                    },
                    {
                      q: "Combien ça coûte ?",
                      a: "À partir de 800€/mois HT selon le périmètre d'automatisation. L'audit initial est gratuit et inclut une estimation du ROI attendu avant tout engagement."
                    },
                  ]).map((faq, i) => (
                    <div key={i} className="border border-white/[0.10] rounded-2xl bg-[#0a0a0a] overflow-hidden hover:border-white/[0.18] transition-colors">
                      <button onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)} className="w-full px-6 py-5 flex items-center justify-between text-left">
                        <span className="font-bold text-white text-lg pr-4">{faq.q}</span>
                        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${openFaqIndex === i ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {openFaqIndex === i && (
                          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="px-6 pb-6 overflow-hidden">
                            <p className="text-gray-400 leading-relaxed">{faq.a}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ============================================ */}
            {/* SECTION 10 — CTA FINAL                       */}
            {/* ============================================ */}
            <section className="py-24 md:py-32 bg-transparent px-6 relative z-10">
              <div className="max-w-4xl mx-auto">
                <FadeInUp>
                  <div className="relative bg-[#0d0d0d] rounded-[32px] p-10 md:p-16 border border-white/[0.14] overflow-hidden text-center">
                    {/* Glow */}
                    <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none ${vertical === 'immobilier' ? 'bg-violet-500/[0.12]' : 'bg-emerald-500/[0.12]'}`}></div>

                    <div className="relative z-10">
                      <div className="w-16 h-16 bg-white/[0.08] border border-white/[0.14] rounded-2xl flex items-center justify-center mx-auto mb-8">
                        <CalendarCheck className={`w-8 h-8 ${vertical === 'immobilier' ? 'text-violet-400' : 'text-emerald-400'}`} />
                      </div>

                      <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white mb-6">
                        {vertical === 'ecommerce'
                          ? <>Chaque jour qui passe,<br className="hidden md:block" />c'est du chiffre d'affaires en moins.</>
                          : <>Chaque prospect non relancé,<br className="hidden md:block" />c'est un mandat en moins.</>
                        }
                      </h2>

                      <p className="text-lg text-gray-300 font-medium max-w-2xl mx-auto mb-10 leading-relaxed">
                        {vertical === 'ecommerce'
                          ? "En 15 minutes, on analyse votre boutique et on vous montre exactement combien vous perdez — et ce qu'on peut récupérer pour vous."
                          : "En 15 minutes, on analyse votre agence et on vous montre exactement combien de prospects vous perdez — et ce que nos agents IA peuvent récupérer."
                        }
                      </p>

                      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                        <ButtonColorful onClick={() => onNavigate('/audit')}>
                          Réserver mon audit gratuit
                        </ButtonColorful>
                      </div>

                      <div className="flex items-center justify-center gap-6 text-sm text-gray-400 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Shield className="w-4 h-4" /> Sans engagement
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" /> 15 minutes
                        </span>
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> 100% gratuit
                        </span>
                      </div>
                    </div>
                  </div>
                </FadeInUp>
              </div>
            </section>

          </div>
        </main>

        <Footer onNavigate={onNavigate} />
      </div>
    </div>
    </>
  );
};
