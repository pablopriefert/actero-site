import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, ArrowRight, Sparkles, TrendingUp, TrendingDown,
  CheckCircle2, ShoppingBag, Zap, Clock, Euro, Bell,
  Activity, BarChart3, Lightbulb, X, ChevronDown,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { trackEvent } from '../../../lib/analytics'
import { LiveActivityWidget } from '../../dashboard/LiveActivityWidget.jsx'
import { ActivityChart } from '../../dashboard/ActivityChart.jsx'
import { PeakHoursChart } from '../PeakHoursChart.jsx'
import { AgentImprovementWidget } from '../AgentImprovementWidget.jsx'

/**
 * OverviewHome — nouvelle structure de la tab Overview post-setup.
 *
 * Remplace les 10 blocs empilés verticalement par 3 zones hiérarchisées :
 *   1. SystemAlertStack — 1 alerte visible max, reste collapsé en pill
 *   2. TodayHero — status agent + compteur du jour + slot urgent
 *   3. KPIRowWithSparkline — 4 cards stats avec sparkline + variation
 *   4. SignalsGrid — activité live + tabs (insights / peak / tendances)
 *
 * Design principles (ui-ux-pro-max) :
 *   - Visual hierarchy par size/weight/contrast (pas juste couleur)
 *   - 1 primary focal point (TodayHero)
 *   - Progressive disclosure (alerts collapsed, tabs dans SignalsGrid)
 *   - Content priority mobile (stack vertical)
 *   - Touch targets 44px+ partout
 */
