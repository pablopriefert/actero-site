import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, TrendingUp, Clock, PhoneCall, ChevronRight,
  Sparkles, TrendingDown, Activity, Euro,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * Insights Hub — refondu avril 2026.
 *
 * Avant : card menu sans aucune donnée. User clique "Insights" et ne voit
 * aucun insight avant de re-cliquer.
 * Après : header strip (summary 7j) + period selector + 4 cards avec
 * lead metric calculée en live (= hub informatif, pas juste router).
 *
 * Pattern cohérent avec Overview + Automation Hub + Agent Control.
 */
export const InsightsHubView = ({ clientId, onNavigate, canAccessVoice = false }) => {
  const [period, setPeriod] = useState('7d') // '7d' | '30d'

  const days = period === '7d' ? 7 : 30
  const since = useMemo(() => new Date(Date.now() - days * 24 * 3600 * 1000).toISOString(), [days])
  const prevSince = useMemo(() => new Date(Date.now() - 2 * days * 24 * 3600 * 1000).toISOString(), [days])
  const prevEnd = useMemo(() => new Date(Date.now() - days * 24 * 3600 * 1000).toISOString(), [days])

  // Single query that feeds all the lead metrics below
  const { data: insights } = useQuery({
    queryKey: ['insights-hub', clientId, period],
    queryFn: async () => {
      if (!clientId) return null
      const [current, previous, settings] = await Promise.all([
        supabase
          .from('automation_events')
          .select('event_category, time_saved_seconds, source_channel, created_at, latency_ms')
          .eq('client_id', clientId)
          .gte('created_at', since),
        supabase
          .from('automation_events')
          .select('id')
          .eq('client_id', clientId)
          .eq('event_category', 'ticket_resolved')
          .gte('created_at', prevSince)
          .lt('created_at', prevEnd),
        supabase
          .from('client_settings')
          .select('hourly_cost')
          .eq('client_id', clientId)
          .maybeSingle(),
      ])

      const events = current.data || []
      const resolved = events.filter(e => e.event_category === 'ticket_resolved')
      const timeSaved = resolved.reduce((s, e) => s + (Number(e.time_saved_seconds) || 0), 0)
      const hours = Math.round((timeSaved / 3600) * 10) / 10
      const hourlyCost = parseFloat(settings.data?.hourly_cost) || 25
      const roi = Math.round(hours * hourlyCost)

      // Previous period for trend
      const prevCount = (previous.data || []).length
      const trendPct = prevCount > 0
        ? Math.round(((resolved.length - prevCount) / prevCount) * 100)
        : null

      // Peak hour/day (group by day of week + hour)
      const peakMap = {}
      resolved.forEach(e => {
        const d = new Date(e.created_at)
        const key = `${d.getDay()}_${d.getHours()}`
        peakMap[key] = (peakMap[key] || 0) + 1
      })
      let peakSlot = null
      let peakCount = 0
      Object.entries(peakMap).forEach(([key, count]) => {
        if (count > peakCount) {
          peakCount = count
          peakSlot = key
        }
      })

      // Voice stats
      const voice = resolved.filter(e => e.source_channel === 'voice')
      const voiceCount = voice.length
      const voiceAvgLatency = voice.length
        ? Math.round(voice.reduce((s, e) => s + (Number(e.latency_ms) || 0), 0) / voice.length / 1000)
        : null

      return {
        total: resolved.length,
        hours,
        roi,
        trendPct,
        peakSlot,
        voiceCount,
        voiceAvgLatency,
      }
    },
    enabled: !!clientId,
    refetchInterval: 60000,
  })

  /* Format peak slot "3_14" → "Jeudi 14h-15h" */
  const fmtPeak = (slot) => {
    if (!slot) return null
    const [day, hour] = slot.split('_').map(Number)
    const dayNames = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.']
    return `${dayNames[day]} ${hour}h-${hour + 1}h`
  }

  const total = insights?.total ?? 0
  const hours = insights?.hours ?? 0
  const roi = insights?.roi ?? 0
  const trendPct = insights?.trendPct
  const peakLabel = fmtPeak(insights?.peakSlot)
  const voiceCount = insights?.voiceCount ?? 0
  const voiceAvgLatency = insights?.voiceAvgLatency

  const periodLabel = period === '7d' ? '7 derniers jours' : '30 derniers jours'
  const shortLabel = period === '7d' ? '7j' : '30j'

  const cards = [
    {
      id: 'weekly-summary',
      title: 'Performance',
      description: 'Volume, taux auto, temps moyen',
      icon: BarChart3,
      color: '#0E653A',
      metric: total > 0 ? `${total} demande${total > 1 ? 's' : ''}` : 'Aucune donnée',
      metricSub: trendPct !== null && trendPct !== undefined
        ? (trendPct >= 0
            ? `+${trendPct}% vs période précédente`
            : `${trendPct}% vs période précédente`)
        : 'Pas de comparaison disponible',
      trend: trendPct,
    },
    {
      id: 'roi',
      title: 'ROI',
      description: 'Économies vs coût support humain',
      icon: Euro,
      color: '#2563eb',
      metric: `${roi.toLocaleString('fr-FR')}€`,
      metricSub: `${hours}h économisées sur ${shortLabel}`,
    },
    {
      id: 'peak-hours',
      title: 'Heures de pic',
      description: 'Quand vos clients sollicitent le plus',
      icon: Clock,
      color: '#d97706',
      metric: peakLabel || '—',
      metricSub: peakLabel ? 'Créneau le plus chargé' : 'Pas assez de données',
    },
    {
      id: 'voice-calls',
      title: 'Appels vocaux',
      description: 'Analytics de l\'agent téléphonique',
      icon: PhoneCall,
      color: '#7c3aed',
      locked: !canAccessVoice,
      lockedLabel: 'PRO',
      metric: canAccessVoice
        ? (voiceCount > 0 ? `${voiceCount} appel${voiceCount > 1 ? 's' : ''}` : 'Aucun appel')
        : 'Débloqué au plan Pro',
      metricSub: canAccessVoice && voiceAvgLatency
        ? `${voiceAvgLatency}s de réponse moyenne`
        : (canAccessVoice ? `Sur ${shortLabel}` : 'Agent vocal ElevenLabs'),
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 pt-6 pb-16 animate-fade-in-up">
      {/* ═══════ HEADER STRIP ═══════ */}
      <div className="bg-white border border-[#E5E2D7] rounded-2xl p-5 md:p-6 mb-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-cta/10 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-cta" />
              </div>
              <h1 className="text-lg font-bold text-[#1a1a1a]">Insights</h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-cta/10 text-cta text-[10px] font-bold rounded-full uppercase tracking-wider">
                {periodLabel}
              </span>
            </div>
            <p className="text-[12px] text-[#71717a]">
              Les métriques pour comprendre la performance de votre agent.
            </p>
          </div>
          <div className="flex items-center gap-4 md:gap-6 flex-wrap">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Demandes</span>
              <span className="text-lg font-bold text-[#1a1a1a] tabular-nums leading-tight">{total}</span>
              <span className="text-[10px] text-[#9ca3af]">traitées</span>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Temps</span>
              <span className="text-lg font-bold text-[#1a1a1a] tabular-nums leading-tight">{hours}h</span>
              <span className="text-[10px] text-[#9ca3af]">économisées</span>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">ROI</span>
              <span className="text-lg font-bold text-cta tabular-nums leading-tight">
                {roi.toLocaleString('fr-FR')}€
              </span>
              <span className="text-[10px] text-[#9ca3af]">valeur</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ PERIOD SELECTOR ═══════ */}
      <div className="flex items-center gap-1 mb-4">
        {[
          { id: '7d', label: '7 jours' },
          { id: '30d', label: '30 jours' },
        ].map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${
              period === p.id
                ? 'bg-[#1a1a1a] text-white'
                : 'bg-white border border-[#E5E2D7] text-[#71717a] hover:bg-[#fafafa]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ═══════ CARDS GRID ═══════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map((card, idx) => {
          const Icon = card.icon
          const TrendIcon = card.trend !== null && card.trend !== undefined
            ? (card.trend >= 0 ? TrendingUp : TrendingDown)
            : null
          return (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.04 * idx }}
              onClick={() => !card.locked && onNavigate && onNavigate(card.id)}
              disabled={card.locked}
              className={`group text-left bg-white rounded-2xl border p-5 transition-all ${
                card.locked
                  ? 'border-[#E5E2D7] opacity-60 cursor-not-allowed'
                  : 'border-[#E5E2D7] hover:border-cta/30 hover:shadow-[0_1px_3px_rgba(0,0,0,0.04)] cursor-pointer'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${card.color}15` }}
                >
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
                {card.locked ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
                    {card.lockedLabel}
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#9ca3af] opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
              <h3 className="text-[14px] font-semibold text-[#1a1a1a] mb-0.5">{card.title}</h3>
              <p className="text-[11px] text-[#9ca3af] leading-relaxed mb-3">{card.description}</p>

              {/* Lead metric */}
              <div className="pt-3 border-t border-[#E5E2D7]">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-[#1a1a1a] tabular-nums leading-none">
                    {card.metric}
                  </span>
                  {TrendIcon && card.trend !== null && (
                    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold tabular-nums ${
                      card.trend >= 0 ? 'text-cta' : 'text-red-500'
                    }`}>
                      <TrendIcon className="w-3 h-3" />
                      {card.trend >= 0 ? '+' : ''}{card.trend}%
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#71717a] mt-1">{card.metricSub}</p>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
