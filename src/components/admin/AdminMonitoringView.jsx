import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  AlertTriangle, CheckCircle2, XCircle, Clock,
  Zap, RefreshCw, Wifi, WifiOff, Pause, Bot,
  ExternalLink, Power, TrendingUp, BarChart3, ShieldCheck
} from 'lucide-react'
import { AdminN8nCopilot } from './AdminN8nCopilot'

const statusConfig = {
  active_ok: { label: 'Actif — OK', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  active_error: { label: 'Actif — Erreurs', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: AlertTriangle },
  active_idle: { label: 'Actif — Inactif', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: Clock },
  inactive: { label: 'Désactivé', color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20', icon: Pause },
}

function getWorkflowStatus(wf) {
  if (!wf.active) return 'inactive'
  if (wf.recentErrorCount > 0) return 'active_error'
  if (!wf.lastExecution) return 'active_idle'
  return 'active_ok'
}

function getHealthScore(wf) {
  if (wf.recentTotal === 0) return wf.active ? 50 : null
  return Math.round((wf.recentSuccessCount / wf.recentTotal) * 100)
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Jamais'
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
  return `il y a ${Math.floor(diff / 86400)}j`
}

export const AdminMonitoringView = () => {
  const [showCopilot, setShowCopilot] = useState(false)
  const [toggling, setToggling] = useState(null)
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['n8n-workflows'],
    queryFn: async () => {
      const res = await fetch('/api/n8n-workflows')
      if (!res.ok) throw new Error('Erreur API n8n')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const workflows = data?.workflows || []
  const activeCount = workflows.filter(w => w.active).length
  const errorCount = workflows.filter(w => getWorkflowStatus(w) === 'active_error').length
  const totalExecs = workflows.reduce((s, w) => s + w.recentTotal, 0)
  const totalSuccess = workflows.reduce((s, w) => s + w.recentSuccessCount, 0)
  const globalSuccessRate = totalExecs > 0 ? Math.round((totalSuccess / totalExecs) * 100) : 100

  const alerts = workflows
    .filter(w => getWorkflowStatus(w) === 'active_error' || getWorkflowStatus(w) === 'active_idle')
    .map(w => ({
      workflow: w,
      type: getWorkflowStatus(w) === 'active_error' ? 'error' : 'warning',
      message: getWorkflowStatus(w) === 'active_error'
        ? `${w.recentErrorCount} erreur(s) récente(s)`
        : 'Aucune exécution récente',
    }))

  // Insights
  const worstWorkflow = workflows.filter(w => w.recentErrorCount > 0).sort((a, b) => b.recentErrorCount - a.recentErrorCount)[0]
  const zombieWorkflows = workflows.filter(w => w.active && !w.lastExecution)

  const toggleWorkflow = async (wfId, activate) => {
    setToggling(wfId)
    try {
      await fetch('/api/n8n-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', workflowId: wfId, active: activate }),
      })
      queryClient.invalidateQueries({ queryKey: ['n8n-workflows'] })
      refetch()
    } catch { /* ignore */ }
    setToggling(null)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Monitoring n8n</h2>
          <p className="text-sm text-gray-500 mt-1">Statut en temps réel · {workflows.length} workflows</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCopilot(!showCopilot)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-bold transition-all ${
              showCopilot
                ? 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
            }`}
          >
            <Bot className="w-4 h-4" /> Copilot IA
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:border-white/20 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Actifs', value: activeCount, total: workflows.length, icon: Wifi, color: 'emerald' },
          { label: 'Taux de succès', value: `${globalSuccessRate}%`, icon: ShieldCheck, color: globalSuccessRate >= 90 ? 'emerald' : globalSuccessRate >= 70 ? 'amber' : 'red' },
          { label: 'Exécutions', value: totalExecs, icon: Zap, color: 'blue' },
          { label: 'Erreurs', value: errorCount, icon: XCircle, color: errorCount > 0 ? 'red' : 'emerald' },
          { label: 'Alertes', value: alerts.length, icon: AlertTriangle, color: alerts.length > 0 ? 'amber' : 'emerald' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[#0a0a0a] rounded-2xl border border-white/10 p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon className={`w-3.5 h-3.5 text-${kpi.color}-400`} />
            </div>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-bold text-white font-mono">{kpi.value}</span>
              {kpi.total !== undefined && <span className="text-xs text-gray-500 mb-0.5">/{kpi.total}</span>}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Insights bar */}
      {(worstWorkflow || zombieWorkflows.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {worstWorkflow && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/15">
              <TrendingUp className="w-5 h-5 text-red-400 flex-shrink-0 rotate-180" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Plus instable</p>
                <p className="text-xs text-white font-medium truncate">{worstWorkflow.name}</p>
                <p className="text-[10px] text-red-400">{worstWorkflow.recentErrorCount} erreurs / {worstWorkflow.recentTotal} exécutions</p>
              </div>
            </div>
          )}
          {zombieWorkflows.length > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
              <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Workflows zombies</p>
                <p className="text-xs text-white font-medium">{zombieWorkflows.length} workflow(s) actif(s) sans exécution</p>
                <p className="text-[10px] text-amber-400">{zombieWorkflows.map(w => w.name).join(', ')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Copilot */}
      {showCopilot && <AdminN8nCopilot />}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Alertes ({alerts.length})
          </h3>
          {alerts.map((alert, i) => (
            <motion.div
              key={alert.workflow.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-4 p-4 rounded-xl border ${
                alert.type === 'error' ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'
              }`}
            >
              {alert.type === 'error'
                ? <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                : <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{alert.workflow.name}</p>
                <p className={`text-xs ${alert.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>{alert.message}</p>
              </div>
              <span className="text-[10px] text-gray-500">{timeAgo(alert.workflow.lastExecution?.startedAt)}</span>
            </motion.div>
          ))}
        </div>
      )}

      {/* Workflow List */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-600" />
        </div>
      ) : error ? (
        <div className="text-center py-20 bg-[#0a0a0a] rounded-2xl border border-red-500/20">
          <WifiOff className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-red-400">Impossible de se connecter à n8n</h3>
          <p className="text-sm text-gray-500 mt-2">{error.message}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-400 mb-3">Workflows ({workflows.length})</h3>
          {workflows.map((wf, i) => {
            const status = getWorkflowStatus(wf)
            const cfg = statusConfig[status]
            const StatusIcon = cfg.icon
            const health = getHealthScore(wf)
            const healthColor = health === null ? 'gray' : health >= 90 ? 'emerald' : health >= 70 ? 'amber' : 'red'

            return (
              <motion.div
                key={wf.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 flex items-center gap-4 hover:border-white/20 transition-colors group"
              >
                {/* Status icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${cfg.bg}`}>
                  <StatusIcon className={`w-4 h-4 ${cfg.color}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{wf.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${cfg.bg} ${cfg.color}`}>
                      {cfg.label.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {timeAgo(wf.lastExecution?.startedAt)}
                    </span>
                  </div>
                </div>

                {/* Health score */}
                <div className="hidden md:flex items-center gap-3">
                  {health !== null && (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full bg-${healthColor}-500 transition-all`} style={{ width: `${health}%` }} />
                      </div>
                      <span className={`text-[10px] font-mono font-bold text-${healthColor}-400`}>{health}%</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 text-xs">
                  <div className="text-center">
                    <div className="text-emerald-400 font-mono font-bold">{wf.recentSuccessCount}</div>
                    <div className="text-[10px] text-gray-600">OK</div>
                  </div>
                  <div className="text-center">
                    <div className="text-red-400 font-mono font-bold">{wf.recentErrorCount}</div>
                    <div className="text-[10px] text-gray-600">ERR</div>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleWorkflow(wf.id, !wf.active)}
                    disabled={toggling === wf.id}
                    className={`p-1.5 rounded-lg border transition-all ${
                      wf.active
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400'
                        : 'bg-gray-500/10 border-gray-500/20 text-gray-400 hover:bg-emerald-500/10 hover:border-emerald-500/20 hover:text-emerald-400'
                    }`}
                    title={wf.active ? 'Désactiver' : 'Activer'}
                  >
                    <Power className={`w-3 h-3 ${toggling === wf.id ? 'animate-spin' : ''}`} />
                  </button>
                  <a
                    href={`${process.env.N8N_API_URL || 'https://n8n.srv1403284.hstgr.cloud'}/workflow/${wf.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all"
                    title="Ouvrir dans n8n"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
