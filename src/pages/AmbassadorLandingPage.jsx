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
      setFormError('Une erreur est survenue. Veuillez r\u00e9essayer.')
    } finally {
      setFormLoading(false)
    }
  }

  const steps = [
    {
      icon: Share2,
      title: 'Recommandez',
      desc: 'Vous partagez Actero \u00e0 une entreprise de votre r\u00e9seau via votre lien unique.',
    },
    {
      icon: Handshake,
      title: 'On s\u2019occupe de tout',
      desc: 'Notre \u00e9quipe g\u00e8re l\u2019audit, la d\u00e9mo et la vente. Vous n\u2019avez rien \u00e0 faire.',
    },
    {
      icon: Gift,
      title: 'Vous \u00eates r\u00e9compens\u00e9',
      desc: 'Si l\u2019entreprise devient cliente et paie, vous touchez votre r\u00e9compense 30 jours apr\u00e8s.',
    },
  ]

  const targets = [
    {
      icon: ShoppingCart,
      title: 'Boutiques e-commerce Shopify',
      desc: 'SAV automatis\u00e9, relance de paniers abandonn\u00e9s, support client 24/7.',
    },
    {
      icon: Building2,
      title: 'Agences immobili\u00e8res',
      desc: 'Qualification de leads, prise de RDV automatique, relance intelligente.',
    },
    {
      icon: Headphones,
      title: 'Entreprises avec gros volume SAV/leads',
      desc: 'Traitement automatique des demandes entrantes, routing intelligent, reporting.',
    },
  ]

  const notToDo = [
    'Pas de vente \u00e0 faire',
    'Pas de closing',
    'Pas de d\u00e9mo technique',
    'Pas de comp\u00e9tence requise',
    'Pas de suivi commercial',
  ]

  const whyActero = [
    { icon: Zap, label: 'Sp\u00e9cialis\u00e9 IA + automatisation' },
    { icon: BarChart3, label: 'ROI mesurable en temps r\u00e9el' },
    { icon: Clock, label: '+50h \u00e9conomis\u00e9es/mois pour nos clients' },
    { icon: Shield, label: 'Infrastructure production-ready' },
  ]

  const socialProofStats = [
    { icon: Users, value: '20+', label: 'Ambassadeurs actifs' },
    { icon: DollarSign, value: '15 000\u00a0\u20AC+', label: 'Commissions vers\u00e9es' },
    { icon: TrendingUp, value: '94%', label: 'Taux de satisfaction' },
    { icon: Award, value: '30j', label: 'D\u00e9lai de paiement' },
  ]

  const faqItems = [
    {
      q: 'Comment suis-je pay\u00e9 ?',
      a: 'Virement bancaire ou cr\u00e9dit, 30 jours apr\u00e8s le paiement effectif du client.',
    },
    {
      q: 'Quand suis-je pay\u00e9 ?',
      a: '30 jours apr\u00e8s l\u2019encaissement effectif du client. Ce d\u00e9lai couvre la p\u00e9riode de r\u00e9tractation.',
    },
    {
      q: 'Faut-il \u00eatre freelance ou avoir un SIRET ?',
      a: 'Non, ce n\u2019est pas obligatoire pour commencer. Nous adapterons les modalit\u00e9s selon votre situation.',
    },
    {
      q: 'Faut-il vendre Actero ?',
      a: 'Non, vous faites juste une mise en relation. Notre \u00e9quipe s\u2019occupe de tout le processus commercial.',
    },
    {
      q: 'Comment le lead est attribu\u00e9 ?',
      a: 'Via votre code ou lien unique, ou par attribution manuelle valid\u00e9e par Actero.',
    },
    {
      q: 'Que se passe-t-il si le client ne paie pas ?',
      a: 'Aucune commission n\u2019est due. La r\u00e9compense est conditionn\u00e9e au paiement effectif du client.',
    },
    {
      q: 'Combien de prospects puis-je recommander ?',
      a: 'Il n\u2019y a aucune limite. Plus vous recommandez, plus vous gagnez.',
    },
    {
      q: 'Comment suivre mes recommandations ?',
      a: 'Vous disposez d\u2019un tableau de bord d\u00e9di\u00e9 o\u00f9 vous suivez en temps r\u00e9el le statut de chaque lead et commission.',
    },
    {
      q: 'Que se passe-t-il en cas de doublon ?',
      a: 'R\u00e8gle du premier arriv\u00e9 : le premier ambassadeur ayant soumis le lead est retenu.',
    },
  ]

  return (
    <div className="relative min-h-screen bg-[#030303] font-sans text-white selection:bg-emerald-500/20 selection:text-white">
      {/* BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/20 via-[#030303] to-[#030303]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-cyan-500/3 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full">
        <Navbar onNavigate={onNavigate} onAuditOpen={() => onNavigate('/audit')} />

        <main>
          {/* ═══════════════════════════════════════════ */}
          {/* HERO                                       */}
          {/* ═══════════════════════════════════════════ */}
          <section className="pt-36 pb-24 md:pt-44 md:pb-32 px-6">
            <FadeInUp className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-8">
                <UserPlus className="w-3.5 h-3.5" />
                Programme Ambassadeur
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter mb-6 leading-[1.05]">
                Recommandez,{' '}
                <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent bg-[length:200%] animate-[shimmer_3s_ease-in-out_infinite]">
                  soyez r\u00e9compens\u00e9
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-400 font-medium max-w-2xl mx-auto leading-relaxed mb-4">
                Partagez Actero \u00e0 votre r\u00e9seau professionnel. Quand votre contact devient client, vous touchez une r\u00e9compense.
              </p>
              <p className="text-base text-gray-500 max-w-xl mx-auto leading-relaxed mb-12">
                Z\u00e9ro effort commercial. On s'occupe de tout. Vous gagnez.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => scrollToId('candidature')}
                  className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full text-lg transition-all hover:scale-105 shadow-lg shadow-emerald-500/25"
                >
                  Devenir ambassadeur
                </button>
                <button
                  onClick={() => onNavigate('/ambassador/login')}
                  className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-full text-lg transition-all border border-white/10"
                >
                  D\u00e9j\u00e0 ambassadeur ? Connectez-vous
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
                    <div className="text-center p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                        <stat.icon className="w-5 h-5 text-emerald-400" />
                      </div>
                      <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
                      <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                    </div>
                  </ScaleIn>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* COMMENT \u00c7A MARCHE                          */}
          {/* ═══════════════════════════════════════════ */}
          <section className="py-24 md:py-32 px-6">
            <FadeInUp className="max-w-5xl mx-auto text-center mb-16">
              <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-[0.2em] mb-4">
                Comment \u00e7a marche
              </p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter">
                3 \u00e9tapes, c\u2019est tout.
              </h2>
            </FadeInUp>
            <StaggerContainer className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
              {steps.map((step, i) => (
                <StaggerItem key={i}>
                  <div className="relative p-8 rounded-3xl bg-[#111] border border-white/10 hover:border-emerald-500/30 transition-all group">
                    <div className="absolute -top-4 -left-2 w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold text-base shadow-lg shadow-emerald-500/25">
                      {i + 1}
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                      <step.icon className="w-7 h-7 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                    <p className="text-gray-400 font-medium leading-relaxed">{step.desc}</p>
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
          {/* QUI PEUT \u00caTRE RECOMMAND\u00c9                   */}
          {/* ═══════════════════════════════════════════ */}
          <section className="py-24 md:py-32 px-6 bg-[#080808]">
            <FadeInUp className="max-w-5xl mx-auto text-center mb-16">
              <p className="text-xs font-bold text-cyan-400/80 uppercase tracking-[0.2em] mb-4">
                Qui peut \u00eatre recommand\u00e9
              </p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter">
                Les profils id\u00e9aux
              </h2>
            </FadeInUp>
            <StaggerContainer className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
              {targets.map((t, i) => (
                <StaggerItem key={i}>
                  <div className="p-8 rounded-3xl bg-[#111] border border-white/10 hover:border-cyan-500/30 transition-all h-full">
                    <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6">
                      <t.icon className="w-7 h-7 text-cyan-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{t.title}</h3>
                    <p className="text-gray-400 font-medium leading-relaxed">{t.desc}</p>
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
              <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-[0.2em] mb-4">
                Ce que vous pouvez gagner
              </p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-6">
                Une r\u00e9compense pour chaque client sign\u00e9 gr\u00e2ce \u00e0 vous
              </h2>
              <p className="text-xl text-gray-400 font-medium leading-relaxed mb-10">
                Le montant de la r\u00e9compense d\u00e9pend de la valeur du contrat sign\u00e9. Plus le deal est important, plus votre r\u00e9compense est \u00e9lev\u00e9e.
              </p>
              <div className="p-8 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Gift className="w-8 h-8 text-emerald-400" />
                  <span className="text-2xl font-bold text-white">R\u00e9compense variable</span>
                </div>
                <p className="text-gray-400 font-medium">
                  Vers\u00e9e 30 jours apr\u00e8s le paiement effectif du client. Aucune limite de recommandations.
                </p>
              </div>
            </FadeInUp>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* CE QUE VOUS N'AVEZ PAS \u00c0 FAIRE             */}
          {/* ═══════════════════════════════════════════ */}
          <section className="py-24 md:py-32 px-6 bg-[#080808]">
            <FadeInUp className="max-w-3xl mx-auto text-center mb-12">
              <p className="text-xs font-bold text-red-400/80 uppercase tracking-[0.2em] mb-4">
                Ce que vous n'avez pas \u00e0 faire
              </p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter">
                Z\u00e9ro effort commercial
              </h2>
            </FadeInUp>
            <StaggerContainer className="max-w-2xl mx-auto space-y-4">
              {notToDo.map((item, i) => (
                <StaggerItem key={i}>
                  <div className="flex items-center gap-4 p-5 rounded-2xl bg-[#111] border border-white/10">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                      <X className="w-5 h-5 text-red-400" />
                    </div>
                    <span className="text-lg font-bold text-white">{item}</span>
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
              <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-[0.2em] mb-4">
                Pourquoi Actero
              </p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter">
                Une solution qui se vend toute seule
              </h2>
            </FadeInUp>
            <StaggerContainer className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-6">
              {whyActero.map((item, i) => (
                <StaggerItem key={i}>
                  <div className="flex items-center gap-5 p-6 rounded-2xl bg-[#111] border border-white/10">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-6 h-6 text-emerald-400" />
                    </div>
                    <span className="text-lg font-bold text-white">{item.label}</span>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* FAQ                                        */}
          {/* ═══════════════════════════════════════════ */}
          <section className="py-24 md:py-32 px-6 bg-[#080808]">
            <FadeInUp className="max-w-3xl mx-auto">
              <div className="text-center mb-16">
                <p className="text-xs font-bold text-cyan-400/80 uppercase tracking-[0.2em] mb-4">
                  Questions fr\u00e9quentes
                </p>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter">FAQ</h2>
              </div>
              <div className="space-y-3">
                {faqItems.map((faq, i) => (
                  <div
                    key={i}
                    className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                      className="w-full flex items-center justify-between p-6 text-left"
                    >
                      <span className="text-lg font-bold text-white pr-4">{faq.q}</span>
                      <ChevronDown
                        className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-300 ${
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
                          <p className="px-6 pb-6 text-gray-400 font-medium leading-relaxed">
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
                <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-[0.2em] mb-4">
                  Rejoignez le programme
                </p>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">
                  Candidature
                </h2>
                <p className="text-gray-400 font-medium">
                  Remplissez le formulaire ci-dessous. Nous reviendrons vers vous rapidement.
                </p>
              </div>

              {formSuccess ? (
                <ScaleIn>
                  <div className="p-10 rounded-3xl bg-[#111] border border-emerald-500/30 text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">
                      Candidature envoy\u00e9e !
                    </h3>
                    <p className="text-gray-400 font-medium">
                      Merci pour votre int\u00e9r\u00eat. Notre \u00e9quipe vous contactera tr\u00e8s bient\u00f4t.
                    </p>
                  </div>
                </ScaleIn>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="p-8 md:p-10 rounded-3xl bg-[#111] border border-white/10 space-y-6"
                >
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">
                        Pr\u00e9nom <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        name="first_name"
                        required
                        value={formData.first_name}
                        onChange={handleFormChange}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                        placeholder="Jean"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">
                        Nom <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        name="last_name"
                        required
                        value={formData.last_name}
                        onChange={handleFormChange}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                        placeholder="Dupont"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleFormChange}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                      placeholder="jean@exemple.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      T\u00e9l\u00e9phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleFormChange}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                      placeholder="+33 6 12 34 56 78"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      Type de r\u00e9seau
                    </label>
                    <select
                      name="network_type"
                      value={formData.network_type}
                      onChange={handleFormChange}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all appearance-none"
                    >
                      <option value="" className="bg-[#111]">S\u00e9lectionner</option>
                      <option value="ecommerce" className="bg-[#111]">E-commerce</option>
                      <option value="immobilier" className="bg-[#111]">Immobilier</option>
                      <option value="tech" className="bg-[#111]">Tech</option>
                      <option value="finance" className="bg-[#111]">Finance</option>
                      <option value="autre" className="bg-[#111]">Autre</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      Message (optionnel)
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleFormChange}
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all resize-none"
                      placeholder="Parlez-nous de votre r\u00e9seau..."
                    />
                  </div>

                  {formError && (
                    <div className="p-3 bg-red-500/10 text-red-400 text-sm font-medium rounded-xl border border-red-500/20 text-center">
                      {formError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={formLoading}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold rounded-xl text-lg transition-all flex items-center justify-center gap-3"
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

                  <p className="text-center text-xs text-gray-600">
                    En soumettant ce formulaire, vous acceptez d'\u00eatre contact\u00e9 par l'\u00e9quipe Actero.
                  </p>
                </form>
              )}
            </FadeInUp>
          </section>
        </main>

        <Footer onNavigate={onNavigate} />
      </div>
    </div>
  )
}
