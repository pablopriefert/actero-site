import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Target,
  TrendingUp,
  Sparkles,
  ChevronRight,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from 'lucide-react'

// ============================================================
// DEFAULT OBJECTIVES BY VERTICAL
// ============================================================
const DEFAULT_OBJECTIVES = {
  ecommerce: [
    { id: 'tickets', label: 'Tickets résolus', target: 200, unit: '', icon: '🎫' },
    { id: 'roi', label: 'ROI généré', target: 5000, unit: '€', icon: '💰' },
    { id: 'time', label: 'Temps économisé', target: 50, unit: 'h', icon: '⏱️' },
  ],
  immobilier: [
    { id: 'leads', label: 'Leads qualifiés', target: 200, unit: '', icon: '🎯' },
    { id: 'roi', label: 'ROI généré', target: 5000, unit: '€', icon: '💰' },
    { id: 'time', label: 'Temps économisé', target: 50, unit: 'h', icon: '⏱️' },
  ],
}

// ============================================================
// PROGRESS BAR
// ============================================================
const ProgressBar = ({ current, target, color, theme }) => {
  const isLight = theme === 'light'
  const pct = Math.min(100, Math.round((current / target) * 100))

  const colorMap = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
  }

  return (
    <div className={`w-full h-2.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className={`h-full rounded-full ${colorMap[color] || colorMap.emerald}`}
      />
    </div>
  )
}

// ============================================================
// AI PREDICTION
// ============================================================
function predictCompletion(current, target, dayOfMonth, daysInMonth) {
  if (current >= target) return { pct: 100, status: 'completed', message: 'Objectif atteint !' }
  if (dayOfMonth === 0) return { pct: 0, status: 'neutral', message: 'Début du mois' }

  const dailyRate = current / dayOfMonth
  const projected = Math.round(dailyRate * daysInMonth)
  const projectedPct = Math.min(100, Math.round((projected / target) * 100))

  if (projectedPct >= 100) {
    return { pct: projectedPct, status: 'on_track', message: `Au rythme actuel, objectif atteint avant la fin du mois` }
  } else if (projectedPct >= 80) {
    return { pct: projectedPct, status: 'close', message: `Prédiction IA : ${projectedPct}% de l'objectif atteint d'ici fin du mois` }
  } else {
    return { pct: projectedPct, status: 'behind', message: `Prédiction IA : seulement ${projectedPct}% atteint au rythme actuel` }
  }
}

// ============================================================
// SINGLE OBJECTIVE CARD
// ============================================================
const ObjectiveCard = ({ objective, current, theme }) => {
  const isLight = theme === 'light'
  const pct = Math.min(100, Math.round((current / objective.target) * 100))

  const now = new Date()
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const prediction = predictCompletion(current, objective.target, dayOfMonth, daysInMonth)

  const statusColors = {
    completed: { icon: CheckCircle2, color: isLight ? 'text-emerald-600' : 'text-emerald-400', bg: isLight ? 'bg-emerald-50' : 'bg-emerald-500/10' },
    on_track: { icon: TrendingUp, color: isLight ? 'text-emerald-600' : 'text-emerald-400', bg: isLight ? 'bg-emerald-50' : 'bg-emerald-500/10' },
    close: { icon: Zap, color: isLight ? 'text-amber-600' : 'text-amber-400', bg: isLight ? 'bg-amber-50' : 'bg-amber-500/10' },
    behind: { icon: AlertTriangle, color: isLight ? 'text-red-600' : 'text-red-400', bg: isLight ? 'bg-red-50' : 'bg-red-500/10' },
    neutral: { icon: Target, color: isLight ? 'text-slate-500' : 'text-zinc-500', bg: isLight ? 'bg-slate-50' : 'bg-white/5' },
  }
  const s = statusColors[prediction.status]
  const StatusIcon = s.icon

  return (
    <div className={`p-5 rounded-2xl border ${isLight ? 'bg-white border-slate-200' : 'bg-[#0a0a0a] border-white/10'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{objective.icon}</span>
          <span className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {objective.label}
          </span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
          pct >= 100
            ? (isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400')
            : pct >= 70
              ? (isLight ? 'bg-amber-50 text-amber-600' : 'bg-amber-500/10 text-amber-400')
              : (isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/5 text-zinc-400')
        }`}>
          {pct}%
        </span>
      </div>

      <div className="flex items-baseline gap-1 mb-3">
        <span className={`text-2xl font-bold font-mono tracking-tighter ${isLight ? 'text-slate-900' : 'text-white'}`}>
          {current.toLocaleString()}{objective.unit}
        </span>
        <span className={`text-xs ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
          / {objective.target.toLocaleString()}{objective.unit}
        </span>
      </div>

      <ProgressBar
        current={current}
        target={objective.target}
        color={pct >= 100 ? 'emerald' : pct >= 70 ? 'amber' : 'violet'}
        theme={theme}
      />

      <div className={`flex items-center gap-2 mt-3 px-2.5 py-1.5 rounded-lg ${s.bg}`}>
        <StatusIcon className={`w-3.5 h-3.5 ${s.color}`} />
        <span className={`text-[11px] font-medium ${s.color}`}>
          {prediction.message}
        </span>
      </div>
    </div>
  )
}

// ============================================================
// MAIN WIDGET (for overview embed)
// ============================================================
export const ObjectivesWidget = ({ periodStats, eventCounts, clientType, theme }) => {
  const isLight = theme === 'light'
  const vertical = clientType === 'immobilier' ? 'immobilier' : 'ecommerce'
  const objectives = DEFAULT_OBJECTIVES[vertical]

  // Map current values from real data
  const getCurrentValue = (id) => {
    switch (id) {
      case 'tickets': return eventCounts?.ticket_resolved || periodStats?.tasks_executed || 0
      case 'leads': return eventCounts?.lead_qualified || periodStats?.leads_qualified || 0
      case 'roi': return periodStats?.roi || 0
      case 'time': return periodStats?.time_saved || 0
      default: return 0
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className={`w-4 h-4 ${isLight ? 'text-violet-600' : 'text-violet-400'}`} />
          <h3 className={`text-xs font-bold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
            Objectifs du mois
          </h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${isLight ? 'bg-violet-50' : 'bg-violet-500/10'}`}>
          <Sparkles className={`w-3 h-3 ${isLight ? 'text-violet-600' : 'text-violet-400'}`} />
          <span className={`text-[10px] font-bold ${isLight ? 'text-violet-600' : 'text-violet-400'}`}>
            Prédiction IA activée
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {objectives.map((obj) => (
          <ObjectiveCard
            key={obj.id}
            objective={obj}
            current={getCurrentValue(obj.id)}
            theme={theme}
          />
        ))}
      </div>
    </div>
  )
}
