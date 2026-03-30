import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Share2,
  Handshake,
  Gift,
  ShoppingCart,
  Building2,
  Headphones,
  X,
  ChevronDown,
  CheckCircle2,
  Zap,
  BarChart3,
  Clock,
  Shield,
  ArrowRight,
  Send,
  UserPlus,
  Users,
  DollarSign,
  TrendingUp,
  Award,
  Star,
} from 'lucide-react'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import {
  FadeInUp,
  StaggerContainer,
  StaggerItem,
  ScaleIn,
} from '../components/ui/scroll-animations'
import { SEO } from '../components/SEO'

export const AmbassadorLandingPage = ({ onNavigate }) => {
  const [openFaqIndex, setOpenFaqIndex] = useState(null)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    network_type: '',
    message: '',
  })
  const [formLoading, setFormLoading] = useState(false)
  const [formSuccess, setFormSuccess] = useState(false)
  const [formError, setFormError] = useState('')
  const [rules, setRules] = useState({
    role: false,
    promises: false,
    payment: false,
    refusal: false,
    abuse: false,
    accept: false,
  })
  const allRulesAccepted = Object.values(rules).every(Boolean)

  const scrollToId = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  const handleFormChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const res = await fetch('/api/ambassador/apply.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Une erreur est survenue.')
        return
      }
      setFormSuccess(true)
    } catch (_err) {
      setFormError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setFormLoading(false)
    }
  }

  const steps = [
    {
      icon: Share2,
      title: 'Recommandez',
      desc: 'Vous partagez Actero à une entreprise de votre réseau via votre lien unique.',
    },
    {
      icon: Handshake,
      title: 'On s’occupe de tout',
      desc: 'Notre équipe gère l’audit, la démo et la vente. Vous n’avez rien à faire.',
    },
    {
      icon: Gift,
      title: 'Vous êtes récompensé',
      desc: 'Si l’entreprise devient cliente et paie, vous touchez votre récompense 30 jours après.',
    },
  ]

  const targets = [
    {
      icon: ShoppingCart,
      title: 'Boutiques e-commerce Shopify',
      desc: 'SAV automatisé, relance de paniers abandonnés, support client 24/7.',
    },
    {
      icon: Building2,
      title: 'Agences immobilières',
      desc: 'Qualification de leads, prise de RDV automatique, relance intelligente.',
    },
    {
      icon: Headphones,
      title: 'Entreprises avec gros volume SAV/leads',
      desc: 'Traitement automatique des demandes entrantes, routing intelligent, reporting.',
    },
  ]

  const notToDo = [
    'Pas de vente à faire',
    'Pas de closing',
    'Pas de démo technique',
    'Pas de compétence requise',
    'Pas de suivi commercial',
  ]

  const whyActero = [
    { icon: Zap, label: 'Spécialisé IA + automatisation' },
    { icon: BarChart3, label: 'ROI mesurable en temps réel' },
    { icon: Clock, label: '+50h économisées/mois pour nos clients' },
    { icon: Shield, label: 'Infrastructure production-ready' },
  ]

  const socialProofStats = [
    { icon: Users, value: '20+', label: 'Ambassadeurs actifs' },
    { icon: DollarSign, value: '15 000  €+', label: 'Commissions versées' },
    { icon: TrendingUp, value: '94%', label: 'Taux de satisfaction' },
    { icon: Award, value: '30j', label: 'Délai de paiement' },
  ]

  const faqItems = [
    {
      q: 'Comment suis-je payé ?',
      a: 'Virement bancaire ou crédit, 30 jours après le paiement effectif du client.',
    },
    {
      q: 'Quand suis-je payé ?',
      a: '30 jours après l’encaissement effectif du client. Ce délai couvre la période de rétractation.',
    },
    {
      q: 'Faut-il être freelance ou avoir un SIRET ?',
      a: 'Non, ce n’est pas obligatoire pour commencer. Nous adapterons les modalités selon votre situation.',
    },
    {
      q: 'Faut-il vendre Actero ?',
      a: 'Non, vous faites juste une mise en relation. Notre équipe s’occupe de tout le processus commercial.',
    },
    {
      q: 'Comment le lead est attribué ?',
      a: 'Via votre code ou lien unique, ou par attribution manuelle validée par Actero.',
    },
    {
      q: 'Que se passe-t-il si le client ne paie pas ?',
      a: 'Aucune commission n’est due. La récompense est conditionnée au paiement effectif du client.',
    },
    {
      q: 'Combien de prospects puis-je recommander ?',
      a: 'Il n’y a aucune limite. Plus vous recommandez, plus vous gagnez.',
    },
    {
      q: 'Comment suivre mes recommandations ?',
      a: 'Vous disposez d’un tableau de bord dédié où vous suivez en temps réel le statut de chaque lead et commission.',
    },
    {
      q: 'Que se passe-t-il en cas de doublon ?',
      a: 'Règle du premier arrivé : le premier ambassadeur ayant soumis le lead est retenu.',
    },
  ]

  return (
    <>
      <SEO
        title="Programme Ambassadeur Actero | Recommandez, soyez recompense"
        description="Devenez ambassadeur Actero et touchez une commission par client recommande. Zero effort commercial, on s'occupe de tout."
        canonical="/ambassadeurs"
      />
    <div className="relative min-h-screen bg-white font-sans text-[#262626] selection:bg-[#003725]/15 selection:text-[#262626]">
      {/* BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#F9F7F1] to-white" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#003725]/3 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-[#003725]/2 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full">
        <Navbar onNavigate={onNavigate} onAuditOpen={() => onNavigate('/audit')} />

        <main>
          {/* ═══════════════════════════════════════════ */}
          {/* HERO                                       */}
          {/* ═══════════════════════════════════════════ */}
          <section className="pt-36 pb-24 md:pt-44 md:pb-32 px-6">
            <FadeInUp className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F9F7F1] border border-gray-200 text-[#003725] text-xs font-bold uppercase tracking-widest mb-8">
                <UserPlus className="w-3.5 h-3.5" />
                Programme Ambassadeur
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter mb-6 leading-[1.05]">
                Recommandez,{' '}
                <span className="text-[#003725]">
                  soyez récompensé
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-[#716D5C] font-medium max-w-2xl mx-auto leading-relaxed mb-4">
                Partagez Actero à votre réseau professionnel. Quand votre contact devient client, vous touchez une récompense.
              </p>
              <p className="text-base text-[#716D5C] max-w-xl mx-auto leading-relaxed mb-12">
                Zéro effort commercial. On s’occupe de tout. Vous gagnez.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => scrollToId('candidature')}
                  className="px-8 py-4 bg-[#0F5F35] hover:bg-[#003725] text-white font-bold rounded-full text-lg transition-all hover:scale-105 shadow-lg shadow-[#003725]/15"
                >
                  Devenir ambassadeur
                </button>
                <button
                  onClick={() => onNavigate('/ambassador/login')}
                  className="px-8 py-4 bg-gray-50 hover:bg-gray-50 text-[#262626] font-bold rounded-full text-lg transition-all border border-gray-200"
                >
                  Déjà ambassadeur ? Connectez-vous
                </button>
              </div>
            </FadeInUp>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SOCIAL PROOF                               */}
          {/* ═══════════════════════════════════════════ */}
          <section className="pb-16 px-6">
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {socialProofStats.map((stat, i) => (
                  <ScaleIn key={i} delay={i * 0.1}>
                    <div className="text-center p-6 rounded-2xl bg-gray-50 border border-gray-200">
                      <div className="w-10 h-10 rounded-xl bg-[#003725]/10 flex items-center justify-center mx-auto mb-3">
                        <stat.icon className="w-5 h-5 text-[#003725]" />
                      </div>
                      <p className="text-2xl font-bold text-[#262626] mb-1">{stat.value}</p>
                      <p className="text-xs text-[#716D5C] font-medium">{stat.label}</p>
                    </div>
                  </ScaleIn>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* COMMENT ÇA MARCHE                          */}
          {/* ═══════════════════════════════════════════ */}
          <section className="py-24 md:py-32 px-6">
            <FadeInUp className="max-w-5xl mx-auto text-center mb-16">
              <p className="text-xs font-bold text-[#003725]/80 uppercase tracking-[0.2em] mb-4">
                Comment ça marche
              </p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter">
                3 étapes, c’est tout.
              </h2>
            </FadeInUp>
            <StaggerContainer className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
              {steps.map((step, i) => (
                <StaggerItem key={i}>
                  <div className="relative p-8 rounded-3xl bg-[#F9F7F1] border border-gray-200 hover:border-[#003725]/20 transition-all group">
                    <div className="absolute -top-4 -left-2 w-10 h-10 rounded-full bg-emerald-500 text-[#262626] flex items-center justify-center font-bold text-base shadow-lg shadow-[#003725]/15">
                      {i + 1}
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-[#003725]/10 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                      <step.icon className="w-7 h-7 text-[#003725]" />
                    </div>
                    <h3 className="text-xl font-bold text-[#262626] mb-3">{step.title}</h3>
                    <p className="text-[#716D5C] font-medium leading-relaxed">{step.desc}</p>
                    {i < steps.length - 1 && (
                      <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                        <ArrowRight className="w-5 h-5 text-emerald-500/30" />
                      </div>
                    )}
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* QUI PEUT ÊTRE RECOMMANDÉ                   */}
          {/* ═══════════════════════════════════════════ */}
          <section className="py-24 md:py-32 px-6 bg-[#F9F7F1]">
            <FadeInUp className="max-w-5xl mx-auto text-center mb-16">
              <p className="text-xs font-bold text-[#003725]/80 uppercase tracking-[0.2em] mb-4">
                Qui peut être recommandé
              </p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter">
                Les profils idéaux
              </h2>
            </FadeInUp>
            <StaggerContainer className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
              {targets.map((t, i) => (
                <StaggerItem key={i}>
                  <div className="p-8 rounded-3xl bg-[#F9F7F1] border border-gray-200 hover:border-cyan-500/30 transition-all h-full">
                    <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6">
                      <t.icon className="w-7 h-7 text-[#003725]" />
                    </div>
                    <h3 className="text-xl font-bold text-[#262626] mb-3">{t.title}</h3>
                    <p className="text-[#716D5C] font-medium leading-relaxed">{t.desc}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* CE QUE VOUS POUVEZ GAGNER                  */}
          {/* ═══════════════════════════════════════════ */}
          <section className="py-24 md:py-32 px-6">
            <FadeInUp className="max-w-3xl mx-auto text-center">
              <p className="text-xs font-bold text-[#003725]/80 uppercase tracking-[0.2em] mb-4">
                Ce que vous pouvez gagner
              </p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-6">
                Une récompense pour chaque client signé grâce à vous
              </h2>
              <p className="text-xl text-[#716D5C] font-medium leading-relaxed mb-10">
                Plus vous recommandez, plus vous gagnez. Les récompenses augmentent à partir du 3e client.
              </p>
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="p-8 rounded-3xl bg-[#F9F7F1] border border-gray-200 text-center">
                  <p className="text-xs font-bold text-[#003725]/60 uppercase tracking-widest mb-3">1er et 2e client</p>
                  <p className="text-5xl font-bold text-[#003725] mb-2">150€</p>
                  <p className="text-sm text-[#716D5C] font-medium">par client signé</p>
                </div>
                <div className="p-8 rounded-3xl bg-[#F9F7F1] border border-gray-200 text-center relative overflow-hidden">
                  <div className="absolute top-3 right-3 px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-full text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">Bonus</div>
                  <p className="text-xs font-bold text-[#716D5C]/60 uppercase tracking-widest mb-3">À partir du 3e client</p>
                  <p className="text-5xl font-bold text-[#716D5C] mb-2">300€</p>
                  <p className="text-sm text-[#716D5C] font-medium">par client signé</p>
                </div>
              </div>
              <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100 text-center">
                <p className="text-sm text-[#716D5C] font-medium">
                  Versée <span className="text-[#262626] font-bold">30 jours</span> après le paiement effectif du client. Aucune limite de recommandations.
                </p>
              </div>
            </FadeInUp>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* CE QUE VOUS N'AVEZ PAS À FAIRE             */}
          {/* ═══════════════════════════════════════════ */}
          <section className="py-24 md:py-32 px-6 bg-[#F9F7F1]">
            <FadeInUp className="max-w-3xl mx-auto text-center mb-12">
              <p className="text-xs font-bold text-red-400/80 uppercase tracking-[0.2em] mb-4">
                Ce que vous n’avez pas à faire
              </p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter">
                Zéro effort commercial
              </h2>
            </FadeInUp>
            <StaggerContainer className="max-w-2xl mx-auto space-y-4">
              {notToDo.map((item, i) => (
                <StaggerItem key={i}>
                  <div className="flex items-center gap-4 p-5 rounded-2xl bg-[#F9F7F1] border border-gray-200">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                      <X className="w-5 h-5 text-red-400" />
                    </div>
                    <span className="text-lg font-bold text-[#262626]">{item}</span>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* POURQUOI ACTERO                            */}
          {/* ═══════════════════════════════════════════ */}
          <section className="py-24 md:py-32 px-6">
            <FadeInUp className="max-w-5xl mx-auto text-center mb-16">
              <p className="text-xs font-bold text-[#003725]/80 uppercase tracking-[0.2em] mb-4">
                Pourquoi Actero
              </p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter">
                Une solution qui se vend toute seule
              </h2>
            </FadeInUp>
            <StaggerContainer className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-6">
              {whyActero.map((item, i) => (
                <StaggerItem key={i}>
                  <div className="flex items-center gap-5 p-6 rounded-2xl bg-[#F9F7F1] border border-gray-200">
                    <div className="w-12 h-12 rounded-xl bg-[#003725]/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-6 h-6 text-[#003725]" />
                    </div>
                    <span className="text-lg font-bold text-[#262626]">{item.label}</span>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* FAQ                                        */}
          {/* ═══════════════════════════════════════════ */}
          <section className="py-24 md:py-32 px-6 bg-[#F9F7F1]">
            <FadeInUp className="max-w-3xl mx-auto">
              <div className="text-center mb-16">
                <p className="text-xs font-bold text-[#003725]/80 uppercase tracking-[0.2em] mb-4">
                  Questions fréquentes
                </p>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter">FAQ</h2>
              </div>
              <div className="space-y-3">
                {faqItems.map((faq, i) => (
                  <div
                    key={i}
                    className="rounded-2xl bg-[#F9F7F1] border border-gray-200 overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                      className="w-full flex items-center justify-between p-6 text-left"
                    >
                      <span className="text-lg font-bold text-[#262626] pr-4">{faq.q}</span>
                      <ChevronDown
                        className={`w-5 h-5 text-[#716D5C] flex-shrink-0 transition-transform duration-300 ${
                          openFaqIndex === i ? 'rotate-180' : ''
                        }`}
                      />
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
                          <p className="px-6 pb-6 text-[#716D5C] font-medium leading-relaxed">
                            {faq.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </FadeInUp>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* FORMULAIRE DE CANDIDATURE                  */}
          {/* ═══════════════════════════════════════════ */}
          <section id="candidature" className="py-24 md:py-32 px-6">
            <FadeInUp className="max-w-2xl mx-auto">
              <div className="text-center mb-12">
                <p className="text-xs font-bold text-[#003725]/80 uppercase tracking-[0.2em] mb-4">
                  Rejoignez le programme
                </p>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">
                  Candidature
                </h2>
                <p className="text-[#716D5C] font-medium">
                  Remplissez le formulaire ci-dessous. Nous reviendrons vers vous rapidement.
                </p>
              </div>

              {formSuccess ? (
                <ScaleIn>
                  <div className="p-10 rounded-3xl bg-[#F9F7F1] border border-[#003725]/20 text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="w-8 h-8 text-[#003725]" />
                    </div>
                    <h3 className="text-2xl font-bold text-[#262626] mb-3">
                      Candidature envoyée !
                    </h3>
                    <p className="text-[#716D5C] font-medium">
                      Merci pour votre intérêt. Notre équipe vous contactera très bientôt.
                    </p>
                  </div>
                </ScaleIn>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="p-8 md:p-10 rounded-3xl bg-[#F9F7F1] border border-gray-200 space-y-6"
                >
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-[#716D5C] mb-2">
                        Prénom <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        name="first_name"
                        required
                        value={formData.first_name}
                        onChange={handleFormChange}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[#262626] placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                        placeholder="Jean"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#716D5C] mb-2">
                        Nom <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        name="last_name"
                        required
                        value={formData.last_name}
                        onChange={handleFormChange}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[#262626] placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                        placeholder="Dupont"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#716D5C] mb-2">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleFormChange}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[#262626] placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                      placeholder="jean@exemple.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#716D5C] mb-2">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleFormChange}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[#262626] placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                      placeholder="+33 6 12 34 56 78"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#716D5C] mb-2">
                      Type de réseau
                    </label>
                    <select
                      name="network_type"
                      value={formData.network_type}
                      onChange={handleFormChange}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[#262626] focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all appearance-none"
                    >
                      <option value="" className="bg-[#F9F7F1]">Sélectionner</option>
                      <option value="e_commerce" className="bg-[#F9F7F1]">E-commerce</option>
                      <option value="immobilier" className="bg-[#F9F7F1]">Immobilier</option>
                      <option value="tech" className="bg-[#F9F7F1]">Tech</option>
                      <option value="finance" className="bg-[#F9F7F1]">Finance</option>
                      <option value="autre" className="bg-[#F9F7F1]">Autre</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#716D5C] mb-2">
                      Message (optionnel)
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleFormChange}
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[#262626] placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all resize-none"
                      placeholder="Parlez-nous de votre réseau..."
                    />
                  </div>

                  {/* Validation des règles */}
                  <div className="space-y-3 p-4 bg-gray-50 border border-gray-100 rounded-xl">
                    <p className="text-sm font-bold text-[#262626] mb-3">Validation des règles du programme</p>
                    {[
                      { key: 'role', text: "Je comprends que mon rôle est uniquement de recommander Actero, pas de vendre ni de closer." },
                      { key: 'promises', text: "Je comprends que je ne peux faire aucune promesse au nom d\u2019Actero, ni annoncer des prix ou des résultats non validés." },
                      { key: 'payment', text: "Je comprends qu\u2019une récompense est versée uniquement si le client signe, paie effectivement, et 30 jours après l\u2019encaissement." },
                      { key: 'refusal', text: "Je comprends qu\u2019un lead peut être refusé s\u2019il est non qualifié, abusif, ou déjà connu d\u2019Actero." },
                      { key: 'abuse', text: "Je comprends que tout abus, spam ou comportement nuisible peut entraîner la désactivation de mon compte." },
                      { key: 'accept', text: "J\u2019accepte les règles du programme ambassadeur Actero." },
                    ].map(({ key, text }) => (
                      <label key={key} className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={rules[key]}
                          onChange={() => setRules(prev => ({ ...prev, [key]: !prev[key] }))}
                          className="mt-0.5 w-4 h-4 rounded border-white/20 bg-gray-50 text-emerald-500 focus:ring-emerald-500/30 accent-emerald-500 flex-shrink-0"
                        />
                        <span className={`text-xs leading-relaxed transition-colors ${rules[key] ? 'text-[#716D5C]' : 'text-[#716D5C] group-hover:text-[#716D5C]'}`}>{text}</span>
                      </label>
                    ))}
                  </div>

                  {formError && (
                    <div className="p-3 bg-red-500/10 text-red-400 text-sm font-medium rounded-xl border border-red-500/20 text-center">
                      {formError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={formLoading || !allRulesAccepted}
                    className={`w-full py-4 font-bold rounded-xl text-lg transition-all flex items-center justify-center gap-3 ${allRulesAccepted ? 'bg-[#0F5F35] hover:bg-[#003725] text-white' : 'bg-gray-50 text-[#716D5C] cursor-not-allowed'}`}
                  >
                    {formLoading ? (
                      <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Envoyer ma candidature
                      </>
                    )}
                  </button>

                  <p className="text-center text-xs text-[#716D5C]">
                    En soumettant ce formulaire, vous acceptez d’être contacté par l'équipe Actero.
                  </p>
                </form>
              )}
            </FadeInUp>
          </section>
        </main>

        <Footer onNavigate={onNavigate} />
      </div>
    </div>
    </>
  )
}
