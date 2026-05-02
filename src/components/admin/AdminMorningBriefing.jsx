import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Bug,
  Eye,
  ThumbsDown,
  Brain,
  TrendingDown,
  TrendingUp,
  Plug,
  Zap,
  Clock,
  Euro,
  Heart,
  Activity,
  ArrowRight,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { SectionCard } from '../ui/SectionCard'
import { LivePulseDot } from '../ui/LivePulseDot'

/**
 * Admin Morning Briefing — single-screen aggregate of every "you should look at this" signal.
 *
 * Goal: replace the 6+ tab tour Pablo used to do every morning. One page = one
 * answer to "what happened during the night, what needs my attention right now".
 *
 * Each card is clickable and navigates to the deep-dive view. The cards grouped
 * by urgency:
 *   - 🔴 Urgent : engine errors 24h, hallucinations, manual reviews due, negative
 *     ratings unhandled, connectors down.
 *   - 🟠 À surveiller : churn predictions cette semaine, clients en santé fragile.
 *   - 🟢 Pulse : MRR delta 7j, hours saved 7j, runs 24h, rating positive 7j.
 *
 * All queries hit Supabase in parallel via React Query, with 60s staleTime —
 * so tab-switching back to the briefing within a minute serves cached data.
 */

const since24h = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
const since7d = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
const since14d = () => new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
const todayStart = () => new Date(new Date().toISOString().slice(0, 10)).toISOString()

