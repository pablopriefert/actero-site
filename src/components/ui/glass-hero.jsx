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
    <section className="relative bg-white pt-40 md:pt-48 pb-16 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto relative">
        <div className="max-w-4xl mx-auto text-center">
          {/* Backed by Station F */}
          <FadeInUp delay={0.03} className="mb-6">
            <div className="inline-flex items-center justify-center gap-2 text-[15px] font-semibold text-[#1A1A1A]">
              <span>Backed by</span>
              <img
                src="/stationf-logo.png"
                alt="Station F"
                className="h-[22px] w-auto object-contain"
                loading="eager"
                decoding="async"
              />
            </div>
          </FadeInUp>

          {/* Headline */}
          <FadeInUp delay={0.05} className="mb-10">
            <h1
              className="leading-[1.02] text-[#1A1A1A] font-normal"
              style={{
                ...fontDisplay,
                fontSize: 'clamp(48px, 7vw, 96px)',
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
            <div className="flex flex-wrap items-center justify-center gap-3.5 mb-4">
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
            <div className="mb-8">
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

        {/* ══════════════════ DASHBOARD PREVIEW (desktop only) ══════════════════ */}
        <FadeInUp delay={0.2} className="mt-16 hidden md:block">
          <div
            className="relative rounded-3xl p-4 bg-white border border-black/[0.08]"
            style={{
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 40px 80px -20px rgba(0,0,0,0.12)',
              /* CLS guard — réserve la hauteur du dashboard preview
                 (window chrome 36px + grid 480px + padding 32px ≈ 552px) */
              minHeight: '552px',
            }}
          >
            <DashboardPreview />
          </div>
        </FadeInUp>
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

/**
 * DashboardPreview — mock visuel du dashboard client (browser chrome +
 * sidebar + KPIs + histogramme SVG). Tous les chiffres sont statiques —
 * c'est un visuel de preview, pas une connexion live.
 */
function DashboardPreview() {
  const sidebarItems = [
    { label: "Vue d'ensemble", active: true },
    { label: 'Tickets SAV' },
    { label: 'Paniers relancés' },
    { label: 'Agent vocal' },
    { label: 'Base connaissance' },
    { label: 'Intégrations' },
    { label: 'Ton de marque' },
  ]

  const kpis = [
    { label: 'Résolutions', value: '1 847', delta: '+12%', hint: 'sans humain' },
    { label: 'Heures libérées', value: '126h', delta: '+8h', hint: 'équipe SAV' },
    { label: 'CA récupéré', value: '18 420€', delta: '+15%', hint: 'paniers + upsell' },
    { label: 'CSAT moyen', value: '4.7', delta: '+0.3', hint: 'sur 5 étoiles' },
  ]

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-black/[0.06] w-full">
      {/* Window chrome */}
      <div className="h-9 bg-[#F9F7F1] border-b border-black/[0.05] flex items-center px-3.5 gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-[#E8DFC9]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#E8DFC9]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#E8DFC9]" />
        <div className="ml-5 text-[11px] text-[#9ca3af] font-mono">app.actero.fr / dashboard</div>
      </div>

      {/* Content grid — sidebar + main */}
      <div className="grid grid-cols-[220px_1fr] min-h-[480px]">
        {/* Sidebar */}
        <div className="bg-[#FAFAFA] border-r border-black/[0.05] px-3 py-5">
          <div className="px-2 pb-4 text-[11px] font-semibold text-[#9ca3af] uppercase tracking-[0.08em]">
            Boutique
          </div>
          {sidebarItems.map((item) => (
            <div
              key={item.label}
              className={`px-2.5 py-[7px] rounded-lg text-[13px] mb-0.5 cursor-pointer ${
                item.active
                  ? 'bg-[#E8F5EC] text-cta font-semibold'
                  : 'text-[#5A5A5A] font-medium'
              }`}
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* Main */}
        <div className="px-7 py-6">
          {/* Topbar */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-xl font-bold text-[#1A1A1A]">Vue d'ensemble</div>
              <div className="text-xs text-[#716D5C] mt-0.5">
                BoutiqueMode.fr · 30 derniers jours
              </div>
            </div>
            <div className="flex gap-2">
              <div className="px-2.5 py-1.5 border border-black/[0.08] rounded-lg text-xs text-[#5A5A5A]">
                30 jours ▾
              </div>
              <div className="px-2.5 py-1.5 bg-cta text-white rounded-lg text-xs font-semibold">
                Exporter PDF
              </div>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-2.5 mb-5">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="p-3.5 border border-black/[0.06] rounded-[10px] bg-white"
              >
                <div className="text-[11px] text-[#716D5C] font-medium">{k.label}</div>
                <div
                  className="text-[22px] font-bold text-[#1A1A1A] mt-1 tabular-nums"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  {k.value}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[11px] font-semibold text-cta bg-[#E8F5EC] px-1.5 rounded tabular-nums">
                    {k.delta}
                  </span>
                  <span className="text-[11px] text-[#9ca3af]">{k.hint}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="p-4 border border-black/[0.06] rounded-[10px]">
            <div className="flex justify-between mb-3.5">
              <div className="text-[13px] font-semibold text-[#1A1A1A]">
                Résolutions par jour
              </div>
              <div className="flex gap-2.5 text-[11px] text-[#716D5C]">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cta" />
                  Auto
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#E8DFC9]" />
                  Escalade humain
                </span>
              </div>
            </div>
            <svg width="100%" height="80" viewBox="0 0 600 80" preserveAspectRatio="none">
              {Array.from({ length: 30 }).map((_, i) => {
                const auto = 30 + Math.sin(i * 0.5) * 18 + (i % 3) * 4
                const human = 8 + Math.cos(i * 0.7) * 5
                return (
                  <g key={i} transform={`translate(${i * 20 + 4}, 0)`}>
                    <rect x="0" y={80 - auto} width="12" height={auto} fill="#0E653A" rx="2" />
                    <rect
                      x="0"
                      y={80 - auto - human}
                      width="12"
                      height={human}
                      fill="#E8DFC9"
                      rx="1"
                    />
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
