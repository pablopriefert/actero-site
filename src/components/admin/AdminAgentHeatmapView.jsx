import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Grid3x3, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../ui/PageHeader'
import { SectionCard } from '../ui/SectionCard'
import { EmptyState } from '../ui/EmptyState'
import { ListItem } from '../ui/ListItem'
import { StatusPill } from '../ui/StatusPill'

const AGENTS = ['order', 'return', 'product', 'escalation', 'general', 'unknown']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function colorForRate(rate, total) {
  if (!total) return '#f0f0f0'
  if (rate < 0.02) return '#10b981'
  if (rate < 0.1) return '#f59e0b'
  return '#ef4444'
}

function formatHour(h) {
  return `${String(h).padStart(2, '0')}:00`
}

export const AdminAgentHeatmapView = () => {
  const [selectedCell, setSelectedCell] = useState(null) // { agent, hour }

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['admin-agent-heatmap'],
    queryFn: async () => {
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('engine_runs_v2')
        .select('id, agent_used, status, created_at, classification, error_message, client_id')
        .gte('created_at', start)
        .limit(5000)
      if (error) throw error
      return data || []
    },
    refetchInterval: 30000,
  })

  // Bucket runs: agent x hour
  const buckets = useMemo(() => {
    const map = {}
    for (const a of AGENTS) {
      map[a] = {}
      for (const h of HOURS) map[a][h] = { total: 0, errors: 0, runs: [] }
    }
    const now = new Date()
    for (const run of runs) {
      const agent = AGENTS.includes(run.agent_used) ? run.agent_used : 'unknown'
      const createdAt = new Date(run.created_at)
      const hoursAgo = Math.floor((now.getTime() - createdAt.getTime()) / (60 * 60 * 1000))
      // Map hoursAgo (0..23) to a slot (23-hoursAgo) so left=oldest, right=now
      const slot = 23 - hoursAgo
      if (slot < 0 || slot > 23) continue
      const cell = map[agent][slot]
      cell.total += 1
      if (run.error != null) {
        cell.errors += 1
        cell.runs.push(run)
      }
    }
    return map
  }, [runs])

  const selectedRuns = useMemo(() => {
    if (!selectedCell) return []
    const cell = buckets[selectedCell.agent]?.[selectedCell.hour]
    return cell?.runs || []
  }, [buckets, selectedCell])

  // Global stats
  const totalRuns = runs.length
  const totalErrors = runs.filter((r) => r.error != null).length
  const globalRate = totalRuns ? ((totalErrors / totalRuns) * 100).toFixed(1) : '0.0'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Agent Heatmap"
        subtitle={`Erreurs par agent (24h) - ${totalRuns} runs, ${totalErrors} erreurs (${globalRate}%)`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#fafafa]">
        <SectionCard
          title="Taux d'erreur par agent et par heure"
          subtitle="Colonne de gauche = il y a 24h, colonne de droite = maintenant"
          icon={Grid3x3}
        >
          {isLoading ? (
            <div className="h-64 rounded-xl bg-[#fafafa] animate-pulse" />
          ) : (
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                {/* Header row with hours */}
                <div className="flex items-center mb-2 ml-[96px]">
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="w-6 text-center text-[9px] text-[#9ca3af] tabular-nums"
                    >
                      {h % 3 === 0 ? h : ''}
                    </div>
                  ))}
                </div>
                {AGENTS.map((agent) => (
                  <div key={agent} className="flex items-center mb-1">
                    <div className="w-24 pr-3 text-[11px] font-medium text-[#1a1a1a] truncate">
                      {agent}
                    </div>
                    {HOURS.map((h) => {
                      const cell = buckets[agent][h]
                      const rate = cell.total ? cell.errors / cell.total : 0
                      const color = colorForRate(rate, cell.total)
                      const isSelected =
                        selectedCell &&
                        selectedCell.agent === agent &&
                        selectedCell.hour === h
                      const tooltip = cell.total
                        ? `${agent} - slot ${h} - ${cell.total} runs, ${cell.errors} erreurs (${(rate * 100).toFixed(1)}%)`
                        : `${agent} - slot ${h} - aucun run`
                      return (
                        <button
                          key={h}
                          title={tooltip}
                          onClick={() =>
                            cell.errors > 0
                              ? setSelectedCell({ agent, hour: h })
                              : setSelectedCell(null)
                          }
                          className={`w-6 h-6 mr-0.5 rounded-sm transition-transform ${
                            isSelected ? 'ring-2 ring-[#0F5F35] scale-110' : ''
                          } ${cell.errors > 0 ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
                          style={{ backgroundColor: color }}
                        />
                      )
                    })}
                  </div>
                ))}
                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 text-[10px] text-[#71717a]">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm" style={{ background: '#10b981' }} />
                    {'< 2%'}
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm" style={{ background: '#f59e0b' }} />
                    {'< 10%'}
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm" style={{ background: '#ef4444' }} />
                    {'>= 10%'}
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm" style={{ background: '#f0f0f0' }} />
                    aucun run
                  </div>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        {selectedCell && (
          <SectionCard
            title={`Runs failed - ${selectedCell.agent} (slot ${selectedCell.hour})`}
            subtitle={`${selectedRuns.length} run(s) en erreur dans cette tranche`}
            icon={XCircle}
            action={
              <button
                onClick={() => setSelectedCell(null)}
                className="text-[11px] text-[#71717a] hover:text-[#1a1a1a]"
              >
                Fermer
              </button>
            }
          >
            {selectedRuns.length === 0 ? (
              <EmptyState
                icon={XCircle}
                title="Aucun run failed"
                description="Cette tranche ne contient pas d'erreur."
              />
            ) : (
              <div className="-mx-5">
                {selectedRuns.map((r) => (
                  <ListItem
                    key={r.id}
                    icon={<XCircle className="w-4 h-4 text-[#ef4444]" />}
                    title={r.classification || 'run'}
                    subtitle={
                      r.error_message
                        ? String(r.error_message).slice(0, 120)
                        : 'Pas de message d\'erreur'
                    }
                    meta={
                      <StatusPill variant="danger" size="sm">
                        failed
                      </StatusPill>
                    }
                  />
                ))}
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </div>
  )
}

export default AdminAgentHeatmapView
