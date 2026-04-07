import { supabase } from "../../lib/supabase"
import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, CheckCircle2, XCircle, Clock,
  Zap, RefreshCw, Wifi, WifiOff, Pause, Search,
  ExternalLink, Power, ChevronDown, ChevronUp,
  Activity, BarChart3, ShieldCheck, Filter, Eye,
  Link2, Unlink, Users, X
} from 'lucide-react'


const statusConfig = {
  active_ok: { label: 'Actif', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', icon: CheckCircle2 },
  active_error: { label: 'Erreur', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-400', icon: AlertTriangle },
  active_idle: { label: 'Inactif', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400', icon: Clock },
  inactive: { label: 'Désactivé', color: 'text-[#716D5C]', bg: 'bg-gray-500/10 border-gray-500/20', dot: 'bg-gray-500', icon: Pause },
}

const CATEGORIES = [
  { id: 'sav', label: 'SAV', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { id: 'paniers', label: 'Paniers', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { id: 'leads', label: 'Leads', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  { id: 'metrics', label: 'Métriques', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  { id: 'prospection', label: 'Prospection', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
  { id: 'immobilier', label: 'Immobilier', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { id: 'autre', label: 'Autre', color: 'bg-gray-500/10 text-[#716D5C] border-gray-500/20' },
]

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

// Associate modal
const AssociateModal = ({ workflow, clients, associations, onClose, onAssociate, onUnassociate }) => {
  const [selectedClient, setSelectedClient] = useState('')
  const [category, setCategory] = useState('sav')
  const [label, setLabel] = useState(workflow?.name || '')
  const [saving, setSaving] = useState(false)

  const currentAssoc = associations.filter(a => a.n8n_workflow_id === workflow?.id)

  const handleAssociate = async () => {
    if (!selectedClient) return
    setSaving(true)
    await onAssociate(workflow.id, selectedClient, label, category)
    setSaving(false)
    setSelectedClient('')
  }

  if (!workflow) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#F9F7F1] border border-gray-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-[#262626]">Associer à un client</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-50 rounded-lg transition-colors">
            <X className="w-4 h-4 text-[#716D5C]" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-[#F9F7F1] rounded-xl border border-gray-100">
          <p className="text-xs text-[#716D5C]">Workflow</p>
          <p className="text-sm text-[#262626] font-medium">{workflow.name}</p>
          <p className="text-[10px] text-[#716D5C] font-mono">{workflow.id}</p>
        </div>

        {/* Existing associations */}
        {currentAssoc.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-[#716D5C] mb-2">Clients associés :</p>
            <div className="space-y-2">
              {currentAssoc.map(a => {
                const client = clients.find(c => c.id === a.client_id)
                const catConfig = CATEGORIES.find(c => c.id === a.category)
                return (
                  <div key={a.id} className="flex items-center justify-between p-2.5 bg-[#F9F7F1] rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-violet-500/10 flex items-center justify-center text-[10px] font-bold text-violet-400">
                        {client?.brand_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-xs text-[#262626] font-medium">{client?.brand_name || 'Client inconnu'}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-[#716D5C]">{a.label}</span>
                          {catConfig && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${catConfig.color}`}>{catConfig.label}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onUnassociate(a.id)}
                      className="p-1 rounded hover:bg-red-500/10 text-[#716D5C] hover:text-red-400 transition-colors"
                      title="Dissocier"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* New association form */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[#716D5C] uppercase tracking-wider block mb-1">Client</label>
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-[#262626] focus:outline-none focus:border-violet-500/30"
            >
              <option value="">Sélectionner un client...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id} className="bg-[#F9F7F1]">{c.brand_name} ({c.client_type})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[#716D5C] uppercase tracking-wider block mb-1">Label (nom affiché au client)</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-[#262626] focus:outline-none focus:border-violet-500/30"
              placeholder="Ex: SAV Support Client"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#716D5C] uppercase tracking-wider block mb-1">Catégorie</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-all ${
                    category === cat.id ? cat.color : 'border-gray-100 text-[#716D5C] hover:border-gray-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleAssociate}
            disabled={!selectedClient || saving}
            className="w-full mt-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-[#716D5C] text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            {saving ? 'Association...' : 'Associer'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export const AdminMonitoringView = () => {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const [toggling, setToggling] = useState(null)
  const [associateWf, setAssociateWf] = useState(null)
  const queryClient = useQueryClient()

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['n8n-workflows'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/n8n-workflows', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      })
      if (!res.ok) throw new Error('Erreur')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['admin-clients-list'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, brand_name, client_type').order('brand_name')
      return data || []
    },
  })

  const { data: associations = [], refetch: refetchAssoc } = useQuery({
    queryKey: ['workflow-associations'],
    queryFn: async () => {
      const { data } = await supabase.from('client_n8n_workflows').select('*')
      return data || []
    },
  })

  const workflows = data?.workflows || []
  const activeCount = workflows.filter(w => w.active).length
  const errorCount = workflows.filter(w => getStatus(w) === 'active_error').length
  const inactiveCount = workflows.filter(w => !w.active).length
  const totalExecs = workflows.reduce((s, w) => s + w.recentTotal, 0)
  const totalSuccess = workflows.reduce((s, w) => s + w.recentSuccessCount, 0)
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

  const associateWorkflow = async (workflowId, clientId, label, category) => {
    await supabase.from('client_n8n_workflows').insert({
      client_id: clientId,
      n8n_workflow_id: workflowId,
      label: label,
      category: category,
    })
    refetchAssoc()
  }

  const unassociateWorkflow = async (id) => {
    await supabase.from('client_n8n_workflows').delete().eq('id', id)
    refetchAssoc()
  }

  const getClientForWorkflow = (wfId) => {
    const assocs = associations.filter(a => a.n8n_workflow_id === wfId)
    return assocs.map(a => clients.find(c => c.id === a.client_id)).filter(Boolean)
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total workflows', value: workflows.length, icon: Wifi, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Actifs', value: activeCount, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'En erreur', value: errorCount, icon: AlertTriangle, color: errorCount > 0 ? 'text-red-400' : 'text-[#716D5C]', bg: errorCount > 0 ? 'bg-red-500/10' : 'bg-gray-500/10' },
          { label: 'Désactivés', value: inactiveCount, icon: Pause, color: 'text-[#716D5C]', bg: 'bg-gray-500/10' },
          { label: 'Exécutions', value: totalExecs, icon: Activity, color: 'text-violet-400', bg: 'bg-violet-500/10' },
          { label: 'Taux succès', value: `${successRate}%`, icon: ShieldCheck, color: successRate >= 90 ? 'text-emerald-400' : 'text-amber-400', bg: successRate >= 90 ? 'bg-emerald-500/10' : 'bg-amber-500/10' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[#F9F7F1] border border-gray-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
              </div>
            </div>
            <div className={`text-xl font-bold font-mono ${kpi.color}`}>{kpi.value}</div>
            <div className="text-[10px] text-[#716D5C] uppercase tracking-wider mt-1">{kpi.label}</div>
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
                  : 'bg-transparent border-gray-100 text-[#716D5C] hover:text-[#716D5C] hover:border-gray-200'
              }`}
            >
              {f.label} <span className="ml-1 font-mono">{f.count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#716D5C]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-[#262626] placeholder-gray-600 focus:outline-none focus:border-violet-500/30 w-48"
            />
          </div>
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-lg bg-gray-50 border border-gray-200 text-[#716D5C] hover:text-[#262626] hover:border-gray-300 transition-all"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Workflow table */}
      <div className="bg-[#F9F7F1] border border-gray-100 rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-gray-100 text-[10px] uppercase tracking-wider text-[#716D5C] font-bold">
          <div className="col-span-1">Statut</div>
          <div className="col-span-3">Workflow</div>
          <div className="col-span-2">Client</div>
          <div className="col-span-1">Dernière exéc.</div>
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
          const linkedClients = getClientForWorkflow(wf.id)

          return (
            <div key={wf.id}>
              <div
                className={`grid grid-cols-12 gap-4 px-5 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition-colors items-center cursor-pointer ${
                  isExpanded ? 'bg-gray-50' : ''
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
                <div className="col-span-3 flex items-center gap-2 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center border flex-shrink-0 ${c.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${c.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#262626] truncate">{wf.name}</p>
                    <p className="text-[10px] text-[#716D5C] font-mono truncate">{wf.id}</p>
                  </div>
                </div>

                {/* Client */}
                <div className="col-span-2">
                  {linkedClients.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {linkedClients.map(cl => (
                        <span key={cl.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-[10px] text-violet-400 font-medium">
                          {cl.brand_name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-[#716D5C] italic">Non associé</span>
                  )}
                </div>

                {/* Last execution */}
                <div className="col-span-1">
                  <p className="text-[11px] text-[#716D5C]">{timeAgo(wf.lastExecution?.startedAt)}</p>
                </div>

                {/* Success */}
                <div className="col-span-1 text-center">
                  <span className="text-sm font-bold font-mono text-emerald-400">{wf.recentSuccessCount}</span>
                </div>

                {/* Errors */}
                <div className="col-span-1 text-center">
                  <span className={`text-sm font-bold font-mono ${wf.recentErrorCount > 0 ? 'text-red-400' : 'text-[#716D5C]'}`}>
                    {wf.recentErrorCount}
                  </span>
                </div>

                {/* Health */}
                <div className="col-span-1 text-center">
                  {health !== null ? (
                    <div className="inline-flex flex-col items-center">
                      <span className={`text-xs font-bold font-mono ${
                        health >= 90 ? 'text-emerald-400' : health >= 70 ? 'text-amber-400' : 'text-red-400'
                      }`}>{health}%</span>
                      <div className="w-10 h-1 rounded-full bg-gray-800 mt-1">
                        <div className={`h-full rounded-full ${
                          health >= 90 ? 'bg-emerald-400' : health >= 70 ? 'bg-amber-400' : 'bg-red-400'
                        }`} style={{ width: `${health}%` }} />
                      </div>
                    </div>
                  ) : (
                    <span className="text-[10px] text-[#716D5C]">—</span>
                  )}
                </div>

                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setAssociateWf(wf) }}
                    className={`px-2 py-1 rounded-lg border text-[10px] font-medium transition-all ${
                      linkedClients.length > 0
                        ? 'border-violet-500/20 text-violet-400 hover:bg-violet-500/10'
                        : 'border-amber-500/20 text-amber-400 hover:bg-amber-500/10'
                    }`}
                    title="Associer à un client"
                  >
                    <Link2 className="w-3 h-3 inline mr-0.5" />
                    {linkedClients.length > 0 ? linkedClients.length : 'Associer'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleWorkflow(wf.id, !wf.active) }}
                    disabled={toggling === wf.id}
                    className={`px-2 py-1 rounded-lg border text-[10px] font-medium transition-all ${
                      wf.active
                        ? 'border-red-500/20 text-red-400 hover:bg-red-500/10'
                        : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'
                    } ${toggling === wf.id ? 'opacity-50' : ''}`}
                  >
                    <Power className={`w-3 h-3 inline ${toggling === wf.id ? 'animate-spin' : ''}`} />
                  </button>
                  <a
                    href={`https://n8n.srv1403284.hstgr.cloud/workflow/${wf.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="px-2 py-1 rounded-lg border border-gray-200 text-[10px] font-medium text-[#716D5C] hover:text-[#262626] hover:border-gray-300 transition-all"
                  >
                    <ExternalLink className="w-3 h-3 inline" />
                  </a>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-[#716D5C]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#716D5C]" />}
                </div>
              </div>

              {/* Expanded detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-b border-gray-100"
                  >
                    <div className="px-5 py-4 bg-[#F9F7F1] grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] text-[#716D5C] uppercase tracking-wider mb-1">ID Workflow</p>
                        <p className="text-xs text-[#262626] font-mono">{wf.id}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#716D5C] uppercase tracking-wider mb-1">Créé le</p>
                        <p className="text-xs text-[#716D5C]">{formatDate(wf.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#716D5C] uppercase tracking-wider mb-1">Modifié le</p>
                        <p className="text-xs text-[#716D5C]">{formatDate(wf.updatedAt)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#716D5C] uppercase tracking-wider mb-1">Exécutions</p>
                        <p className="text-xs text-[#262626] font-mono font-bold">{wf.recentTotal}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#716D5C] uppercase tracking-wider mb-1">Taux de succès</p>
                        <p className={`text-xs font-mono font-bold ${
                          health === null ? 'text-[#716D5C]' : health >= 90 ? 'text-emerald-400' : health >= 70 ? 'text-amber-400' : 'text-red-400'
                        }`}>{health !== null ? `${health}%` : 'Aucune'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#716D5C] uppercase tracking-wider mb-1">Statut dernière exéc.</p>
                        <p className={`text-xs font-medium ${
                          wf.lastExecution?.status === 'success' ? 'text-emerald-400' :
                          wf.lastExecution?.status === 'error' ? 'text-red-400' : 'text-[#716D5C]'
                        }`}>{wf.lastExecution?.status || 'Aucune'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#716D5C] uppercase tracking-wider mb-1">Clients associés</p>
                        <p className="text-xs text-[#262626]">{linkedClients.length > 0 ? linkedClients.map(c => c.brand_name).join(', ') : 'Aucun'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#716D5C] uppercase tracking-wider mb-1">Lien direct</p>
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
            <p className="text-sm text-[#716D5C]">
              {search ? 'Aucun workflow trouvé' : 'Aucun workflow'}
            </p>
          </div>
        )}
      </div>

      {/* Associate modal */}
      <AnimatePresence>
        {associateWf && (
          <AssociateModal
            workflow={associateWf}
            clients={clients}
            associations={associations}
            onClose={() => setAssociateWf(null)}
            onAssociate={associateWorkflow}
            onUnassociate={unassociateWorkflow}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
