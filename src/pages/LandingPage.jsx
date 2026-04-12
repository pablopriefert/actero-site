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
  Check,
  CheckCircle2,
  Users,
  Target,
  BarChart3,
  Headphones,
  RefreshCw,
  Eye,
  Shield,
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
import { ButtonColorful } from '../components/ui/button-colorful'
import { ScrollCounter } from '../components/ui/ScrollCounter'
import {
  FadeInUp,
  StaggerContainer,
  StaggerItem,
  ScaleIn,
  SlideInLeft
} from '../components/ui/scroll-animations'
import { initAmplitude, trackEvent } from '../lib/analytics'
import { TicketReplay } from '../components/landing/TicketReplay'
import { ROISimulator } from '../components/landing/ROISimulator'
import { AgentCarousel } from '../components/landing/AgentCarousel'
import { ChatMockup } from '../components/landing/ChatMockup'
import { IntegrationGrid } from '../components/landing/IntegrationGrid'
import { ProcessSteps } from '../components/landing/ProcessSteps'
import { StickyCTA } from '../components/ui/StickyCTA'
import { ReadingProgress } from '../components/ui/ReadingProgress'
import { Tilt3D } from '../components/ui/Tilt3D'

export const LandingPage = ({ onNavigate }) => {
  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const vertical = 'ecommerce';

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
      "description": "Agence IA specialisee dans l'automatisation pour e-commerce Shopify",
      "foundingDate": "2026",
      "founders": [
        { "@type": "Person", "name": "Pablo Priefert-Vallette" },
        { "@type": "Person", "name": "Gaspard Ain" }
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "email": "contact@actero.fr",
        "contactType": "sales"
      },
      "sameAs": [
        "https://www.linkedin.com/company/actero"
      ]
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
        title="Actero — Automatisation IA pour E-commerce Shopify"
        description="Actero deploie des agents IA autonomes pour automatiser le SAV e-commerce Shopify. ROI mesurable des le premier mois."
        keywords="agent IA e-commerce, automatisation Shopify, agent SAV IA, agence IA France"
        canonical="/"
        ogImage="https://actero.fr/og-image.png"
        schemaData={landingSchema}
      />
    <div className="relative min-h-screen bg-white font-sans text-[#262626]">
      <ReadingProgress vertical={vertical} />
      <StickyCTA onNavigate={onNavigate} vertical={vertical} />

      <div className="relative w-full">
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
          <GlassHero onNavigate={onNavigate} vertical={vertical} />

          <div className="relative w-full z-10">

            {/* ============================================ */}
            {/* SECTION 2 — LA DOULEUR                      */}
            {/* ============================================ */}
            <section className="py-24 md:py-32 bg-[#F9F7F1] px-6 relative z-10">
              <FadeInUp className="max-w-5xl mx-auto text-center">
                <p className="text-xs font-bold text-red-500 uppercase tracking-[0.2em] mb-6">
                  Ce que vous perdez chaque mois
                </p>
                {vertical === 'ecommerce' ? (
                  <>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-[#262626] mb-6">
                      Votre croissance est freinée<br className="hidden md:block" />
                      par des problèmes invisibles.
                    </h2>
                    <p className="text-xl md:text-2xl text-[#716D5C] font-medium max-w-3xl mx-auto leading-relaxed mb-20">
                      Des paniers abandonnés sans relance. Un support qui noie votre équipe.
                      <br className="hidden md:block" />
                      Des milliers d'euros qui s'évaporent chaque mois — sans que personne ne les chiffre.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-[#262626] mb-6">
                      Vos agents perdent du temps<br className="hidden md:block" />
                      sur des tâches à faible valeur.
                    </h2>
                    <p className="text-xl md:text-2xl text-[#716D5C] font-medium max-w-3xl mx-auto leading-relaxed mb-20">
                      Des prospects jamais relancés. Des documents collectés à la main.
                      <br className="hidden md:block" />
                      Des heures englouties en administratif au lieu de conclure des ventes.
                    </p>
                  </>
                )}

                <StaggerContainer className="grid md:grid-cols-3 gap-12 lg:gap-16 text-center">
                  {(vertical === 'ecommerce' ? [
                    {
                      icon: <ShoppingCart className="w-8 h-8 text-red-500" />,
                      statValue: 70, statSuffix: "%",
                      title: "des paniers jamais relancés",
                      desc: "7 acheteurs sur 10 abandonnent leur panier. Sans séquence de relance automatisée, chaque panier oublié est une vente en moins sur votre P&L.",
                    },
                    {
                      icon: <Clock className="w-8 h-8 text-red-500" />,
                      statValue: 40, statSuffix: "h+",
                      title: "englouties en support chaque mois",
                      desc: "\"Où est ma commande ?\", \"Je veux un remboursement.\" Votre équipe traite les mêmes demandes en boucle au lieu de faire croître le business.",
                    },
                    {
                      icon: <Eye className="w-8 h-8 text-red-500" />,
                      statValue: 0, statSuffix: "",
                      title: "visibilité sur vos fuites de marge",
                      desc: "Pas de tableau de bord consolidé. Vous ne savez pas combien vous perdez, ni où. Impossible d'optimiser ce qu'on ne mesure pas.",
                    },
                  ] : [
                    {
                      icon: <Phone className="w-8 h-8 text-red-500" />,
                      statValue: 60, statSuffix: "%",
                      title: "des prospects jamais rappelés",
                      desc: "Un prospect non recontacté dans les 24h a 6 fois moins de chances de signer. Sans relance automatique, chaque lead oublié est un mandat perdu.",
                    },
                    {
                      icon: <Clock className="w-8 h-8 text-red-500" />,
                      statValue: 30, statSuffix: "h+",
                      title: "perdues en administratif par mois",
                      desc: "Collecte de documents, relances manuelles, prises de rendez-vous par téléphone. Vos agents passent plus de temps à gérer qu'à vendre.",
                    },
                    {
                      icon: <Eye className="w-8 h-8 text-red-500" />,
                      statValue: 0, statSuffix: "",
                      title: "suivi des prospects inactifs",
                      desc: "Pas de système de relance automatisé. Les prospects refroidis tombent dans l'oubli alors qu'un simple suivi pourrait les réactiver.",
                    },
                  ]).map((block, i) => (
                    <StaggerItem
                      key={`${vertical}-${i}`}
                      className="flex flex-col items-center group"
                    >
                      <Tilt3D intensity={8} className="w-full">
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 flex flex-col items-center hover:border-gray-200 transition-colors duration-300">
                          <div className="mb-4 opacity-60 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-300">
                            {block.icon}
                          </div>
                          <p className="text-4xl md:text-5xl font-bold text-[#262626] mb-3 tracking-tight">
                            <ScrollCounter value={block.statValue} suffix={block.statSuffix} />
                          </p>
                          <h3 className="text-lg font-bold text-[#262626] mb-3">
                            {block.title}
                          </h3>
                          <p className="text-base text-[#716D5C] font-medium leading-relaxed max-w-xs">
                            {block.desc}
                          </p>
                        </div>
                      </Tilt3D>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </FadeInUp>
            </section>

            {/* ============================================ */}
            {/* INTÉGRATIONS — Grille de cards              */}
            {/* ============================================ */}
            <section className="py-20 bg-white relative z-10 px-6">
              <div className="max-w-6xl mx-auto">
                <FadeInUp className="text-center mb-10">
                  <p className="text-xs font-bold text-[#716D5C] uppercase tracking-[0.2em] mb-3">
                    Intégrations
                  </p>
                  <h2 className="text-2xl md:text-3xl font-bold text-[#262626] mb-2">
                    Connecté à vos outils en quelques clics
                  </h2>
                  <p className="text-[#716D5C] font-medium text-sm">
                    {vertical === 'ecommerce' ? '+12 intégrations disponibles' : '+10 intégrations disponibles'}
                  </p>
                </FadeInUp>
                <IntegrationGrid vertical={vertical} />
              </div>
            </section>

            {/* ============================================ */}
            {/* SECTION 3 — CE QUE FAIT ACTERO (Résultats)  */}
            {/* ============================================ */}
            <section className="py-24 md:py-32 bg-[#F9F7F1] px-6 relative z-10">
              <div className="max-w-6xl mx-auto">
                <FadeInUp className="text-center mb-20">
                  <p className={`text-xs font-bold uppercase tracking-[0.2em] mb-6 ${vertical === 'immobilier' ? 'text-[#003725]' : 'text-[#003725]'}`}>
                    {vertical === 'ecommerce' ? 'Ce que vous récupérez' : 'Vos 3 agents IA'}
                  </p>
                  {vertical === 'ecommerce' ? (
                    <>
                      <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-[#262626] mb-6">
                        Quatre leviers concrets<br className="hidden md:block" />
                        pour reprendre le contrôle.
                      </h2>
                      <p className="text-lg text-[#716D5C] font-medium max-w-2xl mx-auto">
                        Pas des outils à configurer. Des résultats business déployés et mesurés pour vous.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-[#262626] mb-6">
                        Trois agents IA qui travaillent<br className="hidden md:block" />
                        pour votre agence 24h/24.
                      </h2>
                      <p className="text-lg text-[#716D5C] font-medium max-w-2xl mx-auto">
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
                      iconColor: "text-[#003725]",
                      iconBg: "bg-[#F9F7F1] border-gray-200",
                      agentName: "SARA",
                      title: "Libérez votre équipe du support répétitif",
                      result: "80% des tickets résolus sans intervention humaine",
                      desc: "Un agent IA formé sur vos données prend en charge les demandes récurrentes : suivi de commande, retours, remboursements. Votre équipe se concentre enfin sur ce qui fait croître le business.",
                    },
                    {
                      icon: <RefreshCw className="w-6 h-6" />,
                      iconColor: "text-[#716D5C]",
                      iconBg: "bg-[#F9F7F1] border-gray-200",
                      agentName: "ALEX",
                      title: "Récupérez les ventes abandonnées",
                      result: "Jusqu'à +15% de taux de récupération paniers",
                      desc: "Des séquences de relance personnalisées par email et SMS, déclenchées au bon moment. L'IA adapte le message au profil et au comportement de chaque client.",
                    },
                    {
                      icon: <BarChart3 className="w-6 h-6" />,
                      iconColor: "text-[#716D5C]",
                      iconBg: "bg-[#F9F7F1] border-gray-200",
                      agentName: "NOVA",
                      title: "Détectez les problèmes avant qu'ils ne coûtent",
                      result: "Alertes en temps réel sur vos KPIs critiques",
                      desc: "Actero surveille votre Shopify et Stripe en continu. Baisse de conversion, anomalie de stock, pic de tickets : vous êtes alerté avant que la marge ne s'évapore.",
                    },
                    {
                      icon: <Zap className="w-6 h-6" />,
                      iconColor: "text-[#003725]",
                      iconBg: "bg-[#F9F7F1] border-gray-200",
                      agentName: "MAX",
                      title: "Éliminez les tâches manuelles qui freinent votre croissance",
                      result: "Vos process manuels transformés en flux automatiques",
                      desc: "Synchronisation CRM, tagging client, facturation, reporting. On identifie vos goulots d'étranglement opérationnels et on les supprime.",
                    },
                  ] : [
                    {
                      icon: <Calendar className="w-6 h-6" />,
                      iconColor: "text-[#003725]",
                      iconBg: "bg-[#F9F7F1] border-gray-200",
                      agentName: "LÉA",
                      title: "Agent Prise de Rendez-vous",
                      result: "+30% de rendez-vous confirmés",
                      desc: "L'agent qualifie chaque prospect entrant (type de bien, budget, localisation), propose des créneaux disponibles et confirme automatiquement les rendez-vous. Synchronisation directe avec votre agenda.",
                    },
                    {
                      icon: <FileText className="w-6 h-6" />,
                      iconColor: "text-[#716D5C]",
                      iconBg: "bg-[#F9F7F1] border-gray-200",
                      agentName: "DOC",
                      title: "Agent Collecte de Documents",
                      result: "-50% de temps administratif",
                      desc: "L'agent identifie les documents requis selon le type de transaction (vente, achat, location), envoie les demandes personnalisées et relance automatiquement jusqu'à réception complète du dossier.",
                    },
                    {
                      icon: <UserCheck className="w-6 h-6" />,
                      iconColor: "text-[#716D5C]",
                      iconBg: "bg-[#F9F7F1] border-gray-200",
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
            <section className="py-24 md:py-32 bg-white px-6 relative z-10">
              <div className="max-w-6xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <p className={`text-xs font-bold uppercase tracking-[0.2em] mb-4 ${vertical === 'immobilier' ? 'text-[#003725]' : 'text-[#003725]'}`}>
                    En action 24h/24
                  </p>
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-[#262626] mb-4">
                    Votre agent IA répond<br className="hidden md:block" />
                    en quelques secondes.
                  </h2>
                  <p className="text-lg text-[#716D5C] font-medium max-w-xl mx-auto">
                    Chaque message est traité instantanément, 24h/24, 7j/7 — sans intervention humaine.
                  </p>
                </FadeInUp>
                <ChatMockup vertical={vertical} />
              </div>
            </section>

            {/* ============================================ */}
            {/* SECTION — DARK GREEN BENTO (Avant/Après)     */}
            {/* ============================================ */}
            <section className="py-24 md:py-32 bg-[#003725] px-6 relative z-10">
              <div className="max-w-6xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                  {/* Left — Heading + body */}
                  <FadeInUp>
                    <p className="text-xs font-bold text-white/50 uppercase tracking-[0.2em] mb-6">
                      Transformation
                    </p>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-white mb-6 leading-[1.1]">
                      {vertical === 'ecommerce'
                        ? <>Avant vs Après Actero.</>
                        : <>Votre agence, transformée par l'IA.</>
                      }
                    </h2>
                    <p className="text-lg text-white/70 font-medium leading-relaxed max-w-lg">
                      {vertical === 'ecommerce'
                        ? "Des paniers abandonnés récupérés, un support automatisé, et un ROI visible dès le premier mois. Voici ce que nos clients constatent."
                        : "Des prospects qualifiés automatiquement, des documents collectés sans effort, et des relances qui tournent 24h/24."
                      }
                    </p>
                  </FadeInUp>

                  {/* Right — Bento grid of stat cards */}
                  <FadeInUp delay={0.15}>
                    <div className="grid grid-cols-2 gap-4">
                      {(vertical === 'ecommerce' ? [
                        { value: "< 30s", label: "Temps de réponse IA", bg: "bg-[#F9F7F1]", textColor: "text-[#003725]" },
                        { value: "12%", label: "Paniers récupérés", bg: "bg-[#0F5F35]", textColor: "text-white" },
                        { value: "82%", label: "Tickets résolus par l'IA", bg: "bg-[#0F5F35]", textColor: "text-white" },
                        { value: "+3 400€", label: "Gain mensuel moyen", bg: "bg-[#F9F7F1]", textColor: "text-[#003725]" },
                      ] : [
                        { value: "+30%", label: "Rendez-vous confirmés", bg: "bg-[#F9F7F1]", textColor: "text-[#003725]" },
                        { value: "-50%", label: "Temps administratif", bg: "bg-[#0F5F35]", textColor: "text-white" },
                        { value: "+10%", label: "Prospects réactivés", bg: "bg-[#0F5F35]", textColor: "text-white" },
                        { value: "24/7", label: "Agents IA actifs", bg: "bg-[#F9F7F1]", textColor: "text-[#003725]" },
                      ]).map((card, i) => (
                        <div key={i} className={`${card.bg} rounded-2xl p-6 md:p-8 flex flex-col justify-between min-h-[160px]`}>
                          <p className={`text-3xl md:text-4xl font-bold tracking-tight ${card.textColor}`}>{card.value}</p>
                          <p className={`text-sm font-medium mt-3 ${card.textColor === 'text-white' ? 'text-white/70' : 'text-[#716D5C]'}`}>{card.label}</p>
                        </div>
                      ))}
                    </div>
                  </FadeInUp>
                </div>
              </div>
            </section>

            {/* ============================================ */}
            {/* SECTION 4 — COMMENT ÇA MARCHE               */}
            {/* ============================================ */}
            <section id="comment-ca-marche" className="py-24 md:py-32 bg-white px-6 relative overflow-hidden z-10">
              <div className="max-w-5xl mx-auto relative z-10">
                <FadeInUp className="text-center mb-20">
                  <p className="text-xs font-bold text-[#716D5C] uppercase tracking-[0.2em] mb-6">
                    Déploiement
                  </p>
                  <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-[#262626] mb-6">
                    Opérationnel en 7 jours.<br className="hidden md:block" />
                    Vous ne touchez à rien.
                  </h2>
                  <p className="text-lg text-[#716D5C] font-medium max-w-2xl mx-auto">
                    {vertical === 'ecommerce'
                      ? "Pas de setup technique de votre côté. On audite, on déploie, on optimise. Vous validez les résultats."
                      : "On analyse votre agence, on déploie vos 3 agents IA, et on optimise en continu. Zéro compétence technique requise."
                    }
                  </p>
                </FadeInUp>

                <ProcessSteps vertical={vertical} onNavigate={onNavigate} />

                <FadeInUp delay={0.5} className="mt-10">
                  <div className="bg-[#F9F7F1] rounded-3xl p-8 md:p-10 border border-gray-200">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-[#716D5C] mb-2">Résultat</p>
                        <p className="text-xl md:text-2xl font-bold text-[#262626] leading-snug">
                          {vertical === 'ecommerce'
                            ? <>Un système qui tourne <span className="text-[#716D5C]">24h/24</span>, optimise vos marges en continu, <br className="hidden md:block" />piloté par un account manager dédié.</>
                            : <>3 agents IA qui travaillent <span className="text-[#716D5C]">24h/24</span> pour votre agence, <br className="hidden md:block" />pilotés par un account manager dédié.</>
                          }
                        </p>
                      </div>
                      <ButtonColorful
                        onClick={() => onNavigate("/signup?plan=pro")}
                        className="flex-shrink-0 flex items-center gap-2"
                      >
                        Essai gratuit 7 jours <ArrowRight className="w-4 h-4" />
                      </ButtonColorful>
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
            <section id="proof" className="py-24 bg-[#F9F7F1] px-6 relative z-10">
              <div className="max-w-6xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <p className="text-xs font-bold text-[#716D5C] uppercase tracking-[0.2em] mb-6">
                    Résultats mesurés
                  </p>
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-[#262626] mb-6">
                    Des résultats concrets,<br className="hidden md:block" />
                    pas des promesses.
                  </h2>
                  <p className="text-lg text-[#716D5C] font-medium max-w-2xl mx-auto">
                    Chaque déploiement est suivi et optimisé. Voici ce que nos premiers clients constatent.
                  </p>
                </FadeInUp>

                {/* Metrics */}
                <FadeInUp className="mb-16">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 max-w-4xl mx-auto">
                    {(vertical === 'ecommerce' ? [
                      { value: 120, prefix: "+", suffix: "h", label: "Libérées par mois côté support", color: "text-[#262626]" },
                      { value: 15, prefix: "+", suffix: "%", label: "De revenus récupérés via relances", color: "text-[#003725]" },
                      { value: 80, prefix: "", suffix: "%", label: "Des demandes traitées sans humain", color: "text-[#262626]" },
                    ] : [
                      { value: 30, prefix: "+", suffix: "%", label: "De rendez-vous confirmés", color: "text-[#262626]" },
                      { value: 50, prefix: "-", suffix: "%", label: "De temps administratif", color: "text-[#003725]" },
                      { value: 10, prefix: "+", suffix: "%", label: "De prospects réactivés", color: "text-[#262626]" },
                    ]).map((stat, i) => (
                      <div key={i} className={`flex flex-col items-center justify-center py-6 ${i < 2 ? "md:border-r border-gray-200" : ""}`}>
                        <ScrollCounter
                          value={stat.value}
                          prefix={stat.prefix}
                          suffix={stat.suffix}
                          className={`text-6xl lg:text-[5rem] font-bold tracking-tighter ${stat.color} mb-2 leading-none`}
                        />
                        <span className="text-xs font-bold text-[#716D5C] uppercase tracking-widest text-center">{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </FadeInUp>

                {/* Case Study */}
                <ScaleIn className="max-w-4xl mx-auto">
                  <div className="bg-white rounded-[32px] p-8 md:p-12 border border-gray-200 shadow-xl relative overflow-hidden">
                    <div className="relative z-10">
                      {vertical === 'ecommerce' ? (
                        <>
                          <div className="flex items-center gap-3 mb-10">
                            <div className="px-3 py-1 bg-[#F9F7F1] border border-gray-200 rounded-full text-xs font-bold uppercase tracking-widest text-[#716D5C]">Exemple de déploiement</div>
                            <span className="text-[#262626] font-bold">Marque e-commerce Beauté — Shopify</span>
                          </div>
                          <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="space-y-8">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-[#716D5C] mb-1">Problème identifié</p>
                                <p className="text-xl font-bold text-[#262626] leading-tight">Support saturé (60+ tickets/jour) et taux d'abandon panier à 78%.</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-[#716D5C] mb-1">Solution déployée</p>
                                <p className="text-base text-[#716D5C] font-medium leading-relaxed">Agent IA support N1 + séquences de relance personnalisées + dashboard de monitoring en temps réel.</p>
                              </div>
                              <div className="flex gap-12">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-[#716D5C] mb-1">Avant</p>
                                  <p className="text-2xl font-bold text-[#716D5C] line-through">AOV 65 €</p>
                                </div>
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-[#003725] mb-1">Après 30 jours</p>
                                  <p className="text-3xl font-bold text-[#262626] tracking-tight">AOV 82 €</p>
                                </div>
                              </div>
                            </div>
                            <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm text-center">
                              <p className="text-xs font-bold text-[#716D5C] uppercase tracking-widest mb-3">Impact net en 30 jours</p>
                              <p className="text-5xl font-bold text-[#003725] tracking-tighter mb-2">+ 12 400 €</p>
                              <p className="text-sm text-[#716D5C] font-medium mb-6">de revenus supplémentaires récupérés</p>
                              <button onClick={() => onNavigate("/signup?plan=pro")} className="text-sm font-bold text-[#262626] border-b-2 border-gray-300 hover:border-gray-900 transition-colors pb-0.5 inline-flex items-center gap-1">
                                Obtenir le même résultat <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-3 mb-10">
                            <div className="px-3 py-1 bg-[#F9F7F1] border border-gray-200 rounded-full text-xs font-bold uppercase tracking-widest text-[#716D5C]">Exemple de déploiement</div>
                            <span className="text-[#262626] font-bold">Agence immobilière — Île-de-France</span>
                          </div>
                          <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="space-y-8">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-[#716D5C] mb-1">Problème identifié</p>
                                <p className="text-xl font-bold text-[#262626] leading-tight">50% des leads non recontactés sous 24h, collecte documentaire manuelle, zéro relance systématique.</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-[#716D5C] mb-1">Solution déployée</p>
                                <p className="text-base text-[#716D5C] font-medium leading-relaxed">3 agents IA : qualification + prise de RDV automatique, collecte documentaire intelligente, relance progressive des prospects inactifs.</p>
                              </div>
                              <div className="flex gap-12">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-[#716D5C] mb-1">Avant</p>
                                  <p className="text-2xl font-bold text-[#716D5C] line-through">12 RDV/mois</p>
                                </div>
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-[#003725] mb-1">Après 30 jours</p>
                                  <p className="text-3xl font-bold text-[#262626] tracking-tight">19 RDV/mois</p>
                                </div>
                              </div>
                            </div>
                            <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm text-center">
                              <p className="text-xs font-bold text-[#716D5C] uppercase tracking-widest mb-3">Impact en 30 jours</p>
                              <p className="text-5xl font-bold text-[#003725] tracking-tighter mb-2">+58%</p>
                              <p className="text-sm text-[#716D5C] font-medium mb-6">de rendez-vous qualifiés supplémentaires</p>
                              <button onClick={() => onNavigate("/signup?plan=pro")} className="text-sm font-bold text-[#262626] border-b-2 border-gray-300 hover:border-gray-900 transition-colors pb-0.5 inline-flex items-center gap-1">
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
            <section className="py-24 bg-white px-6 relative z-10">
              <div className="max-w-4xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <p className="text-xs font-bold text-[#716D5C] uppercase tracking-[0.2em] mb-6">
                    Pourquoi Actero
                  </p>
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-[#262626] mb-6 leading-tight">
                    Pas un outil de plus à gérer.
                    <br />
                    <span className="text-[#003725]">
                      {vertical === 'ecommerce' ? 'Votre équipe opérations IA, externalisée.' : 'Votre assistant digital, clé en main.'}
                    </span>
                  </h2>
                  <p className="text-lg text-[#716D5C] font-medium max-w-2xl mx-auto">
                    {vertical === 'ecommerce'
                      ? "Make et Zapier vous laissent tout construire seul. Actero audite, déploie, maintient et optimise — vous ne gérez rien."
                      : "Les CRM classiques vous laissent tout configurer seul. Actero déploie vos agents IA et les optimise — vous vous concentrez sur la vente."
                    }
                  </p>
                </FadeInUp>

                <SlideInLeft>
                <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
                  <div className="grid grid-cols-2 border-b border-gray-200 bg-[#F9F7F1]">
                    <div className="p-6 md:p-8 border-r border-gray-200">
                      <p className="text-lg font-bold tracking-tight text-[#716D5C] line-through">Outils en self-service</p>
                    </div>
                    <div className="p-6 md:p-8">
                      <p className="text-xl font-bold tracking-tight text-[#262626] flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full animate-pulse bg-[#0F5F35]"></span>
                        Actero
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-gray-200">
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
                      <div key={i} className="grid grid-cols-2 group hover:bg-[#F9F7F1] transition-colors">
                        <div className="p-6 md:p-8 border-r border-gray-200 flex items-center">
                          <p className="text-[15px] font-medium text-[#716D5C]">{row.old}</p>
                        </div>
                        <div className="p-6 md:p-8 flex items-center gap-3">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#003725]" />
                          <p className="text-[15px] font-bold text-[#262626]">{row.new}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                </SlideInLeft>
              </div>
            </section>

            {/* ============================================ */}
            {/* SECTION 8 — OFFRE PACKAGÉE                   */}
            {/* ============================================ */}
            <section className="py-24 md:py-32 bg-white px-6 relative z-10">
              <div className="max-w-5xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <p className="text-xs font-bold text-[#716D5C] uppercase tracking-[0.2em] mb-6">
                    Le programme
                  </p>
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-[#262626] mb-6">
                    Un système conçu pour être<br className="hidden md:block" />
                    rentable dès le premier mois.
                  </h2>
                </FadeInUp>

                <FadeInUp delay={0.1}>
                  <div className="bg-white rounded-3xl overflow-hidden relative border border-gray-200">

                    <div className="grid md:grid-cols-2 relative z-10">
                      {/* Left — Offer details */}
                      <div className="p-8 md:p-12 border-b md:border-b-0 md:border-r border-gray-200">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-6 uppercase tracking-widest bg-[#F9F7F1] border border-gray-200 text-[#716D5C]">
                          <Zap className="w-3.5 h-3.5" /> Done-for-you
                        </div>
                        <h3 className="text-3xl font-bold text-[#262626] mb-3 tracking-tight">
                          {vertical === 'ecommerce' ? 'Programme Actero' : 'Programme Actero Immobilier'}
                        </h3>
                        <p className="text-[#716D5C] font-medium leading-relaxed mb-8">
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
                              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-[#003725]" />
                              <span className="text-sm font-medium text-[#716D5C]">{feature}</span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-6 border-t border-gray-200">
                          <div className="flex items-baseline gap-2 mb-3">
                            <span className="text-4xl font-bold tracking-tight text-[#003725]">A partir de 99€/mois</span>
                          </div>
                          <p className="text-sm text-[#716D5C] font-medium">
                            {vertical === 'ecommerce'
                              ? "Plan Free gratuit. Starter 99€/mois, Pro 399€/mois. Essai 7 jours sans engagement."
                              : "Plan Free gratuit. Starter 99€/mois, Pro 399€/mois. Essai 7 jours sans engagement."
                            }
                          </p>
                        </div>
                      </div>

                      {/* Right — Pour qui + CTA */}
                      <div className="p-8 md:p-12 flex flex-col justify-between">
                        <div>
                          <h4 className="text-lg font-bold text-[#262626] mb-6">C'est fait pour vous si :</h4>
                          <div className="space-y-5 mb-10">
                            {(vertical === 'ecommerce' ? [
                              {
                                icon: <ShoppingCart className="w-5 h-5 text-[#003725]" />,
                                text: "Vous êtes sur Shopify avec +30K€/mois de CA"
                              },
                              {
                                icon: <Users className="w-5 h-5 text-[#716D5C]" />,
                                text: "Votre équipe support est débordée par des demandes répétitives"
                              },
                              {
                                icon: <TrendingDown className="w-5 h-5 text-[#716D5C]" />,
                                text: "Vous perdez des ventes mais ne savez pas combien ni où"
                              },
                              {
                                icon: <Target className="w-5 h-5 text-[#003725]" />,
                                text: "Vous voulez scaler votre CA sans multiplier vos coûts opérationnels"
                              },
                            ] : [
                              {
                                icon: <Building2 className="w-5 h-5 text-[#003725]" />,
                                text: "Vous gérez une agence immobilière avec +5 agents"
                              },
                              {
                                icon: <Phone className="w-5 h-5 text-[#716D5C]" />,
                                text: "Vos agents passent trop de temps en tâches administratives"
                              },
                              {
                                icon: <TrendingDown className="w-5 h-5 text-[#716D5C]" />,
                                text: "Vous perdez des prospects faute de suivi systématique"
                              },
                              {
                                icon: <Target className="w-5 h-5 text-[#003725]" />,
                                text: "Vous voulez augmenter vos mandats sans recruter"
                              },
                            ]).map((item, i) => (
                              <div key={i} className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  {item.icon}
                                </div>
                                <p className="text-[#716D5C] font-medium leading-relaxed text-[15px]">{item.text}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <ButtonColorful
                            onClick={() => onNavigate("/signup?plan=pro")}
                            className="w-full flex items-center justify-center gap-2 mb-4"
                          >
                            Essai gratuit 7 jours <ArrowRight className="w-4 h-4" />
                          </ButtonColorful>
                          <p className="text-center text-xs text-[#716D5C] font-medium">
                            Sans engagement. Annulez a tout moment.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </FadeInUp>
              </div>
            </section>

            {/* ============================================ */}
            {/* SECTION — PRICING                            */}
            {/* ============================================ */}
            <section id="pricing" className="py-20 px-4 bg-white">
              <div className="max-w-6xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold text-center text-[#1a1a1a] mb-4">
                  Des prix simples et transparents
                </h2>
                <p className="text-center text-[#71717a] text-lg mb-12 max-w-xl mx-auto">
                  Commencez gratuitement, upgradez quand vous grandissez.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* Free card */}
                  <div className="bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 flex flex-col">
                    <h3 className="text-lg font-bold text-[#1a1a1a]">Free</h3>
                    <p className="text-[12px] text-[#71717a] mb-3">Decouvrir sans engagement</p>
                    <div className="text-3xl font-bold text-[#1a1a1a] mb-4">0€<span className="text-sm font-normal text-[#71717a]">/mois</span></div>
                    <ul className="space-y-1.5 flex-1 mb-4">
                      <li className="flex items-center gap-1.5 text-[12px] text-[#1a1a1a]"><Check className="w-3.5 h-3.5 text-[#0F5F35]" />50 tickets / mois</li>
                      <li className="flex items-center gap-1.5 text-[12px] text-[#1a1a1a]"><Check className="w-3.5 h-3.5 text-[#0F5F35]" />Integration Shopify</li>
                      <li className="flex items-center gap-1.5 text-[12px] text-[#1a1a1a]"><Check className="w-3.5 h-3.5 text-[#0F5F35]" />Dashboard ROI basique</li>
                    </ul>
                    <a href="/signup?plan=free" className="block text-center py-2.5 rounded-full text-[13px] font-semibold bg-[#0F5F35]/10 text-[#0F5F35] hover:bg-[#0F5F35]/20 transition">
                      Commencer gratuitement
                    </a>
                  </div>

                  {/* Starter card */}
                  <div className="bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 flex flex-col">
                    <h3 className="text-lg font-bold text-[#1a1a1a]">Starter</h3>
                    <p className="text-[12px] text-[#71717a] mb-3">Automatiser les premieres taches</p>
                    <div className="text-3xl font-bold text-[#1a1a1a] mb-1">99€<span className="text-sm font-normal text-[#71717a]">/mois</span></div>
                    <p className="text-[11px] text-[#0F5F35] font-semibold mb-4">7 jours d'essai gratuit</p>
                    <ul className="space-y-1.5 flex-1 mb-4">
                      <li className="flex items-center gap-1.5 text-[12px] text-[#1a1a1a]"><Check className="w-3.5 h-3.5 text-[#0F5F35]" />1 000 tickets / mois</li>
                      <li className="flex items-center gap-1.5 text-[12px] text-[#1a1a1a]"><Check className="w-3.5 h-3.5 text-[#0F5F35]" />5 agents IA specialises</li>
                      <li className="flex items-center gap-1.5 text-[12px] text-[#1a1a1a]"><Check className="w-3.5 h-3.5 text-[#0F5F35]" />Editeur ton de marque</li>
                      <li className="flex items-center gap-1.5 text-[12px] text-[#1a1a1a]"><Check className="w-3.5 h-3.5 text-[#0F5F35]" />Support email 48h</li>
                    </ul>
                    <a href="/signup?plan=starter" className="block text-center py-2.5 rounded-full text-[13px] font-semibold bg-[#0F5F35]/10 text-[#0F5F35] hover:bg-[#0F5F35]/20 transition">
                      Essai gratuit 7 jours
                    </a>
                  </div>

                  {/* Pro card — highlighted */}
                  <div className="relative bg-white rounded-2xl border-2 border-[#0F5F35] shadow-lg p-5 flex flex-col">
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0F5F35] text-white text-[10px] font-bold px-3 py-1 rounded-full">Recommande</span>
                    <h3 className="text-lg font-bold text-[#1a1a1a]">Pro</h3>
                    <p className="text-[12px] text-[#71717a] mb-3">Automatisation complete + vocal</p>
                    <div className="text-3xl font-bold text-[#1a1a1a] mb-1">399€<span className="text-sm font-normal text-[#71717a]">/mois</span></div>
                    <p className="text-[11px] text-[#0F5F35] font-semibold mb-4">7 jours d'essai gratuit</p>
                    <ul className="space-y-1.5 flex-1 mb-4">
                      <li className="flex items-center gap-1.5 text-[12px] text-[#1a1a1a]"><Check className="w-3.5 h-3.5 text-[#0F5F35]" />5 000 tickets / mois</li>
                      <li className="flex items-center gap-1.5 text-[12px] text-[#1a1a1a]"><Check className="w-3.5 h-3.5 text-[#0F5F35]" />Agent vocal (200 min)</li>
                      <li className="flex items-center gap-1.5 text-[12px] text-[#1a1a1a]"><Check className="w-3.5 h-3.5 text-[#0F5F35]" />Agent WhatsApp</li>
                      <li className="flex items-center gap-1.5 text-[12px] text-[#1a1a1a]"><Check className="w-3.5 h-3.5 text-[#0F5F35]" />Simulateur + API</li>
                      <li className="flex items-center gap-1.5 text-[12px] text-[#1a1a1a]"><Check className="w-3.5 h-3.5 text-[#0F5F35]" />Support prioritaire 24h</li>
                    </ul>
                    <a href="/signup?plan=pro" className="block text-center py-2.5 rounded-full text-[13px] font-semibold bg-[#0F5F35] text-white hover:bg-[#003725] transition">
                      Essai gratuit 7 jours
                    </a>
                  </div>

                  {/* Enterprise card */}
                  <div className="bg-[#fafafa] rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 flex flex-col">
                    <h3 className="text-lg font-bold text-[#1a1a1a]">Enterprise</h3>
                    <p className="text-[12px] text-[#71717a] mb-3">Sur mesure grands comptes</p>
                    <div className="text-3xl font-bold text-[#1a1a1a] mb-4">Sur devis</div>
                    <ul className="space-y-1.5 flex-1 mb-4">
                      <li className="flex items-center gap-1.5 text-[12px] text-[#1a1a1a]"><Check className="w-3.5 h-3.5 text-[#0F5F35]" />Tickets illimites</li>
                      <li className="flex items-center gap-1.5 text-[12px] text-[#1a1a1a]"><Check className="w-3.5 h-3.5 text-[#0F5F35]" />Multi-boutiques (10)</li>
                      <li className="flex items-center gap-1.5 text-[12px] text-[#1a1a1a]"><Check className="w-3.5 h-3.5 text-[#0F5F35]" />White-label + SLA 99,9%</li>
                      <li className="flex items-center gap-1.5 text-[12px] text-[#1a1a1a]"><Check className="w-3.5 h-3.5 text-[#0F5F35]" />Account manager dedie</li>
                    </ul>
                    <a href="mailto:contact@actero.fr" className="block text-center py-2.5 rounded-full text-[13px] font-semibold border border-[#f0f0f0] text-[#1a1a1a] hover:bg-white transition">
                      Contacter l'equipe
                    </a>
                  </div>
                </div>

                <p className="text-center text-[13px] text-[#71717a] mt-8">
                  Tous les plans incluent l'integration Shopify native. <a href="/tarifs" className="text-[#0F5F35] font-semibold hover:underline">Voir le comparatif complet →</a>
                </p>
              </div>
            </section>

            {/* ============================================ */}
            {/* SECTION 9 — FAQ                              */}
            {/* ============================================ */}
            <section id="faq" className="py-24 bg-white px-6 relative z-10">
              <div className="max-w-3xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-[#262626] mb-4" style={{ fontFamily: 'Georgia, serif' }}>Questions fréquentes</h2>
                  <p className="text-[#716D5C] font-medium text-lg">Tout ce que vous devez savoir avant de commencer.</p>
                </FadeInUp>
                <div className="divide-y divide-gray-200">
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
                      a: "Actero propose 4 plans : Free (0€), Starter (99€/mois), Pro (399€/mois) et Enterprise (sur devis). Essai gratuit de 7 jours sur Starter et Pro. -20% en facturation annuelle."
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
                      a: "Tarif sur devis, adapté à votre périmètre d'automatisation. L'audit initial est gratuit et inclut une estimation du ROI attendu avant tout engagement."
                    },
                  ]).map((faq, i) => (
                    <div key={i} className="py-6">
                      <button onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)} className="w-full flex items-center justify-between text-left group">
                        <span className={`font-semibold text-lg pr-4 transition-colors ${openFaqIndex === i ? 'text-[#262626]' : 'text-[#262626]'}`}>{faq.q}</span>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${openFaqIndex === i ? 'bg-[#003725] text-white' : 'bg-[#F9F7F1] text-[#716D5C] group-hover:bg-[#003725]/10'}`}>
                          <span className="text-xl font-light leading-none">{openFaqIndex === i ? '−' : '+'}</span>
                        </div>
                      </button>
                      <AnimatePresence>
                        {openFaqIndex === i && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                            <p className="text-[#716D5C] leading-relaxed pt-4 pr-14">{faq.a}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ============================================ */}
            {/* SECTION — YELLOW CTA (Onboarding Steps)      */}
            {/* ============================================ */}
            <section className="py-16 md:py-20 px-6 relative z-10">
              <div className="max-w-5xl mx-auto">
                <FadeInUp>
                  <div className="bg-[#FFF389] rounded-3xl p-10 md:p-16 overflow-hidden">
                    <div className="text-center mb-12">
                      <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-[#003725] mb-4" style={{ fontFamily: 'Georgia, serif' }}>
                        Opérationnel en 48 heures.
                      </h2>
                      <p className="text-[#003725]/70 font-medium text-lg max-w-xl mx-auto">
                        Du paiement au dashboard live. Zéro setup de votre côté.
                      </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 md:gap-12 mb-12">
                      {[
                        { num: "01", title: "Paiement sécurisé", desc: "Stripe Checkout. Paiement par carte ou PayPal en 2 minutes." },
                        { num: "02", title: "Connexion outils", desc: "Un clic pour connecter Shopify et vos outils. Installation OAuth automatique." },
                        { num: "03", title: "IA en production", desc: "Vos agents IA sont déployés et configurés. Dashboard live en 24-48h." },
                      ].map((step, i) => (
                        <div key={i} className="text-center md:text-left">
                          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mx-auto md:mx-0 mb-4">
                            <span className="text-sm font-bold text-[#003725]">{step.num}</span>
                          </div>
                          <h3 className="text-xl font-bold text-[#003725] mb-2" style={{ fontFamily: 'Georgia, serif' }}>{step.title}</h3>
                          <p className="text-[#003725]/70 font-medium text-sm leading-relaxed">{step.desc}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                      <button
                        onClick={() => onNavigate('/tarifs')}
                        className="text-sm font-semibold text-[#003725] underline underline-offset-4 decoration-[#003725]/40 hover:decoration-[#003725] transition-colors"
                      >
                        Voir les tarifs
                      </button>
                      <ButtonColorful onClick={() => onNavigate('/signup?plan=pro')}>
                        Essai gratuit 7 jours
                      </ButtonColorful>
                    </div>
                  </div>
                </FadeInUp>
              </div>
            </section>

            {/* ============================================ */}
            {/* SECTION 10 — CTA FINAL (Dark Green)          */}
            {/* ============================================ */}
            <section className="py-24 md:py-32 bg-[#003725] px-6 relative z-10">
              <div className="max-w-4xl mx-auto text-center">
                <FadeInUp>
                  <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-white mb-6 leading-[1.1]" style={{ fontFamily: 'Georgia, serif' }}>
                    {vertical === 'ecommerce'
                      ? <>Chaque jour qui passe, c'est du chiffre d'affaires en moins.</>
                      : <>Chaque prospect non relancé, c'est un mandat en moins.</>
                    }
                  </h2>

                  <p className="text-lg text-white/70 font-medium max-w-2xl mx-auto mb-10 leading-relaxed">
                    {vertical === 'ecommerce'
                      ? "En 15 minutes, on analyse votre boutique et on vous montre exactement combien vous perdez — et ce qu'on peut récupérer pour vous."
                      : "En 15 minutes, on analyse votre agence et on vous montre exactement combien de prospects vous perdez — et ce que nos agents IA peuvent récupérer."
                    }
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                    <button
                      onClick={() => onNavigate('/signup?plan=pro')}
                      className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-white text-[#003725] font-semibold text-[15px] hover:bg-[#F9F7F1] transition-colors gap-2"
                    >
                      Essai gratuit 7 jours
                    </button>
                    <button
                      onClick={() => onNavigate('/tarifs')}
                      className="inline-flex items-center justify-center h-12 px-8 rounded-full border border-white/30 text-white font-semibold text-[15px] hover:bg-white/10 transition-colors gap-2"
                    >
                      Voir les tarifs
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-6 text-sm text-white/60 font-medium">
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
