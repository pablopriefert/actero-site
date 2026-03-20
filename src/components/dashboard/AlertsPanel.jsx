import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { AlertTriangle, XCircle, Clock, CheckCircle2, Zap } from 'lucide-react'
import { getWorkflows, getExecutions } from '../../lib/n8n'

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
  return `il y a ${Math.floor(diff / 86400)}j`
}

export function AlertsPanel({ theme = 'dark', maxAlerts = 5 }) {
  const isDark = theme === 'dark'

  const { data: workflows = [] } = useQuery({
    queryKey: ['n8n-workflows'],
    queryFn: getWorkflows,
    staleTime: 60000,
  })

  const { data: recentErrors = [] } = useQuery({
    queryKey: ['n8n-errors'],
    queryFn: () => getExecutions({ status: 'error', limit: 20 }),
    staleTime: 30000,
  })

  const workflowMap = Object.fromEntries(workflows.map(w => [w.id, w]))

  // Build alerts
  const alerts = []

  // 1. Recent execution errors (last 24h)
  const now = Date.now()
  recentErrors
    .filter(e => (now - new Date(e.startedAt).getTime()) < 86400000)
    .forEach(exec => {
      const wf = workflowMap[exec.workflowId]
      alerts.push({
        id: `err-${exec.id}`,
        type: 'error',
        title: `Échec : ${wf?.name || exec.workflowId}`,
        description: `Exécution #${exec.id} a échoué`,
        time: exec.startedAt,
        icon: XCircle,
        color: 'red',
      })
    })

  // 2. Active workflows with recent errors
  const errorWorkflowIds = new Set(recentErrors.map(e => e.workflowId))
  workflows.filter(w => w.active && errorWorkflowIds.has(w.id)).forEach(w => {
    const errorCount = recentErrors.filter(e => e.workflowId === w.id).length
    if (errorCount >= 3) {
      alerts.push({
        id: `unstable-${w.id}`,
        type: 'warning',
        title: `Instable : ${w.name}`,
        description: `${errorCount} erreurs dans les dernières 24h`,
        time: recentErrors.find(e => e.workflowId === w.id)?.startedAt,
        icon: AlertTriangle,
        color: 'amber',
      })
    }
  })

  // 3. Inactive critical workflows
  workflows.filter(w => !w.active).forEach(w => {
    const name = w.name.toLowerCase()
    if (name.includes('execution engine') || name.includes('process automation') || name.includes('increment')) {
      alerts.push({
        id: `inactive-${w.id}`,
        type: 'warning',
        title: `Désactivé : ${w.name}`,
        description: 'Ce workflow critique est actuellement inactif',
        time: w.updatedAt,
        icon: AlertTriangle,
        color: 'amber',
      })
    }
  })

  // Sort by time (most recent first) and limit
  alerts.sort((a, b) => new Date(b.time) - new Date(a.time))
  const visibleAlerts = alerts.slice(0, maxAlerts)

  if (visibleAlerts.length === 0) {
    return (
      <div className={`rounded-xl border p-4 flex items-center gap-3 ${isDark ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-emerald-50 border-emerald-200'}`}>
        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        <div>
          <p className={`text-sm font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Tous les systèmes fonctionnent</p>
          <p className={`text-[11px] ${isDark ? 'text-emerald-500/60' : 'text-emerald-400'}`}>
            {workflows.filter(w => w.active).length} workflows actifs, aucune alerte
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {visibleAlerts.map((alert, i) => {
        const Icon = alert.icon
        return (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-xl border p-4 flex items-start gap-3 ${
              alert.color === 'red'
                ? isDark ? 'bg-red-500/5 border-red-500/15' : 'bg-red-50 border-red-200'
                : isDark ? 'bg-amber-500/5 border-amber-500/15' : 'bg-amber-50 border-amber-200'
            }`}
          >
            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 text-${alert.color}-400`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{alert.title}</p>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{alert.description}</p>
            </div>
            <span className={`text-[10px] whitespace-nowrap ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              {alert.time ? timeAgo(alert.time) : ''}
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}
