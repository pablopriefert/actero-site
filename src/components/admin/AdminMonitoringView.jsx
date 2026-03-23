import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, CheckCircle2, XCircle, Clock,
  Zap, RefreshCw, Wifi, WifiOff, Pause, Search,
  ExternalLink, Power, ChevronDown, ChevronUp,
  Activity, BarChart3, ShieldCheck, Filter, Eye
} from 'lucide-react'

const statusConfig = {
  active_ok: { label: 'Actif', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', icon: CheckCircle2 },
  active_error: { label: 'Erreur', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-400', icon: AlertTriangle },
  active_idle: { label: 'Inactif', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400', icon: Clock },
  inactive: { label: 'Désactivé', color: 'text-gray-500', bg: 'bg-gray-500/10 border-gray-500/20', dot: 'bg-gray-500', icon: Pause },
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
  if (s < 60) return "À l'instant"
  if (s < 3600) return `Il y a ${Math.floor(s / 60)}m`
  if (s < 86400) return `Il y a ${Math.floor(s / 3600)}h`
  return `Il y a ${Math.floor(s / 86400)}j`
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export const AdminMonitoringView = () => {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all, active, error, inactive
  const [expanded, setExpanded] = useState(null)
  const [toggling, setToggling] = useState(null)
  const queryClient = useQueryClient()

  const { data, refetch, isLoading } = useQuery({
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
  const inactiveCount = workflows.filter(w => !w.active).length
  const totalExecs = workflows.reduce((s, w) => s + w.recentTotal, 0)
  const totalSuccess = workflows.reduce((s, w) => s + w.recentSuccessCount, 0)
  const totalErrors = workflows.reduce((s, w) => s + w.recentErrorCount, 0)
  const successRate = totalExecs > 0 ? Math.round((totalSuccess / totalExecs) * 100) : 100

  const filtered = workflows.filter(wf => {
    const st = getStatus(wf)
    if (filter === 'active' && st !== 'active_ok') return false
    if (filter === 'error' && st !== 'active_error') return false
    if (filter === 'inactive' && st !== 'inactive') return false
    if (search && !wf.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

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
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total workflows', value: workflows.length, icon: Wifi, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Actifs', value: activeCount, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'En erreur', value: errorCount, icon: AlertTriangle, color: errorCount > 0 ? 'text-red-400' : 'text-gray-500', bg: errorCount > 0 ? 'bg-red-500/10' : 'bg-gray-500/10' },
          { label: 'Désactivés', value: inactiveCount, icon: Pause, color: 'text-gray-400', bg: 'bg-gray-500/10' },
          { label: 'Exécutions', value: totalExecs, icon: Activity, color: 'text-violet-400', bg: 'bg-violet-500/10' },
          { label: 'Taux succès', value: `${successRate}%`, icon: ShieldCheck, color: successRate >= 90 ? 'text-emerald-400' : 'text-amber-400', bg: successRate >= 90 ? 'bg-emerald-500/10' : 'bg-amber-500/10' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[#111] border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
              </div>
            </div>
            <div className={`text-xl font-bold font-mono ${kpi.color}`}>{kpi.value}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: 'Tous', count: workflows.length },
            { id: 'active', label: 'Actifs', count: activeCount },
            { id: 'error', label: 'Erreurs', count: errorCount },
            { id: 'inactive', label: 'Désactivés', count: inactiveCount },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                filter === f.id
                  ? 'bg-violet-500/10 border-violet-500/20 text-violet-400'
                  : 'bg-transparent border-white/5 text-gray-500 hover:text-gray-300 hover:border-white/10'
              }`}
            >
              {f.label} <span className="ml-1 font-mono">{f.count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/30 w-48"
            />
          </div>
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Workflow table */}
      <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-white/5 text-[10px] uppercase tracking-wider text-gray-500 font-bold">
          <div className="col-span-1">Statut</div>
          <div className="col-span-4">Workflow</div>
          <div className="col-span-2">Dernière exéc.</div>
          <div className="col-span-1 text-center">Succès</div>
          <div className="col-span-1 text-center">Erreurs</div>
          <div className="col-span-1 text-center">Santé</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Rows */}
        {filtered.map(wf => {
          const st = getStatus(wf)
          const c = statusConfig[st]
          const Icon = c.icon
          const health = wf.recentTotal > 0 ? Math.round((wf.recentSuccessCount / wf.recentTotal) * 100) : null
          const isExpanded = expanded === wf.id

          return (
            <div key={wf.id}>
              <div
                className={`grid grid-cols-12 gap-4 px-5 py-3.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors items-center cursor-pointer ${
                  isExpanded ? 'bg-white/[0.02]' : ''
                }`}
                onClick={() => setExpanded(isExpanded ? null : wf.id)}
              >
                {/* Status */}
                <div className="col-span-1">
                  <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium ${c.bg} ${c.color}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    {c.label}
                  </div>
                </div>

                {/* Name */}
                <div className="col-span-4 flex items-center gap-2 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center border flex-shrink-0 ${c.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${c.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{wf.name}</p>
                    <p className="text-[10px] text-gray-600 font-mono truncate">{wf.id}</p>
                  </div>
                </div>

                {/* Last execution */}
                <div className="col-span-2">
                  <p className="text-xs text-gray-300">{timeAgo(wf.lastExecution?.startedAt)}</p>
                  <p className="text-[10px] text-gray-600">{formatDate(wf.lastExecution?.startedAt)}</p>
                </div>

                {/* Success */}
                <div className="col-span-1 text-center">
                  <span className="text-sm font-bold font-mono text-emerald-400">{wf.recentSuccessCount}</span>
                </div>

                {/* Errors */}
                <div className="col-span-1 text-center">
                  <span className={`text-sm font-bold font-mono ${wf.recentErrorCount > 0 ? 'text-red-400' : 'text-gray-600'}`}>
                    {wf.recentErrorCount}
                  </span>
                </div>

                {/* Health */}
                <div className="col-span-1 text-center">
                  {health !== null ? (
                    <div className="inline-flex flex-col items-center">
                      <span className={`text-sm font-bold font-mono ${
                        health >= 90 ? 'text-emerald-400' : health >= 70 ? 'text-amber-400' : 'text-red-400'
                      }`}>{health}%</span>
                      <div className="w-12 h-1 rounded-full bg-gray-800 mt-1">
                        <div className={`h-full rounded-full ${
                          health >= 90 ? 'bg-emerald-400' : health >= 70 ? 'bg-amber-400' : 'bg-red-400'
                        }`} style={{ width: `${health}%` }} />
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600">—</span>
                  )}
                </div>

                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleWorkflow(wf.id, !wf.active) }}
                    disabled={toggling === wf.id}
                    className={`px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-all ${
                      wf.active
                        ? 'border-red-500/20 text-red-400 hover:bg-red-500/10'
                        : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'
                    } ${toggling === wf.id ? 'opacity-50' : ''}`}
                  >
                    <Power className={`w-3 h-3 inline mr-1 ${toggling === wf.id ? 'animate-spin' : ''}`} />
                    {wf.active ? 'Stop' : 'Start'}
                  </button>
                  <a
                    href={`https://n8n.srv1403284.hstgr.cloud/workflow/${wf.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="px-2.5 py-1 rounded-lg border border-white/10 text-[10px] font-medium text-gray-400 hover:text-white hover:border-white/20 transition-all"
                  >
                    <ExternalLink className="w-3 h-3 inline mr-1" />
                    n8n
                  </a>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
                </div>
              </div>

              {/* Expanded detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-b border-white/5"
                  >
                    <div className="px-5 py-4 bg-[#0a0a0a] grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">ID Workflow</p>
                        <p className="text-xs text-white font-mono">{wf.id}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Créé le</p>
                        <p className="text-xs text-gray-300">{formatDate(wf.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Modifié le</p>
                        <p className="text-xs text-gray-300">{formatDate(wf.updatedAt)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Exécutions totales</p>
                        <p className="text-xs text-white font-mono font-bold">{wf.recentTotal}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Taux de succès</p>
                        <p className={`text-xs font-mono font-bold ${
                          health === null ? 'text-gray-600' : health >= 90 ? 'text-emerald-400' : health >= 70 ? 'text-amber-400' : 'text-red-400'
                        }`}>{health !== null ? `${health}%` : 'Aucune exécution'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Dernière erreur</p>
                        <p className="text-xs text-gray-300">
                          {wf.lastExecution?.status === 'error' ? formatDate(wf.lastExecution?.startedAt) : 'Aucune'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Statut dernière exéc.</p>
                        <p className={`text-xs font-medium ${
                          wf.lastExecution?.status === 'success' ? 'text-emerald-400' :
                          wf.lastExecution?.status === 'error' ? 'text-red-400' : 'text-gray-500'
                        }`}>{wf.lastExecution?.status || 'Aucune'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Lien direct</p>
                        <a
                          href={`https://n8n.srv1403284.hstgr.cloud/workflow/${wf.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                        >
                          Ouvrir dans n8n →
                        </a>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <WifiOff className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {search ? 'Aucun workflow trouvé' : 'Aucun workflow'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
