import React, { useState, useEffect, useRef } from 'react'
import { ArrowRight, Check, X } from 'lucide-react'
import { motion, useSpring, useTransform, animate, useInView, useReducedMotion } from 'framer-motion'
import { FadeInUp } from './scroll-animations'
import { WatchDemoButton } from './WatchDemoButton'
import { CONTACT } from '../../config/contact'
import { trackEvent } from '../../lib/analytics'

/**
 * GlassHero — Variation A (Refined Notion) implementation.
 *
 * Premium upgrade :
 * — Announcement bar dismissible (localStorage "actero_announce_vision_v1")
 *   en haut : "Claude Vision est disponible — l'agent comprend maintenant
 *   les photos clients →"
 * — Titre Instrument Serif avec 1 mot gradient vert (from #003725 to #14A85C)
 * — Subtitle 3-piliers (SAV + relance paniers + automatisations)
 * — CTA primary unique + ghost "Voir la démo"
 * — Link "Parler à un humain" demoted en text-link avec arrow
 * — 3 KPIs mappés sur les 3 piliers (60%, +15%, 5min setup)
 * — Dashboard mockup avec aspect-ratio déclaré pour réduire CLS
 * — Task 1 : count-up animated KPI numbers on enter
 * — Task 2 : ambient aurora glow blobs behind hero (z-0)
 * — Task 8 : announcement pill spring entrance
 */
