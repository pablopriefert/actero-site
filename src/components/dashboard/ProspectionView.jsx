import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Mail, Send, Eye, MousePointer, UserCheck, AlertCircle, RefreshCw, TrendingUp } from 'lucide-react'
import { getWorkflows, getExecutions, categorizeWorkflows, computeWorkflowStats } from '../../lib/n8n'

export function ProspectionView({ theme = 'dark' }) {
  const isDark = theme === 'dark'

  const { data: workflows = [] } = useQuery({
    queryKey: ['n8n-workflows'],
    queryFn: getWorkflows,
    staleTime: 60000,
  })

  const categories = categorizeWorkflows(workflows)
  const prospectionWorkflows = categories.prospection || []
  const activeProspection = prospectionWorkflows.filter(w => w.active)

  // Get executions for all prospection workflows
  const { data: allExecs = [], isLoading } = useQuery({
    queryKey: ['n8n-prospection-execs'],
    queryFn: async () => {
      const results = await Promise.all(
        prospectionWorkflows.map(w => getExecutions({ workflowId: w.id, limit: 100 }))
      )
      return results.flat()
    },
    staleTime: 60000,
    enabled: prospectionWorkflows.length > 0,
  })

  const stats = computeWorkflowStats(allExecs)

  // Group executions by day for chart
  const last14Days = []
  const now = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const dayExecs = allExecs.filter(e => e.startedAt?.startsWith(dateStr))
    last14Days.push({
      date: dateStr,
      label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      total: dayExecs.length,
      success: dayExecs.filter(e => e.status === 'success').length,
      error: dayExecs.filter(e => e.status === 'error').length,
    })
  }

  // Per-workflow breakdown
  const perWorkflow = prospectionWorkflows.map(w => {
    const wExecs = allExecs.filter(e => e.workflowId === w.id)
    return {
      ...w,
      stats: computeWorkflowStats(wExecs),
      lastExec: wExecs[0],
    }
  })

  const kpis = [
    { label: 'Workflows actifs', value: activeProspection.length, total: prospectionWorkflows.length, icon: Send, color: 'blue' },
    { label: 'Exécutions totales', value: stats.total, icon: Mail, color: 'violet' },
    { label: 'Taux de succès', value: `${stats.successRate}%`, icon: TrendingUp, color: 'emerald' },
    { label: 'Erreurs', value: stats.error, icon: AlertCircle, color: stats.error > 0 ? 'red' : 'gray' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Prospection</h2>
        <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Performance de vos workflows de lead gen & cold email
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-xl border p-4 ${isDark ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-gray-200'}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`w-4 h-4 text-${kpi.color}-400`} />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{kpi.label}</span>
            </div>
            <p className={`text-2xl font-bold font-mono ${
              kpi.color === 'red' && kpi.value > 0 ? 'text-red-400' :
              kpi.color === 'emerald' ? 'text-emerald-400' :
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              {kpi.value}
              {kpi.total !== undefined && <span className={`text-sm font-normal ${isDark ? 'text-gray-600' : 'text-gray-400'}`}> / {kpi.total}</span>}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Activity chart */}
      <div className={`rounded-2xl border p-6 ${isDark ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-sm font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Activité prospection (14 jours)</h3>
        <div className="flex items-end gap-1.5 h-28">
          {last14Days.map((day, i) => {
            const max = Math.max(...last14Days.map(d => d.total), 1)
            const h = Math.max((day.total / max) * 100, 4)
            return (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ delay: i * 0.03, duration: 0.4 }}
                className="flex-1 group relative"
              >
                <div className={`w-full h-full rounded-md ${
                  day.error > 0 ? 'bg-red-500/50' :
                  day.total > 0 ? 'bg-blue-500/60 hover:bg-blue-400/80' : isDark ? 'bg-white/5' : 'bg-gray-100'
                } transition-colors`} />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {day.total} exec. ({day.error} err.)
                </div>
              </motion.div>
            )
          })}
        </div>
        <div className="flex justify-between mt-2">
          {last14Days.filter((_, i) => i % 2 === 0).map((day, i) => (
            <span key={i} className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{day.label}</span>
          ))}
        </div>
      </div>

      {/* Per-workflow table */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-gray-200'}`}>
        <div className="px-5 py-4">
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Détail par workflow</h3>
        </div>
        <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-gray-100'}`}>
          {perWorkflow.map((w, i) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-4 px-5 py-3 ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'} transition-colors`}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${w.active ? 'bg-emerald-400' : isDark ? 'bg-gray-600' : 'bg-gray-300'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{w.name}</p>
              </div>
              <div className="flex items-center gap-6 text-xs font-mono">
                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{w.stats.total} exec.</span>
                <span className="text-emerald-400">{w.stats.successRate}%</span>
                <span className={w.stats.error > 0 ? 'text-red-400' : isDark ? 'text-gray-600' : 'text-gray-300'}>{w.stats.error} err.</span>
              </div>
            </motion.div>
          ))}
          {perWorkflow.length === 0 && (
            <div className="py-8 text-center">
              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Aucun workflow de prospection détecté</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
