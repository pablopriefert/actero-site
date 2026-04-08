import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Zap, ShoppingBag, Building2, Home, Headphones,
  CheckCircle2, Loader2, Play, Pause, BarChart3, Clock,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const PLAYBOOK_ICONS = {
  sav_ecommerce: ShoppingBag,
  abandoned_cart: ShoppingBag,
  lead_qualification_immo: Building2,
  gestion_locative: Home,
  support_technique: Headphones,
}

const PLAYBOOK_COLORS = {
  sav_ecommerce: 'from-emerald-500 to-emerald-700',
  abandoned_cart: 'from-amber-500 to-amber-700',
  lead_qualification_immo: 'from-blue-500 to-blue-700',
  gestion_locative: 'from-violet-500 to-violet-700',
  support_technique: 'from-cyan-500 to-cyan-700',
}

export const PlaybooksView = ({ clientId, theme }) => {
  const toast = useToast()
  const queryClient = useQueryClient()

  // All available playbooks
  const { data: playbooks = [], isLoading: loadingPlaybooks } = useQuery({
    queryKey: ['playbooks-list'],
    queryFn: async () => {
      const { data } = await supabase.from('engine_playbooks').select('*').eq('is_active', true).order('display_name')
      return data || []
    },
  })

  // Client's playbook associations
  const { data: clientPlaybooks = [], isLoading: loadingAssoc } = useQuery({
    queryKey: ['client-playbooks', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('engine_client_playbooks')
        .select('*')
        .eq('client_id', clientId)
      return data || []
    },
    enabled: !!clientId,
  })

  // Recent runs for this client
  const { data: recentRuns = [] } = useQuery({
    queryKey: ['client-recent-runs', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('engine_runs_v2')
        .select('playbook_id, status, confidence, duration_ms, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(50)
      return data || []
    },
    enabled: !!clientId,
  })

  const isActive = (playbookId) => clientPlaybooks.some(cp => cp.playbook_id === playbookId && cp.is_active)

  const getPlaybookStats = (playbookId) => {
    const runs = recentRuns.filter(r => r.playbook_id === playbookId)
    const completed = runs.filter(r => r.status === 'completed').length
    const total = runs.length
    const avgConfidence = total > 0 ? (runs.reduce((s, r) => s + (r.confidence || 0), 0) / total) : 0
    return { total, completed, rate: total > 0 ? Math.round(completed / total * 100) : 0, avgConfidence }
  }

  const handleToggle = async (playbookId) => {
    const existing = clientPlaybooks.find(cp => cp.playbook_id === playbookId)
    const currentlyActive = existing?.is_active || false

    if (existing) {
      await supabase.from('engine_client_playbooks').update({
        is_active: !currentlyActive,
        [!currentlyActive ? 'activated_at' : 'deactivated_at']: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await supabase.from('engine_client_playbooks').insert({
        client_id: clientId,
        playbook_id: playbookId,
        is_active: true,
        activated_at: new Date().toISOString(),
      })
    }

    queryClient.invalidateQueries({ queryKey: ['client-playbooks', clientId] })
    toast.success(!currentlyActive ? 'Playbook active' : 'Playbook desactive')
  }

  const isLoading = loadingPlaybooks || loadingAssoc

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#716D5C]" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#262626]">Mes Playbooks</h2>
        <p className="text-sm text-[#716D5C] mt-1">
          Activez les automatisations metier pour votre agent IA. Chaque playbook est optimise pour un cas d'usage specifique.
        </p>
      </div>

      <div className="space-y-3">
        {playbooks.map(playbook => {
          const Icon = PLAYBOOK_ICONS[playbook.name] || Zap
          const color = PLAYBOOK_COLORS[playbook.name] || 'from-gray-500 to-gray-700'
          const active = isActive(playbook.id)
          const stats = getPlaybookStats(playbook.id)
          const cp = clientPlaybooks.find(c => c.playbook_id === playbook.id)

          return (
            <motion.div
              key={playbook.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white border rounded-2xl overflow-hidden transition-all ${active ? 'border-[#0F5F35] ring-1 ring-[#0F5F35]/20' : 'border-gray-200'}`}
            >
              <div className="p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-[#262626]">{playbook.display_name}</h3>
                    {active && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full">
                        <Play className="w-3 h-3" /> Actif
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#716D5C] mt-0.5">{playbook.description}</p>
                </div>

                {/* Stats */}
                {stats.total > 0 && (
                  <div className="hidden md:flex gap-4 text-center flex-shrink-0">
                    <div>
                      <p className="text-sm font-bold text-[#262626]">{stats.total}</p>
                      <p className="text-[9px] text-[#716D5C] uppercase">Runs</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-600">{stats.rate}%</p>
                      <p className="text-[9px] text-[#716D5C] uppercase">Auto</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-violet-600">{Math.round(stats.avgConfidence * 100)}%</p>
                      <p className="text-[9px] text-[#716D5C] uppercase">Confiance</p>
                    </div>
                  </div>
                )}

                {/* Toggle */}
                <button
                  onClick={() => handleToggle(playbook.id)}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${active ? 'bg-[#0F5F35]' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Event types + actions */}
              <div className="px-5 pb-4 flex flex-wrap gap-1.5">
                {(playbook.event_types || []).map(et => (
                  <span key={et} className="px-2 py-0.5 bg-[#F9F7F1] rounded text-[9px] font-mono text-[#716D5C]">{et}</span>
                ))}
                <span className="px-2 py-0.5 bg-blue-50 rounded text-[9px] text-blue-600 font-bold">
                  {(playbook.actions_available || []).length} actions
                </span>
                <span className="px-2 py-0.5 bg-violet-50 rounded text-[9px] text-violet-600 font-bold">
                  Seuil: {Math.round((playbook.confidence_threshold || 0.85) * 100)}%
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>

      {playbooks.length === 0 && (
        <div className="text-center py-12 text-[#716D5C]">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Aucun playbook disponible pour le moment.</p>
        </div>
      )}
    </div>
  )
}