export const AdminMorningBriefing = ({ onTabChange }) => {
  // ── 24h engine errors ──────────────────────────────────────────────
  const { data: engineErrors24h = 0 } = useQuery({
    queryKey: ['briefing-engine-errors-24h'],
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from('automation_runs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', since24h())
      return count || 0
    },
  })

  // ── Manual reviews pending ─────────────────────────────────────────
  const { data: pendingReviews = 0 } = useQuery({
    queryKey: ['briefing-pending-reviews'],
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from('engine_reviews_v2')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
      return count || 0
    },
  })

  // ── Negative ratings unhandled ─────────────────────────────────────
  const { data: negativeRatings = 0 } = useQuery({
    queryKey: ['briefing-negative-ratings'],
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from('ai_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('rating', 'negative')
        .is('added_to_kb', false)
      return count || 0
    },
  })

  // ── Client error reports last 24h (frontend issues reported) ──────
  const { data: errorReports24h = 0 } = useQuery({
    queryKey: ['briefing-error-reports-24h'],
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from('client_error_reports')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since24h())
      return count || 0
    },
  })

  // ── Engine runs last 24h (volume) ─────────────────────────────────
  const { data: runs24h = 0 } = useQuery({
    queryKey: ['briefing-runs-24h'],
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from('automation_runs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since24h())
      return count || 0
    },
  })

  // ── MRR (current + delta 7d) ─────────────────────────────────────
  const { data: mrrSnapshot } = useQuery({
    queryKey: ['briefing-mrr'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('plan, status, plan_updated_at')
        .in('status', ['active', 'trialing'])
      const PRICES = { free: 0, starter: 99, pro: 399, enterprise: 999 }
      const current = (data || []).reduce((s, c) => s + (PRICES[c.plan] || 0), 0)
      const sevenDaysAgo = new Date(since7d())
      const recentChanges = (data || []).filter(
        (c) => c.plan_updated_at && new Date(c.plan_updated_at) > sevenDaysAgo,
      )
      return { current, recentChangesCount: recentChanges.length }
    },
  })

  // ── Hours saved last 7d + delta vs prev 7d ───────────────────────
  const { data: hoursSnapshot } = useQuery({
    queryKey: ['briefing-hours-saved'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('metrics_daily')
        .select('time_saved_minutes, date')
        .gte('date', new Date(since14d()).toISOString().slice(0, 10))
      const today = new Date()
      const last7 = (data || []).filter((m) => (today - new Date(m.date)) / 86400000 <= 7)
      const prev7 = (data || []).filter((m) => {
        const diff = (today - new Date(m.date)) / 86400000
        return diff > 7 && diff <= 14
      })
      const last7Hours = Math.round(last7.reduce((s, m) => s + (m.time_saved_minutes || 0), 0) / 60)
      const prev7Hours = Math.round(prev7.reduce((s, m) => s + (m.time_saved_minutes || 0), 0) / 60)
      const trend = prev7Hours > 0 ? Math.round(((last7Hours - prev7Hours) / prev7Hours) * 100) : 0
      return { last7Hours, prev7Hours, trend }
    },
  })

  // ── Positive rating rate last 7d ─────────────────────────────────
  const { data: ratingSnapshot } = useQuery({
    queryKey: ['briefing-rating-rate'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_conversations')
        .select('rating')
        .not('rating', 'is', null)
        .gte('rated_at', since7d())
      const total = (data || []).length
      const positive = (data || []).filter((c) => c.rating === 'positive').length
      const rate = total > 0 ? Math.round((positive / total) * 100) : null
      return { rate, total }
    },
  })

  // ── Churn predictions for this week ──────────────────────────────
  const { data: churnAtRisk = 0 } = useQuery({
    queryKey: ['briefing-churn-at-risk'],
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from('churn_predictions')
        .select('id', { count: 'exact', head: true })
        .gte('predicted_at', since7d())
        .gte('churn_probability', 0.6)
      return count || 0
    },
  })

  // ── Connector health: any down? ───────────────────────────────────
  const { data: connectorIssues = 0 } = useQuery({
    queryKey: ['briefing-connector-issues'],
    staleTime: 60_000,
    queryFn: async () => {
      // client_settings.email_consecutive_failures >= 10 means circuit-breaker is open
      const { count } = await supabase
        .from('client_settings')
        .select('client_id', { count: 'exact', head: true })
        .gte('email_consecutive_failures', 10)
      return count || 0
    },
  })

  const urgentSignals = [
    {
      key: 'engine-errors',
      label: 'Erreurs engine 24h',
      count: engineErrors24h,
      icon: AlertTriangle,
      tone: engineErrors24h > 0 ? 'red' : 'green',
      target: 'top-errors',
    },
    {
      key: 'pending-reviews',
      label: 'Reviews à faire',
      count: pendingReviews,
      icon: Eye,
      tone: pendingReviews > 0 ? 'red' : 'green',
      target: 'manual-review',
    },
    {
      key: 'negative-ratings',
      label: 'Notes négatives non-traitées',
      count: negativeRatings,
      icon: ThumbsDown,
      tone: negativeRatings > 0 ? 'red' : 'green',
      target: 'ratings',
    },
    {
      key: 'error-reports',
      label: 'Erreurs reportées (clients)',
      count: errorReports24h,
      icon: Bug,
      tone: errorReports24h > 0 ? 'red' : 'green',
      target: 'error-reports',
    },
    {
      key: 'connector-issues',
      label: 'Connecteurs en circuit-breaker',
      count: connectorIssues,
      icon: Plug,
      tone: connectorIssues > 0 ? 'red' : 'green',
      target: 'connector-health',
    },
    {
      key: 'churn-at-risk',
      label: 'Clients churn ≥60% cette semaine',
      count: churnAtRisk,
      icon: TrendingDown,
      tone: churnAtRisk > 0 ? 'amber' : 'green',
      target: 'churn-cohort',
    },
  ]

  const pulseSignals = [
    {
      key: 'mrr',
      label: 'MRR actif',
      value: `${(mrrSnapshot?.current || 0).toLocaleString('fr-FR')} €`,
      sub: `${mrrSnapshot?.recentChangesCount || 0} changement${(mrrSnapshot?.recentChangesCount || 0) > 1 ? 's' : ''} sur 7j`,
      icon: Euro,
      tone: 'blue',
      target: 'mrr',
    },
    {
      key: 'hours',
      label: 'Heures économisées 7j',
      value: `${hoursSnapshot?.last7Hours ?? 0} h`,
      sub:
        hoursSnapshot?.trend != null
          ? `${hoursSnapshot.trend >= 0 ? '+' : ''}${hoursSnapshot.trend}% vs 7j précédents`
          : '—',
      icon: Clock,
      tone: 'emerald',
      target: 'roi-leaderboard',
    },
    {
      key: 'runs',
      label: 'Runs engine 24h',
      value: runs24h.toLocaleString('fr-FR'),
      sub: 'Toutes statuts confondus',
      icon: Zap,
      tone: 'violet',
      target: 'live-runs',
    },
    {
      key: 'rating',
      label: 'Satisfaction 7j',
      value: ratingSnapshot?.rate != null ? `${ratingSnapshot.rate} %` : '—',
      sub: ratingSnapshot?.total ? `${ratingSnapshot.total} notes reçues` : 'Aucune note cette semaine',
      icon: Heart,
      tone: 'pink',
      target: 'ratings',
    },
  ]

  return (
    <div className="max-w-7xl mx-auto animate-fade-in-up px-4 md:px-0 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-[#71717a]">
            <LivePulseDot color="emerald" />
            Briefing matin
            <span className="text-[#a1a1aa]">·</span>
            <span className="font-mono">
              {new Date().toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-[#1a1a1a]">
            Tout ce qui mérite ton attention.
          </h1>
          <p className="text-[14px] text-[#71717a] mt-1">
            Cette page agrège chaque signal opérationnel critique. Si elle est verte, tu peux passer à autre chose.
          </p>
        </div>
        <button
          onClick={() => onTabChange?.('overview')}
          className="text-[12px] font-medium text-[#71717a] hover:text-[#1a1a1a] inline-flex items-center gap-1"
        >
          Voir les stats détaillées
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Urgent signals — clickable cards */}
      <SectionCard title="🚨 Signaux à traiter" subtitle="Cliquer une carte pour ouvrir la vue détaillée">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {urgentSignals.map((s) => (
            <BriefingSignalCard
              key={s.key}
              signal={s}
              onClick={() => onTabChange?.(s.target)}
            />
          ))}
        </div>
      </SectionCard>

      {/* Pulse signals — KPI cards */}
      <SectionCard title="🩺 Pulse business" subtitle="Indicateurs de fond, mis à jour en temps quasi-réel">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {pulseSignals.map((p) => (
            <BriefingPulseCard
              key={p.key}
              pulse={p}
              onClick={() => onTabChange?.(p.target)}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

/* ── Sub-components ────────────────────────────────────────────── */

function BriefingSignalCard({ signal, onClick }) {
  const { label, count, icon: Icon, tone } = signal
  const isOk = count === 0
  const palette = {
    red: 'border-red-200 bg-red-50/40 hover:bg-red-50',
    amber: 'border-amber-200 bg-amber-50/40 hover:bg-amber-50',
    green: 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60',
  }
  const tonePalette = palette[tone] || palette.green
  const iconColor = isOk
    ? 'text-emerald-600'
    : tone === 'amber'
      ? 'text-amber-600'
      : 'text-red-600'
  const countColor = isOk
    ? 'text-emerald-700'
    : tone === 'amber'
      ? 'text-amber-700'
      : 'text-red-700'
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition-colors ${tonePalette}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Icon className={`w-5 h-5 flex-shrink-0 ${iconColor}`} />
        <span className={`text-[28px] font-semibold tabular-nums tracking-tight leading-none ${countColor}`}>
          {isOk ? '✓' : count}
        </span>
      </div>
      <div className="mt-3 text-[13px] font-medium text-[#1a1a1a] leading-snug">{label}</div>
      <div className="mt-1 text-[11px] text-[#71717a]">
        {isOk ? 'RAS' : 'Cliquer pour ouvrir'}
      </div>
    </motion.button>
  )
}

function BriefingPulseCard({ pulse, onClick }) {
  const { label, value, sub, icon: Icon, tone } = pulse
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700',
    pink: 'bg-pink-50 text-pink-700',
  }
  const iconBg = tones[tone] || tones.blue
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="text-left rounded-xl border border-[#f0f0f0] bg-white p-4 hover:bg-zinc-50 transition-colors"
    >
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${iconBg}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="mt-3 text-[24px] font-semibold tracking-tight tabular-nums text-[#1a1a1a] leading-none">
        {value}
      </div>
      <div className="mt-1 text-[12px] font-medium text-[#1a1a1a]">{label}</div>
      <div className="mt-0.5 text-[11px] text-[#71717a]">{sub}</div>
    </motion.button>
  )
}

export default AdminMorningBriefing
