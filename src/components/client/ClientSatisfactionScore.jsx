import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ThumbsUp, Clock, Zap, Activity, TrendingUp, TrendingDown
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * Feature 5 — SLA Tracking: response time metrics
 * Feature 6 — Client Satisfaction Score: composite score with gauge
 */

const SLACard = ({ label, value, unit, icon: Icon, color = 'zinc', theme }) => {
  const isLight = theme === 'light'
  const colors = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    rose: 'text-rose-400',
    zinc: 'text-zinc-400',
  }
  return (
    <div className={`rounded-xl border p-4 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0a0a0a] border-white/10'}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${colors[color]}`} />
        <p className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>{label}</p>
      </div>
      <p className={`text-2xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
        {value}<span className="text-sm font-normal text-zinc-500 ml-1">{unit}</span>
      </p>
    </div>
  )
}

const ScoreGauge = ({ score, theme }) => {
  const isLight = theme === 'light'
  const circumference = 2 * Math.PI * 50
  const progress = (score / 100) * circumference
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Bon' : 'A ameliorer'

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 110 110">
          <circle cx="55" cy="55" r="50" fill="none" stroke={isLight ? '#e2e8f0' : 'rgba(255,255,255,0.05)'} strokeWidth="8" />
          <circle
            cx="55" cy="55" r="50" fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{score}</span>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>/100</span>
        </div>
      </div>
      <p className={`mt-2 text-sm font-bold ${isLight ? 'text-slate-700' : 'text-zinc-300'}`} style={{ color }}>{label}</p>
    </div>
  )
}

export const ClientSatisfactionScore = ({ clientId, theme = 'dark' }) => {
  const isLight = theme === 'light'

  const { data: scoreData } = useQuery({
    queryKey: ['satisfaction-score', clientId],
    queryFn: async () => {
      // Fetch AI conversations for satisfaction rate + response times
      const { data: conversations } = await supabase
        .from('ai_conversations')
        .select('rating, response_time_ms, status, created_at')
        .eq('client_id', clientId)

      // Fetch recent events for uptime/volume metric
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { count: eventCount } = await supabase
        .from('automation_events')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .gte('created_at', thirtyDaysAgo)

      const convos = conversations || []

      // Satisfaction rate from ratings
      const rated = convos.filter(c => c.rating)
      const positiveCount = rated.filter(c => c.rating === 'positive').length
      const satisfactionRate = rated.length >= 5
        ? Math.round((positiveCount / rated.length) * 100)
        : 85 // Default assumption if not enough data

      // Response time metrics
      const withResponseTime = convos.filter(c => c.response_time_ms && c.response_time_ms > 0)
      const avgResponseTime = withResponseTime.length > 0
        ? Math.round(withResponseTime.reduce((sum, c) => sum + c.response_time_ms, 0) / withResponseTime.length)
        : 0
      const fastest = withResponseTime.length > 0
        ? Math.min(...withResponseTime.map(c => c.response_time_ms))
        : 0
      const slowest = withResponseTime.length > 0
        ? Math.max(...withResponseTime.map(c => c.response_time_ms))
        : 0

      // Uptime score (based on days with events in last 30 days)
      const eventDays = new Set()
      if (convos.length > 0) {
        convos.forEach(c => {
          if (new Date(c.created_at) >= new Date(thirtyDaysAgo)) {
            eventDays.add(new Date(c.created_at).toISOString().split('T')[0])
          }
        })
      }
      const uptimeScore = Math.min(100, Math.round((eventDays.size / 30) * 100))

      // Volume score (normalized to 100 based on event count)
      const volumeScore = Math.min(100, Math.round((eventCount || 0) / 5)) // 500 events = 100 score

      // Composite score: weighted average
      // 40% satisfaction, 25% response time (inverted — faster = better), 20% uptime, 15% volume
      const responseTimeScore = avgResponseTime > 0
        ? Math.max(0, Math.min(100, Math.round(100 - (avgResponseTime / 10000) * 100))) // <10s = 100, >10s = 0
        : 80 // Default if no data

      const compositeScore = Math.round(
        satisfactionRate * 0.4 +
        responseTimeScore * 0.25 +
        uptimeScore * 0.20 +
        volumeScore * 0.15
      )

      // Historical trend (compare last 15 days vs previous 15 days)
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000)
      const recent = convos.filter(c => new Date(c.created_at) >= fifteenDaysAgo)
      const older = convos.filter(c => {
        const d = new Date(c.created_at)
        return d >= new Date(thirtyDaysAgo) && d < fifteenDaysAgo
      })
      const recentRated = recent.filter(c => c.rating)
      const olderRated = older.filter(c => c.rating)
      const recentSat = recentRated.length >= 3 ? Math.round(recentRated.filter(c => c.rating === 'positive').length / recentRated.length * 100) : null
      const olderSat = olderRated.length >= 3 ? Math.round(olderRated.filter(c => c.rating === 'positive').length / olderRated.length * 100) : null
      const trend = recentSat !== null && olderSat !== null ? recentSat - olderSat : null

      return {
        compositeScore: Math.min(100, Math.max(0, compositeScore)),
        satisfactionRate,
        avgResponseTime,
        fastest,
        slowest,
        responseTimeScore,
        uptimeScore,
        volumeScore,
        totalConversations: convos.length,
        ratedCount: rated.length,
        eventCount: eventCount || 0,
        trend,
      }
    },
    enabled: !!clientId,
  })

  if (!scoreData) return null

  const formatMs = (ms) => {
    if (ms === 0) return '—'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div className="space-y-6">
      {/* Composite satisfaction score */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border p-6 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0a0a0a] border-white/10'}`}
      >
        <div className="flex flex-col md:flex-row items-center gap-6">
          <ScoreGauge score={scoreData.compositeScore} theme={theme} />
          <div className="flex-1 space-y-3">
            <h3 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Score de satisfaction global</h3>
            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
              Combine la satisfaction IA, le temps de reponse, la disponibilite et le volume d&apos;activite.
            </p>
            {scoreData.trend !== null && (
              <div className={`flex items-center gap-1 text-sm font-medium ${scoreData.trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {scoreData.trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {scoreData.trend >= 0 ? '+' : ''}{scoreData.trend}% vs les 15 jours precedents
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              <div className={`text-center px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>Satisfaction</p>
                <p className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{scoreData.satisfactionRate}%</p>
              </div>
              <div className={`text-center px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>Rapidite</p>
                <p className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{scoreData.responseTimeScore}%</p>
              </div>
              <div className={`text-center px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>Disponibilite</p>
                <p className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{scoreData.uptimeScore}%</p>
              </div>
              <div className={`text-center px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>Volume</p>
                <p className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{scoreData.volumeScore}%</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* SLA Tracking */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SLACard
          label="Temps de reponse moyen"
          value={formatMs(scoreData.avgResponseTime)}
          unit=""
          icon={Clock}
          color="blue"
          theme={theme}
        />
        <SLACard
          label="Reponse la plus rapide"
          value={formatMs(scoreData.fastest)}
          unit=""
          icon={Zap}
          color="emerald"
          theme={theme}
        />
        <SLACard
          label="Reponse la plus lente"
          value={formatMs(scoreData.slowest)}
          unit=""
          icon={Activity}
          color="amber"
          theme={theme}
        />
      </div>
    </div>
  )
}

/**
 * Small KPI card for overview: shows satisfaction rate
 */
export const SatisfactionKPI = ({ clientId, theme = 'dark' }) => {
  const isLight = theme === 'light'

  const { data: rate } = useQuery({
    queryKey: ['satisfaction-kpi', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_conversations')
        .select('rating')
        .eq('client_id', clientId)
        .not('rating', 'is', null)
      if (!data || data.length < 5) return null
      const positive = data.filter(c => c.rating === 'positive').length
      return Math.round((positive / data.length) * 100)
    },
    enabled: !!clientId,
  })

  if (rate === null || rate === undefined) return null

  return (
    <div className={`group p-6 rounded-2xl border transition-all duration-300 ${
      isLight ? 'bg-white border-slate-200 shadow-sm hover:shadow-md' : 'bg-[#0a0a0a] border-white/10 hover:border-white/20'
    }`}>
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          isLight ? 'bg-blue-50 border-blue-100' : 'bg-blue-500/10 border-blue-500/20'
        }`}>
          <ThumbsUp className={`w-5 h-5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
        </div>
        <h4 className={`text-xs font-bold uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
          Satisfaction IA
        </h4>
      </div>
      <span className={`text-4xl font-bold tracking-tight ${
        rate >= 80 ? (isLight ? 'text-emerald-600' : 'text-emerald-500')
          : rate >= 50 ? (isLight ? 'text-amber-600' : 'text-amber-500')
            : (isLight ? 'text-red-600' : 'text-red-500')
      }`}>
        {rate}%
      </span>
    </div>
  )
}