export const GlassHero = ({ onNavigate }) => {
  const fontDisplay = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }
  const prefersReducedMotion = useReducedMotion()

  /* ─── Announcement bar dismiss (localStorage, default visible) ─── */
  const ANNOUNCE_KEY = 'actero_announce_vision_v1'
  const [showAnnounce, setShowAnnounce] = useState(true)

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(ANNOUNCE_KEY)
      if (dismissed === '1') setShowAnnounce(false)
    } catch {
      /* localStorage unavailable — keep default visible */
    }
  }, [])

  const dismissAnnounce = () => {
    setShowAnnounce(false)
    try {
      window.localStorage.setItem(ANNOUNCE_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="relative bg-white pt-28 md:pt-24 pb-6 px-6 overflow-hidden">
      {/* ══════════════════ TASK 2: AURORA GLOW BLOBS (z-0, behind everything) ══════════════════ */}
      {!prefersReducedMotion && (
        <>
          <motion.div
            className="absolute -top-24 -left-32 w-[520px] h-[520px] rounded-full bg-[#14A85C]/[0.07] blur-3xl pointer-events-none"
            style={{ zIndex: 0 }}
            animate={{
              x: [0, 30, -15, 0],
              y: [0, -20, 25, 0],
              scale: [1, 1.08, 0.95, 1],
            }}
            transition={{
              duration: 18,
              ease: 'easeInOut',
              repeat: Infinity,
              repeatType: 'loop',
            }}
          />
          <motion.div
            className="absolute top-1/3 -right-40 w-[480px] h-[480px] rounded-full bg-[#A8C490]/[0.12] blur-3xl pointer-events-none"
            style={{ zIndex: 0 }}
            animate={{
              x: [0, -25, 10, 0],
              y: [0, 20, -30, 0],
              scale: [1, 0.92, 1.06, 1],
            }}
            transition={{
              duration: 22,
              ease: 'easeInOut',
              repeat: Infinity,
              repeatType: 'loop',
              delay: 3,
            }}
          />
          <motion.div
            className="absolute bottom-0 left-1/3 w-[360px] h-[360px] rounded-full bg-[#14A85C]/[0.05] blur-3xl pointer-events-none"
            style={{ zIndex: 0 }}
            animate={{
              x: [0, 20, -10, 0],
              y: [0, -15, 10, 0],
              scale: [1, 1.1, 0.97, 1],
            }}
            transition={{
              duration: 16,
              ease: 'easeInOut',
              repeat: Infinity,
              repeatType: 'loop',
              delay: 6,
            }}
          />
        </>
      )}

      <div className="max-w-6xl mx-auto relative" style={{ zIndex: 1 }}>
        {/* ══════════════════ ANNOUNCEMENT BAR — TASK 8: spring entrance ══════════════════ */}
        {showAnnounce && (
          <motion.div
            className="mb-8 flex justify-center"
            initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 300, damping: 28, delay: 0.1 }
            }
          >
            <div className="group inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full bg-[#F4F0E6] border border-[#E8DFC9] text-[12.5px] text-[#003725] max-w-full">
              <span className="shrink-0 text-[#716D5C]" aria-hidden>
                ✨
              </span>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('/produit')}
                className="inline-flex items-center gap-1.5 font-medium hover:underline underline-offset-2 decoration-[#003725]/40 truncate"
              >
                <strong className="font-semibold">Claude Vision est disponible</strong>
                <span className="hidden sm:inline text-[#5A5A5A]">
                  — l'agent comprend maintenant les photos clients
                </span>
                <ArrowRight className="w-3 h-3 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={dismissAnnounce}
                aria-label="Fermer l'annonce"
                className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[#716D5C] hover:bg-white hover:text-[#003725] transition-colors"
              >
                <X className="w-3 h-3" strokeWidth={2.2} />
              </button>
            </div>
          </motion.div>
        )}

        {/* ══════════════════ HERO TEXT — centered ══════════════════ */}
        <div className="max-w-3xl mx-auto text-center">
          {/* Eyebrow — partner chip cream */}
          <FadeInUp className="mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-[#716D5C] bg-[#F9F7F1] border border-[#E8DFC9]">
              <span className="w-1.5 h-1.5 rounded-full bg-cta" />
              <span>Powered by</span>
              <strong className="text-[#262626] font-semibold">ElevenLabs Grants</strong>
              <span className="text-[#E8DFC9]">·</span>
              <span>Shopify Partner 2026</span>
            </div>
          </FadeInUp>

          {/* Headline — Instrument Serif + italic muted suffix + gradient accent */}
          <FadeInUp delay={0.05} className="mb-6">
            <h1
              className="leading-[1.05] text-[#1A1A1A] font-normal"
              style={{
                ...fontDisplay,
                fontSize: 'clamp(38px, 5.2vw, 64px)',
                letterSpacing: '-0.02em',
              }}
            >
              Votre{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#003725] to-[#14A85C]">
                e-commerce
              </span>{' '}
              tourne,
              <br />
              <span className="italic text-[#716D5C]">tout seul, 24/7.</span>
            </h1>
          </FadeInUp>

          {/* Subtitle — 3 piliers explicit */}
          <FadeInUp delay={0.1} className="mb-2">
            <p className="text-[15px] md:text-base text-[#5A5A5A] leading-[1.55] max-w-xl mx-auto">
              L'agent IA qui gère vos tickets SAV, relance les paniers abandonnés et automatise
              vos workflows e-commerce — 24/7, en français, avec le ton de votre marque.
            </p>
          </FadeInUp>

          {/* Sub-line bold */}
          <FadeInUp delay={0.12} className="mb-8">
            <p className="text-[13px] text-[#262626] font-medium">
              Installé en 15 minutes · Essai 7 jours · Sans carte bancaire
            </p>
          </FadeInUp>

          {/* CTAs — primary unique + ghost demo + text-link humain */}
          <FadeInUp delay={0.15}>
            <div className="flex flex-wrap items-center justify-center gap-3.5 mb-3">
              {/* TASK 4: primary CTA with motion micro-interactions */}
              <motion.button
                onClick={() => onNavigate && onNavigate('/signup')}
                className="inline-flex items-center gap-2 px-[26px] py-[14px] rounded-full bg-cta hover:bg-[#0A4F2C] text-white text-[15px] font-semibold transition-colors shadow-[0_1px_2px_rgba(14,101,58,0.2),0_8px_20px_rgba(14,101,58,0.15)] group"
                whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                Essai gratuit 7 jours
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
                className="inline-flex items-center gap-1 text-[13px] text-[#716D5C] hover:text-[#003725] font-medium transition-colors"
              >
                ou parler à un humain
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </FadeInUp>

          {/* Hero KPIs — 3 chiffres mappés sur les 3 piliers — TASK 1: count-up */}
          <FadeInUp delay={0.18}>
            <HeroKpiRow />
          </FadeInUp>

          {/* Compliance tags — plus discret, sous les KPIs */}
          <FadeInUp delay={0.22} className="mt-5">
            <div className="inline-flex flex-wrap items-center justify-center gap-4 text-[11px] text-[#9ca3af]">
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3 h-3 text-cta" strokeWidth={2.5} />
                RGPD · Hébergé en UE
              </span>
              <span className="text-[#E8DFC9]">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3 h-3 text-cta" strokeWidth={2.5} />
                OAuth Shopify 1-clic
              </span>
              <span className="text-[#E8DFC9]">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3 h-3 text-cta" strokeWidth={2.5} />
                Opt-out TDM
              </span>
            </div>
          </FadeInUp>
        </div>

        {/* ══════════════════ DASHBOARD PREVIEW ══════════════════ */}
        <FadeInUp delay={0.25} className="mt-16">
          <div
            className="relative rounded-3xl p-4 border border-[#E8DFC9]"
            style={{
              background: 'linear-gradient(180deg, #F9F7F1 0%, #F4F0E6 100%)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 40px 80px -20px rgba(0,55,37,0.15)',
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
function AnimatedKpiNumber({ target, prefix = '', suffix = '', fontStyle }) {
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
 * DashboardPreview — mock visuel du dashboard client (browser chrome +
 * sidebar + KPIs + histogramme SVG). Tous les chiffres sont static —
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

/**
 * HeroKpiRow — 3 KPIs mappés 1:1 sur les 3 piliers du produit.
 * TASK 1: animated count-up on viewport enter.
 *
 *   Pilier 1 · Agent SAV          → 60% de tickets auto-résolus
 *   Pilier 2 · Relance paniers    → +15% de CA récupéré
 *   Pilier 3 · Automatisations    → 5 min pour activer un playbook
 */
function HeroKpiRow() {
  const fontDisplay = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }
  const prefersReducedMotion = useReducedMotion()

  const kpis = [
    {
      numericTarget: 60,
      prefix: '',
      suffix: '',
      unit: '%',
      label: 'de tickets auto-résolus',
      sub: 'Agent SAV — email, chat, Gorgias, Zendesk',
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
            className="px-5 py-5 rounded-[18px] bg-white border border-[#E8DFC9] text-left"
            whileHover={prefersReducedMotion ? {} : { y: -4, borderColor: '#D4C59E' }}
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
