import React from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { FadeInUp } from './scroll-animations'
import { TalkToHumanButton } from './TalkToHumanButton'

/**
 * GlassHero — Variation A (Refined Notion) implementation.
 *
 * Design (depuis le design bundle Claude Design) :
 * — Centré, max-w-1120 (~6xl)
 * — Chip partenaires cream/E8DFC9 avec dot cta + "Powered by ElevenLabs
 *   Grants · Shopify Partner 2026"
 * — Headline Instrument Serif clamp(38,5.2vw,64px), italique muted sur
 *   la 2e ligne "entièrement automatisé."
 * — Subtitle Inter 16px + ligne bold 13px
 * — 2 CTAs pill (primary cta + ghost outline)
 * — Row 3 trust tags avec check icons
 * — Dashboard preview en dessous : window chrome + sidebar + KPIs + chart
 */
export const GlassHero = ({ onNavigate }) => {
  const fontDisplay = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }

  return (
    <section className="relative bg-white pt-28 md:pt-24 pb-6 px-6">
      <div className="max-w-6xl mx-auto">
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

          {/* Headline — Instrument Serif + italic muted suffix */}
          <FadeInUp delay={0.05} className="mb-6">
            <h1
              className="leading-[1.05] text-[#1A1A1A] font-normal"
              style={{
                ...fontDisplay,
                fontSize: 'clamp(38px, 5.2vw, 64px)',
                letterSpacing: '-0.02em',
              }}
            >
              Votre SAV Shopify,
              <br />
              <span className="italic text-[#716D5C]">entièrement automatisé.</span>
            </h1>
          </FadeInUp>

          {/* Subtitle */}
          <FadeInUp delay={0.1} className="mb-2">
            <p className="text-[15px] md:text-base text-[#5A5A5A] leading-[1.55] max-w-xl mx-auto">
              L'agent IA français qui répond aux questions clients, traite les retours et relance
              les paniers abandonnés pendant que votre équipe se concentre sur la vente.
            </p>
          </FadeInUp>

          {/* Sub-line bold */}
          <FadeInUp delay={0.12} className="mb-8">
            <p className="text-[13px] text-[#262626] font-medium">
              Installé en 15 minutes · Essai 7 jours · Sans carte bancaire
            </p>
          </FadeInUp>

          {/* CTAs */}
          <FadeInUp delay={0.15}>
            <div className="flex flex-wrap items-center justify-center gap-3.5 mb-5">
              <button
                onClick={() => onNavigate && onNavigate('/signup')}
                className="inline-flex items-center gap-2 px-[26px] py-[14px] rounded-full bg-cta hover:bg-[#0A4F2C] text-white text-[15px] font-semibold transition-all shadow-[0_1px_2px_rgba(14,101,58,0.2),0_8px_20px_rgba(14,101,58,0.15)] hover:-translate-y-px"
              >
                Démarrer mon essai gratuit
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigate && onNavigate('/tarifs')}
                className="inline-flex items-center gap-2 px-6 py-[14px] rounded-full bg-transparent text-[#262626] text-[15px] font-semibold border border-black/10 hover:border-black/20 transition-colors"
              >
                Voir les tarifs
              </button>
              <TalkToHumanButton source="landing_hero" variant="light" />
            </div>
          </FadeInUp>

          {/* Trust tags row */}
          <FadeInUp delay={0.18}>
            <div className="inline-flex flex-wrap items-center justify-center gap-4 text-xs text-[#9ca3af]">
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3 h-3 text-cta" strokeWidth={2.5} />
                60% de résolutions automatiques
              </span>
              <span className="text-[#E8DFC9]">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3 h-3 text-cta" strokeWidth={2.5} />
                RGPD · Hébergé en UE
              </span>
              <span className="text-[#E8DFC9]">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3 h-3 text-cta" strokeWidth={2.5} />
                OAuth Shopify 1-clic
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
    <div className="bg-white rounded-2xl overflow-hidden border border-black/[0.06]">
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