export function OverviewHome({
  clientId,
  currentClient,
  // Plan state
  planId, planName, inTrial, trialDaysLeft, ticketsUsed, ticketsLimit, ticketsPercent, isOverLimit,
  // Metrics state
  periodStats, selectedPeriod, setSelectedPeriod, dailyMetrics, eventCounts, liveRoi,
  totalEvents, urgentEscalationCount, completedSetupSteps, showShopifyBanner, setupCompletion,
  // Actions
  setActiveTab, theme,
}) {
  return (
    /*
     * Full-bleed cream wrap. Negative margins pour briser la contrainte
     * du parent ClientDashboard (qui n'est pas touché par la règle
     * « visuel uniquement ») et peindre tout l'écran en paper-cream
     * #F7F5F0 comme le design variation B.
     */
    <div
      className="-m-4 md:-m-6 p-4 md:p-8 min-h-[calc(100vh-64px)]"
      style={{ background: '#F7F5F0' }}
      data-editorial
    >
      <div className="max-w-6xl mx-auto space-y-7">
        {/* Zone 0 — System alerts */}
        <SystemAlertStack
          urgentEscalationCount={urgentEscalationCount}
          ticketsPercent={ticketsPercent}
          ticketsUsed={ticketsUsed}
          ticketsLimit={ticketsLimit}
          planId={planId}
          inTrial={inTrial}
          trialDaysLeft={trialDaysLeft}
          completedSetupSteps={completedSetupSteps}
          showShopifyBanner={showShopifyBanner}
          setupCompletion={setupCompletion}
          setActiveTab={setActiveTab}
        />

        {/* Zone A — Today hero (editorial masthead) */}
        <TodayHero
          clientId={clientId}
          urgentEscalationCount={urgentEscalationCount}
          setActiveTab={setActiveTab}
        />

        {/* Zone B — KPI row avec sparkline */}
        {totalEvents > 0 ? (
          <KPIRowWithSparkline
            eventCounts={eventCounts}
            liveRoi={liveRoi}
            periodStats={periodStats}
            dailyMetrics={dailyMetrics}
            selectedPeriod={selectedPeriod}
            setSelectedPeriod={setSelectedPeriod}
          />
        ) : (
          <EmptyKPIState setActiveTab={setActiveTab} />
        )}

        {/* Zone C — Signals grid (activity + tabs) */}
        {totalEvents > 0 && (
          <SignalsGrid
            clientId={clientId}
            theme={theme}
            selectedPeriod={selectedPeriod}
            setActiveTab={setActiveTab}
          />
        )}

        {/* Starter → Pro upsell */}
        {planId === 'starter' && (
          <div className="bg-white border border-[#E5E2D7] rounded-3xl p-6 flex items-center justify-between gap-4 shadow-[0_1px_3px_rgba(10,10,10,0.03)]">
            <div>
              <p
                className="text-[26px] text-[#0A0A0A] font-normal leading-[1.1]"
                style={{ fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)', letterSpacing: '-0.02em' }}
              >
                Débloquez l'agent <span className="italic text-[#8B7A50]">vocal</span>
              </p>
              <p className="text-[12.5px] text-[#86826F] mt-2 leading-relaxed max-w-md">
                Le plan Pro inclut l'agent vocal téléphone, le simulateur et 5 000 tickets/mois.
              </p>
            </div>
            <button
              onClick={() => {
                trackEvent('Upgrade Clicked', { from_plan: 'starter', to_plan: 'pro', trigger: 'overview_upsell', location: 'overview' })
                setActiveTab('billing')
              }}
              className="px-5 py-2.5 bg-[#0A0A0A] text-[#F9E8A8] text-[11px] font-semibold rounded-full hover:bg-black transition flex-shrink-0 uppercase tracking-[0.08em]"
              style={{ fontFamily: 'var(--font-mono, "DM Mono", ui-monospace, monospace)' }}
            >
              Essai Pro gratuit 7 jours
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   SystemAlertStack — priorité-ranked banners (1 visible, rest collapsed)
   ═══════════════════════════════════════════════════════════════════ */
function SystemAlertStack({
  urgentEscalationCount, ticketsPercent, ticketsUsed, ticketsLimit,
  planId, inTrial, trialDaysLeft, completedSetupSteps, showShopifyBanner, setupCompletion,
  setActiveTab,
}) {
  const [expanded, setExpanded] = useState(false)

  // Build alerts list by priority (high → low)
  const alerts = useMemo(() => {
    const list = []

    if (urgentEscalationCount > 0) {
      list.push({
        id: 'urgent-escalations',
        tone: 'danger',
        title: `${urgentEscalationCount} ticket${urgentEscalationCount > 1 ? 's' : ''} urgent${urgentEscalationCount > 1 ? 's' : ''} — réponse attendue`,
        ctaLabel: 'Voir',
        onClick: () => setActiveTab('escalations'),
      })
    }
    if (planId === 'free' && ticketsPercent >= 80) {
      list.push({
        id: 'usage-warning',
        tone: 'warning',
        title: `Quota mensuel à ${ticketsPercent}% — ${ticketsUsed}/${ticketsLimit} tickets`,
        ctaLabel: 'Passer au Starter — 99€',
        onClick: () => {
          trackEvent('Upgrade Clicked', { from_plan: planId, to_plan: 'starter', trigger: 'usage_alert', location: 'overview' })
          setActiveTab('billing')
        },
      })
    }
    if (inTrial && trialDaysLeft <= 3) {
      list.push({
        id: 'trial-ending',
        tone: 'warning',
        title: `Essai gratuit — plus que ${trialDaysLeft} jour${trialDaysLeft > 1 ? 's' : ''}`,
        ctaLabel: 'Choisir un plan',
        onClick: () => setActiveTab('billing'),
      })
    }
    if (completedSetupSteps < 4 && setupCompletion) {
      list.push({
        id: 'setup-incomplete',
        tone: 'info',
        title: `Configuration à ${Math.round((completedSetupSteps / 4) * 100)}% — l'agent n'est pas encore actif`,
        ctaLabel: 'Continuer',
        onClick: () => { /* wizard s'auto-ouvre au refresh */ window.location.reload() },
      })
    }
    if (showShopifyBanner) {
      list.push({
        id: 'shopify-disconnect',
        tone: 'neutral',
        title: 'Connectez Shopify pour activer toutes les fonctionnalités',
        ctaLabel: 'Connecter',
        onClick: () => setActiveTab('integrations'),
      })
    }
    return list
  }, [urgentEscalationCount, ticketsPercent, ticketsUsed, ticketsLimit, planId, inTrial, trialDaysLeft, completedSetupSteps, setupCompletion, showShopifyBanner, setActiveTab])

  if (alerts.length === 0) return null

  const [primary, ...rest] = alerts

  return (
    <div className="space-y-2">
      <AlertBanner alert={primary} />
      {rest.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#71717a] hover:bg-white hover:text-[#1a1a1a] transition-colors"
            aria-expanded={expanded}
          >
            <Bell className="w-3.5 h-3.5" />
            {rest.length} autre{rest.length > 1 ? 's' : ''} notification{rest.length > 1 ? 's' : ''}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden space-y-2 mt-2"
              >
                {rest.map(a => <AlertBanner key={a.id} alert={a} />)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function AlertBanner({ alert }) {
  const tones = {
    danger:  { bg: 'bg-red-50/70',   border: 'border-red-200',   iconBg: 'bg-red-100',   iconColor: 'text-red-600',   textColor: 'text-red-800',   btnBg: 'bg-red-600 hover:bg-red-700',       icon: AlertTriangle },
    warning: { bg: 'bg-amber-50/70', border: 'border-amber-200', iconBg: 'bg-amber-100', iconColor: 'text-amber-700', textColor: 'text-amber-900', btnBg: 'bg-amber-600 hover:bg-amber-700',   icon: AlertTriangle },
    info:    { bg: 'bg-cta/5',       border: 'border-cta/20',    iconBg: 'bg-cta/10',    iconColor: 'text-cta',       textColor: 'text-[#003725]', btnBg: 'bg-cta hover:bg-[#003725]',         icon: Sparkles },
    neutral: { bg: 'bg-[#FCFAF3]',   border: 'border-[#E5E2D7]', iconBg: 'bg-[#F7F5F0]', iconColor: 'text-[#86826F]', textColor: 'text-[#0A0A0A]', btnBg: 'bg-[#0A0A0A] hover:bg-black',       icon: ShoppingBag },
  }
  const t = tones[alert.tone] || tones.neutral
  const Icon = t.icon
  return (
    <div className={`rounded-3xl border ${t.border} ${t.bg} px-5 py-4 flex items-center justify-between gap-3`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-2xl ${t.iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${t.iconColor}`} />
        </div>
        <p className={`text-[13px] ${t.textColor} font-medium text-left`}>{alert.title}</p>
      </div>
      <button
        onClick={alert.onClick}
        className={`flex-shrink-0 px-4 py-2 rounded-full ${t.btnBg} text-white text-[12px] font-semibold transition-colors whitespace-nowrap`}
      >
        {alert.ctaLabel}
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   TodayHero — primary focal point : agent status + today's ticket count
   ═══════════════════════════════════════════════════════════════════ */
function TodayHero({ clientId, urgentEscalationCount, setActiveTab }) {
  const { data: today } = useQuery({
    queryKey: ['overview-today', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
      const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1)
      const endOfYesterday = new Date(startOfToday); endOfYesterday.setSeconds(-1)

      const [todayRes, yesterdayRes] = await Promise.all([
        supabase.from('automation_events').select('event_category', { count: 'exact' })
          .eq('client_id', clientId)
          .gte('created_at', startOfToday.toISOString()),
        supabase.from('automation_events').select('event_category', { count: 'exact' })
          .eq('client_id', clientId)
          .gte('created_at', startOfYesterday.toISOString())
          .lte('created_at', endOfYesterday.toISOString()),
      ])

      const todayEvents = todayRes.data || []
      const todayTotal = todayEvents.length
      const todayAuto = todayEvents.filter(e => e.event_category === 'ticket_resolved').length
      const todayEscalated = todayEvents.filter(e => e.event_category === 'ticket_escalated').length
      const yesterdayTotal = yesterdayRes.count || 0

      return { todayTotal, todayAuto, todayEscalated, yesterdayTotal }
    },
    enabled: !!clientId,
    refetchInterval: 60_000, // live refresh 1×/min
  })

  const deltaVsYesterday = today && today.yesterdayTotal > 0
    ? Math.round(((today.todayTotal - today.yesterdayTotal) / today.yesterdayTotal) * 100)
    : null

  const isUp = deltaVsYesterday !== null && deltaVsYesterday > 0
  const isDown = deltaVsYesterday !== null && deltaVsYesterday < 0

  const serif = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }
  const mono = { fontFamily: 'var(--font-mono, "DM Mono", ui-monospace, monospace)' }

  return (
    <div>
      {/* ═══ MASTHEAD — kicker mono + grande ligne + 2px ink separator ═══ */}
      <div className="border-b-2 border-[#0A0A0A] pb-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span
                className="text-[10.5px] font-medium text-[#86826F] uppercase tracking-[0.12em]"
                style={mono}
              >
                Agent actif
              </span>
              <span className="h-px flex-1 max-w-[60px] bg-[#E5E2D7]" />
              <span
                className="inline-flex items-center gap-1.5 text-[10.5px] text-cta"
                style={mono}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cta animate-pulse" />
                LIVE · mis à jour il y a moins d'1 min
              </span>
            </div>
            <h1
              className="text-[44px] md:text-[56px] text-[#0A0A0A] leading-[0.95] font-normal"
              style={{ ...serif, letterSpacing: '-0.025em' }}
            >
              Tickets traités <span className="italic text-[#8B7A50]">aujourd'hui.</span>
            </h1>
            {today && today.todayTotal > 0 && (
              <p className="text-[14px] text-[#3A3A3A] mt-3 leading-relaxed max-w-xl">
                <span className="font-semibold text-cta">{today.todayAuto}</span> résolus automatiquement ·{' '}
                <span className="font-semibold text-[#8B7A50]">{today.todayEscalated}</span> escaladés à votre équipe.
              </p>
            )}
            {today && today.yesterdayTotal > 0 && (
              <p className="text-[11px] text-[#86826F] mt-2" style={mono}>
                Hier à la même heure : {today.yesterdayTotal} tickets
              </p>
            )}
          </div>
          <div className="text-right">
            <div
              className="text-[10.5px] text-[#86826F] uppercase tracking-[0.12em] mb-1"
              style={mono}
            >
              Aujourd'hui
            </div>
            <div className="flex items-baseline justify-end gap-3">
              <span
                className="text-[72px] md:text-[96px] text-[#0A0A0A] tabular-nums leading-none font-normal"
                style={{ ...serif, letterSpacing: '-0.04em' }}
              >
                {today?.todayTotal ?? '—'}
              </span>
              {deltaVsYesterday !== null && (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] ${
                    isUp ? 'text-cta' : isDown ? 'text-red-600' : 'text-[#86826F]'
                  }`}
                  style={mono}
                >
                  {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : isDown ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                  {isUp ? '+' : ''}{deltaVsYesterday}%
                </span>
              )}
            </div>
            <div className="text-[10.5px] text-[#86826F] mt-2" style={mono}>
              tickets résolus par l'agent
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Side card : urgent slot ou next action ═══ */}
      <div className="bg-white rounded-3xl border border-[#E5E2D7] p-6 md:p-8">
        {urgentEscalationCount > 0 ? (
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <p className="text-[10px] font-medium text-red-600 uppercase tracking-[0.12em]" style={mono}>
                  Attention requise
                </p>
              </div>
              <p
                className="text-[28px] md:text-[32px] text-[#0A0A0A] leading-[1.05] font-normal"
                style={{ ...serif, letterSpacing: '-0.02em' }}
              >
                {urgentEscalationCount} ticket{urgentEscalationCount > 1 ? 's' : ''}{' '}
                <span className="italic text-[#B8302B]">urgent{urgentEscalationCount > 1 ? 's' : ''}.</span>
              </p>
              <p className="text-[13px] text-[#86826F] mt-2">En attente depuis plus de 2h.</p>
            </div>
            <button
              onClick={() => setActiveTab('escalations')}
              className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full bg-[#B8302B] text-white text-[12px] font-semibold hover:bg-[#991f1f] transition-colors flex-shrink-0 uppercase tracking-[0.06em]"
              style={mono}
            >
              → Voir les tickets
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-cta" />
                <p className="text-[10px] font-medium text-cta uppercase tracking-[0.12em]" style={mono}>
                  Tout est sous contrôle
                </p>
              </div>
              <p
                className="text-[28px] md:text-[32px] text-[#0A0A0A] leading-[1.05] font-normal"
                style={{ ...serif, letterSpacing: '-0.02em' }}
              >
                Aucune action <span className="italic text-[#8B7A50]">requise.</span>
              </p>
              <p className="text-[13px] text-[#86826F] mt-2 max-w-md">
                Votre agent gère tout. Consultez l'activité pour les détails.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('activity')}
              className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full bg-[#0A0A0A] text-[#F9E8A8] text-[12px] font-semibold hover:bg-black transition-colors flex-shrink-0 uppercase tracking-[0.06em]"
              style={mono}
            >
              <Activity className="w-4 h-4" />
              → Voir l'activité
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   KPIRowWithSparkline — 4 stat cards avec sparkline + variation
   ═══════════════════════════════════════════════════════════════════ */
function KPIRowWithSparkline({ eventCounts, liveRoi, periodStats, dailyMetrics, selectedPeriod, setSelectedPeriod }) {
  // Construire les sparklines depuis dailyMetrics (dernier 14 jours)
  const sparklines = useMemo(() => {
    if (!dailyMetrics || dailyMetrics.length === 0) return { auto: [], hours: [], euros: [], total: [] }
    const last14 = dailyMetrics.slice(-14)
    return {
      auto:  last14.map(d => Number(d.tickets_auto) || 0),
      total: last14.map(d => Number(d.tickets_total) || 0),
      hours: last14.map(d => (Number(d.time_saved_minutes) || 0) / 60),
      euros: last14.map(d => Number(d.estimated_roi) || 0),
    }
  }, [dailyMetrics])

  const kpis = [
    {
      label: 'Auto-résolution',
      value: eventCounts?.ticket_resolved || 0,
      suffix: '',
      sub: 'demandes traitées sans humain',
      variation: periodStats?.tasks_executed_var,
      sparkline: sparklines.auto,
      color: '#0E653A',
    },
    {
      label: 'Temps gagné',
      value: Math.round((liveRoi?.hours_saved || 0) * 10) / 10,
      suffix: 'h',
      sub: `sur ${selectedPeriod === 'this_month' ? 'le mois' : selectedPeriod === 'last_month' ? 'le mois dernier' : '30 jours'}`,
      variation: periodStats?.time_saved_var,
      sparkline: sparklines.hours,
      color: '#0E653A',
    },
    {
      label: 'Économies',
      value: Math.round(liveRoi?.value_saved || 0),
      suffix: '€',
      sub: 'valeur générée',
      variation: periodStats?.roi_var,
      sparkline: sparklines.euros,
      color: '#0E653A',
    },
    {
      label: 'À traiter',
      value: eventCounts?.ticket_escalated || 0,
      suffix: '',
      sub: "escalations de l'agent",
      variation: null, // pas de var pour escalations (pas un KPI de performance à comparer)
      sparkline: null, // non pertinent
      color: '#f59e0b',
    },
  ]

  const serif = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }
  const mono = { fontFamily: 'var(--font-mono, "DM Mono", ui-monospace, monospace)' }

  return (
    <div>
      {/* ═══ Section header — kicker mono + serif title + 1px ink separator ═══ */}
      <div className="flex items-end justify-between border-b border-[#0A0A0A] pb-3 mb-5 gap-4 flex-wrap">
        <div>
          <div
            className="text-[10.5px] font-medium text-[#86826F] uppercase tracking-[0.12em] mb-1"
            style={mono}
          >
            Section · Performance
          </div>
          <h2
            className="text-[30px] md:text-[36px] text-[#0A0A0A] font-normal leading-[1.05]"
            style={{ ...serif, letterSpacing: '-0.025em' }}
          >
            Performance <span className="italic text-[#8B7A50]">du mois.</span>
          </h2>
        </div>
        <div role="tablist" aria-label="Période d'analyse" className="inline-flex items-center border border-[#E5E2D7] rounded-full overflow-hidden bg-white">
          {[
            { id: 'this_month', label: 'Ce mois' },
            { id: 'last_month', label: 'Mois dernier' },
            { id: 'last_30_days', label: '30 jours' },
          ].map((p, idx) => {
            const isSelected = selectedPeriod === p.id
            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setSelectedPeriod(p.id)}
                className={`px-3.5 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] transition-colors ${
                  isSelected ? 'bg-[#0A0A0A] text-[#F9E8A8]' : 'text-[#3A3A3A] hover:bg-[#F7F5F0]'
                } ${idx > 0 ? 'border-l border-[#E5E2D7]' : ''}`}
                style={mono}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══ 4-card KPI grid — editorial big serif ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white rounded-3xl border border-[#E5E2D7] p-5 md:p-6 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p
                className="text-[9.5px] font-medium text-[#86826F] uppercase tracking-[0.12em]"
                style={mono}
              >
                {kpi.label}
              </p>
              <span
                className="text-[9.5px] text-[#86826F]"
                style={mono}
              >
                0{i + 1}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className="text-[44px] md:text-[56px] text-[#0A0A0A] tabular-nums leading-[0.95] font-normal"
                style={{ ...serif, letterSpacing: '-0.04em' }}
              >
                {typeof kpi.value === 'number' ? kpi.value.toLocaleString('fr-FR') : kpi.value}
              </span>
              {kpi.suffix && (
                <span
                  className="text-[22px] text-[#8B7A50] italic font-normal"
                  style={serif}
                >
                  {kpi.suffix}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E5E2D7] border-dotted mt-auto">
              <p className="text-[10.5px] text-[#86826F] leading-tight truncate flex-1">
                {kpi.sub}
              </p>
              {kpi.variation !== undefined && kpi.variation !== null && kpi.variation !== 0 && (
                <span
                  className={`flex-shrink-0 text-[10px] ${kpi.variation > 0 ? 'text-cta' : 'text-red-500'}`}
                  style={mono}
                >
                  {kpi.variation > 0 ? '▲' : '▼'} {Math.abs(kpi.variation)}%
                </span>
              )}
            </div>
            {kpi.sparkline && kpi.sparkline.length >= 2 && (
              <div className="h-7 w-full -mt-1">
                <Sparkline data={kpi.sparkline} color={kpi.color} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Sparkline({ data, color = '#0E653A' }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 100
  const h = 24
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full" aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} opacity="0.7" />
    </svg>
  )
}

function EmptyKPIState({ setActiveTab }) {
  const serif = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }
  return (
    <div className="rounded-3xl shadow-[0_1px_3px_rgba(10,10,10,0.04)] border border-[#E5E2D7] bg-white overflow-hidden">
      <div className="relative bg-[#FCFAF3] px-6 py-10 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cta/10 mb-4">
          <Sparkles className="w-5 h-5 text-cta" />
        </div>
        <h3
          className="text-[26px] text-[#0A0A0A] font-normal"
          style={{ ...serif, letterSpacing: '-0.02em' }}
        >
          Votre agent est <span className="italic text-[#8B7A50]">prêt</span>
        </h3>
        <p className="text-[13px] text-[#86826F] mt-2 max-w-md mx-auto leading-relaxed">
          Dès qu'un client vous écrira, vous verrez apparaître ici le temps gagné, les tickets résolus automatiquement et les économies réalisées.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          <button onClick={() => setActiveTab('agent-config')} className="px-4 py-2 rounded-full bg-cta text-white text-[12px] font-semibold hover:bg-[#0A4F2C] transition-colors">
            Configurer mon agent
          </button>
          <button onClick={() => setActiveTab('simulator')} className="px-4 py-2 rounded-full bg-white text-cta text-[12px] font-semibold border border-[#E5E2D7] hover:bg-[#F7F5F0] transition-colors">
            Tester avec un message exemple
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   SignalsGrid — activity feed gauche + tabs droite (insights / peak / tendances)
   ═══════════════════════════════════════════════════════════════════ */
function SignalsGrid({ clientId, theme, selectedPeriod, setActiveTab }) {
  const [rightTab, setRightTab] = useState('insights')
  const mono = { fontFamily: 'var(--font-mono, "DM Mono", ui-monospace, monospace)' }
  const serif = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }

  return (
    <div>
      {/* ═══ Section header ═══ */}
      <div className="flex items-end justify-between border-b border-[#0A0A0A] pb-3 mb-5 gap-4 flex-wrap">
        <div>
          <div
            className="text-[10.5px] font-medium text-[#86826F] uppercase tracking-[0.12em] mb-1"
            style={mono}
          >
            Section · Signaux
          </div>
          <h2
            className="text-[30px] md:text-[36px] text-[#0A0A0A] font-normal leading-[1.05]"
            style={{ ...serif, letterSpacing: '-0.025em' }}
          >
            Feed en direct <span className="italic text-[#8B7A50]">et analyses.</span>
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Activity feed (2/3 on desktop) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-[#E5E2D7] overflow-hidden">
          <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-[#E5E2D7]">
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-cta animate-pulse" />
              <span
                className="text-[10.5px] font-medium text-[#86826F] uppercase tracking-[0.12em]"
                style={mono}
              >
                Live feed · temps réel
              </span>
            </div>
            <button
              onClick={() => setActiveTab('activity')}
              className="text-[10.5px] font-medium text-[#86826F] hover:text-[#0A0A0A] uppercase tracking-[0.08em]"
              style={mono}
            >
              → Tout voir
            </button>
          </div>
          <LiveActivityWidget supabase={supabase} setActiveTab={setActiveTab} isLight={true} compact={true} />
        </div>

        {/* Tabs pane (1/3 on desktop) */}
        <div className="bg-white rounded-3xl border border-[#E5E2D7] overflow-hidden flex flex-col">
          <div role="tablist" aria-label="Analyses" className="flex items-center border-b border-[#E5E2D7] bg-[#FCFAF3]">
            {[
              { id: 'insights', label: 'Insights', icon: Lightbulb },
              { id: 'peak',     label: 'Heures',   icon: Clock },
              { id: 'trends',   label: 'Tendance', icon: BarChart3 },
            ].map((t, idx) => {
              const active = rightTab === t.id
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setRightTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-[10.5px] font-medium uppercase tracking-[0.08em] transition-colors ${
                    active ? 'bg-white text-[#0A0A0A]' : 'text-[#86826F] hover:text-[#0A0A0A]'
                  } ${idx > 0 ? 'border-l border-[#E5E2D7]' : ''}`}
                  style={mono}
                >
                  <Icon className="w-3 h-3" />
                  {t.label}
                </button>
              )
            })}
          </div>
        <div className="flex-1 min-h-[260px]">
          {rightTab === 'insights' && (
            <div className="p-4">
              <AgentImprovementWidget clientId={clientId} theme={theme} />
            </div>
          )}
          {rightTab === 'peak' && (
            <div className="p-4">
              <PeakHoursChart clientId={clientId} />
            </div>
          )}
          {rightTab === 'trends' && (
            <div className="p-4">
              <p
                className="text-[10.5px] text-[#86826F] mb-3 uppercase tracking-[0.08em]"
                style={mono}
              >
                Volume de demandes traitées sur la période.
              </p>
              <div className="h-[200px]">
                <ActivityChart theme={theme} supabase={supabase} selectedPeriod={selectedPeriod} mini={true} />
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
