import React, { useState, useEffect } from 'react'
import { SEO } from '../components/SEO'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Check, Shield, Clock, CheckCircle2 } from 'lucide-react'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import { GlassHero } from '../components/ui/glass-hero'
import { FadeInUp } from '../components/ui/scroll-animations'
import { initAmplitude, trackEvent } from '../lib/analytics'
import { StickyCTABar } from '../components/ui/StickyCTABar'
import { ReadingProgress } from '../components/ui/ReadingProgress'
import { PartnersMarquee } from '../components/ui/PartnersMarquee'
import { CapabilitiesA } from '../components/landing/CapabilitiesA'
import { ROISimulatorA } from '../components/landing/ROISimulatorA'
import { PricingA } from '../components/landing/PricingA'
import { TalkToHumanButton } from '../components/ui/TalkToHumanButton'

/**
 * Actero Landing Page — Variation A (Refined Notion).
 *
 * Reprend la structure du design bundle Claude Design (variation-a/)
 * avec les choix du client — 8 sections :
 *   1. Navbar (sticky)
 *   2. Hero (centré, dashboard preview intégré — CTA « Voir les tarifs »)
 *   3. PartnersMarquee (4 badges PNG — ElevenLabs Grants, Shopify
 *      Partner, Google for Startups, Auth0)
 *   4. Capabilities (2 cards — SAV email/chat + Relance paniers)
 *   5. ROI Simulator (split sliders + dark result panel)
 *   6. Pricing (4 cards — Pro popular dark)
 *   7. FAQ (accordion rond +/-)
 *   8. Final CTA (dark, italic green accent)
 *   9. Footer dark 5-col
 *
 * Retirées à la demande user :
 * — ChatDemo « Comme votre meilleur employé SAV »
 * — Testimonials « Ce que nos clients disent d'Actero »
 * — Capabilities : 2 cards sur 4 (Agent vocal + Éditeur ton retirés),
 *   les 2 restantes remplissent l'espace
 *
 * Typo : Instrument Serif pour tous les h1/h2 (font-normal + italic suffix
 * muted sur la 2e ligne). Inter pour corps. DM Mono pour data accents.
 */
