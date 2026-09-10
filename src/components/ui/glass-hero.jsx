import React, { useEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, Loader2 } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { FadeInUp } from './scroll-animations'
import { Logo } from '../layout/Logo'
import { trackEvent } from '../../lib/analytics'

/**
 * GlassHero — end-to-end "AI ecosystem" style hero (Timbal-inspired), in Actero
 * colours + French: announcement pill → bold headline with a serif-italic gold
 * accent → subtitle → an interactive AI prompt box → dashboard preview.
 */
// Hero UI font — la sans de l'app, pour que le hero ne soit pas la seule
// surface à parler une autre langue typographique.
const heroFont = { fontFamily: 'var(--font-sans, "Inter Tight"), system-ui, sans-serif' }

export const GlassHero = ({ onNavigate }) => {
  const fontDisplay = { fontFamily: 'var(--font-display, "Inter Tight", ui-sans-serif, sans-serif)' }

  return (
    <section className="relative bg-white pt-36 md:pt-44 pb-16 px-6 overflow-hidden">
      {/* Fond blanc, sans habillage. Le hero portait un dégradé vertical vers
          un vert saturé, plus un grain à 16 % en fusion multiply dont la seule
          raison d'être était de texturer cette bande colorée. Sans le dégradé,
          le grain ne texture plus rien : il salit du blanc. Les deux partent
          ensemble. */}

      <div className="max-w-6xl mx-auto relative">
        <div className="max-w-4xl mx-auto text-center">
          {/* Announcement / social-proof pill */}
          <FadeInUp delay={0.02} className="mb-8">
            <button
              onClick={() => onNavigate && onNavigate('/entreprise')}
              className="inline-flex items-center gap-2 rounded-full bg-[#FFFFFF] border border-[#E6E8EC] py-1.5 pl-1.5 pr-3.5 text-[13px] font-semibold text-[#1A1A1A] hover:border-[#8B7A50]/40 transition-colors"
            >
              <span className="rounded-full bg-white border border-[#E6E8EC] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8B7A50]">
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
                ...heroFont,
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
            <p className="text-[#716D5C] text-[17px] md:text-[19px] leading-relaxed max-w-2xl mx-auto" style={heroFont}>
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
 * product surface; submitting (Enter or the send button) calls the public demo
 * endpoint (`/api/public/hero-demo`) and renders the agent's answer inline, so
 * a visitor experiences the agent BEFORE signing up. The reply is followed by
 * the signup CTA — the demo IS the conversion path.
 */
const EXAMPLES = [
  'Où est ma commande #1082 ?',
  'Je veux échanger ma taille M contre une L',
  'Quel est le délai de livraison vers Lyon ?',
]

const GENERIC_ERROR =
  "Impossible de joindre l'agent pour le moment. Réessayez dans un instant."

function HeroPrompt({ onNavigate }) {
  const [value, setValue] = useState('')
  const [turns, setTurns] = useState([]) // { role: 'user' | 'agent', text }
  const [loading, setLoading] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const inputRef = useRef(null)
  const transcriptRef = useRef(null)

  // Keep the newest bubble in view inside the capped transcript area.
  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns, loading])

  const submit = async () => {
    const q = value.trim()
    trackEvent('Hero_Prompt_Submitted', { has_text: !!q })
    if (!q || loading) return

    setValue('')
    setTurns((prev) => [...prev, { role: 'user', text: q }])
    setLoading(true)

    try {
      const res = await fetch('/api/public/hero-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
      })
      const data = await res.json().catch(() => null)
      // The endpoint answers 200 with a graceful fallback, and still ships a
      // French `response` on 429 / too-long — so trust `response` when present.
      const reply = typeof data?.response === 'string' ? data.response.trim() : ''
      setTurns((prev) => [...prev, { role: 'agent', text: reply || GENERIC_ERROR }])
    } catch {
      setTurns((prev) => [...prev, { role: 'agent', text: GENERIC_ERROR }])
    } finally {
      setLoading(false)
    }
  }

  const prefill = (example) => {
    setValue(example)
    inputRef.current?.focus()
  }

  const hasReply = turns.some((t) => t.role === 'agent')

  return (
    <div className="mx-auto w-full max-w-2xl">
      <motion.div
        className="rounded-[22px] bg-white border border-black/[0.08] px-4 pt-4 pb-3 text-left"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 24px 48px -24px rgba(0,0,0,0.18)' }}
        whileHover={prefersReducedMotion ? {} : { y: -2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 24 }}
      >
        {/* Conversation — compact, scrolls internally so the hero never grows. */}
        {turns.length > 0 && (
          <div
            ref={transcriptRef}
            role="log"
            aria-live="polite"
            aria-label="Conversation avec l'agent SAV de démonstration"
            className="mb-3 max-h-[220px] overflow-y-auto space-y-2 pr-1"
            style={heroFont}
          >
            {turns.map((t, i) => (
              <div key={i} className={t.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    t.role === 'user'
                      ? 'max-w-[85%] rounded-2xl rounded-br-md bg-[#F4F4F2] px-3 py-2 text-[14px] text-[#1A1A1A]'
                      : 'max-w-[90%] rounded-2xl rounded-bl-md bg-[#E8F5EC] px-3 py-2 text-[14px] leading-relaxed text-[#14361F] whitespace-pre-line'
                  }
                >
                  {t.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-[#E8F5EC] px-3 py-2 text-[14px] text-[#14361F] inline-flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                  <span className="sr-only">L&apos;agent rédige sa réponse…</span>
                  <span aria-hidden>L&apos;agent rédige…</span>
                </div>
              </div>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder={turns.length ? 'Posez une autre question…' : `Essayez : « ${EXAMPLES[0]} »`}
          aria-label="Posez une question à l'agent SAV Actero"
          style={heroFont}
          className="w-full bg-transparent text-[16px] md:text-[17px] text-[#1A1A1A] placeholder:text-[#9ca3af] outline-none py-1.5"
        />

        <div className="flex items-center justify-between mt-3">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#E8F5EC] px-2.5 py-1.5 text-[12px] font-semibold text-cta">
            <Logo className="w-3.5 h-3.5 text-cta" />
            Agent SAV
          </span>

          <motion.button
            onClick={submit}
            disabled={loading}
            aria-label="Envoyer la question à l'agent"
            aria-busy={loading}
            className="w-9 h-9 rounded-full bg-cta text-white flex items-center justify-center hover:bg-[#0E653A] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            whileHover={prefersReducedMotion || loading ? {} : { scale: 1.06 }}
            whileTap={prefersReducedMotion || loading ? {} : { scale: 0.94 }}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <ArrowUpRight className="w-4 h-4" aria-hidden />
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Conversion CTA — appears as soon as the visitor has seen a real answer. */}
      {hasReply && (
        <div className="mt-3">
          <button
            onClick={() => {
              trackEvent('Hero_Demo_CTA_Clicked', { turns: turns.length })
              onNavigate && onNavigate('/signup')
            }}
            className="inline-flex items-center gap-2 rounded-full bg-cta px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#0E653A] transition-colors"
            style={heroFont}
          >
            Créer mon agent gratuitement
            <ArrowRight className="w-4 h-4" aria-hidden />
          </button>
        </div>
      )}

      {/* Example questions — one tap to prefill the input. */}
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            onClick={() => prefill(example)}
            aria-label={`Pré-remplir : ${example}`}
            style={heroFont}
            className="rounded-full bg-white/70 border border-black/[0.08] px-3 py-1.5 text-[12.5px] text-[#5A5A5A] hover:border-cta/40 hover:text-[#1A1A1A] transition-colors"
          >
            {example}
          </button>
        ))}
      </div>

      <p className="mt-3 text-[12.5px] text-[#716D5C]">
        {hasReply
          ? 'Démo publique · données de boutique fictives'
          : 'Testez l’agent en direct · sans carte bancaire'}
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
      <div className="h-9 bg-[#FFFFFF] border-b border-black/[0.05] flex items-center px-3.5 gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-[#E3E6EA]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#E3E6EA]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#E3E6EA]" />
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
                  <span className="w-2 h-2 rounded-full bg-[#E3E6EA]" />
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
                    <rect x="0" y={80 - auto} width="12" height={auto} fill="#13804A" rx="2" />
                    <rect
                      x="0"
                      y={80 - auto - human}
                      width="12"
                      height={human}
                      fill="#E3E6EA"
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
