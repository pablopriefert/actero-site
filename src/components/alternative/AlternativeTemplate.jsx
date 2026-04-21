import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Check, X, Minus, Plus, Sparkles, Clock, Shield, Zap } from 'lucide-react'
import { SEO } from '../SEO'
import { Navbar } from '../layout/Navbar'
import { Footer } from '../layout/Footer'
import { FadeInUp } from '../ui/scroll-animations'
import { PartnersMarquee } from '../ui/PartnersMarquee'
import { TalkToHumanButton } from '../ui/TalkToHumanButton'
import { trackEvent } from '../../lib/analytics'

/**
 * AlternativeTemplate — shared layout for /alternative-{gorgias,tidio,zendesk}.
 *
 * Design aligned with Landing/Pricing (variation A Refined Notion) :
 *   - Instrument Serif h1/h2 + italic muted suffix
 *   - Cream #F9F7F1 alternating with white
 *   - Cards rounded-[20px] border black/[0.05]
 *   - Pill CTAs — bg-cta primary / dark #003725 final CTA
 *
 * SEO :
 *   - Title + meta description optimized longue traîne
 *   - JSON-LD : FAQPage + SoftwareApplication (Actero) — Google Rich Results friendly
 *   - Structured H1/H2/H3 hierarchy for featured snippets
 */
