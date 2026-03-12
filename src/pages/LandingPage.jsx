import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronDown, 
  Menu, 
  X, 
  Bot, 
  Zap, 
  Activity, 
  TrendingDown, 
  Clock, 
  BarChart2, 
  BrainCircuit, 
  ArrowRight, 
  ArrowUpRight, 
  Sparkles, 
  Search, 
  Lock, 
  CheckCircle2, 
  RefreshCw,
  Database,
  HelpCircle
} from 'lucide-react'
import { Logo } from '../components/layout/Logo'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import { GlassHero } from '../components/ui/glass-hero'
import { RevenueCalculator } from '../components/ui/revenue-calculator'
import { ArchitectureMap } from '../components/ui/architecture-map'
import { BeforeAfterSlider } from '../components/ui/before-after-slider'
import { AITeamBuilder } from '../components/ui/ai-team-builder'
import { ButtonColorful } from '../components/ui/button-colorful'
import { MagneticButton } from '../components/ui/magnetic-button'
import { AIAuditScannerModal } from '../components/landing/AIAuditScannerModal'
import { GptBadge } from '../components/ui/GptBadge'
import { ScrollCounter } from '../components/ui/ScrollCounter'
import { 
  FadeInUp, 
  StaggerContainer, 
  StaggerItem, 
  ScaleIn, 
  SlideInLeft 
} from '../components/ui/scroll-animations'
import { initAmplitude, trackEvent } from '../lib/analytics'
import { supabase } from '../lib/supabase'
import { callGemini } from '../lib/gemini'