export const LandingPage = ({ onNavigate }) => {
  const [openFaqIndex, setOpenFaqIndex] = useState(-1)

  useEffect(() => {
    initAmplitude()
    trackEvent('Landing_Page_Viewed')
  }, [])

  const scrollToId = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  /* ─────────────── FAQ (7 questions, alignées variant A) ─────────────── */
  const faqs = [
    {
      q: 'Est-ce que je dois savoir coder ?',
      a: "Non. Actero est 100% self-service. Connectez Shopify en OAuth 1-clic, l'IA lit votre catalogue et vos politiques automatiquement.",
    },
    {
      q: 'Combien de temps pour voir les premiers résultats ?',
      a: "Installation en 15 minutes via le Setup Wizard. L'agent répond aux premiers tickets dans l'heure qui suit la connexion Shopify.",
    },
    {
      q: 'Est-ce que mes données sont sécurisées ?',
      a: "OAuth officiel Shopify, chiffrement AES-256, hébergement UE, RGPD, DPA signable. Nous sommes opt-out du TDM (Art. 4, Directive EU 2019/790) — vos données n'entraînent jamais nos modèles.",
    },
    {
      q: "Qu'est-ce que l'agent vocal ElevenLabs ?",
      a: 'Un agent téléphonique avec numéro FR et voix naturelle. 200 min incluses sur Pro, illimité + voix custom sur Enterprise.',
    },
    {
      q: 'Quelle différence avec Make ou Zapier ?',
      a: 'Make/Zapier sont génériques : vous construisez tout. Actero est spécialisé e-commerce avec agents préconfigurés, guardrails et dashboard ROI natif.',
    },
    {
      q: 'Je peux personnaliser la marque du portail SAV ?',
      a: 'Oui dès Pro : custom domain, logo, couleurs, suppression du branding Actero. Enterprise débloque le white-label complet.',
    },
    {
      q: 'Y a-t-il un engagement de durée ?',
      a: 'Non sur Free, Starter et Pro. Résiliation à tout moment depuis le dashboard.',
    },
  ]

  const serif = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }

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
     RENDER
     ═════════════════════════════════════════════════════════════════ */
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
        <ReadingProgress vertical="ecommerce" />
        <StickyCTABar onNavigate={onNavigate} />

        <Navbar onNavigate={onNavigate} scrollToId={scrollToId} />

        <main>
          {/* 1. HERO (centered + dashboard preview) */}
          <GlassHero onNavigate={onNavigate} />

          {/* 2. PARTNERS MARQUEE (4 badges PNG : ElevenLabs Grants,
              Shopify Partner, Google for Startups, Auth0) */}
          <PartnersMarquee />

          {/* 3. CAPABILITIES (2 cards — SAV email/chat + Relance paniers) */}
          <CapabilitiesA />

          {/* 5. ROI SIMULATOR (split + dark result panel) */}
          <ROISimulatorA />

          {/* 6. PRICING (4 cards — Pro popular dark) */}
          <PricingA onNavigate={onNavigate} />

          {/* 7. FAQ (accordion rond +/-) */}
          <section id="faq" className="py-24 md:py-32 bg-white px-6">
            <div className="max-w-[760px] mx-auto">
              <FadeInUp className="text-center mb-14">
                <h2
                  className="font-normal leading-[1.05] text-[#1A1A1A] mb-3"
                  style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
                >
                  Questions fréquentes
                </h2>
                <p className="text-[17px] text-[#716D5C]">
                  Tout ce que vous devez savoir avant de commencer.
                </p>
              </FadeInUp>
              <div>
                {faqs.map((f, i) => {
                  const isOpen = openFaqIndex === i
                  return (
                    <div key={i} className="border-b border-black/[0.08]">
                      <button
                        onClick={() => setOpenFaqIndex(isOpen ? -1 : i)}
                        className="w-full text-left bg-transparent border-none py-[22px] cursor-pointer flex justify-between items-center gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta focus-visible:ring-offset-2 rounded-lg"
                        aria-expanded={isOpen}
                      >
                        <span className="text-[16.5px] font-semibold text-[#1A1A1A]">{f.q}</span>
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all text-[18px] font-light leading-none ${
                            isOpen
                              ? 'bg-[#003725] text-white'
                              : 'bg-[#F9F7F1] text-[#716D5C]'
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
            </div>
          </section>

          {/* 8. FINAL CTA (dark, italic green accent) */}
          <section className="py-24 md:py-32 bg-[#003725] px-6">
            <div className="max-w-[820px] mx-auto text-center text-white">
              <FadeInUp>
                <h2
                  className="font-normal text-white mb-5 leading-[1.05]"
                  style={{ ...serif, fontSize: 'clamp(40px, 6vw, 72px)', letterSpacing: '-0.02em' }}
                >
                  Chaque semaine sans Actero,<br className="hidden md:block" />
                  <span className="italic text-[#A8C490]">c'est 40 heures payées pour rien.</span>
                </h2>
                <p className="text-[17px] text-[#F4F0E6]/70 max-w-xl mx-auto mb-8 leading-[1.55]">
                  Connectez Shopify en 1 clic, laissez l'IA apprendre votre catalogue, voyez
                  les premières résolutions livrées dans l'heure.
                </p>
                <div className="flex flex-wrap gap-3.5 justify-center mb-6">
                  <button
                    onClick={() => onNavigate('/signup')}
                    className="inline-flex items-center gap-2 bg-[#F4F0E6] text-[#003725] px-[26px] py-[14px] rounded-full text-[15px] font-semibold hover:bg-white transition-colors"
                  >
                    Démarrer mon essai gratuit <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <TalkToHumanButton source="landing_final_cta" variant="dark" />
                </div>
                <div className="inline-flex flex-wrap items-center justify-center gap-[18px] text-[12.5px] text-[#F4F0E6]/55">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-[#A8C490]" strokeWidth={2.5} /> Sans engagement
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-[#A8C490]" strokeWidth={2.5} /> Setup 15 min
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-[#A8C490]" strokeWidth={2.5} /> Plan Free à vie
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-[#A8C490]" strokeWidth={2.5} /> Annulable en 1 clic
                  </span>
                </div>
              </FadeInUp>
            </div>
          </section>
        </main>

        {/* 10. FOOTER (unified — cream, 4 cols, real links) */}
        <Footer onNavigate={onNavigate} />
      </div>
    </>
  )
}
