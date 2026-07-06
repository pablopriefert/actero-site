import React, { useEffect, useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import { motion, useSpring, useTransform, animate, useInView, useReducedMotion } from 'framer-motion'
import { FadeInUp } from './scroll-animations'
import { WatchDemoButton } from './WatchDemoButton'
import { CONTACT } from '../../config/contact'
import { trackEvent } from '../../lib/analytics'

/**
 * GlassHero — minimal editorial hero on a clean white background.
 * Renders only the headline, the CTAs, and the 3 KPI cards. The nav lives in
 * the site header; the announcement bar / eyebrow / subtitle / dashboard
 * preview were intentionally removed for a stripped-back, high-end look.
 */
export const GlassHero = ({ onNavigate }) => {
  const fontDisplay = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }
  const prefersReducedMotion = useReducedMotion()

  return (
    <section className="relative bg-white pt-28 md:pt-24 pb-16 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto relative">
        <div className="max-w-3xl mx-auto text-center">
          {/* Headline */}
          <FadeInUp delay={0.05} className="mb-8">
            <h1
              className="leading-[1.03] text-[#1A1A1A] font-normal"
              style={{
                ...fontDisplay,
                fontSize: 'clamp(42px, 6vw, 76px)',
                letterSpacing: '-0.02em',
              }}
            >
              Votre support client,
              <br />
              <span className="italic text-[#8B7A50]">résolu tout seul.</span>
            </h1>
          </FadeInUp>

          {/* CTAs — primary (black) + ghost demo + text-link humain */}
          <FadeInUp delay={0.1}>
            <div className="flex flex-wrap items-center justify-center gap-3.5 mb-3">
              <motion.button
                onClick={() => onNavigate && onNavigate('/signup')}
                className="inline-flex items-center gap-2 px-[26px] py-[14px] rounded-full bg-[#1A1A1A] hover:bg-black text-white text-[15px] font-semibold transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.15),0_8px_20px_rgba(0,0,0,0.12)] group"
                whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                Créer un compte gratuitement
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </motion.button>
              <WatchDemoButton source="landing_hero" variant="light" />
            </div>
            <div className="mb-5">
              <button
                onClick={() => {
                  trackEvent('Talk_To_Human_Clicked', { source: 'landing_hero_link' })
                  window.open(CONTACT.demo.url, '_blank', 'noopener,noreferrer')
                }}
                className="inline-flex items-center gap-1 text-[13px] text-[#716D5C] hover:text-[#1A1A1A] font-medium transition-colors"
              >
                ou parler à un humain
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </FadeInUp>

          {/* Hero KPIs — 3 chiffres mappés sur les 3 piliers */}
          <FadeInUp delay={0.15}>
            <HeroKpiRow />
          </FadeInUp>
        </div>
      </div>
    </section>
  )
}

/**
 * AnimatedKpiNumber — count-up on enter into viewport.
 * Respects prefers-reduced-motion (shows final value immediately).
 */
function AnimatedKpiNumber({ target, prefix = '', suffix = '', fontStyle: _fontStyle }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const prefersReducedMotion = useReducedMotion()

  const spring = useSpring(prefersReducedMotion ? target : 0, {
    damping: 30,
    stiffness: 100,
  })
  const display = useTransform(spring, (v) => Math.round(v).toString())

  useEffect(() => {
    if (inView && !prefersReducedMotion) {
      animate(spring, target, { duration: 1.8, ease: 'easeOut' })
    }
  }, [inView, prefersReducedMotion, spring, target])

  return (
    <span ref={ref}>
      {prefix}
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  )
}

/**
 * HeroKpiRow — 3 KPIs mappés 1:1 sur les 3 piliers du produit.
 *   Pilier 1 · Agent SAV          → 50-70% de tickets auto-résolus
 *   Pilier 2 · Relance paniers    → +15% de CA récupéré
 *   Pilier 3 · Automatisations    → 5 min pour activer un playbook
 */
function HeroKpiRow() {
  const fontDisplay = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }
  const prefersReducedMotion = useReducedMotion()

  const kpis = [
    {
      numericTarget: 70,
      prefix: '',
      suffix: '',
      unit: '%',
      label: 'de tickets auto-résolus',
      sub: 'Agent SAV — généralement 50 à 70% selon votre volume',
    },
    {
      numericTarget: 15,
      prefix: '+',
      suffix: '',
      unit: '%',
      label: 'de CA paniers récupérés',
      sub: 'Agent de relance proactif, personnalisé',
    },
    {
      numericTarget: 5,
      prefix: '',
      suffix: '',
      unit: 'min',
      label: "pour activer un playbook",
      sub: '10+ workflows e-commerce prêts à brancher',
    },
  ]

  return (
    <div className="mt-10 max-w-3xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {kpis.map((k, i) => (
          <motion.div
            key={i}
            className="px-5 py-5 rounded-[18px] bg-white border border-black/[0.08] text-left"
            whileHover={prefersReducedMotion ? {} : { y: -4, borderColor: 'rgba(0,0,0,0.16)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, duration: 0.25 }}
          >
            <div
              className="leading-none text-[#1A1A1A] font-normal tabular-nums"
              style={{ ...fontDisplay, fontSize: 'clamp(38px, 4.6vw, 52px)', letterSpacing: '-0.02em' }}
            >
              <AnimatedKpiNumber
                target={k.numericTarget}
                prefix={k.prefix}
                suffix={k.suffix}
                fontStyle={fontDisplay}
              />
              <span className="text-[#716D5C] text-[0.45em] font-medium ml-0.5 align-baseline">
                {k.unit}
              </span>
              <span className="text-[#716D5C] text-[0.35em] font-medium ml-0.5 align-super">*</span>
            </div>
            <div className="text-[12.5px] font-bold text-[#1A1A1A] mt-2 leading-[1.3]">
              {k.label}
            </div>
            <div className="text-[11px] text-[#716D5C] mt-1 leading-[1.4]">
              {k.sub}
            </div>
          </motion.div>
        ))}
      </div>
      <p className="mt-3 text-[11px] italic text-[#716D5C] text-center leading-[1.4]">
        * Objectifs produit, benchmark pilote
      </p>
    </div>
  )
}
