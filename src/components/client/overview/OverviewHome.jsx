import React, { useMemo, useRef, useEffect } from 'react'
import { motion, useSpring, useTransform, animate, useInView } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, ArrowRight, Sparkles, TrendingUp,
  CheckCircle2, Zap, Clock, Plug, BookOpen,
  Activity,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { trackEvent } from '../../../lib/analytics'
import VisionUsageWidget from './VisionUsageWidget.jsx'
import { EmptyState } from '../../ui/EmptyState.jsx'

/**
 * OverviewHome — narrative home.
 *
 * Structure (top to bottom) :
 *   1. Greeting          — "Bonjour {firstName}" en serif + date + sous-titre.
 *   2. 3 KPI cards       — aujourd'hui + variation + sparkline 14j.
 *   3. Timeline          — "Depuis ta dernière visite" : 5-8 événements récents.
 *   4. À faire aujourd'hui — checklist actionnable (escalades, KB, intégration).
 *   5. Widgets row       — VisionUsageWidget + upsell free-only.
 *
 * Tonalité : tutoiement. Typography : Instrument Serif pour les titres.
 */
export function OverviewHome({
  clientId,
  currentClient: _currentClient,
  firstName,
  // Plan state
  planId, planName: _planName, inTrial, trialDaysLeft, ticketsUsed, ticketsLimit, ticketsPercent, isOverLimit: _isOverLimit,
  limits,
  // Metrics state
  periodStats, selectedPeriod: _selectedPeriod, setSelectedPeriod: _setSelectedPeriod, dailyMetrics, eventCounts, liveRoi: _liveRoi,
  totalEvents, urgentEscalationCount, completedSetupSteps, showShopifyBanner, setupCompletion,
  // Actions
  setActiveTab, theme: _theme, onOpenSetupWizard,
}) {
  const sectionVariants = {
    initial: { opacity: 0, y: 20 },
    animate: (i) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] },
    }),
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* 1. Greeting */}
      <motion.div
        custom={0}
        variants={sectionVariants}
        initial="initial"
        animate="animate"
      >
        <GreetingBlock firstName={firstName} />
      </motion.div>

      {/* 2. 3 KPI cards (top-level KPIs) */}
      <motion.div
        custom={1}
        variants={sectionVariants}
        initial="initial"
        animate="animate"
      >
        {totalEvents > 0 ? (
          <KpiTrio
            clientId={clientId}
            eventCounts={eventCounts}
            periodStats={periodStats}
            dailyMetrics={dailyMetrics}
          />
        ) : (
          <EmptyKpiHint onOpenSetupWizard={onOpenSetupWizard} setActiveTab={setActiveTab} />
        )}
      </motion.div>

      {/* 3. Timeline "Depuis ta dernière visite" */}
      <motion.div
        custom={2}
        variants={sectionVariants}
        initial="initial"
        animate="animate"
      >
        <TimelineSection
          clientId={clientId}
          setActiveTab={setActiveTab}
          hasIntegration={!!setupCompletion?.shopify || completedSetupSteps > 0}
        />
      </motion.div>

      {/* 4. À faire aujourd'hui */}
      <motion.div
        custom={3}
        variants={sectionVariants}
        initial="initial"
        animate="animate"
      >
        <TodoSection
          clientId={clientId}
          urgentEscalationCount={urgentEscalationCount}
          showShopifyBanner={showShopifyBanner}
          ticketsPercent={ticketsPercent}
          ticketsUsed={ticketsUsed}
          ticketsLimit={ticketsLimit}
          planId={planId}
          inTrial={inTrial}
          trialDaysLeft={trialDaysLeft}
          completedSetupSteps={completedSetupSteps}
          setupCompletion={setupCompletion}
          setActiveTab={setActiveTab}
          onOpenSetupWizard={onOpenSetupWizard}
        />
      </motion.div>

      {/* 5. Widgets row — sidebar-level, not hero-level */}
      {clientId && (
        <motion.div
          custom={4}
          variants={sectionVariants}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <VisionUsageWidget
            clientId={clientId}
            planLimit={limits?.vision_analyses_per_month}
          />
        </motion.div>
      )}

      {/* Upsell — free only */}
      {planId === 'free' && (
        <div className="bg-cta/5 border border-cta/20 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[#1a1a1a]">Débloque les automatisations avancées</p>
            <p className="text-[13px] text-[#5A5A5A] mt-0.5">
              Le plan Starter inclut 500 tickets/mois, les templates de réponse et les intégrations Gorgias/Zendesk.
            </p>
          </div>
          <button
            onClick={() => {
              trackEvent('Upgrade Clicked', { from_plan: 'free', to_plan: 'starter', trigger: 'overview_upsell', location: 'overview' })
              setActiveTab('billing')
            }}
            className="px-4 py-2 bg-cta text-white text-[13px] font-semibold rounded-full hover:bg-[#003725] transition flex-shrink-0"
          >
            Passer au Starter
          </button>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   1. GreetingBlock — "Bonjour {firstName}" + date + sous-titre
   ═══════════════════════════════════════════════════════════════════ */
function GreetingBlock({ firstName }) {
  const today = useMemo(() => {
    return new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
  }, [])

  const salutation = firstName ? `Bonjour ${firstName}` : 'Bonjour et bienvenue'

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1
            className="text-[34px] md:text-[40px] italic tracking-tight text-[#1a1a1a] leading-none"
            style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 }}
          >
            {salutation}
          </h1>
          <Sparkles className="w-6 h-6 text-cta flex-shrink-0" aria-hidden="true" />
        </div>
        <p className="text-[15px] text-[#5A5A5A] mt-2">
          Voici ce qui s'est passé sur ton agent Actero aujourd'hui.
        </p>
      </div>
      <p className="text-[13px] text-[#9ca3af] font-medium whitespace-nowrap mt-3 hidden sm:block capitalize">
        {today}
      </p>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   AnimatedKpiNumber — count-up from 0 on first in-view.
   Respects prefers-reduced-motion natively via framer-motion.
   ════════════════════════════════════════════════════════════════════ */
function AnimatedKpiNumber({ value, className }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  const spring = useSpring(0, { damping: 30, stiffness: 80 })
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString('fr-FR'))

  useEffect(() => {
    if (inView && typeof value === 'number' && isFinite(value)) {
      animate(spring, value, { duration: 1.5, ease: 'easeOut' })
    }
  }, [inView, value, spring])

  if (typeof value !== 'number' || !isFinite(value)) {
    return <span className={className}>{value}</span>
  }
  return <motion.span ref={ref} className={className}>{display}</motion.span>
}

