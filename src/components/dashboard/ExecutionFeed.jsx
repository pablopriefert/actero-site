import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Loader2, Clock, RefreshCw, Filter } from 'lucide-react'
import { getExecutions, getWorkflows } from '../../lib/n8n'

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
  return `il y a ${Math.floor(diff / 86400)}j`
}

function durationStr(startedAt, stoppedAt) {
  if (!startedAt || !stoppedAt) return '—'
  const ms = new Date(stoppedAt) - new Date(startedAt)
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}min`
}

const STATUS_META = {
  success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Succès' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Erreur' },
  running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'En cours' },
  waiting: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'En attente' },
}

export function ExecutionFeed({ theme = 'dark' }) {
  const isDark = theme === 'dark'
  const [statusFilter, setStatusFilter] = useState('all')
  const [limit, setLimit] = useState(30)

  const { data: workflows = [] } = useQuery({
    queryKey: ['n8n-workflows'],
    queryFn: getWorkflows,
    staleTime: 60000,
  })

  const workflowMap = Object.fromEntries(workflows.map(w => [w.id, w.name]))

  const { data: executions = [], isLoading, refetch } = useQuery({
    queryKey: ['n8n-executions-feed', statusFilter, limit],
    queryFn: () => getExecutions({
      limit,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
    refetchInterval: 15000, // Auto refresh every 15s
    staleTime: 10000,
  })

  const filters = [
    { id: 'all', label: 'Toutes' },
    { id: 'success', label: 'Succès' },
    { id: 'error', label: 'Erreurs' },
    { id: 'running', label: 'En cours' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Exécutions</h2>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Historique en temps réel des workflows n8n
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            AUTO-REFRESH
          </div>
          <button
            onClick={() => refetch()}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/5 text-gray-500' : 'hover:bg-gray-100 text-gray-400'}`}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === f.id
                ? isDark ? 'bg-white text-black' : 'bg-black text-white'
                : isDark ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Execution list */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-gray-200'}`}>
        {isLoading && executions.length === 0 ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-gray-500" />
          </div>
        ) : executions.length === 0 ? (
          <div className="py-12 text-center">
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Aucune exécution trouvée</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {executions.map((exec, i) => {
              const meta = STATUS_META[exec.status] || STATUS_META.waiting
              const Icon = meta.icon
              return (
                <motion.div
                  key={exec.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className={`flex items-center gap-4 px-5 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'}`}
                >
                  {/* Status icon */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${meta.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${meta.color} ${exec.status === 'running' ? 'animate-spin' : ''}`} />
                  </div>

                  {/* Workflow name */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {workflowMap[exec.workflowId] || `Workflow ${exec.workflowId}`}
                    </p>
                    <p className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                      ID: {exec.id}
                    </p>
                  </div>

                  {/* Duration */}
                  <div className="text-right">
                    <p className={`text-xs font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {durationStr(exec.startedAt, exec.stoppedAt)}
                    </p>
                  </div>

                  {/* Time ago */}
                  <div className="w-24 text-right">
                    <p className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                      {exec.startedAt ? timeAgo(exec.startedAt) : '—'}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Load more */}
      {executions.length >= limit && (
        <div className="text-center">
          <button
            onClick={() => setLimit(l => l + 30)}
            className={`text-sm font-medium ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-500'}`}
          >
            Charger plus d'exécutions
          </button>
        </div>
      )}
    </div>
  )
}