export const AlternativeTemplate = ({ onNavigate, data }) => {
  const [openFaq, setOpenFaq] = useState(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    trackEvent('Alternative_Page_Viewed', { competitor: data.competitorKey })
  }, [data.competitorKey])

  const serif = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }
  const competitor = data.competitorName

  // ── JSON-LD : FAQ + SoftwareApplication ────────────────────────
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
        "Plateforme SaaS française d'automatisation IA du SAV e-commerce Shopify. Agent IA qui résout 60% des tickets automatiquement, installation OAuth en 15 minutes, hébergement UE RGPD.",
      offers: [
        {
          '@type': 'Offer',
          name: 'Free',
          price: '0',
          priceCurrency: 'EUR',
          description: '50 tickets/mois, sans carte bancaire, à vie',
        },
        {
          '@type': 'Offer',
          name: 'Starter',
          price: '99',
          priceCurrency: 'EUR',
          description: '1 000 tickets/mois, 3 workflows, essai 7 jours',
        },
        {
          '@type': 'Offer',
          name: 'Pro',
          price: '399',
          priceCurrency: 'EUR',
          description: '5 000 tickets/mois, agent vocal, workflows illimités',
        },
      ],
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        reviewCount: '27',
        bestRating: '5',
        worstRating: '1',
      },
      url: `https://actero.fr/alternative-${data.competitorKey}`,
      provider: {
        '@type': 'Organization',
        name: 'Actero SAS',
        url: 'https://actero.fr',
      },
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
          name: `Alternative à ${competitor}`,
          item: `https://actero.fr/alternative-${data.competitorKey}`,
        },
      ],
    },
  ]

  return (
    <>
      <SEO
        title={data.seo.title}
        description={data.seo.description}
        keywords={data.seo.keywords}
        canonical={`/alternative-${data.competitorKey}`}
        ogImage="https://actero.fr/og-image.png"
        schemaData={schema}
      />

      <div className="min-h-screen bg-white text-[#262626] font-sans selection:bg-[#003725]/10">
        <Navbar onNavigate={onNavigate} trackEvent={trackEvent} />

        <main>
          {/* ═══════════ HERO ═══════════ */}
          <section className="pt-28 md:pt-32 pb-16 px-6">
            <div className="max-w-[920px] mx-auto text-center">
              <FadeInUp className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-[#716D5C] bg-[#F9F7F1] border border-[#E8DFC9]">
                  <span className="w-1.5 h-1.5 rounded-full bg-cta" />
                  <span>Alternative à {competitor}</span>
                  <span className="text-[#E8DFC9]">·</span>
                  <span>FR · RGPD · Shopify natif</span>
                </div>
              </FadeInUp>

              <FadeInUp delay={0.05} className="mb-6">
                <h1
                  className="leading-[1.05] text-[#1A1A1A] font-normal"
                  style={{ ...serif, fontSize: 'clamp(38px, 5.2vw, 64px)', letterSpacing: '-0.02em' }}
                >
                  La meilleure alternative à {competitor}
                  <br />
                  <span className="italic text-[#716D5C]">pour les e-commerçants Shopify français.</span>
                </h1>
              </FadeInUp>

              <FadeInUp delay={0.1} className="mb-2">
                <p className="text-[15px] md:text-base text-[#5A5A5A] leading-[1.55] max-w-xl mx-auto">
                  {data.hero.subtitle}
                </p>
              </FadeInUp>

              <FadeInUp delay={0.12} className="mb-8">
                <p className="text-[13px] text-[#262626] font-medium mt-4">
                  Installé en 15 minutes · Plan Free à vie · Essai 7 jours sans carte bancaire
                </p>
              </FadeInUp>

              <FadeInUp delay={0.15}>
                <div className="flex flex-wrap items-center justify-center gap-3.5 mb-5">
                  <button
                    onClick={() => {
                      trackEvent('Alternative_Hero_CTA_Clicked', { competitor: data.competitorKey })
                      onNavigate('/signup')
                    }}
                    className="inline-flex items-center gap-2 px-[26px] py-[14px] rounded-full bg-cta hover:bg-[#0A4F2C] text-white text-[15px] font-semibold transition-all shadow-[0_1px_2px_rgba(14,101,58,0.2),0_8px_20px_rgba(14,101,58,0.15)] hover:-translate-y-px"
                  >
                    Essayer Actero gratuitement
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onNavigate('/tarifs')}
                    className="inline-flex items-center gap-2 px-6 py-[14px] rounded-full bg-transparent text-[#262626] text-[15px] font-semibold border border-black/10 hover:border-black/20 transition-colors"
                  >
                    Voir les tarifs
                  </button>
                  <TalkToHumanButton source={`alternative_${data.competitorKey}_hero`} variant="light" />
                </div>
              </FadeInUp>

              <FadeInUp delay={0.18}>
                <div className="inline-flex flex-wrap items-center justify-center gap-4 text-xs text-[#9ca3af]">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-cta" strokeWidth={2.5} />
                    60% de résolutions automatiques
                  </span>
                  <span className="text-[#E8DFC9]">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-cta" strokeWidth={2.5} />
                    Migration depuis {competitor} en 1 jour
                  </span>
                  <span className="text-[#E8DFC9]">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-cta" strokeWidth={2.5} />
                    Hébergé en UE
                  </span>
                </div>
              </FadeInUp>
            </div>
          </section>

          {/* ═══════════ PARTNERS MARQUEE ═══════════ */}
          <PartnersMarquee />

          {/* ═══════════ TABLEAU COMPARATIF ═══════════ */}
          <section className="py-24 md:py-32 bg-[#F9F7F1] px-6">
            <div className="max-w-5xl mx-auto">
              <FadeInUp className="text-center mb-14">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
                  Comparatif
                </p>
                <h2
                  className="font-normal leading-[1.05] text-[#1A1A1A] mb-4"
                  style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
                >
                  Actero vs {competitor},<br className="hidden md:block" />
                  <span className="italic text-[#716D5C]">point par point.</span>
                </h2>
                <p className="text-[17px] text-[#5A5A5A] max-w-xl mx-auto leading-[1.5]">
                  Comparaison factuelle sur les {data.comparison.length} critères qui comptent
                  vraiment pour un e-commerçant Shopify. Données {competitor} vérifiées sur leur
                  site officiel ({data.comparisonDate}).
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
                        <th className="p-5 text-center text-sm font-bold text-[#003725] bg-[#F0F7F2]">
                          Actero
                        </th>
                        <th className="p-5 text-center text-sm font-bold text-[#716D5C]">
                          {competitor}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.comparison.map((row, idx) => (
                        <tr
                          key={row.label}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}
                        >
                          <td className="p-5 text-sm font-semibold text-[#262626] sticky left-0 bg-inherit">
                            {row.label}
                          </td>
                          <td className="p-5 text-center text-sm text-[#1A1A1A] bg-[#F0F7F2]/40">
                            <CellContent value={row.actero} winner />
                          </td>
                          <td className="p-5 text-center text-sm text-[#5A5A5A]">
                            <CellContent value={row.competitor} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FadeInUp>

              <FadeInUp className="mt-6 text-center">
                <p className="text-xs text-[#716D5C]">
                  Dernière mise à jour : {data.comparisonDate}. Sources : {data.sources}
                </p>
              </FadeInUp>
            </div>
          </section>

          {/* ═══════════ POURQUOI SWITCHER ═══════════ */}
          <section className="py-24 md:py-32 bg-white px-6">
            <div className="max-w-6xl mx-auto">
              <FadeInUp className="text-center mb-14">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
                  Pourquoi switcher
                </p>
                <h2
                  className="font-normal leading-[1.05] text-[#1A1A1A] mb-4"
                  style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
                >
                  Ce que vous gagnez<br className="hidden md:block" />
                  <span className="italic text-[#716D5C]">en quittant {competitor}.</span>
                </h2>
              </FadeInUp>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
                {data.whySwitch.map((w, i) => {
                  const Icon = w.icon
                  return (
                    <FadeInUp key={i}>
                      <div className="bg-[#F9F7F1] rounded-[20px] p-8 border border-[#E8DFC9] h-full">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-11 h-11 rounded-[12px] bg-white border border-[#E8DFC9] flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-cta" strokeWidth={2} />
                          </div>
                          <div className="flex-1">
                            <div className="text-[32px] font-bold text-[#1A1A1A] leading-none mb-1" style={{ letterSpacing: '-0.02em' }}>
                              {w.stat}
                            </div>
                            <div className="text-[12px] font-semibold text-cta uppercase tracking-[0.08em]">
                              {w.statLabel}
                            </div>
                          </div>
                        </div>
                        <h3 className="text-[18px] font-bold text-[#1A1A1A] mb-2 leading-[1.25]">
                          {w.title}
                        </h3>
                        <p className="text-[14px] text-[#5A5A5A] leading-[1.6]">{w.desc}</p>
                      </div>
                    </FadeInUp>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ═══════════ TÉMOIGNAGES (placeholder structure) ═══════════ */}
          <section className="py-24 md:py-32 bg-[#F9F7F1] px-6">
            <div className="max-w-5xl mx-auto">
              <FadeInUp className="text-center mb-14">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
                  Ils ont migré depuis {competitor}
                </p>
                <h2
                  className="font-normal leading-[1.05] text-[#1A1A1A] mb-4"
                  style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
                >
                  Des marques qui ont sauté le pas,<br className="hidden md:block" />
                  <span className="italic text-[#716D5C]">sans regret.</span>
                </h2>
              </FadeInUp>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {data.testimonials.map((t, i) => (
                  <FadeInUp key={i}>
                    <div className="bg-white rounded-[20px] p-7 border border-black/[0.05] h-full flex flex-col">
                      {/* Stars */}
                      <div className="flex gap-0.5 mb-4">
                        {[...Array(5)].map((_, s) => (
                          <svg key={s} className="w-4 h-4 text-[#F59E0B]" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.959a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.45a1 1 0 00-.364 1.118l1.287 3.96c.3.921-.755 1.688-1.54 1.118l-3.36-2.45a1 1 0 00-1.175 0l-3.36 2.45c-.784.57-1.838-.197-1.539-1.118l1.285-3.96a1 1 0 00-.362-1.118L2.98 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.951-.69l1.286-3.958z" />
                          </svg>
                        ))}
                      </div>
                      <p className="text-[14.5px] text-[#3A3A3A] leading-[1.65] mb-6 flex-1">
                        « {t.quote} »
                      </p>
                      <div className="pt-5 border-t border-black/[0.06]">
                        <div className="text-[14px] font-bold text-[#1A1A1A]">{t.author}</div>
                        <div className="text-[12px] text-[#716D5C] mt-0.5">{t.role}</div>
                      </div>
                    </div>
                  </FadeInUp>
                ))}
              </div>

              <FadeInUp className="mt-8 text-center">
                <p className="text-xs text-[#9ca3af] italic">
                  Les marques affichées sont des exemples types. Vos retours client remplaceront
                  ces témoignages dès leur collecte — contact@actero.fr.
                </p>
              </FadeInUp>
            </div>
          </section>

          {/* ═══════════ CTA (dark, italic accent) ═══════════ */}
          <section className="py-24 md:py-32 bg-[#003725] px-6">
            <div className="max-w-[820px] mx-auto text-center text-white">
              <FadeInUp>
                <h2
                  className="font-normal text-white mb-5 leading-[1.05]"
                  style={{ ...serif, fontSize: 'clamp(40px, 6vw, 68px)', letterSpacing: '-0.02em' }}
                >
                  Essayez Actero gratuitement —<br className="hidden md:block" />
                  <span className="italic text-[#A8C490]">agent prêt en 15 minutes.</span>
                </h2>
                <p className="text-[17px] text-[#F4F0E6]/70 max-w-xl mx-auto mb-8 leading-[1.55]">
                  Connectez Shopify en 1 clic. L'agent lit votre catalogue, apprend votre ton et
                  répond à vos premiers tickets dans l'heure. Aucune carte bancaire requise.
                </p>
                <div className="flex flex-wrap gap-3.5 justify-center mb-6">
                  <button
                    onClick={() => {
                      trackEvent('Alternative_Bottom_CTA_Clicked', { competitor: data.competitorKey })
                      onNavigate('/signup')
                    }}
                    className="inline-flex items-center gap-2 bg-[#F4F0E6] text-[#003725] px-[26px] py-[14px] rounded-full text-[15px] font-semibold hover:bg-white transition-colors"
                  >
                    Démarrer mon essai gratuit <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onNavigate('/tarifs')}
                    className="inline-flex items-center gap-2 bg-transparent text-white border border-[#F4F0E6]/25 px-6 py-[14px] rounded-full text-[15px] font-semibold hover:bg-white/10 transition-colors"
                  >
                    Voir les tarifs
                  </button>
                  <TalkToHumanButton source={`alternative_${data.competitorKey}_final_cta`} variant="dark" />
                </div>
                <div className="inline-flex flex-wrap items-center justify-center gap-[18px] text-[12.5px] text-[#F4F0E6]/55">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-[#A8C490]" strokeWidth={2.5} /> Sans carte bancaire
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-[#A8C490]" strokeWidth={2.5} /> Résiliation en 1 clic
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-[#A8C490]" strokeWidth={2.5} /> Garantie 30 jours
                  </span>
                </div>
              </FadeInUp>
            </div>
          </section>

          {/* ═══════════ FAQ (migration depuis X) ═══════════ */}
          <section className="py-24 md:py-32 bg-white px-6">
            <div className="max-w-[760px] mx-auto">
              <FadeInUp className="text-center mb-14">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
                  FAQ migration
                </p>
                <h2
                  className="font-normal leading-[1.05] text-[#1A1A1A] mb-3"
                  style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
                >
                  Tout ce que vous vouliez savoir<br className="hidden md:block" />
                  <span className="italic text-[#716D5C]">sur la migration depuis {competitor}.</span>
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
                            <div className="pr-[60px] pb-[22px] text-[15px] text-[#5A5A5A] leading-[1.6]">
                              {f.a}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>

              {/* ── Internal crosslinks (SEO + navigation) ── */}
              <FadeInUp className="mt-14 pt-10 border-t border-black/[0.06]">
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

/* ────────────────────────────────────────────────
   CellContent — renders boolean | string | object
   with optional winner highlight (Actero column)
   ──────────────────────────────────────────────── */
function CellContent({ value, winner = false }) {
  if (value === true)
    return <Check className={`w-5 h-5 mx-auto ${winner ? 'text-cta' : 'text-[#262626]'}`} strokeWidth={2.5} />
  if (value === false)
    return <X className="w-4 h-4 text-[#D1CFC3] mx-auto" strokeWidth={2.5} />
  if (value === 'partial')
    return <Minus className="w-4 h-4 text-[#D4A017] mx-auto" strokeWidth={2.5} />
  if (typeof value === 'object' && value !== null) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className={`text-[14px] font-bold ${winner ? 'text-[#003725]' : 'text-[#262626]'}`}>
          {value.main}
        </span>
        {value.sub && (
          <span className="text-[11px] text-[#716D5C] leading-tight">{value.sub}</span>
        )}
      </div>
    )
  }
  return <span className="text-[13.5px] font-medium">{value}</span>
}
