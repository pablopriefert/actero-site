import React, { useState } from 'react'
import { SEO } from '../components/SEO'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import { FadeInUp, StaggerContainer, StaggerItem } from '../components/ui/scroll-animations'
import {
  Rocket,
  CheckCircle2,
  ArrowRight,
  ShoppingCart,
  Clock,
  Star,
  Users,
  Send,
  Zap,
  Gift,
  MessageSquare,
  BadgeCheck
} from 'lucide-react'

export const ActeroForStartupsPage = ({ onNavigate }) => {
  const [form, setForm] = useState({
    boutique_name: '',
    url: '',
    email: '',
    revenue: '',
    platform: '',
    motivation: ''
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/startups/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (data.success) {
        setSubmitted(true)
      } else {
        setError(data.message || 'Une erreur est survenue.')
      }
    } catch {
      // Fallback: mailto
      const subject = encodeURIComponent(`Candidature Actero for Startups - ${form.boutique_name}`)
      const body = encodeURIComponent(
        `Nom de la boutique: ${form.boutique_name}\nURL: ${form.url}\nEmail: ${form.email}\nCA annuel: ${form.revenue}\nPlateforme: ${form.platform}\nMotivation: ${form.motivation}`
      )
      window.location.href = `mailto:startups@actero.fr?subject=${subject}&body=${body}`
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <SEO
        title="Actero for Startups — -50% pendant 6 mois"
        description="Programme Actero for Startups : automatisez votre support e-commerce des le lancement avec -50% pendant 6 mois."
        canonical="/startups"
        noIndex={true}
      />
      <div className="relative min-h-screen bg-white font-sans text-[#262626]">
        <Navbar onNavigate={onNavigate} />

        <main>
          {/* ── HERO ── */}
          <section className="pt-32 md:pt-40 pb-20 px-6 bg-white">
            <div className="max-w-4xl mx-auto text-center">
              <FadeInUp className="mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cta/10 text-cta text-sm font-bold">
                  <Rocket className="w-4 h-4" />
                  Programme Startups
                </div>
              </FadeInUp>

              <FadeInUp delay={0.05}>
                <h1
                  className="text-4xl md:text-6xl lg:text-7xl font-normal leading-[1.1] mb-6"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
                >
                  <span className="text-[#262626]">Actero for Startups</span>
                </h1>
              </FadeInUp>

              <FadeInUp delay={0.1}>
                <p className="text-xl md:text-2xl text-[#716D5C] font-medium max-w-2xl mx-auto leading-relaxed mb-4">
                  Automatisez votre support e-commerce des le lancement.
                </p>
                <p className="text-2xl md:text-3xl font-bold text-cta">
                  -50% pendant 6 mois.
                </p>
              </FadeInUp>
            </div>
          </section>

          {/* ── COMMENT CA MARCHE ── */}
          <section className="py-20 px-6 bg-[#F9F7F1]">
            <div className="max-w-4xl mx-auto">
              <FadeInUp className="text-center mb-16">
                <p className="text-xs font-bold text-[#716D5C] uppercase tracking-[0.2em] mb-4">
                  En 4 etapes
                </p>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-[#262626]">
                  Comment ca marche
                </h2>
              </FadeInUp>

              <StaggerContainer className="grid md:grid-cols-2 gap-6">
                {[
                  {
                    num: '01',
                    icon: <Send className="w-5 h-5 text-cta" />,
                    title: 'Vous candidatez',
                    desc: 'Remplissez le formulaire ci-dessous avec les informations sur votre boutique.'
                  },
                  {
                    num: '02',
                    icon: <Clock className="w-5 h-5 text-cta" />,
                    title: 'Review sous 48h',
                    desc: 'Notre equipe examine votre candidature et vous repond sous 48 heures.'
                  },
                  {
                    num: '03',
                    icon: <Gift className="w-5 h-5 text-cta" />,
                    title: 'Code promo -50%',
                    desc: 'Si accepte, vous recevez un code promo -50% valable 6 mois par email.'
                  },
                  {
                    num: '04',
                    icon: <Rocket className="w-5 h-5 text-cta" />,
                    title: 'Inscrivez-vous',
                    desc: 'Rendez-vous sur actero.fr/signup avec votre code et commencez a automatiser.'
                  }
                ].map((step, i) => (
                  <StaggerItem key={i}>
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 flex gap-4 items-start hover:border-gray-300 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-cta/10 flex items-center justify-center flex-shrink-0">
                        {step.icon}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#716D5C] uppercase tracking-widest mb-1">
                          Etape {step.num}
                        </p>
                        <h3 className="text-lg font-bold text-[#262626] mb-1">{step.title}</h3>
                        <p className="text-sm text-[#716D5C] font-medium leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          </section>

          {/* ── CRITERES D'ELIGIBILITE ── */}
          <section className="py-20 px-6 bg-white">
            <div className="max-w-4xl mx-auto">
              <FadeInUp className="text-center mb-12">
                <p className="text-xs font-bold text-[#716D5C] uppercase tracking-[0.2em] mb-4">
                  Eligibilite
                </p>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-[#262626]">
                  Criteres d'eligibilite
                </h2>
              </FadeInUp>

              <FadeInUp>
                <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  {[
                    { icon: <ShoppingCart className="w-5 h-5 text-cta" />, text: 'Boutique e-commerce de moins de 2 ans' },
                    { icon: <Star className="w-5 h-5 text-cta" />, text: "CA < 500k\u20AC/an" },
                    { icon: <Zap className="w-5 h-5 text-cta" />, text: 'Shopify, WooCommerce ou Webflow' },
                    { icon: <MessageSquare className="w-5 h-5 text-cta" />, text: 'Engagement de donner du feedback produit' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-[#F9F7F1] rounded-xl p-4 border border-gray-200">
                      <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                        {item.icon}
                      </div>
                      <p className="text-sm font-medium text-[#262626]">{item.text}</p>
                    </div>
                  ))}
                </div>
              </FadeInUp>
            </div>
          </section>

          {/* ── AVANTAGES ── */}
          <section className="py-20 px-6 bg-[#003725]">
            <div className="max-w-4xl mx-auto">
              <FadeInUp className="text-center mb-12">
                <p className="text-xs font-bold text-white/50 uppercase tracking-[0.2em] mb-4">
                  Ce que vous obtenez
                </p>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-white">
                  Avantages du programme
                </h2>
              </FadeInUp>

              <StaggerContainer className="grid md:grid-cols-2 gap-6">
                {[
                  {
                    icon: <Gift className="w-6 h-6" />,
                    title: '-50% pendant 6 mois',
                    desc: "Starter a 49,50\u20AC/mois ou Pro a 199,50\u20AC/mois pendant toute la duree du programme."
                  },
                  {
                    icon: <Users className="w-6 h-6" />,
                    title: 'Support prioritaire',
                    desc: 'Acces au support prioritaire pendant toute la duree du programme.'
                  },
                  {
                    icon: <Zap className="w-6 h-6" />,
                    title: 'Acces aux features beta',
                    desc: 'Testez les nouvelles fonctionnalites en avant-premiere et influencez la roadmap.'
                  },
                  {
                    icon: <BadgeCheck className="w-6 h-6" />,
                    title: 'Communaute Actero',
                    desc: 'Mention dans la communaute Actero et networking avec les autres startups du programme.'
                  }
                ].map((item, i) => (
                  <StaggerItem key={i}>
                    <div className="bg-cta rounded-2xl p-6 border border-white/10">
                      <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center mb-4 text-white">
                        {item.icon}
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                      <p className="text-sm text-white/70 font-medium leading-relaxed">{item.desc}</p>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          </section>

          {/* ── FORMULAIRE ── */}
          <section className="py-20 px-6 bg-white" id="candidature">
            <div className="max-w-2xl mx-auto">
              <FadeInUp className="text-center mb-12">
                <p className="text-xs font-bold text-[#716D5C] uppercase tracking-[0.2em] mb-4">
                  Candidature
                </p>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-[#262626] mb-4">
                  Postulez au programme
                </h2>
                <p className="text-[#716D5C] font-medium">
                  Remplissez ce formulaire en 2 minutes. Reponse sous 48h.
                </p>
              </FadeInUp>

              <FadeInUp delay={0.1}>
                {submitted ? (
                  <div className="bg-cta/10 rounded-2xl p-10 text-center border border-cta/20">
                    <CheckCircle2 className="w-12 h-12 text-cta mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-[#262626] mb-2">Candidature envoyee !</h3>
                    <p className="text-[#716D5C] font-medium">
                      Nous reviendrons vers vous sous 48h. Surveillez votre boite email.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-[#262626] mb-1.5">
                        Nom de la boutique *
                      </label>
                      <input
                        type="text"
                        name="boutique_name"
                        value={form.boutique_name}
                        onChange={handleChange}
                        required
                        placeholder="Ma Boutique"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#F9F7F1] text-[#262626] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-[#262626] mb-1.5">
                        URL du site *
                      </label>
                      <input
                        type="url"
                        name="url"
                        value={form.url}
                        onChange={handleChange}
                        required
                        placeholder="https://maboutique.com"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#F9F7F1] text-[#262626] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-[#262626] mb-1.5">
                        Email *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        required
                        placeholder="vous@votreboutique.com"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#F9F7F1] text-[#262626] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta transition"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-bold text-[#262626] mb-1.5">
                          CA annuel estime *
                        </label>
                        <select
                          name="revenue"
                          value={form.revenue}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#F9F7F1] text-[#262626] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta transition"
                        >
                          <option value="">Selectionnez</option>
                          <option value="<50k">&lt; 50k&euro;</option>
                          <option value="50-200k">50 - 200k&euro;</option>
                          <option value="200-500k">200 - 500k&euro;</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-[#262626] mb-1.5">
                          Plateforme *
                        </label>
                        <select
                          name="platform"
                          value={form.platform}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#F9F7F1] text-[#262626] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta transition"
                        >
                          <option value="">Selectionnez</option>
                          <option value="shopify">Shopify</option>
                          <option value="woocommerce">WooCommerce</option>
                          <option value="webflow">Webflow</option>
                          <option value="autre">Autre</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-[#262626] mb-1.5">
                        Pourquoi Actero ? * <span className="text-[#716D5C] font-normal">(3 phrases max)</span>
                      </label>
                      <textarea
                        name="motivation"
                        value={form.motivation}
                        onChange={handleChange}
                        required
                        rows={3}
                        maxLength={500}
                        placeholder="Decrivez brievement pourquoi vous souhaitez rejoindre le programme..."
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#F9F7F1] text-[#262626] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta transition resize-none"
                      />
                    </div>

                    {error && (
                      <p className="text-sm text-red-500 font-medium">{error}</p>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-4 px-6 rounded-xl bg-cta text-white font-bold text-base flex items-center justify-center gap-2 hover:bg-[#003725] transition-colors disabled:opacity-60"
                    >
                      {loading ? 'Envoi en cours...' : (
                        <>Envoyer ma candidature <ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>
                  </form>
                )}
              </FadeInUp>

              <p className="text-center text-xs text-[#716D5C] font-medium mt-6">
                Programme soumis a validation. Places limitees.
              </p>
            </div>
          </section>
        </main>

        <Footer onNavigate={onNavigate} />
      </div>
    </>
  )
}
