import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Trophy,
  Clock,
  X,
  ChevronRight,
} from 'lucide-react'

// ============================================================
// GENERATE ALERTS FROM DATA
// ============================================================
function generateAlerts(periodStats, prevPeriodStats, metrics, events, clientType) {
  const alerts = []
  const now = new Date()

  // 1. ROI alerts
  if (periodStats?.roi > 0 && periodStats?.roi_var > 20) {
    alerts.push({
      id: 'roi_up',
      type: 'success',
      icon: TrendingUp,
      title: `ROI en hausse de ${periodStats.roi_var}%`,
      message: `Votre ROI a atteint ${periodStats.roi.toLocaleString()}€ ce mois — en forte progression.`,
      priority: 90,
      time: now,
    })
  }
  if (periodStats?.roi_var < -15 && periodStats?.roi_var !== 0) {
    alerts.push({
      id: 'roi_down',
      type: 'warning',
      icon: TrendingDown,
      title: `ROI en baisse de ${Math.abs(periodStats.roi_var)}%`,
      message: `Surveillez vos automatisations — le ROI est en recul par rapport au mois dernier.`,
      priority: 85,
      time: now,
    })
  }

  // 2. Time saved milestone
  if (periodStats?.time_saved >= 50) {
    alerts.push({
      id: 'time_milestone',
      type: 'milestone',
      icon: Trophy,
      title: `${periodStats.time_saved}h économisées ce mois`,
      message: `Nouveau record ! Votre infrastructure IA tourne à plein régime.`,
      priority: 75,
      time: now,
    })
  } else if (periodStats?.time_saved >= 20) {
    alerts.push({
      id: 'time_good',
      type: 'info',
      icon: Clock,
      title: `${periodStats.time_saved}h économisées ce mois`,
      message: `L'IA vous fait gagner un temps significatif sur vos opérations.`,
      priority: 50,
      time: now,
    })
  }

  // 3. Tasks volume
  if (periodStats?.tasks_executed > 300) {
    alerts.push({
      id: 'high_volume',
      type: 'success',
      icon: CheckCircle2,
      title: `${periodStats.tasks_executed} actions exécutées`,
      message: `Volume d'actions élevé — votre système est très actif ce mois.`,
      priority: 70,
      time: now,
    })
  }

  // 4. Tasks variation
  if (periodStats?.tasks_executed_var < -30 && periodStats?.tasks_executed > 0) {
    alerts.push({
      id: 'tasks_drop',
      type: 'warning',
      icon: AlertTriangle,
      title: `Baisse d'activité de ${Math.abs(periodStats.tasks_executed_var)}%`,
      message: `Le nombre d'actions IA a diminué. Vérifiez que vos automatisations tournent correctement.`,
      priority: 80,
      time: now,
    })
  }

  // 5. Immobilier-specific
  if (clientType === 'immobilier') {
    if (periodStats?.leads_qualified > 100) {
      alerts.push({
        id: 'leads_high',
        type: 'success',
        icon: TrendingUp,
        title: `${periodStats.leads_qualified} leads qualifiés`,
        message: `Excellent volume de leads qualifiés ce mois. Priorisez le suivi pour maximiser les conversions.`,
        priority: 82,
        time: now,
      })
    }
  }

  // 6. Ecommerce-specific
  if (clientType === 'ecommerce') {
    const ticketsResolved = events?.filter(e => e.event_category === 'ticket_resolved').length || 0
    if (ticketsResolved > 50) {
      alerts.push({
        id: 'tickets_high',
        type: 'success',
        icon: CheckCircle2,
        title: `${ticketsResolved} tickets résolus automatiquement`,
        message: `Votre SAV IA fonctionne parfaitement — les clients reçoivent des réponses instantanées.`,
        priority: 72,
        time: now,
      })
    }
  }

  return alerts.sort((a, b) => b.priority - a.priority)
}

// ============================================================
// ALERT TYPE STYLES
// ============================================================
const ALERT_STYLES = {
  success: {
    dark: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/15', icon: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    light: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  },
  warning: {
    dark: { bg: 'bg-amber-500/5', border: 'border-amber-500/15', icon: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    light: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  },
  milestone: {
    dark: { bg: 'bg-violet-500/5', border: 'border-violet-500/15', icon: 'text-violet-400', badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
    light: { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'text-violet-600', badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  },
  info: {
    dark: { bg: 'bg-blue-500/5', border: 'border-blue-500/15', icon: 'text-blue-400', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    light: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  },
}

const TYPE_LABELS = {
  success: 'Bonne nouvelle',
  warning: 'Attention',
  milestone: 'Milestone',
  info: 'Info',
}

// ============================================================
// SINGLE ALERT CARD
// ============================================================
const AlertCard = ({ alert, theme, onDismiss }) => {
  const isLight = theme === 'light'
  const style = ALERT_STYLES[alert.type]?.[isLight ? 'light' : 'dark'] || ALERT_STYLES.info[isLight ? 'light' : 'dark']
  const Icon = alert.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.3 }}
      className={`p-4 rounded-2xl border ${style.bg} ${style.border}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${style.badge}`}>
          <Icon className={`w-4 h-4 ${style.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${style.badge}`}>
              {TYPE_LABELS[alert.type]}
            </span>
          </div>
          <h4 className={`text-sm font-bold mt-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {alert.title}
          </h4>
          <p className={`text-xs mt-1 leading-relaxed ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
            {alert.message}
          </p>
        </div>
        <button
          onClick={() => onDismiss(alert.id)}
          className={`shrink-0 p-1 rounded-lg transition-colors ${
            isLight ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/5'
          }`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  )
}

// ============================================================
// MAIN COMPONENT (for overview embed)
// ============================================================
export const AlertsOverview = ({ periodStats, metrics, events, clientType, theme }) => {
  const isLight = theme === 'light'
  const [dismissed, setDismissed] = useState([])

  const alerts = generateAlerts(periodStats, null, metrics, events, clientType)
  const visibleAlerts = alerts.filter(a => !dismissed.includes(a.id)).slice(0, 3)

  if (visibleAlerts.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Bell className={`w-4 h-4 ${isLight ? 'text-slate-500' : 'text-zinc-500'}`} />
        <h3 className={`text-xs font-bold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
          Alertes & notifications
        </h3>
        {visibleAlerts.length > 0 && (
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
            isLight ? 'bg-violet-100 text-violet-600' : 'bg-violet-500/20 text-violet-400'
          }`}>
            {visibleAlerts.length}
          </span>
        )}
      </div>
      <AnimatePresence>
        {visibleAlerts.map(alert => (
          <AlertCard
            key={alert.id}
            alert={alert}
            theme={theme}
            onDismiss={(id) => setDismissed(prev => [...prev, id])}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
