import { supabase } from "../../lib/supabase"
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Power, Play, Pause, Activity, Clock, CheckCircle2, XCircle,
  AlertTriangle, Loader2, Zap, ShieldCheck, BarChart3, TrendingUp
} from 'lucide-react'


const CATEGORY_CONFIG = {
  sav: { label: 'SAV', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: '🎧' },
  paniers: { label: 'Paniers', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: '🛒' },
  leads: { label: 'Leads', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20', icon: '🎯' },
  metrics: { label: 'Métriques', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', icon: '📊' },
  prospection: { label: 'Prospection', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20', icon: '📧' },
  immobilier: { label: 'Immobilier', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: '🏠' },
  autre: { label: 'Autre', color: 'bg-gray-500/10 text-[#716D5C] border-gray-500/20', icon: '⚡' },
}

const toggleWorkflow = async ({ workflowId, active }) => {
  const res = await fetch('/api/n8n-copilot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'toggle', workflowId, active }),
  })
  if (!res.ok) throw new Error('Erreur')
  return res.json()
}

const sendPauseAlert = (clientName, workflowName) => {
  fetch('/api/send-alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'workflow_paused', clientName, details: workflowName }),
  }).catch(() => {})
}

const ConfirmDialog = ({ isOpen, onConfirm, onCancel, workflowName }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
          onClick={e => e.stopPropagation()}
          className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 max-w-sm mx-4 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="text-[#262626] font-bold text-sm">Mettre en pause ?</h3>
          </div>
          <p className="text-xs text-[#716D5C] mb-5">
            Vous allez mettre en pause <span className="text-[#262626] font-medium">{workflowName}</span>. L'automation ne traitera plus de données tant qu'elle sera en pause.
          </p>
          <div className="flex gap-2">
            <button onClick={onCancel} className="flex-1 px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-[#716D5C] text-xs font-medium hover:bg-gray-50 transition-all">Annuler</button>
            <button onClick={onConfirm} className="flex-1 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-all">Mettre en pause</button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
)

const Toast = ({ message, isVisible }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-sm font-medium"
      >
        <CheckCircle2 className="w-4 h-4" />
        {message}
      </motion.div>
    )}
  </AnimatePresence>
)

