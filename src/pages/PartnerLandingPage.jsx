import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart,
  Megaphone,
  Laptop,
  Briefcase,
  Building2,
  ChevronDown,
  CheckCircle2,
  X as XIcon,
  Zap,
  BarChart3,
  Clock,
  Target,
  ArrowRight,
  Send,
  Handshake,
  Users,
  DollarSign,
  HeartHandshake,
  Rocket,
  Shield,
  Lock,
  Loader2,
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

// Private page gate — accessible only via /partner?token=xxx sent in cold emails
const PartnerAccessGate = ({ children }) => {
  const [state, setState] = useState('checking') // checking | granted | denied
  const [agencyName, setAgencyName] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) {
      setState('denied')
      setError('Cette page est privée et accessible uniquement sur invitation.')
      return
    }

    // Persist token in sessionStorage so internal navigation keeps access
    const cached = sessionStorage.getItem(`partner_token_${token}`)
    if (cached === 'valid') {
      setState('granted')
      setAgencyName(sessionStorage.getItem('partner_agency_name'))
      return
    }

    fetch(`/api/partner/verify-token?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          sessionStorage.setItem(`partner_token_${token}`, 'valid')
          if (data.agency_name) sessionStorage.setItem('partner_agency_name', data.agency_name)
          setAgencyName(data.agency_name)
          setState('granted')
        } else {
          setState('denied')
          setError(data.error || 'Lien invalide')
        }
      })
      .catch(() => {
        setState('denied')
        setError('Erreur de vérification')
      })
  }, [])

  if (state === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-[#0F5F35] animate-spin" />
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] px-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-[#1a1a1a] mb-2">Page privée</h1>
          <p className="text-sm text-[#71717a] mb-6">{error || 'Cette page est accessible uniquement sur invitation.'}</p>
          <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F5F35] hover:underline">
            Retour à l'accueil
          </a>
        </div>
      </div>
    )
  }

  return typeof children === 'function' ? children({ agencyName }) : children
}

const PartnerLandingPageContent = ({ onNavigate, agencyName }) => {
  const [openFaqIndex, setOpenFaqIndex] = useState(null)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company_name: '',
    activity_type: '',
    potential_clients: '',
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
      const res = await fetch('/api/partner/apply.js', {
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

  const targets = [
    { icon: ShoppingCart, title: 'Agences e-commerce / Shopify', desc: 'Vous gérez des boutiques en ligne et cherchez à offrir plus de valeur à vos clients.' },
    { icon: Megaphone, title: 'Agences marketing / ads', desc: 'Vous pilotez des campagnes et souhaitez proposer des solutions IA complémentaires.' },
    { icon: Laptop, title: 'Freelances', desc: 'Vous accompagnez des entreprises et voulez élargir votre offre sans complexité.' },
    { icon: Briefcase, title: 'Consultants business', desc: 'Vous conseillez des dirigeants et identifiez des besoins en automatisation.' },
    { icon: Building2, title: 'Entrepreneurs', desc: 'Vous connaissez des entreprises e-commerce qui gagneraient à automatiser.' },
  ]

  const steps = [
    { num: '01', title: 'Vous nous présentez un client potentiel', desc: 'Un simple email, un formulaire ou une mise en relation directe suffit.' },
    { num: '02', title: 'Nous gérons l\'audit, la vente et le déploiement', desc: 'Notre équipe prend le relais sur tout le processus commercial et technique.' },
    { num: '03', title: 'Vous touchez une commission sur chaque client signé', desc: 'Dès que le client signe et paie, votre commission est déclenchée.' },
  ]

  const benefits = [
    { icon: DollarSign, title: 'Nouvelle source de revenus', desc: 'Générez des commissions récurrentes sans effort supplémentaire.' },
    { icon: HeartHandshake, title: 'Plus de valeur pour vos clients', desc: 'Offrez des solutions IA concrètes qui transforment leur business.' },
    { icon: Shield, title: 'Aucun besoin de gérer la technique', desc: 'Nous nous occupons de tout, de A à Z.' },
    { icon: Handshake, title: 'Aucun besoin de closer', desc: 'Pas de vente à faire. Nous gérons la conversion.' },
    { icon: Rocket, title: 'Collaboration simple et rapide', desc: 'Un process fluide, sans lourdeur administrative.' },
  ]

  const notToDo = [
    'Pas de production',
    'Pas de support',
    'Pas de gestion client',
    'Pas de SAV',
    'Pas de closing obligatoire',
  ]

  const whyActero = [
    { icon: Zap, title: 'Spécialisation IA business', desc: 'Experts en automatisation et intelligence artificielle appliquée.' },
    { icon: BarChart3, title: 'Résultats concrets', desc: 'ROI mesurable, gains de temps réels, impact business immédiat.' },
    { icon: Target, title: 'Process structuré', desc: 'Méthodologie éprouvée de l\'audit au déploiement.' },
    { icon: Clock, title: 'Rapidité d\'exécution', desc: 'Déploiement rapide, résultats visibles en quelques semaines.' },
    { icon: ArrowRight, title: 'Approche orientée ROI', desc: 'Chaque action est pensée pour maximiser le retour sur investissement.' },
  ]

  const faqItems = [
    {
      q: 'Qui peut devenir partenaire ?',
      a: 'Toute personne ou entreprise qui dispose d\'un réseau professionnel : agences, freelances, consultants, etc. Aucune compétence technique n\'est requise.',
    },
    {
      q: 'Comment fonctionne la collaboration ?',
      a: 'Vous nous présentez un prospect via le formulaire ou par email. Notre équipe prend en charge l\'intégralité du processus : audit, démonstration, vente et déploiement.',
    },
    {
      q: 'Quand suis-je rémunéré ?',
      a: 'Votre commission est versée après la signature et le paiement effectif du client. Les modalités exactes sont définies lors de votre onboarding partenaire.',
    },
    {
      q: 'Dois-je vendre Actero ?',
      a: 'Non. Votre rôle se limite à la mise en relation. Vous n\'avez aucune obligation de vente, de closing ou de suivi commercial.',
    },
    {
      q: 'Puis-je recommander plusieurs clients ?',
      a: 'Absolument. Il n\'y a aucune limite au nombre de prospects que vous pouvez nous présenter. Plus vous recommandez, plus vous gagnez.',
    },
    {
      q: 'Comment les leads sont-ils attribués ?',
      a: 'Chaque lead est tracé et attribué au partenaire qui l\'a soumis en premier. En cas de doublon, la règle du premier arrivé s\'applique.',
    },
  ]

  const activityOptions = [
    'Agence e-commerce',
    'Agence marketing',
    'Freelance',
    'Consultant',
    'Autre',
  ]

  const clientsOptions = ['1-3', '4-10', '10+']

  return (
    <>
      <SEO
        title="Partenariat B2B Actero | Agences & Freelances"
        description="Devenez partenaire Actero et proposez l'automatisation IA a vos clients e-commerce. Commission attractive, support dedie."
        canonical="/partner"
      />
    <div className="relative min-h-screen bg-white font-sans text-[#262626] selection:bg-indigo-500/20 selection:text-[#262626]">
      {/* BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#F9F7F1] to-white" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-violet-500/3 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full">
        <Navbar onNavigate={onNavigate} onAuditOpen={() => onNavigate('/audit')} />

        <main>
          {/* ═══════════════════════════════════════════ */}
          {/* HERO                                       */}
          {/* ═══════════════════════════════════════════ */}
          <section className="pt-36 pb-24 md:pt-44 md:pb-32 px-6">
            <FadeInUp className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-8">
                <Handshake className="w-3.5 h-3.5" />
                {agencyName ? `Invitation personnalisée pour ${agencyName}` : 'Programme Partenaire'}
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter mb-6 leading-[1.05]">
                Devenez partenaire{' '}
                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent bg-[length:200%] animate-[shimmer_3s_ease-in-out_infinite]">
                  Actero
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-[#716D5C] font-medium max-w-3xl mx-auto leading-relaxed mb-4">
                Recommandez nos solutions IA à vos clients et générez une nouvelle source de revenus sans gérer la vente ni la technique.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
                <button
                  onClick={() => scrollToId('candidature')}
                  className="px-8 py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-full text-lg transition-all hover:scale-105 shadow-lg shadow-indigo-500/25"
                >
                  Devenir partenaire
                </button>
              </div>
            </FadeInUp>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* POUR QUI                                   */}
          {/* ═══════════════════════════════════════════ */}
          <section className="py-24 px-6">
            <div className="max-w-6xl mx-auto">
              <FadeInUp className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Pour qui est ce programme ?
                </h2>
                <p className="text-[#716D5C] text-lg max-w-2xl mx-auto">
                  Si vous avez un réseau professionnel, ce programme est fait pour vous.
                </p>
              </FadeInUp>
              <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {targets.map((t, i) => (
                  <StaggerItem key={i}>
                    <div className="p-6 rounded-2xl bg-gray-50 border border-gray-200 hover:border-indigo-500/20 transition-all group h-full">
                      <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition-colors">
                        <t.icon className="w-6 h-6 text-indigo-400" />
                      </div>
                      <h3 className="text-lg font-bold mb-2">{t.title}</h3>
                      <p className="text-sm text-[#716D5C] leading-relaxed">{t.desc}</p>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* COMMENT ÇA MARCHE                          */}
          {/* ═══════════════════════════════════════════ */}
          <section className="py-24 px-6 bg-gray-50/50">
            <div className="max-w-5xl mx-auto">
              <FadeInUp className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Comment ça marche
                </h2>
                <p className="text-[#716D5C] text-lg max-w-2xl mx-auto">
                  Un process simple en 3 étapes.
                </p>
              </FadeInUp>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {steps.map((s, i) => (
                  <ScaleIn key={i} delay={i * 0.15}>
                    <div className="relative p-8 rounded-2xl bg-gray-50 border border-gray-200 text-center h-full">
                      <div className="text-5xl font-black text-indigo-500/20 mb-4">{s.num}</div>
                      <h3 className="text-lg font-bold mb-3">{s.title}</h3>
                      <p className="text-sm text-[#716D5C] leading-relaxed">{s.desc}</p>
                      {i < steps.length - 1 && (
                        <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                          <ArrowRight className="w-6 h-6 text-indigo-500/30" />
                        </div>
                      )}
                    </div>
                  </ScaleIn>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* POURQUOI DEVENIR PARTENAIRE                */}
          {/* ═══════════════════════════════════════════ */}
          <section className="py-24 px-6">
            <div className="max-w-6xl mx-auto">
              <FadeInUp className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Pourquoi devenir partenaire
                </h2>
              </FadeInUp>
              <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {benefits.map((b, i) => (
                  <StaggerItem key={i}>
                    <div className="p-6 rounded-2xl bg-gray-50 border border-gray-200 hover:border-indigo-500/20 transition-all group h-full">
                      <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition-colors">
                        <b.icon className="w-6 h-6 text-indigo-400" />
                      </div>
                      <h3 className="text-lg font-bold mb-2">{b.title}</h3>
                      <p className="text-sm text-[#716D5C] leading-relaxed">{b.desc}</p>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* CE QUE VOUS N'AVEZ PAS À FAIRE            */}
          {/* ═══════════════════════════════════════════ */}
          <section className="py-24 px-6 bg-gray-50/50">
            <div className="max-w-3xl mx-auto">
              <FadeInUp className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Ce que vous n'avez pas à faire
                </h2>
                <p className="text-[#716D5C] text-lg">
                  Zéro charge opérationnelle de votre côté.
                </p>
              </FadeInUp>
              <StaggerContainer className="space-y-4">
                {notToDo.map((item, i) => (
                  <StaggerItem key={i}>
                    <div className="flex items-center gap-4 p-5 rounded-xl bg-red-500/[0.03] border border-red-500/10">
                      <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                        <XIcon className="w-4 h-4 text-red-400" />
                      </div>
                      <span className="text-base font-medium text-[#716D5C]">{item}</span>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* POURQUOI ACTERO                            */}
          {/* ═══════════════════════════════════════════ */}
          <section className="py-24 px-6">
            <div className="max-w-6xl mx-auto">
              <FadeInUp className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Pourquoi Actero
                </h2>
                <p className="text-[#716D5C] text-lg max-w-2xl mx-auto">
                  Une équipe spécialisée, des résultats prouvés.
                </p>
              </FadeInUp>
              <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {whyActero.map((w, i) => (
                  <StaggerItem key={i}>
                    <div className="p-6 rounded-2xl bg-gray-50 border border-gray-200 hover:border-violet-500/20 transition-all group h-full">
                      <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center mb-4 group-hover:bg-violet-500/20 transition-colors">
                        <w.icon className="w-6 h-6 text-violet-400" />
                      </div>
                      <h3 className="text-lg font-bold mb-2">{w.title}</h3>
                      <p className="text-sm text-[#716D5C] leading-relaxed">{w.desc}</p>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* FAQ                                        */}
          {/* ═══════════════════════════════════════════ */}
          <section className="py-24 px-6 bg-gray-50/50">
            <div className="max-w-3xl mx-auto">
              <FadeInUp className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Questions fréquentes
                </h2>
              </FadeInUp>
              <div className="space-y-3">
                {faqItems.map((faq, i) => (
                  <FadeInUp key={i} delay={i * 0.05}>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
                      <button
                        onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                        className="w-full flex items-center justify-between px-6 py-5 text-left group"
                      >
                        <span className="font-semibold text-base pr-4">{faq.q}</span>
                        <motion.div
                          animate={{ rotate: openFaqIndex === i ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="w-5 h-5 text-[#716D5C] group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                        </motion.div>
                      </button>
                      <AnimatePresence>
                        {openFaqIndex === i && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                          >
                            <div className="px-6 pb-5 text-sm text-[#716D5C] leading-relaxed">
                              {faq.a}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </FadeInUp>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* FORMULAIRE                                 */}
          {/* ═══════════════════════════════════════════ */}
          <section id="candidature" className="py-24 px-6">
            <div className="max-w-2xl mx-auto">
              <FadeInUp className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Postulez maintenant
                </h2>
                <p className="text-[#716D5C] text-lg">
                  Remplissez le formulaire et notre équipe vous recontactera sous 48h.
                </p>
              </FadeInUp>

              {formSuccess ? (
                <FadeInUp>
                  <div className="text-center p-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                    <CheckCircle2 className="w-16 h-16 text-indigo-400 mx-auto mb-6" />
                    <h3 className="text-2xl font-bold mb-3">Candidature envoyée !</h3>
                    <p className="text-[#716D5C]">
                      Merci pour votre intérêt. Notre équipe vous contactera très prochainement.
                    </p>
                  </div>
                </FadeInUp>
              ) : (
                <FadeInUp>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-[#716D5C] mb-1.5">Prénom *</label>
                        <input
                          type="text"
                          name="first_name"
                          value={formData.first_name}
                          onChange={handleFormChange}
                          required
                          className="w-full px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-[#262626] placeholder-gray-600 outline-none focus:border-indigo-500/40 transition-colors"
                          placeholder="Votre prénom"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#716D5C] mb-1.5">Nom *</label>
                        <input
                          type="text"
                          name="last_name"
                          value={formData.last_name}
                          onChange={handleFormChange}
                          required
                          className="w-full px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-[#262626] placeholder-gray-600 outline-none focus:border-indigo-500/40 transition-colors"
                          placeholder="Votre nom"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-[#716D5C] mb-1.5">Email *</label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleFormChange}
                          required
                          className="w-full px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-[#262626] placeholder-gray-600 outline-none focus:border-indigo-500/40 transition-colors"
                          placeholder="vous@entreprise.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#716D5C] mb-1.5">Téléphone</label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleFormChange}
                          className="w-full px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-[#262626] placeholder-gray-600 outline-none focus:border-indigo-500/40 transition-colors"
                          placeholder="+33 6 00 00 00 00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#716D5C] mb-1.5">Nom de la société *</label>
                      <input
                        type="text"
                        name="company_name"
                        value={formData.company_name}
                        onChange={handleFormChange}
                        required
                        className="w-full px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-[#262626] placeholder-gray-600 outline-none focus:border-indigo-500/40 transition-colors"
                        placeholder="Nom de votre entreprise"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-[#716D5C] mb-1.5">Type d'activité *</label>
                        <select
                          name="activity_type"
                          value={formData.activity_type}
                          onChange={handleFormChange}
                          required
                          className="w-full px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-[#262626] outline-none focus:border-indigo-500/40 transition-colors appearance-none cursor-pointer"
                        >
                          <option value="" disabled className="bg-[#F9F7F1]">Sélectionnez</option>
                          {activityOptions.map((opt) => (
                            <option key={opt} value={opt} className="bg-[#F9F7F1]">{opt}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#716D5C] mb-1.5">Nombre de clients potentiels</label>
                        <select
                          name="potential_clients"
                          value={formData.potential_clients}
                          onChange={handleFormChange}
                          className="w-full px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-[#262626] outline-none focus:border-indigo-500/40 transition-colors appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-[#F9F7F1]">Sélectionnez</option>
                          {clientsOptions.map((opt) => (
                            <option key={opt} value={opt} className="bg-[#F9F7F1]">{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#716D5C] mb-1.5">Message libre</label>
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleFormChange}
                        rows={4}
                        className="w-full px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-[#262626] placeholder-gray-600 outline-none focus:border-indigo-500/40 transition-colors resize-none"
                        placeholder="Parlez-nous de votre activité et de vos clients potentiels..."
                      />
                    </div>

                    {formError && (
                      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        {formError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={formLoading}
                      className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:hover:bg-indigo-500 text-white font-bold rounded-xl text-lg transition-all shadow-lg shadow-indigo-500/25"
                    >
                      {formLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          Envoyer ma candidature
                        </>
                      )}
                    </button>
                  </form>
                </FadeInUp>
              )}
            </div>
          </section>
        </main>

        <Footer onNavigate={onNavigate} />
      </div>
    </div>
    </>
  )
}

// Exported wrapper: gate the page behind token validation
export const PartnerLandingPage = ({ onNavigate }) => (
  <PartnerAccessGate>
    {({ agencyName }) => <PartnerLandingPageContent onNavigate={onNavigate} agencyName={agencyName} />}
  </PartnerAccessGate>
)
