import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, CheckCircle2, XCircle, Clock,
  Zap, RefreshCw, Wifi, WifiOff, Pause,
  ExternalLink, Power, ChevronRight, ChevronLeft,
  ShieldCheck, PanelRightOpen, PanelRightClose
} from 'lucide-react'
import { AdminN8nCopilot } from './AdminN8nCopilot'

const statusConfig = {
  active_ok: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  active_error: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: AlertTriangle },
  active_idle: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: Clock },
  inactive: { color: 'text-gray-500', bg: 'bg-gray-500/10 border-gray-500/20', icon: Pause },
}

function getStatus(wf) {
  if (!wf.active) return 'inactive'
  if (wf.recentErrorCount > 0) return 'active_error'
  if (!wf.lastExecution) return 'active_idle'
  return 'active_ok'
}

function timeAgo(d) {
  if (!d) return '—'
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}j`
}

export const AdminMonitoringView = () => {
  const [panelOpen, setPanelOpen] = useState(true)
  const [toggling, setToggling] = useState(null)
  const queryClient = useQueryClient()

  const { data, refetch } = useQuery({
    queryKey: ['n8n-workflows'],
    queryFn: async () => {
      const res = await fetch('/api/n8n-workflows')
      if (!res.ok) throw new Error('Erreur')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const workflows = data?.workflows || []
  const activeCount = workflows.filter(w => w.active).length
  const errorCount = workflows.filter(w => getStatus(w) === 'active_error').length
  const totalExecs = workflows.reduce((s, w) => s + w.recentTotal, 0)
  const totalSuccess = workflows.reduce((s, w) => s + w.recentSuccessCount, 0)
  const successRate = totalExecs > 0 ? Math.round((totalSuccess / totalExecs) * 100) : 100

  const toggleWorkflow = async (wfId, activate) => {
    setToggling(wfId)
    try {
      await fetch('/api/n8n-copilot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', workflowId: wfId, active: activate }),
      })
      queryClient.invalidateQueries({ queryKey: ['n8n-workflows'] })
      refetch()
    } catch { /* */ }
    setToggling(null)
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden -m-4 md:-m-8">
      {/* Main: Copilot */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#030303]">
        <AdminN8nCopilot />
      </div>

      {/* Toggle panel button */}
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className="hidden md:flex items-center justify-center w-6 bg-[#0a0a0a] border-x border-white/5 text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0"
      >
        {panelOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Side panel: Workflows */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="hidden md:flex flex-col bg-[#0a0a0a] border-l border-white/5 overflow-hidden flex-shrink-0"
          >
            {/* Panel header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-bold text-white">Workflows</span>
                <span className="text-[10px] text-gray-500">{workflows.length}</span>
              </div>
              <button onClick={() => refetch()} className="p-1 rounded-md hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors">
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {/* Mini KPIs */}
            <div className="grid grid-cols-4 gap-0 border-b border-white/5 flex-shrink-0">
              {[
                { label: 'Actifs', value: activeCount, color: 'text-emerald-400' },
                { label: 'Erreurs', value: errorCount, color: errorCount > 0 ? 'text-red-400' : 'text-gray-500' },
                { label: 'Exéc.', value: totalExecs, color: 'text-blue-400' },
                { label: 'Succès', value: `${successRate}%`, color: successRate >= 90 ? 'text-emerald-400' : 'text-amber-400' },
              ].map(k => (
                <div key={k.label} className="px-3 py-2.5 text-center border-r border-white/5 last:border-r-0">
                  <div className={`text-sm font-bold font-mono ${k.color}`}>{k.value}</div>
                  <div className="text-[9px] text-gray-600 uppercase tracking-wider mt-0.5">{k.label}</div>
                </div>
              ))}
            </div>

            {/* Workflow list */}
            <div className="flex-1 overflow-y-auto">
              {workflows.map(wf => {
                const st = getStatus(wf)
                const c = statusConfig[st]
                const Icon = c.icon
                const health = wf.recentTotal > 0 ? Math.round((wf.recentSuccessCount / wf.recentTotal) * 100) : null

                return (
                  <div
                    key={wf.id}
                    className="px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center border mt-0.5 flex-shrink-0 ${c.bg}`}>
                        <Icon className={`w-3 h-3 ${c.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{wf.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-500">{timeAgo(wf.lastExecution?.startedAt)}</span>
                          {health !== null && (
                            <>
                              <span className="text-[10px] text-gray-600">·</span>
                              <span className={`text-[10px] font-mono ${health >= 90 ? 'text-emerald-400' : health >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                                {health}%
                              </span>
                            </>
                          )}
                          <span className="text-[10px] text-gray-600">·</span>
                          <span className="text-[10px] text-emerald-400 font-mono">{wf.recentSuccessCount}</span>
                          <span className="text-[10px] text-gray-600">/</span>
                          <span className="text-[10px] text-red-400 font-mono">{wf.recentErrorCount}</span>
                        </div>
                      </div>

                      {/* Quick actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => toggleWorkflow(wf.id, !wf.active)}
                          disabled={toggling === wf.id}
                          className={`p-1 rounded-md border transition-all ${
                            wf.active
                              ? 'border-emerald-500/20 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400'
                              : 'border-gray-500/20 text-gray-500 hover:bg-emerald-500/10 hover:border-emerald-500/20 hover:text-emerald-400'
                          }`}
                          title={wf.active ? 'Désactiver' : 'Activer'}
                        >
                          <Power className={`w-2.5 h-2.5 ${toggling === wf.id ? 'animate-spin' : ''}`} />
                        </button>
                        <a
                          href={`https://n8n.srv1403284.hstgr.cloud/workflow/${wf.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded-md border border-white/10 text-gray-500 hover:text-white hover:border-white/20 transition-all"
                          title="Ouvrir dans n8n"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                )
              })}

              {workflows.length === 0 && (
                <div className="text-center py-12">
                  <WifiOff className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                  <p className="text-xs text-gray-600">Aucun workflow</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
