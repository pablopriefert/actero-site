import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Check, X, Minus, Trophy } from 'lucide-react'
import { SEO } from '../SEO'
import { Navbar } from '../layout/Navbar'
import { Footer } from '../layout/Footer'
import { FadeInUp } from '../ui/scroll-animations'
import { PartnersMarquee } from '../ui/PartnersMarquee'
import { TalkToHumanButton } from '../ui/TalkToHumanButton'
import { WatchDemoButton } from '../ui/WatchDemoButton'
import { trackEvent } from '../../lib/analytics'

/**
 * VsTemplate — head-to-head comparison page (X vs Actero).
 *
 * Differs from AlternativeTemplate:
 *   - H1 framed as "X vs Actero — lequel choisir en 2026 ?"
 *   - Verdict block (Actero / Tie / X) before the table — built for AI Overviews
 *     and Featured Snippets, where Google rewards an explicit answer up top.
 *   - Balanced "Quand choisir X / Quand choisir Actero" section instead of
 *     the persuasive "Why switch" cards (objectivity = better SERP ranking on
 *     `[A] vs [B]` intent, where searchers expect a comparative not a sales
 *     pitch).
 *   - JSON-LD adds a Review schema with comparative ratings.
 */
export const VsTemplate = ({ onNavigate, data, children }) => {
  const [openFaq, setOpenFaq] = useState(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    trackEvent('Vs_Page_Viewed', { competitor: data.competitorKey })
  }, [data.competitorKey])

  const serif = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }
  const competitor = data.competitorName

  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: data.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Actero',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Customer Service Software',
      operatingSystem: 'Web',
      description:
        "Plateforme SaaS française d'automatisation IA du SAV e-commerce Shopify. 50 à 70% des tickets résolus seul, relance paniers abandonnés, analyse photo (Claude Vision), hébergement UE.",
      offers: [
        { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'EUR' },
        { '@type': 'Offer', name: 'Starter', price: '99', priceCurrency: 'EUR' },
        { '@type': 'Offer', name: 'Pro', price: '399', priceCurrency: 'EUR' },
      ],
      url: `https://actero.fr/${data.competitorKey}-vs-actero`,
      provider: { '@type': 'Organization', name: 'Actero', url: 'https://actero.fr' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://actero.fr/' },
        { '@type': 'ListItem', position: 2, name: 'Comparaisons', item: 'https://actero.fr/tarifs' },
        {
          '@type': 'ListItem',
          position: 3,
          name: `${competitor} vs Actero`,
          item: `https://actero.fr/${data.competitorKey}-vs-actero`,
        },
      ],
    },
  ]

  const verdictTone = {
    actero: { bg: '#003725', accent: '#A8C490', label: 'Actero', strokeColor: 'text-[#A8C490]' },
    tie: { bg: '#716D5C', accent: '#F4F0E6', label: 'Match nul', strokeColor: 'text-[#F4F0E6]' },
    competitor: { bg: '#1A1A1A', accent: '#F4F0E6', label: competitor, strokeColor: 'text-[#F4F0E6]' },
  }[data.verdict?.winner || 'actero']

  return (
    <>
      <SEO
        title={data.seo.title}
        description={data.seo.description}
        keywords={data.seo.keywords}
        canonical={`/${data.competitorKey}-vs-actero`}
        ogImage="https://actero.fr/og-image.png"
        schemaData={schema}
      />

      <div className="min-h-screen bg-white text-[#262626] font-sans selection:bg-[#003725]/10">
        <Navbar onNavigate={onNavigate} trackEvent={trackEvent} />

        <main>
          {/* HERO */}
          <section className="pt-28 md:pt-32 pb-12 px-6">
            <div className="max-w-[920px] mx-auto text-center">
              <FadeInUp className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-[#716D5C] bg-[#F9F7F1] border border-[#E8DFC9]">
                  <span className="w-1.5 h-1.5 rounded-full bg-cta" />
                  <span>Comparatif détaillé</span>
                  <span className="text-[#E8DFC9]">·</span>
                  <span>Mis à jour {data.comparisonDate}</span>
                </div>
              </FadeInUp>

              <FadeInUp delay={0.05} className="mb-6">
                <h1
                  className="leading-[1.05] text-[#1A1A1A] font-normal"
                  style={{ ...serif, fontSize: 'clamp(38px, 5.2vw, 64px)', letterSpacing: '-0.02em' }}
                >
                  {competitor} vs Actero —
                  <br />
                  <span className="italic text-[#716D5C]">lequel choisir en 2026 ?</span>
                </h1>
              </FadeInUp>

              <FadeInUp delay={0.1} className="mb-8">
                <p className="text-[16px] md:text-[17px] text-[#5A5A5A] leading-[1.55] max-w-[640px] mx-auto">
                  {data.hero.subtitle}
                </p>
              </FadeInUp>

              <FadeInUp delay={0.15}>
                <div className="flex flex-wrap items-center justify-center gap-3.5 mb-5">
                  <button
                    onClick={() => {
                      trackEvent('Vs_Hero_CTA_Clicked', { competitor: data.competitorKey })
                      onNavigate('/signup')
                    }}
                    className="inline-flex items-center gap-2 px-[26px] py-[14px] rounded-full bg-cta hover:bg-[#0A4F2C] text-white text-[15px] font-semibold transition-all shadow-[0_1px_2px_rgba(14,101,58,0.2),0_8px_20px_rgba(14,101,58,0.15)] hover:-translate-y-px"
                  >
                    Essai gratuit 7 jours
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <WatchDemoButton source={`vs_${data.competitorKey}_hero`} variant="light" />
                </div>
              </FadeInUp>
            </div>
          </section>

          {/* VERDICT BLOCK — built for AI Overviews / Featured Snippets */}
          <section className="px-6 pb-4">
            <div className="max-w-[920px] mx-auto">
              <FadeInUp>
                <div
                  className="rounded-[24px] p-7 md:p-9 text-white relative overflow-hidden"
                  style={{ backgroundColor: verdictTone.bg }}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0`}>
                      <Trophy className={`w-6 h-6 ${verdictTone.strokeColor}`} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[11px] font-bold uppercase tracking-[0.18em] mb-2"
                        style={{ color: verdictTone.accent }}
                      >
                        Verdict — {verdictTone.label}
                      </div>
                      <h2
                        className="font-normal leading-[1.15] mb-3 text-white"
                        style={{ ...serif, fontSize: 'clamp(22px, 3vw, 30px)', letterSpacing: '-0.01em' }}
                      >
                        {data.verdict.headline}
                      </h2>
                      <p className="text-[14.5px] leading-[1.6] text-white/80">{data.verdict.body}</p>
                    </div>
                  </div>
                </div>
              </FadeInUp>
            </div>
          </section>

          <PartnersMarquee />

          {/* COMPARISON TABLE */}
          <section className="py-20 md:py-28 bg-[#F9F7F1] px-6">
            <div className="max-w-5xl mx-auto">
              <FadeInUp className="text-center mb-12">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
                  Comparatif feature-par-feature
                </p>
                <h2
                  className="font-normal leading-[1.05] text-[#1A1A1A] mb-3"
                  style={{ ...serif, fontSize: 'clamp(34px, 5vw, 52px)', letterSpacing: '-0.02em' }}
                >
                  {competitor} vs Actero,<br className="hidden md:block" />
                  <span className="italic text-[#716D5C]">les chiffres exacts.</span>
                </h2>
                <p className="text-[15.5px] text-[#5A5A5A] max-w-xl mx-auto leading-[1.5]">
                  Données {competitor} vérifiées sur le site officiel ({data.comparisonDate}). Tarifs en EUR — conversion USD au taux moyen 0,93.
                </p>
              </FadeInUp>

              <FadeInUp>
                <div className="overflow-x-auto rounded-2xl bg-white border border-gray-200">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left p-5 text-sm font-bold text-[#262626] w-[36%] sticky left-0 bg-white">
                          Critère
                        </th>
                        <th className="p-5 text-center text-sm font-bold text-[#716D5C]">{competitor}</th>
                        <th className="p-5 text-center text-sm font-bold text-[#003725] bg-[#F0F7F2]">Actero</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.comparison.map((row, idx) => (
                        <tr key={row.label} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}>
                          <td className="p-5 text-sm font-semibold text-[#262626] sticky left-0 bg-inherit">{row.label}</td>
                          <td className="p-5 text-center text-sm text-[#5A5A5A]">
                            <CellContent value={row.competitor} />
                          </td>
                          <td className="p-5 text-center text-sm text-[#1A1A1A] bg-[#F0F7F2]/40">
                            <CellContent value={row.actero} winner />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FadeInUp>

              <FadeInUp className="mt-5 text-center">
                <p className="text-xs text-[#716D5C]">
                  Sources : {data.sources}. Mis à jour {data.comparisonDate}.
                </p>
              </FadeInUp>
            </div>
          </section>

          {/* OPTIONAL EMBEDDED SLOT (e.g. cost calculator on /gorgias-vs-actero) */}
          {children && (
            <section className="py-20 md:py-28 bg-white px-6">
              <div className="max-w-[920px] mx-auto">{children}</div>
            </section>
          )}

          {/* WHEN TO PICK WHICH — balanced */}
          <section className="py-20 md:py-28 bg-white px-6">
            <div className="max-w-6xl mx-auto">
              <FadeInUp className="text-center mb-12">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
                  Pour qui chaque outil ?
                </p>
                <h2
                  className="font-normal leading-[1.05] text-[#1A1A1A] mb-3"
                  style={{ ...serif, fontSize: 'clamp(34px, 5vw, 52px)', letterSpacing: '-0.02em' }}
                >
                  Quand choisir {competitor},<br className="hidden md:block" />
                  <span className="italic text-[#716D5C]">quand choisir Actero.</span>
                </h2>
              </FadeInUp>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-[#F9F7F1] rounded-[20px] p-7 border border-[#E8DFC9]">
                  <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#716D5C] mb-3">
                    Choisir {competitor} si…
                  </div>
                  <ul className="space-y-3">
                    {data.whenCompetitor.map((item, i) => (
                      <li key={i} className="flex gap-3 text-[14.5px] text-[#3A3A3A] leading-[1.55]">
                        <span className="text-[#716D5C] mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#003725] rounded-[20px] p-7 text-white">
                  <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#A8C490] mb-3">
                    Choisir Actero si…
                  </div>
                  <ul className="space-y-3">
                    {data.whenActero.map((item, i) => (
                      <li key={i} className="flex gap-3 text-[14.5px] text-white/90 leading-[1.55]">
                        <Check className="w-4 h-4 text-[#A8C490] flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="py-24 md:py-28 bg-[#F9F7F1] px-6">
            <div className="max-w-[820px] mx-auto text-center">
              <FadeInUp>
                <h2
                  className="font-normal text-[#1A1A1A] mb-5 leading-[1.05]"
                  style={{ ...serif, fontSize: 'clamp(36px, 5.5vw, 60px)', letterSpacing: '-0.02em' }}
                >
                  Convaincu par les chiffres ?<br className="hidden md:block" />
                  <span className="italic text-[#716D5C]">Testez Actero en 15 minutes.</span>
                </h2>
                <p className="text-[16px] text-[#5A5A5A] max-w-xl mx-auto mb-8 leading-[1.55]">
                  OAuth Shopify 1-clic, agent prêt à répondre dans l'heure, plan Free à vie sans carte bancaire.
                </p>
                <div className="flex flex-wrap gap-3.5 justify-center">
                  <button
                    onClick={() => {
                      trackEvent('Vs_Bottom_CTA_Clicked', { competitor: data.competitorKey })
                      onNavigate('/signup')
                    }}
                    className="inline-flex items-center gap-2 bg-cta hover:bg-[#0A4F2C] text-white px-[26px] py-[14px] rounded-full text-[15px] font-semibold transition-colors"
                  >
                    Essai gratuit 7 jours <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <TalkToHumanButton source={`vs_${data.competitorKey}_final_cta`} variant="light" />
                </div>
              </FadeInUp>
            </div>
          </section>

          {/* FAQ */}
          <section className="py-20 md:py-28 bg-white px-6">
            <div className="max-w-[760px] mx-auto">
              <FadeInUp className="text-center mb-12">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">FAQ</p>
                <h2
                  className="font-normal leading-[1.05] text-[#1A1A1A] mb-3"
                  style={{ ...serif, fontSize: 'clamp(34px, 5vw, 52px)', letterSpacing: '-0.02em' }}
                >
                  Questions fréquentes,<br className="hidden md:block" />
                  <span className="italic text-[#716D5C]">{competitor} vs Actero.</span>
                </h2>
              </FadeInUp>

              <div>
                {data.faqs.map((f, i) => {
                  const isOpen = openFaq === i
                  return (
                    <div key={i} className="border-b border-black/[0.08]">
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : i)}
                        className="w-full text-left bg-transparent border-none py-[22px] cursor-pointer flex justify-between items-center gap-4"
                        aria-expanded={isOpen}
                      >
                        <h3 className="text-[16.5px] font-semibold text-[#1A1A1A] m-0">{f.q}</h3>
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all text-[18px] font-light leading-none ${
                            isOpen ? 'bg-[#003725] text-white' : 'bg-[#F9F7F1] text-[#716D5C]'
                          }`}
                        >
                          {isOpen ? '−' : '+'}
                        </div>
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="pr-[60px] pb-[22px] text-[15px] text-[#5A5A5A] leading-[1.6]">{f.a}</div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>

              <FadeInUp className="mt-12 pt-10 border-t border-black/[0.06]">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4 text-[#716D5C] text-center">
                  Autres comparatifs
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {data.crosslinks.map((link) => (
                    <button
                      key={link.href}
                      onClick={() => onNavigate(link.href)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F9F7F1] border border-[#E8DFC9] text-[13px] font-semibold text-[#262626] hover:border-cta hover:text-cta transition-colors"
                    >
                      {link.label}
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </FadeInUp>
            </div>
          </section>
        </main>

        <Footer onNavigate={onNavigate} />
      </div>
    </>
  )
}

function CellContent({ value, winner = false }) {
  if (value === true)
    return <Check className={`w-5 h-5 mx-auto ${winner ? 'text-cta' : 'text-[#262626]'}`} strokeWidth={2.5} />
  if (value === false) return <X className="w-4 h-4 text-[#D1CFC3] mx-auto" strokeWidth={2.5} />
  if (value === 'partial') return <Minus className="w-4 h-4 text-[#D4A017] mx-auto" strokeWidth={2.5} />
  if (typeof value === 'object' && value !== null) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className={`text-[14px] font-bold ${winner ? 'text-[#003725]' : 'text-[#262626]'}`}>{value.main}</span>
        {value.sub && <span className="text-[11px] text-[#716D5C] leading-tight">{value.sub}</span>}
      </div>
    )
  }
  return <span className="text-[13.5px] font-medium">{value}</span>
}

export default VsTemplate
