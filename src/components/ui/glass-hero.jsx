import React, { useState } from 'react'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { FadeInUp } from './scroll-animations'
import { Logo } from '../layout/Logo'
import { trackEvent } from '../../lib/analytics'

/**
 * GlassHero — end-to-end "AI ecosystem" style hero (Timbal-inspired), in Actero
 * colours + French: announcement pill → bold headline with a serif-italic gold
 * accent → subtitle → an interactive AI prompt box → dashboard preview.
 */
export const GlassHero = ({ onNavigate }) => {
  const fontDisplay = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }

  return (
    <section className="relative bg-white pt-36 md:pt-44 pb-16 px-6 overflow-hidden">
      {/* soft brand glow behind the headline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-24 mx-auto h-[420px] max-w-3xl"
        style={{ background: 'radial-gradient(60% 60% at 50% 40%, rgba(168,196,144,0.16), rgba(255,255,255,0) 70%)' }}
      />

      <div className="max-w-6xl mx-auto relative">
        <div className="max-w-4xl mx-auto text-center">
          {/* Announcement / social-proof pill */}
          <FadeInUp delay={0.02} className="mb-8">
            <button
              onClick={() => onNavigate && onNavigate('/entreprise')}
              className="inline-flex items-center gap-2 rounded-full bg-[#F9F7F1] border border-[#EFE7D6] py-1.5 pl-1.5 pr-3.5 text-[13px] font-semibold text-[#1A1A1A] hover:border-[#8B7A50]/40 transition-colors"
            >
              <span className="rounded-full bg-white border border-[#EFE7D6] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8B7A50]">
                Soutenu par
              </span>
              <img
                src="/stationf-logo.png"
                alt="Station F"
                className="h-[13px] w-auto object-contain"
                loading="eager"
                decoding="async"
              />
              <ArrowRight className="w-3.5 h-3.5 text-[#716D5C]" />
            </button>
          </FadeInUp>

          {/* Headline — bold sans, serif-italic gold accent (mirrors "for creators") */}
          <FadeInUp delay={0.05} className="mb-6">
            <h1
              className="font-bold text-[#1A1A1A] leading-[1.02]"
              style={{
                fontFamily: 'var(--font-sans, "DM Sans", system-ui, sans-serif)',
                fontSize: 'clamp(44px, 7vw, 88px)',
                letterSpacing: '-0.03em',
              }}
            >
              L&apos;agent IA du support
              <br />
              client pour{' '}
              <span className="font-normal italic text-[#8B7A50]" style={fontDisplay}>
                le e-commerce
              </span>
            </h1>
          </FadeInUp>

          {/* Subtitle */}
          <FadeInUp delay={0.08} className="mb-10">
            <p className="text-[#716D5C] text-[17px] md:text-[19px] leading-relaxed max-w-2xl mx-auto">
              Actero est l&apos;agent SAV autonome pour Shopify. Il répond à vos clients,
              suit les commandes et relance les paniers abandonnés — dans votre ton de
              marque, 24/7.
            </p>
          </FadeInUp>

          {/* AI prompt box */}
          <FadeInUp delay={0.12}>
            <HeroPrompt onNavigate={onNavigate} />
          </FadeInUp>
        </div>

        {/* ══════════ DASHBOARD PREVIEW (desktop only) ══════════ */}
        <FadeInUp delay={0.2} className="mt-16 hidden md:block">
          <div
            className="relative rounded-3xl p-4 bg-white border border-black/[0.08]"
            style={{
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 40px 80px -20px rgba(0,0,0,0.12)',
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
 * HeroPrompt — the "chat AI" box under the subtitle. A real input styled like a
 * product surface; submitting (Enter or the send button) opens the live
 * simulator with the question pre-filled. Funnels to a hands-on trial, no card.
 */
const EXAMPLES = [
  'Où est ma commande #1082 ?',
  'Je veux échanger ma taille M contre une L',
  'Quel est le délai de livraison vers Lyon ?',
]

function HeroPrompt({ onNavigate }) {
  const [value, setValue] = useState('')
  const prefersReducedMotion = useReducedMotion()

  const submit = () => {
    const q = value.trim()
    trackEvent('Hero_Prompt_Submitted', { has_text: !!q })
    onNavigate && onNavigate(q ? `/demo?q=${encodeURIComponent(q)}` : '/demo')
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <motion.div
        className="rounded-[22px] bg-white border border-black/[0.08] px-4 pt-4 pb-3 text-left"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 24px 48px -24px rgba(0,0,0,0.18)' }}
        whileHover={prefersReducedMotion ? {} : { y: -2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 24 }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder={`Essayez : « ${EXAMPLES[0]} »`}
          aria-label="Posez une question à l'agent SAV Actero"
          className="w-full bg-transparent text-[16px] md:text-[17px] text-[#1A1A1A] placeholder:text-[#9ca3af] outline-none py-1.5"
        />

        <div className="flex items-center justify-between mt-3">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#E8F5EC] px-2.5 py-1.5 text-[12px] font-semibold text-cta">
            <Logo className="w-3.5 h-3.5 text-cta" />
            Agent SAV
          </span>

          <motion.button
            onClick={submit}
            aria-label="Tester l'agent"
            className="w-9 h-9 rounded-full bg-cta text-white flex items-center justify-center hover:bg-[#0a4f2c] transition-colors"
            whileHover={prefersReducedMotion ? {} : { scale: 1.06 }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.94 }}
          >
            <ArrowUpRight className="w-4 h-4" />
          </motion.button>
        </div>
      </motion.div>

      <p className="mt-3 text-[12.5px] text-[#716D5C]">
        Testez l&apos;agent en direct · sans carte bancaire
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
    { label: 'Simulateur' },
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