const formatLastExecution = (dateStr) => {
  if (!dateStr) return 'Jamais'
  const s = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (s < 60) return "À l'instant"
  if (s < 3600) return `Il y a ${Math.floor(s / 60)}m`
  if (s < 86400) return `Il y a ${Math.floor(s / 3600)}h`
  if (s < 604800) return `Il y a ${Math.floor(s / 86400)}j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export const ClientSystemsView = ({ clientId, clientName, theme }) => {
  const queryClient = useQueryClient()
  const [confirmDialog, setConfirmDialog] = useState({ open: false, workflow: null })
  const [toast, setToast] = useState({ visible: false, message: '' })
  const [togglingId, setTogglingId] = useState(null)

  // Fetch client's workflow associations from Supabase
  const { data: associations = [] } = useQuery({
    queryKey: ['client-workflow-assocs', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data } = await supabase
        .from('client_n8n_workflows')
        .select('*')
        .eq('client_id', clientId)
      return data || []
    },
    enabled: !!clientId,
  })

  // Fetch all n8n workflows to match with associations
  const { data: allWorkflows = [], isLoading } = useQuery({
    queryKey: ['client-workflows'],
    queryFn: async () => {
      const res = await fetch('/api/n8n-workflows')
      if (!res.ok) throw new Error('Erreur')
      const data = await res.json()
      return data.workflows || []
    },
    refetchInterval: 30000,
  })

  // Merge: only show workflows associated to this client
  const workflows = associations.map(assoc => {
    const wf = allWorkflows.find(w => w.id === assoc.n8n_workflow_id)
    return {
      ...assoc,
      ...(wf || {}),
      id: assoc.n8n_workflow_id,
      displayName: assoc.label || wf?.name || 'Workflow',
      category: assoc.category || 'autre',
      isOnline: !!wf,
    }
  })

  const activeCount = workflows.filter(w => w.active).length
  const pausedCount = workflows.filter(w => !w.active).length

  const mutation = useMutation({
    mutationFn: toggleWorkflow,
    onMutate: ({ workflowId }) => setTogglingId(workflowId),
    onSuccess: (_, { workflowId, active }) => {
      queryClient.invalidateQueries({ queryKey: ['client-workflows'] })
      setTogglingId(null)
      showToast(active ? 'Automation activée' : 'Automation mise en pause')
      if (!active) {
        const wf = workflows.find(w => w.id === workflowId)
        sendPauseAlert(clientName || 'Client', wf?.displayName || '')
      }
    },
    onError: () => { setTogglingId(null); showToast('Erreur lors de la mise à jour') },
  })

  const showToast = (msg) => {
    setToast({ visible: true, message: msg })
    setTimeout(() => setToast({ visible: false, message: '' }), 3000)
  }

  const handleToggle = (wf) => {
    if (wf.active) {
      setConfirmDialog({ open: true, workflow: wf })
    } else {
      mutation.mutate({ workflowId: wf.id, active: true })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-50 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (workflows.length === 0) {
    return (
      <div className="text-center py-20">
        <Zap className="w-12 h-12 text-gray-700 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-[#262626] mb-2">Aucune automation configurée</h3>
        <p className="text-sm text-[#716D5C] max-w-md mx-auto">
          Vos automations apparaîtront ici une fois déployées par l'équipe Actero.
          Contactez-nous via l'onglet Support pour activer vos workflows.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <Zap className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold text-emerald-400">{activeCount}</span>
          <span className="text-xs text-emerald-400/70">actives</span>
        </div>
        {pausedCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-500/10 border border-gray-500/20 rounded-xl">
            <Pause className="w-4 h-4 text-[#716D5C]" />
            <span className="text-sm font-bold text-[#716D5C]">{pausedCount}</span>
            <span className="text-xs text-[#716D5C]/70">en pause</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl">
          <Activity className="w-4 h-4 text-[#716D5C]" />
          <span className="text-sm font-bold text-[#262626]">{workflows.length}</span>
          <span className="text-xs text-[#716D5C]">total</span>
        </div>
      </div>

      {/* Workflow cards */}
      <div className="space-y-3">
        {workflows.map((wf, i) => {
          const isToggling = togglingId === wf.id
          const catConfig = CATEGORY_CONFIG[wf.category] || CATEGORY_CONFIG.autre
          const health = wf.recentTotal > 0 ? Math.round((wf.recentSuccessCount / wf.recentTotal) * 100) : null

          return (
            <motion.div
              key={wf.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`bg-[#F9F7F1] border rounded-2xl p-5 transition-all ${
                wf.active ? 'border-gray-100 hover:border-gray-200' : 'border-gray-100 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                    wf.active ? 'bg-emerald-500/10' : 'bg-gray-800'
                  }`}>
                    {catConfig.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-[#262626] font-semibold text-sm truncate">{wf.displayName}</h3>
                      <span className={`px-2 py-0.5 rounded-md border text-[9px] font-medium ${catConfig.color}`}>
                        {catConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${wf.active ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                        <span className={`text-xs font-medium ${wf.active ? 'text-emerald-400' : 'text-[#716D5C]'}`}>
                          {wf.active ? 'Active' : 'En pause'}
                        </span>
                      </div>
                      <span className="text-gray-700">·</span>
                      <div className="flex items-center gap-1 text-[#716D5C]">
                        <Clock className="w-3 h-3" />
                        <span className="text-[11px]">{formatLastExecution(wf.lastExecution?.startedAt || wf.updatedAt)}</span>
                      </div>
                      {health !== null && (
                        <>
                          <span className="text-gray-700">·</span>
                          <div className="flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-[#716D5C]" />
                            <span className={`text-[11px] font-mono font-medium ${
                              health >= 90 ? 'text-emerald-400' : health >= 70 ? 'text-amber-400' : 'text-red-400'
                            }`}>{health}%</span>
                          </div>
                        </>
                      )}
                      {wf.recentTotal > 0 && (
                        <>
                          <span className="text-gray-700">·</span>
                          <div className="flex items-center gap-1">
                            <BarChart3 className="w-3 h-3 text-[#716D5C]" />
                            <span className="text-[11px] text-[#716D5C]">{wf.recentTotal} exéc.</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => handleToggle(wf)}
                  disabled={isToggling}
                  className={`relative w-12 h-7 rounded-full transition-all duration-300 flex items-center flex-shrink-0 ${
                    wf.active ? 'bg-emerald-600' : 'bg-gray-200'
                  } ${isToggling ? 'opacity-50' : 'cursor-pointer hover:shadow-lg'}`}
                >
                  <motion.div
                    animate={{ x: wf.active ? 22 : 3 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center"
                  >
                    {isToggling ? (
                      <Loader2 className="w-3 h-3 text-[#716D5C] animate-spin" />
                    ) : wf.active ? (
                      <Play className="w-2.5 h-2.5 text-emerald-600" />
                    ) : (
                      <Pause className="w-2.5 h-2.5 text-[#716D5C]" />
                    )}
                  </motion.div>
                </button>
              </div>
            </motion.div>
          )
        })}
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.open}
        workflowName={confirmDialog.workflow?.displayName}
        onConfirm={() => {
          mutation.mutate({ workflowId: confirmDialog.workflow.id, active: false })
          setConfirmDialog({ open: false, workflow: null })
        }}
        onCancel={() => setConfirmDialog({ open: false, workflow: null })}
      />
      <Toast message={toast.message} isVisible={toast.visible} />
    </div>
  )
}
