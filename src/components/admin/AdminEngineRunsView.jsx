import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Zap, CheckCircle2, XCircle, Clock, AlertTriangle,
  Loader2, Search, ChevronDown, Eye, RefreshCw,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { RunTagFlagButton } from './RunTagFlagButton'

const STATUS_BADGES = {
  completed: { label: 'Complete', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  failed: { label: 'Echoue', color: 'bg-red-50 text-red-600 border-red-200' },
  needs_review: { label: 'Review', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  running: { label: 'En cours', color: 'bg-blue-50 text-blue-600 border-blue-200' },
}

export const AdminEngineRunsView = () => {
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedRun, setExpandedRun] = useState(null)

  const { data: runs = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-engine-runs', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('engine_runs_v2')
        .select('*, engine_events(event_type, source, normalized), clients(brand_name)')
        .order('created_at', { ascending: false })
        .limit(100)

      if (statusFilter !== 'all') query = query.eq('status', statusFilter)

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    refetchInterval: 10000,
  })

  // Stats
  const total = runs.length
  const completed = runs.filter(r => r.status === 'completed').length
  const failed = runs.filter(r => r.status === 'failed').length
  const needsReview = runs.filter(r => r.status === 'needs_review').length
  const avgDuration = total > 0 ? Math.round(runs.reduce((s, r) => s + (r.duration_ms || 0), 0) / total) : 0
  const avgConfidence = total > 0 ? (runs.reduce((s, r) => s + (r.confidence || 0), 0) / total).toFixed(2) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[24px] font-bold text-[#1a1a1a]">Engine Runs</h2>
          <p className="text-[13px] text-[#71717a]">Toutes les executions du moteur en temps reel</p>
        </div>
        <button onClick={() => refetch()} className="p-2 rounded-lg hover:bg-[#f5f5f5]"><RefreshCw className="w-4 h-4 text-[#71717a]" /></button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: total, color: 'text-[#1a1a1a]' },
          { label: 'Completes', value: completed, color: 'text-emerald-600' },
          { label: 'Echoues', value: failed, color: 'text-red-600' },
          { label: 'En review', value: needsReview, color: 'text-amber-600' },
          { label: 'Duree moy.', value: `${avgDuration}ms`, color: 'text-blue-600' },
          { label: 'Confiance moy.', value: `${(avgConfidence * 100).toFixed(0)}%`, color: 'text-violet-600' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white border border-[#f0f0f0] rounded-xl p-3 text-center">
            <p className={`text-[18px] font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] text-[#71717a] uppercase tracking-wider">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'completed', 'failed', 'needs_review'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${statusFilter === s ? 'bg-[#0F5F35] text-white' : 'bg-[#f5f5f5] text-[#71717a] hover:bg-gray-200'}`}>
            {s === 'all' ? 'Tous' : STATUS_BADGES[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Runs list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#71717a]" /></div>
      ) : runs.length === 0 ? (
        <div className="text-center py-12 text-[#71717a]"><Zap className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>Aucun run pour le moment</p></div>
      ) : (
        <div className="space-y-2">
          {runs.map(run => {
            const badge = STATUS_BADGES[run.status] || STATUS_BADGES.running
            const isExpanded = expandedRun === run.id
            return (
              <div key={run.id} className="bg-white border border-[#f0f0f0] rounded-xl overflow-hidden">
                <button onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                  className="w-full p-4 flex items-center gap-3 text-left hover:bg-[#fafafa]">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>{badge.label}</span>
                  <span className="text-[12px] font-bold text-[#1a1a1a]">{run.clients?.brand_name || 'Client'}</span>
                  <span className="text-[12px] text-[#71717a]">{run.classification || 'N/A'}</span>
                  <span className="text-[12px] text-[#71717a] ml-auto">{run.duration_ms}ms</span>
                  <span className="text-[12px] text-[#71717a]">{Math.round((run.confidence || 0) * 100)}%</span>
                  <span className="text-[10px] text-[#71717a]">{new Date(run.created_at).toLocaleString('fr-FR')}</span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <RunTagFlagButton runId={run.id} onTagged={refetch} />
                  </div>
                  <ChevronDown className={`w-4 h-4 text-[#71717a] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {isExpanded && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="border-t border-[#f0f0f0] p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-[12px]">
                      <div><span className="text-[#71717a]">Event type:</span> <span className="font-bold">{run.engine_events?.event_type}</span></div>
                      <div><span className="text-[#71717a]">Source:</span> <span className="font-bold">{run.engine_events?.source}</span></div>
                      <div><span className="text-[#71717a]">Customer:</span> <span className="font-bold">{run.engine_events?.normalized?.customer_email}</span></div>
                      <div><span className="text-[#71717a]">Classification:</span> <span className="font-bold">{run.classification}</span></div>
                    </div>
                    {run.engine_events?.normalized?.message && (
                      <div className="p-3 bg-[#ffffff] rounded-lg">
                        <p className="text-[10px] text-[#71717a] uppercase tracking-wider mb-1">Message</p>
                        <p className="text-[13px] text-[#1a1a1a]">{run.engine_events.normalized.message.substring(0, 300)}</p>
                      </div>
                    )}
                    {run.steps && run.steps.length > 0 && (
                      <div>
                        <p className="text-[10px] text-[#71717a] uppercase tracking-wider mb-2">Steps ({run.steps.length})</p>
                        <div className="space-y-1">
                          {run.steps.map((step, i) => (
                            <div key={i} className="flex items-center gap-2 text-[12px]">
                              {step.status === 'completed' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                              <span className="font-mono text-[#1a1a1a]">{step.action}</span>
                              <span className="text-[#71717a]">{step.duration_ms}ms</span>
                              {step.error && <span className="text-red-500">{step.error}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {run.error && <p className="text-[12px] text-red-600 bg-red-50 p-2 rounded-lg">{run.error}</p>}
                  </motion.div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
