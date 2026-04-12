import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, CheckCircle2, X, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../ui/PageHeader'
import { SectionCard } from '../ui/SectionCard'
import { EmptyState } from '../ui/EmptyState'
import { StatusPill } from '../ui/StatusPill'
import { ListItem } from '../ui/ListItem'

function relTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "a l'instant"
  if (m < 60) return `il y a ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  const d = Math.floor(h / 24)
  return `il y a ${d}j`
}

function truncateKey(msg) {
  if (!msg) return '(no message)'
  return String(msg).slice(0, 200)
}

export const AdminTopErrorsView = () => {
  const [drillDown, setDrillDown] = useState(null) // error key

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['admin-top-errors'],
    queryFn: async () => {
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('engine_runs_v2')
        .select('id, error_message, error, client_id, created_at, classification, agent_used, status')
        .not('error', 'is', null)
        .gte('created_at', start)
        .limit(1000)
      if (error) throw error
      return data || []
    },
    refetchInterval: 30000,
  })

  const topErrors = useMemo(() => {
    const groups = new Map()
    for (const r of runs) {
      const key = truncateKey(r.error_message || r.error)
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          message: key,
          count: 0,
          lastSeen: r.created_at,
          clients: new Set(),
          runs: [],
        })
      }
      const g = groups.get(key)
      g.count += 1
      g.clients.add(r.client_id)
      g.runs.push(r)
      if (new Date(r.created_at) > new Date(g.lastSeen)) g.lastSeen = r.created_at
    }
    return Array.from(groups.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [runs])

  const drillDownGroup = useMemo(
    () => topErrors.find((g) => g.key === drillDown),
    [drillDown, topErrors]
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Top erreurs"
        subtitle={`${runs.length} erreurs au total sur les 24 dernieres heures`}
      />

      <div className="flex-1 overflow-y-auto p-6 bg-[#fafafa]">
        <SectionCard
          title="Top 10 erreurs des 24 dernieres heures"
          subtitle="Grouping par message d'erreur (tronque a 200 caracteres)"
          icon={AlertTriangle}
        >
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-[#fafafa] animate-pulse" />
              ))}
            </div>
          ) : topErrors.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Aucune erreur dans les dernieres 24h"
              description="Le moteur tourne sans accroc. Felicitations."
            />
          ) : (
            <div className="space-y-3">
              {topErrors.map((err, idx) => (
                <div
                  key={err.key}
                  className="flex items-start gap-3 p-3 rounded-xl border border-[#f0f0f0] hover:border-[#ef4444]/30 hover:bg-[#fafafa] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#ef4444]/10 text-[#ef4444] flex items-center justify-center text-[12px] font-bold flex-shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-[#1a1a1a] font-medium leading-snug line-clamp-3 break-words">
                      {err.message}
                    </div>
                    <div className="text-[11px] text-[#9ca3af] mt-1">
                      Derniere occurrence {relTime(err.lastSeen)} - {err.clients.size} client{err.clients.size > 1 ? 's' : ''} touche{err.clients.size > 1 ? 's' : ''} - {err.count} run{err.count > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <StatusPill variant="danger" size="sm">
                      {err.count}
                    </StatusPill>
                    <button
                      onClick={() => setDrillDown(err.key)}
                      className="p-1.5 rounded-lg hover:bg-[#f0f0f0] text-[#71717a]"
                      title="Voir les runs affectes"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Drill-down modal */}
      <AnimatePresence>
        {drillDown && drillDownGroup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
            onClick={() => setDrillDown(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-[#f0f0f0] flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-[#1a1a1a]">
                    Runs affectes ({drillDownGroup.runs.length})
                  </div>
                  <div className="text-[11px] text-[#9ca3af] truncate mt-0.5">
                    {drillDownGroup.message.slice(0, 120)}
                  </div>
                </div>
                <button
                  onClick={() => setDrillDown(null)}
                  className="p-1.5 rounded-lg hover:bg-[#fafafa] text-[#71717a] flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {drillDownGroup.runs.map((r) => (
                  <ListItem
                    key={r.id}
                    icon={<AlertTriangle className="w-4 h-4 text-[#ef4444]" />}
                    title={`${r.classification || 'run'} -> ${r.agent_used || 'general'}`}
                    subtitle={`client ${r.client_id?.slice(0, 8) || '—'}`}
                    meta={relTime(r.created_at)}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AdminTopErrorsView