export const LandingPage = ({ onNavigate }) => {
  // --- Helpers ---
  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // --- États pour l'interaction IA ---
  // eslint-disable-next-line no-unused-vars
  const [aiInput, setAiInput] = useState("");
  // eslint-disable-next-line no-unused-vars
  const [platform, setPlatform] = useState("Shopify");
  // eslint-disable-next-line no-unused-vars
  const [objective, setObjective] = useState("Conversion");
  // eslint-disable-next-line no-unused-vars
  const [aiLoading, setAiLoading] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [aiResult, setAiResult] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [aiError, setAiError] = useState("");

  // --- Modal AI Lead ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- États UI (FAQ & Modals) ---
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [isAuditScannerOpen, setIsAuditScannerOpen] = useState(false);
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- Initialiser Amplitude ---
  useEffect(() => {
    initAmplitude();
    trackEvent("Landing_Page_Viewed");
  }, []);

  // eslint-disable-next-line no-unused-vars
  const handleOpenModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (brandName.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(contactEmail))
      return;
    setIsSubmitting(true);

    try {
      if (supabase) {
        await supabase.from("leads").insert({
          brand_name: brandName.trim(),
          email: contactEmail.trim(),
          source: "landing_architecture",
        });
      }
    } catch (_err) {
      console.error("Erreur d'insertion lead", _err);
    }

    setIsSubmitting(false);
    setIsModalOpen(false);
    generateAIAudit();
  };

   
  const generateAIAudit = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    setAiError("");
    setAiResult(null);

    const fullPrompt = `Plateforme: ${platform}, Objectif: ${objective}. Problème e-commerce: "${aiInput}"

    Tu es un architecte système expert en automatisation e-commerce (n8n, Make, Shopify, Klaviyo, Stripe). Le prospect te décrit un problème opérationnel, une perte de temps ou une fuite de revenus. Ton rôle est d'analyser le problème et de proposer une solution d'automatisation élégante et haut de gamme. Ne parle pas de code, parle de flux de données et de résultats.
    Retourne UNIQUEMENT un JSON valide avec les propriétés suivantes:
    - diagnosis: Le diagnostic du problème (1 phrase courte et percutante)
    - solution: La logique de la solution d'automatisation proposée (ex: Déclencheur X -> Action Y avec l'outil Z)
    - timeSaved: Estimation réaliste du temps gagné (ex: '15h / mois')
    - revenueImpact: Impact métier (ex: '+12% de conversion sur les paniers abandonnés')`;

    try {
      const result = await callGemini(fullPrompt);
      if (result) {
        setAiResult(result);
      } else {
        throw new Error("Réponse vide de l'IA");
      }
    } catch (_err) {
      setAiError(
        "Le système d'analyse est actuellement très sollicité. Veuillez réessayer dans quelques instants.",
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#030303] font-sans text-white selection:bg-emerald-500/20 selection:text-white">
      {/* GLOBAL BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="/moody_landscape_bg.png"
          alt="Premium Moody Landscape Background"
          className="w-full h-full object-cover object-[center_70%] opacity-40 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#030303]/20 via-[#030303]/70 to-[#030303]/90"></div>
      </div>

      <div className="relative z-10 w-full">
        {/* NAVBAR */}
        <Navbar 
          onNavigate={onNavigate} 
          onOpenAuditScanner={() => setIsAuditScannerOpen(true)}
          scrollToId={scrollToId}
          isMegaMenuOpen={isMegaMenuOpen}
          setIsMegaMenuOpen={setIsMegaMenuOpen}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />

        <main>
          {/* HERO SECTION */}
          <GlassHero
            onNavigate={onNavigate}
            onOpenAuditScanner={() => setIsAuditScannerOpen(true)}
          />

          <div className="relative w-full z-10">
            {/* PROBLEM SECTION */}
            <section className="py-24 md:py-32 bg-transparent px-6 relative z-10">
              <FadeInUp className="max-w-5xl mx-auto text-center">
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-white mb-6">
                  Vous perdez déjà de l'argent.
                </h2>
                <p className="text-xl md:text-2xl text-gray-400 font-medium max-w-3xl mx-auto leading-relaxed mb-20">
                  Panier abandonné. Support saturé. Données inexploitées.
                  <br className="hidden md:block" />
                  Chaque jour sans automatisation vous coûte.
                </p>

                <StaggerContainer className="grid md:grid-cols-3 gap-12 lg:gap-16 text-center">
                  {[
                    {
                      icon: <TrendingDown className="w-8 h-8 text-gray-400" />,
                      title: "Perte de conversion",
                      desc: "Des relances génériques qui ne convertissent plus.",
                    },
                    {
                      icon: <Clock className="w-8 h-8 text-gray-400" />,
                      title: "Temps humain gaspillé",
                      desc: "Des heures perdues sur des tâches répétitives.",
                    },
                    {
                      icon: <BarChart2 className="w-8 h-8 text-gray-400" />,
                      title: "Décisions sans data",
                      desc: "Navigation à vue au lieu d'itérer sur la data.",
                    },
                  ].map((block, i) => (
                    <StaggerItem
                      key={i}
                      className="flex flex-col items-center group"
                    >
                      <div className="mb-6 opacity-60 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-300">
                        {block.icon}
                      </div>
                      <h3 className="text-xl font-bold text-white mb-3">
                        {block.title}
                      </h3>
                      <p className="text-base text-gray-400 font-medium leading-relaxed">
                        {block.desc}
                      </p>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </FadeInUp>
            </section>

            {/* LOGO MARQUEE */}
            <section className="py-16 bg-transparent relative z-10 overflow-hidden">
              <FadeInUp className="text-center mb-10">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em]">
                  Intégrations compatibles
                </p>
              </FadeInUp>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#030303] to-transparent z-10 pointer-events-none"></div>
                <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#030303] to-transparent z-10 pointer-events-none"></div>
                <div className="flex animate-marquee gap-16 items-center whitespace-nowrap">
                  {[...Array(2)].map((_, setIdx) => (
                    <React.Fragment key={setIdx}>
                      {[
                        { name: "Shopify", icon: "shopify", color: "95BF47" },
                        { name: "Stripe", icon: "stripe", color: "635BFF" },
                        { name: "Klaviyo", src: "/klaviyo.svg" },
                        { name: "Make", icon: "make", color: "5F4CFF" },
                        { name: "n8n", icon: "n8n", color: "FF6D5A" },
                        { name: "HubSpot", icon: "hubspot", color: "FF7A59" },
                        { name: "Zendesk", icon: "zendesk", color: "17494D" },
                        { name: "Slack", src: "/slack.svg" },
                        { name: "OpenAI", src: "/openai.svg" },
                        { name: "Intercom", icon: "intercom", color: "0058DD" },
                        { name: "Zapier", icon: "zapier", color: "FF4A00" },
                      ].map((tech, i) => (
                        <div
                          key={`${setIdx}-${i}`}
                          className="group flex items-center gap-3 text-xl md:text-2xl font-bold text-white/70 hover:text-white transition-all duration-500 select-none flex-shrink-0"
                        >
                          <img
                            src={tech.src ? tech.src : `https://cdn.simpleicons.org/${tech.icon}/${tech.color}`}
                            alt={tech.name}
                            className="w-10 h-10 md:w-12 md:h-12 object-contain group-hover:scale-110 transition-all duration-500 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
                            loading="lazy"
                          />
                          <span className="text-white font-bold">{tech.name}</span>
                        </div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </section>

            {/* BENTO GRID */}
            <section id="comment-ca-marche" className="py-32 bg-transparent px-6 relative overflow-hidden z-10">
              <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#0a0a0a] rounded-full blur-3xl opacity-50 -mr-40 -mt-40 pointer-events-none"></div>
              <div className="max-w-6xl mx-auto relative z-10">
                <FadeInUp className="text-center mb-20">
                  <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-white mb-6">
                    Et si votre boutique devenait autonome ?
                  </h2>
                  <p className="text-lg text-gray-400 font-medium max-w-2xl mx-auto">
                    3 étapes. Zéro code. Résultat garanti.
                  </p>
                </FadeInUp>

                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-5">
                  <FadeInUp delay={0.1} className="md:col-span-4 group">
                    <div className="relative bg-[#0a0a0a] rounded-[28px] p-8 md:p-10 border border-white/5 h-full overflow-hidden hover:border-white/15 transition-all duration-500">
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                          <Activity className="w-5 h-5 text-emerald-400" />
                          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Étape 01</span>
                        </div>
                        <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-tight">Analyse en continu</h3>
                        <p className="text-gray-400 font-medium leading-relaxed max-w-md text-base">
                          Actero se connecte à l'ensemble de votre stack (Shopify, CRM, Support) et surveille chaque interaction en temps réel.
                        </p>
                      </div>
                    </div>
                  </FadeInUp>

                  <FadeInUp delay={0.2} className="md:col-span-2 group">
                    <div className="relative bg-[#0a0a0a] rounded-[28px] p-8 border border-white/5 h-full overflow-hidden hover:border-white/15 transition-all duration-500">
                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-6">
                          <BrainCircuit className="w-5 h-5 text-amber-400" />
                          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Étape 02</span>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4 tracking-tight flex items-center flex-wrap gap-2">
                          Recommandation IA <GptBadge />
                        </h3>
                        <p className="text-gray-400 font-medium leading-relaxed text-base">
                          L'IA identifie le workflow exact qui augmentera vos marges.
                        </p>
                      </div>
                    </div>
                  </FadeInUp>

                  <FadeInUp delay={0.3} className="md:col-span-3 group">
                    <div className="relative bg-[#0a0a0a] rounded-[28px] p-8 md:p-10 border border-white/5 h-full overflow-hidden hover:border-white/15 transition-all duration-500">
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                          <Zap className="w-5 h-5 text-sky-400" />
                          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Étape 03</span>
                        </div>
                        <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-tight flex items-center flex-wrap gap-2">
                          Exécution instantanée <GptBadge />
                        </h3>
                        <p className="text-gray-400 font-medium leading-relaxed max-w-md text-base">
                          Validez en un clic. L'architecture technique se déploie sans aucun code.
                        </p>
                      </div>
                    </div>
                  </FadeInUp>

                  <FadeInUp delay={0.4} className="md:col-span-3 group">
                    <div className="relative bg-gradient-to-br from-white/5 to-white/[0.02] rounded-[28px] p-8 md:p-10 border border-white/10 h-full overflow-hidden hover:border-white/20 transition-all duration-500">
                      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
                        <div className="flex-1">
                          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Résultat</p>
                          <p className="text-xl md:text-2xl font-bold text-white leading-snug">
                            Un système autonome qui optimise vos marges <span className="text-zinc-400">24h/24</span>.
                          </p>
                        </div>
                        <MagneticButton
                          onClick={() => onNavigate("/audit")}
                          className="flex-shrink-0 bg-white text-black px-8 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-200 transition-colors"
                        >
                          Commencer <ArrowRight className="w-4 h-4" />
                        </MagneticButton>
                      </div>
                    </div>
                  </FadeInUp>
                </div>
              </div>
            </section>

            <RevenueCalculator />
            <ArchitectureMap />

            {/* IMPACT SECTION */}
            <section id="proof" className="py-24 bg-transparent px-6 relative z-10">
              <div className="max-w-6xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 max-w-4xl mx-auto">
                    {[
                      { value: 120, prefix: "+", suffix: "h", label: "Temps gagné / mois", color: "text-white" },
                      { value: 18, prefix: "+", suffix: "%", label: "Hausse Conversion", color: "text-zinc-300" },
                      { value: 100, prefix: "", suffix: "%", label: "Autonome", color: "text-white" },
                    ].map((stat, i) => (
                      <div key={i} className={`flex flex-col items-center justify-center py-6 ${i < 2 ? "md:border-r border-white/5" : ""}`}>
                        <ScrollCounter
                          value={stat.value}
                          prefix={stat.prefix}
                          suffix={stat.suffix}
                          className={`text-6xl lg:text-[5rem] font-bold tracking-tighter ${stat.color} mb-2 leading-none`}
                        />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </FadeInUp>

                <ScaleIn className="max-w-4xl mx-auto">
                  <div className="bg-[#030303] rounded-[32px] p-8 md:p-12 border border-white/10 shadow-xl relative overflow-hidden group">
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-10">
                        <div className="px-3 py-1 bg-[#0a0a0a] border border-white/5 rounded-full text-xs font-bold uppercase tracking-widest text-zinc-300 shadow-sm">Étude de Cas</div>
                        <span className="text-white font-bold">Marque DNVB (Beauté)</span>
                      </div>
                      <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-8">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Architecture déployée</p>
                            <p className="text-xl font-bold text-white leading-tight">Moteur de recommandation post-achat avec SMS dynamiques.</p>
                          </div>
                          <div className="flex gap-12">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">AOV Avant</p>
                              <p className="text-2xl font-bold text-gray-400 line-through">65 €</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">AOV Après</p>
                              <p className="text-3xl font-bold text-white tracking-tight">82 €</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-[#0a0a0a] rounded-3xl p-8 border border-white/5 shadow-sm text-center">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Revenus nets générés en 30j</p>
                          <p className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 to-emerald-700 tracking-tighter mb-6">+ 12 400 €</p>
                          <button onClick={() => onNavigate("/audit")} className="text-sm font-bold text-white border-b-2 border-transparent hover:border-gray-900 transition-colors pb-0.5 inline-flex items-center gap-1">
                            Je veux le même plan <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScaleIn>
              </div>
            </section>

            <BeforeAfterSlider />
            <AITeamBuilder onNavigate={onNavigate} />

            {/* COMPARISON SECTION */}
            <section className="py-24 bg-transparent border-t border-white/10 px-6 relative z-10">
              <div className="max-w-4xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-6 leading-tight">
                    Ce n'est pas un outil.
                    <br />
                    C'est une <span className="text-zinc-300">infrastructure.</span>
                  </h2>
                </FadeInUp>

                <SlideInLeft className="bg-[#0a0a0a] rounded-[32px] border border-white/10 overflow-hidden shadow-sm">
                  <div className="grid grid-cols-2 border-b border-white/5 bg-white/5">
                    <div className="p-6 md:p-8 border-r border-white/5">
                      <p className="text-lg font-bold tracking-tight text-gray-400 line-through">Make / Zapier</p>
                    </div>
                    <div className="p-6 md:p-8">
                      <p className="text-xl font-bold tracking-tight text-zinc-300 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse"></span>
                        Actero
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-white/5">
                    {[
                      { old: "Création manuelle des flux", new: "Déploiement Autonome piloté par l'IA" },
                      { old: "Focalisé sur la technique", new: "Focalisé sur le Business" },
                      { old: "Monitoring passif", new: "Auto-réparation Intelligente" },
                      { old: "Pas de mesure de ROI direct", new: "Impact financier mesuré en temps réel" },
                    ].map((row, i) => (
                      <div key={i} className="grid grid-cols-2 group hover:bg-white/5 transition-colors">
                        <div className="p-6 md:p-8 border-r border-white/5 flex items-center">
                          <p className="text-[15px] font-medium text-gray-400">{row.old}</p>
                        </div>
                        <div className="p-6 md:p-8 flex items-center">
                          <p className="text-[15px] font-bold text-white">{row.new}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </SlideInLeft>
              </div>
            </section>

            {/* FAQ SECTION */}
            <section id="faq" className="py-24 bg-transparent px-6 relative z-10">
              <div className="max-w-3xl mx-auto">
                <div className="text-center mb-16">
                  <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white mb-6">Questions fréquentes.</h2>
                </div>
                <div className="space-y-4">
                  {[
                    { q: "Est-ce que je dois savoir coder ?", a: "Absolument pas. Actero est une plateforme 'Done-for-you'." },
                    { q: "Combien de temps prend l'intégration ?", a: "Moins de 5 minutes pour connecter votre boutique." },
                    { q: "Est-ce sécurisé ?", a: "Nous utilisons les protocoles OAuth officiels et ne stockons que le strict nécessaire." },
                  ].map((faq, i) => (
                    <div key={i} className="border border-white/10 rounded-2xl bg-[#030303] overflow-hidden">
                      <button onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)} className="w-full px-6 py-5 flex items-center justify-between text-left">
                        <span className="font-bold text-white text-lg">{faq.q}</span>
                        <ChevronDown className={`w-5 h-5 transition-transform ${openFaqIndex === i ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {openFaqIndex === i && (
                          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="px-6 pb-6 overflow-hidden">
                            <p className="text-gray-400">{faq.a}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </main>

        <Footer onNavigate={onNavigate} />

        {/* Modal Lead IA */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => !isSubmitting && closeModal()}></div>
            <div className="relative bg-[#0a0a0a] rounded-2xl p-8 max-w-md w-full shadow-2xl z-10 border border-white/5">
              <h3 className="text-2xl font-bold text-white mb-4">Dernière étape</h3>
              <form onSubmit={handleModalSubmit} className="space-y-4">
                <input required value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Nom de votre marque" className="w-full bg-[#030303] border border-white/10 rounded-xl py-3 px-4 text-white" />
                <input required type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="Email pro" className="w-full bg-[#030303] border border-white/10 rounded-xl py-3 px-4 text-white" />
                <button type="submit" disabled={isSubmitting} className="w-full bg-white text-black py-3 rounded-xl font-bold">
                  {isSubmitting ? "Envoi..." : "Générer mon audit"}
                </button>
              </form>
            </div>
          </div>
        )}

        <AIAuditScannerModal isOpen={isAuditScannerOpen} onClose={() => setIsAuditScannerOpen(false)} onNavigate={onNavigate} />
      </div>
    </div>
  );
};
