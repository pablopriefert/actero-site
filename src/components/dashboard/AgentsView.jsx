import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, ZapOff, Play, Pause, CheckCircle2, XCircle, Clock,
  BarChart3, Activity, ChevronDown, ChevronUp, RefreshCw,
  Bot, Mail, Headphones, Database, Cog
} from 'lucide-react'
import { getWorkflows, getExecutions, categorizeWorkflows, computeWorkflowStats, activateWorkflow, deactivateWorkflow } from '../../lib/n8n'

const CATEGORY_META = {
  sav: { label: 'Support Client / SAV', icon: Headphones, color: 'emerald' },
  prospection: { label: 'Prospection & Lead Gen', icon: Mail, color: 'blue' },
  metrics: { label: 'Métriques & Data', icon: Database, color: 'violet' },
  intake: { label: 'Onboarding & Intake', icon: Bot, color: 'amber' },
  other: { label: 'Autres', icon: Cog, color: 'gray' },
}

function WorkflowCard({ workflow, theme, onToggle }) {
  const [expanded, setExpanded] = useState(false)
  const [toggling, setToggling] = useState(false)
  const isDark = theme === 'dark'

  const { data: executions = [] } = useQuery({
    queryKey: ['n8n-executions', workflow.id],
    queryFn: () => getExecutions({ workflowId: workflow.id, limit: 20 }),
    staleTime: 30000,
    enabled: expanded,
  })

  const stats = computeWorkflowStats(executions)

  const handleToggle = async () => {
    setToggling(true)
    try {
      if (workflow.active) {
        await deactivateWorkflow(workflow.id)
      } else {
        await activateWorkflow(workflow.id)
      }
      onToggle?.()
    } catch (e) {
      console.error('Toggle failed:', e)
    } finally {
      setToggling(false)
    }
  }

  const lastExec = executions[0]
  const lastExecTime = lastExec?.startedAt
    ? new Date(lastExec.startedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 transition-colors ${
        isDark ? 'bg-white/[0.02] border-white/10 hover:border-white/20' : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Status dot */}
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
          workflow.active ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : isDark ? 'bg-gray-600' : 'bg-gray-300'
        }`} />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {workflow.name}
          </p>
          <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Dernière exécution : {lastExecTime}
          </p>
        </div>

        {/* Toggle button */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
            toggling ? 'opacity-50 cursor-wait' : ''
          } ${
            workflow.active
              ? isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              : isDark ? 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10' : 'bg-gray-50 text-gray-500 border border-gray-200'
          }`}
        >
          {toggling ? <RefreshCw className="w-3 h-3 animate-spin" /> : workflow.active ? <Zap className="w-3 h-3" /> : <ZapOff className="w-3 h-3" />}
          {workflow.active ? 'ACTIF' : 'INACTIF'}
        </button>

        {/* Expand */}
        <button onClick={() => setExpanded(!expanded)} className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-white/5 text-gray-500' : 'hover:bg-gray-100 text-gray-400'}`}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded stats */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={`mt-4 pt-4 border-t grid grid-cols-4 gap-3 ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Exécutions</p>
                <p className={`text-lg font-bold font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.total}</p>
              </div>
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Succès</p>
                <p className="text-lg font-bold font-mono text-emerald-400">{stats.successRate}%</p>
              </div>
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Erreurs</p>
                <p className={`text-lg font-bold font-mono ${stats.error > 0 ? 'text-red-400' : isDark ? 'text-gray-600' : 'text-gray-300'}`}>{stats.error}</p>
              </div>
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Temps moyen</p>
                <p className={`text-lg font-bold font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {stats.avgDurationMs > 0 ? `${(stats.avgDurationMs / 1000).toFixed(1)}s` : '—'}
                </p>
              </div>
            </div>

            {/* Mini execution history */}
            {executions.length > 0 && (
              <div className="mt-3 flex gap-1">
                {executions.slice(0, 20).map((exec, i) => (
                  <div
                    key={exec.id}
                    title={`${exec.status} — ${new Date(exec.startedAt).toLocaleString('fr-FR')}`}
                    className={`flex-1 h-2 rounded-full ${
                      exec.status === 'success' ? 'bg-emerald-500/70' :
                      exec.status === 'error' ? 'bg-red-500/70' :
                      exec.status === 'running' ? 'bg-blue-500/70 animate-pulse' :
                      isDark ? 'bg-white/10' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function AgentsView({ theme = 'dark' }) {
  const isDark = theme === 'dark'
  const queryClient = useQueryClient()

  const { data: workflows = [], isLoading, error } = useQuery({
    queryKey: ['n8n-workflows'],
    queryFn: getWorkflows,
    staleTime: 30000,
  })

  const categories = categorizeWorkflows(workflows)
  const activeCount = workflows.filter(w => w.active).length
  const totalCount = workflows.length

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['n8n-workflows'] })
  }

  if (error) {
    return (
      <div className={`rounded-2xl border p-12 text-center ${isDark ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-gray-200'}`}>
        <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Impossible de se connecter à n8n</p>
        <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{error.message}</p>
        <button onClick={handleRefresh} className="mt-4 text-sm text-emerald-400 font-medium hover:text-emerald-300">Réessayer</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Mes Agents IA</h2>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {activeCount} agents actifs sur {totalCount} au total
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/5 text-gray-500' : 'hover:bg-gray-100 text-gray-400'}`}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Actifs</span>
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-400">{activeCount}</p>
        </div>
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <ZapOff className="w-4 h-4 text-gray-400" />
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Inactifs</span>
          </div>
          <p className={`text-2xl font-bold font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{totalCount - activeCount}</p>
        </div>
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Catégories</span>
          </div>
          <p className={`text-2xl font-bold font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {Object.values(categories).filter(c => c.length > 0).length}
          </p>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-500" />
        </div>
      )}

      {/* Workflow categories */}
      {!isLoading && Object.entries(categories).map(([catKey, catWorkflows]) => {
        if (catWorkflows.length === 0) return null
        const meta = CATEGORY_META[catKey]
        const Icon = meta.icon
        return (
          <div key={catKey}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-4 h-4 text-${meta.color}-400`} />
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{meta.label}</h3>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                {catWorkflows.length}
              </span>
            </div>
            <div className="space-y-2">
              {catWorkflows.map(w => (
                <WorkflowCard
                  key={w.id}
                  workflow={w}
                  theme={theme}
                  onToggle={handleRefresh}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