/* ═══════════════════════════════════════════════════════════════════
   2. KpiTrio — 3 top-level KPIs, sparkline 14j, variation
   ═══════════════════════════════════════════════════════════════════ */
function KpiTrio({ clientId, eventCounts, periodStats, dailyMetrics }) {
  // Today's count
  const { data: today } = useQuery({
    queryKey: ['overview-today-trio', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
      const { data } = await supabase
        .from('automation_events')
        .select('event_category')
        .eq('client_id', clientId)
        .gte('created_at', startOfToday.toISOString())
      const events = data || []
      return {
        total: events.length,
        resolved: events.filter(e => e.event_category === 'ticket_resolved').length,
      }
    },
    enabled: !!clientId,
    refetchInterval: 60_000,
  })

  // Sparklines — last 14 days
  const sparklines = useMemo(() => {
    if (!dailyMetrics || dailyMetrics.length === 0) {
      return { total: [], autoRate: [] }
    }
    const last14 = dailyMetrics.slice(-14)
    return {
      total: last14.map(d => Number(d.tickets_total) || 0),
      autoRate: last14.map(d => {
        const t = Number(d.tickets_total) || 0
        const a = Number(d.tickets_auto) || 0
        return t > 0 ? Math.round((a / t) * 100) : 0
      }),
    }
  }, [dailyMetrics])

  const totalResolved = eventCounts?.ticket_resolved || 0
  const totalEscalated = eventCounts?.ticket_escalated || 0
  const totalAll = totalResolved + totalEscalated
  const autoRate = totalAll > 0 ? Math.round((totalResolved / totalAll) * 100) : 0
  const pending = eventCounts?.ticket_escalated || 0

  const kpis = [
    {
      label: 'Tickets traités aujourd\'hui',
      value: today?.total ?? '—',
      suffix: '',
      sub: today?.total > 0 ? `dont ${today.resolved} résolus automatiquement` : 'en attente des premiers tickets',
      variation: periodStats?.tasks_executed_var,
      sparkline: sparklines.total,
      color: '#0E653A',
    },
    {
      label: 'Taux d\'automatisation',
      value: autoRate,
      suffix: '%',
      sub: 'des demandes résolues sans humain',
      variation: periodStats?.auto_rate_var,
      sparkline: sparklines.autoRate,
      color: '#0E653A',
    },
    {
      label: 'Tickets en attente',
      value: pending,
      suffix: '',
      sub: pending === 0 ? 'rien ne t\'attend, bravo' : 'escalades à reviewer',
      variation: null,
      sparkline: null,
      color: '#f59e0b',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {kpis.map((kpi, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-[#E5E2D7] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        >
          <p className="text-[12px] font-medium text-[#71717a] leading-tight mb-3">{kpi.label}</p>
          <div className="flex items-baseline gap-1 mb-1">
            <AnimatedKpiNumber
              value={kpi.value}
              className="text-4xl font-bold text-[#1a1a1a] tracking-tight tabular-nums leading-none"
            />
            {kpi.suffix && (
              <span className="text-xl font-semibold text-[#1a1a1a]">{kpi.suffix}</span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 mt-2">
            <p className="text-[12px] text-[#71717a] leading-tight truncate flex-1">{kpi.sub}</p>
            {kpi.variation !== undefined && kpi.variation !== null && kpi.variation !== 0 && (
              <span className={`flex-shrink-0 text-[11px] font-bold ${kpi.variation > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {kpi.variation > 0 ? '▲ +' : '▼ '}{Math.abs(kpi.variation)}%
              </span>
            )}
          </div>
          {kpi.sparkline && kpi.sparkline.length >= 2 && (
            <div className="mt-3 h-7 w-full">
              <Sparkline data={kpi.sparkline} color={kpi.color} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Sparkline({ data, color = '#0E653A' }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 100
  const h = 28
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full" aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} opacity="0.75" />
    </svg>
  )
}

function EmptyKpiHint({ onOpenSetupWizard, setActiveTab }) {
  return (
    <div className="rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#E5E2D7] bg-white overflow-hidden">
      <div className="relative bg-gradient-to-br from-cta/[0.04] via-white to-cta/[0.02] px-6 py-10 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cta/10 mb-4">
          <Sparkles className="w-5 h-5 text-cta" />
        </div>
        <h3 className="text-[18px] font-semibold text-[#1a1a1a] tracking-tight">Ton agent est prêt</h3>
        <p className="text-[15px] text-[#5A5A5A] mt-1.5 max-w-md mx-auto leading-relaxed">
          Dès qu'un client t'écrira, tu verras ici les tickets traités, le taux d'automatisation et les demandes en attente.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          <button
            onClick={() => typeof onOpenSetupWizard === 'function' ? onOpenSetupWizard() : setActiveTab('agent-config')}
            className="px-4 py-2 rounded-full bg-cta text-white text-[13px] font-semibold hover:bg-[#0A4F2C] transition-colors"
          >
            Configurer mon agent
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className="px-4 py-2 rounded-full bg-white text-cta text-[13px] font-semibold border border-cta/20 hover:bg-cta/[0.04] transition-colors"
          >
            Tester avec un message exemple
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   3. TimelineSection — "Depuis ta dernière visite"
   ═══════════════════════════════════════════════════════════════════ */
const EVENT_META = {
  ticket_resolved: {
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    label: 'Ticket résolu',
    ctaTab: 'activity',
    ctaLabel: 'Voir →',
  },
  ticket_escalated: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    label: 'Escalade',
    ctaTab: 'escalations',
    ctaLabel: 'Voir le ticket →',
  },
  integration_connected: {
    icon: Plug,
    color: 'text-cta',
    bg: 'bg-cta/10',
    label: 'Intégration connectée',
    ctaTab: 'integrations',
    ctaLabel: 'Gérer →',
  },
  knowledge_added: {
    icon: BookOpen,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    label: 'Entrée ajoutée',
    ctaTab: 'knowledge-base',
    ctaLabel: 'Voir la KB →',
  },
  default: {
    icon: Activity,
    color: 'text-[#71717a]',
    bg: 'bg-[#f5f5f5]',
    label: 'Événement',
    ctaTab: null,
    ctaLabel: null,
  },
}

function timeAgoShort(date) {
  const ms = Date.now() - new Date(date).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'À l\'instant'
  if (m < 60) return `Il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Il y a ${h}h`
  const d = Math.floor(h / 24)
  return `Il y a ${d}j`
}

function TimelineSection({ clientId, setActiveTab, hasIntegration }) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['overview-timeline', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data } = await supabase
        .from('automation_events')
        .select('id, event_category, event_title, created_at, source_channel')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(8)
      return data || []
    },
    enabled: !!clientId,
    refetchInterval: 120_000,
  })

  return (
    <section aria-labelledby="timeline-heading">
      <div className="flex items-baseline justify-between mb-3">
        <h2
          id="timeline-heading"
          className="text-2xl italic tracking-tight text-[#1a1a1a]"
          style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 }}
        >
          Depuis ta dernière visite
        </h2>
        {events.length > 0 && (
          <button
            onClick={() => setActiveTab('activity')}
            className="text-[13px] font-medium text-cta hover:underline"
          >
            Tout voir →
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-[#E5E2D7] bg-white divide-y divide-[#f0f0f0]">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-[#f5f5f5]" />
              <div className="flex-1 h-3 rounded bg-[#f5f5f5]" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E2D7] bg-white">
          <EmptyState
            icon={Sparkles}
            tone="cta"
            title="Rien ne s'est encore passé"
            description={
              hasIntegration
                ? 'Ton agent attend les premiers messages clients — il se réveille automatiquement dès qu\'un ticket arrive.'
                : 'Ton agent va commencer à travailler dès que ta première intégration sera connectée.'
            }
            action={{
              label: hasIntegration ? 'Tester l\'agent' : 'Connecter une intégration',
              onClick: () => setActiveTab(hasIntegration ? 'simulator' : 'integrations'),
            }}
          />
        </div>
      ) : (
        <ul className="rounded-2xl border border-[#E5E2D7] bg-white divide-y divide-[#f0f0f0]">
          {events.map(ev => {
            const meta = EVENT_META[ev.event_category] || EVENT_META.default
            const Icon = meta.icon
            return (
              <li key={ev.id} className="flex items-center gap-3 px-5 py-3">
                <span className="text-[12px] text-[#9ca3af] font-medium w-20 flex-shrink-0 tabular-nums">
                  {timeAgoShort(ev.created_at)}
                </span>
                <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${meta.color}`} />
                </div>
                <p className="text-[15px] text-[#1a1a1a] flex-1 truncate">
                  {ev.event_title || meta.label}
                </p>
                {meta.ctaTab && (
                  <button
                    onClick={() => setActiveTab(meta.ctaTab)}
                    className="text-[13px] font-medium text-cta hover:underline flex-shrink-0"
                  >
                    {meta.ctaLabel}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   4. TodoSection — "À faire aujourd'hui"
   ═══════════════════════════════════════════════════════════════════ */
function TodoSection({
  clientId,
  urgentEscalationCount,
  showShopifyBanner,
  ticketsPercent,
  ticketsUsed,
  ticketsLimit,
  planId,
  inTrial,
  trialDaysLeft,
  completedSetupSteps,
  setupCompletion,
  setActiveTab,
  onOpenSetupWizard,
}) {
  // KB suggestions (human-answered escalations candidates for KB)
  const { data: kbSuggestions = 0 } = useQuery({
    queryKey: ['overview-kb-suggestions', clientId],
    queryFn: async () => {
      if (!clientId) return 0
      const { count } = await supabase
        .from('ai_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .not('human_response', 'is', null)
      return count || 0
    },
    enabled: !!clientId,
    staleTime: 5 * 60_000,
  })

  const todos = useMemo(() => {
    const list = []

    if (urgentEscalationCount > 0) {
      list.push({
        id: 'urgent',
        tone: 'danger',
        icon: AlertTriangle,
        title: `${urgentEscalationCount} escalade${urgentEscalationCount > 1 ? 's' : ''} à reviewer`,
        subtitle: 'Un client attend ta réponse depuis plus de 2h.',
        action: { label: 'Reviewer', onClick: () => setActiveTab('escalations') },
      })
    }

    if (inTrial && trialDaysLeft <= 3) {
      list.push({
        id: 'trial',
        tone: 'warning',
        icon: Clock,
        title: `Essai gratuit — plus que ${trialDaysLeft} jour${trialDaysLeft > 1 ? 's' : ''}`,
        subtitle: 'Choisis un plan pour garder ton agent actif.',
        action: { label: 'Choisir un plan', onClick: () => setActiveTab('billing') },
      })
    }

    if (planId === 'free' && ticketsPercent >= 80) {
      list.push({
        id: 'quota',
        tone: 'warning',
        icon: TrendingUp,
        title: `Quota à ${ticketsPercent}% — ${ticketsUsed}/${ticketsLimit}`,
        subtitle: 'Ton agent s\'arrêtera quand tu atteindras la limite.',
        action: {
          label: 'Passer au Starter',
          onClick: () => {
            trackEvent('Upgrade Clicked', { from_plan: planId, to_plan: 'starter', trigger: 'todo_quota', location: 'overview' })
            setActiveTab('billing')
          },
        },
      })
    }

    if (completedSetupSteps < 4 && setupCompletion) {
      list.push({
        id: 'setup',
        tone: 'info',
        icon: Zap,
        title: `Configuration à ${Math.round((completedSetupSteps / 4) * 100)}%`,
        subtitle: 'Encore quelques étapes pour activer ton agent.',
        action: {
          label: 'Continuer',
          onClick: () => {
            if (typeof onOpenSetupWizard === 'function') onOpenSetupWizard()
            else setActiveTab('agent-config')
          },
        },
      })
    }

    if (showShopifyBanner) {
      list.push({
        id: 'shopify',
        tone: 'neutral',
        icon: Plug,
        title: '1 intégration à connecter',
        subtitle: 'Connecte Shopify pour que ton agent accède aux commandes.',
        action: { label: 'Connecter', onClick: () => setActiveTab('integrations') },
      })
    }

    if (kbSuggestions >= 3) {
      list.push({
        id: 'kb',
        tone: 'info',
        icon: BookOpen,
        title: `${kbSuggestions} entrées KB suggérées`,
        subtitle: 'Tes dernières réponses peuvent enrichir la base de connaissances.',
        action: { label: 'Voir la KB', onClick: () => setActiveTab('knowledge-base') },
      })
    }

    return list
  }, [
    urgentEscalationCount, ticketsPercent, ticketsUsed, ticketsLimit, planId,
    inTrial, trialDaysLeft, completedSetupSteps, setupCompletion, showShopifyBanner,
    kbSuggestions, setActiveTab, onOpenSetupWizard,
  ])

  const TONES = {
    danger:  { bg: 'bg-red-50/70',   border: 'border-red-200',   iconBg: 'bg-red-100',   iconColor: 'text-red-600',   btn: 'bg-red-600 hover:bg-red-700' },
    warning: { bg: 'bg-amber-50/70', border: 'border-amber-200', iconBg: 'bg-amber-100', iconColor: 'text-amber-700', btn: 'bg-amber-600 hover:bg-amber-700' },
    info:    { bg: 'bg-cta/5',       border: 'border-cta/20',    iconBg: 'bg-cta/10',    iconColor: 'text-cta',       btn: 'bg-cta hover:bg-[#003725]' },
    neutral: { bg: 'bg-white',       border: 'border-[#E5E2D7]', iconBg: 'bg-[#f5f5f5]', iconColor: 'text-[#71717a]', btn: 'bg-[#1a1a1a] hover:bg-black' },
  }

  return (
    <section aria-labelledby="todo-heading">
      <div className="flex items-baseline justify-between mb-3">
        <h2
          id="todo-heading"
          className="text-2xl italic tracking-tight text-[#1a1a1a]"
          style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 }}
        >
          À faire aujourd'hui
        </h2>
        {todos.length > 0 && (
          <span className="text-[13px] text-[#71717a]">
            {todos.length} item{todos.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {todos.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E2D7] bg-white">
          <EmptyState
            icon={CheckCircle2}
            tone="success"
            title="Tout est en ordre"
            description="Rien n'attend ton attention — ton agent gère tout en autonomie."
          />
        </div>
      ) : (
        <ul className="space-y-2">
          {todos.map(t => {
            const tone = TONES[t.tone] || TONES.neutral
            const Icon = t.icon
            return (
              <li
                key={t.id}
                className={`rounded-2xl border ${tone.border} ${tone.bg} px-4 py-3 flex items-center justify-between gap-3`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg ${tone.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${tone.iconColor}`} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[#1a1a1a] leading-tight">{t.title}</p>
                    <p className="text-[13px] text-[#5A5A5A] mt-0.5 leading-snug">{t.subtitle}</p>
                  </div>
                </div>
                <button
                  onClick={t.action.onClick}
                  className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg ${tone.btn} text-white text-[13px] font-semibold transition-colors whitespace-nowrap`}
                >
                  {t.action.label} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
