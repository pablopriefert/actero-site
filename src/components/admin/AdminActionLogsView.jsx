import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield, Search, RefreshCw, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../ui/PageHeader'
import { SectionCard } from '../ui/SectionCard'
import { SearchInput } from '../ui/SearchInput'
import { StatusPill } from '../ui/StatusPill'
import { EmptyState } from '../ui/EmptyState'
import { ExportCsvButton } from '../ui/ExportCsvButton'

/**
 * Admin audit trail — who did what, when, to whom.
 * Source: admin_action_logs (populated by api/admin/_helpers.js#logAdminAction).
 */
export function AdminActionLogsView() {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-action-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_action_logs')
        .select('id, actor_email, action, target_type, target_id, client_id, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return data || []
    },
    staleTime: 30_000,
  })

  const actionTypes = useMemo(() => {
    const set = new Set(logs.map((l) => l.action).filter(Boolean))
    return Array.from(set).sort()
  }, [logs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return logs.filter((l) => {
      if (actionFilter !== 'all' && l.action !== actionFilter) return false
      if (!q) return true
      const hay = `${l.actor_email} ${l.action} ${l.target_type} ${l.target_id} ${JSON.stringify(l.metadata || {})}`.toLowerCase()
      return hay.includes(q)
    })
  }, [logs, search, actionFilter])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Journal d'audit"
        subtitle={`${filtered.length} action(s) affichée(s) sur ${logs.length}`}
        actions={
          <div className="flex items-center gap-2">
            <ExportCsvButton
              filename="actero-action-logs"
              rows={filtered}
              columns={[
                { key: 'created_at', label: 'When' },
                { key: 'actor_email', label: 'Actor' },
                { key: 'action', label: 'Action' },
                { key: 'target_type', label: 'Target type' },
                { key: 'target_id', label: 'Target id' },
                { key: 'client_id', label: 'Client id' },
                { key: 'metadata', label: 'Metadata' },
              ]}
            />
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#f0f0f0] bg-white text-[12px] font-semibold hover:bg-[#fafafa] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Rafraîchir
            </button>
          </div>
        }
      />

      <div className="px-6 space-y-4">
        <SectionCard>
          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Rechercher par email, action, target id…"
              className="flex-1"
            />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-[#f0f0f0] bg-white text-[13px] text-[#1a1a1a]"
            >
              <option value="all">Toutes les actions</option>
              {actionTypes.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-[#71717a] text-[13px]">Chargement…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="Aucune action enregistrée"
              description="Les actions admin (pause, delete, impersonate, etc.) apparaîtront ici."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-[#fafafa] border-b border-[#f0f0f0]">
                  <tr className="text-left text-[#71717a] uppercase tracking-wider text-[10px] font-bold">
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Actor</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr key={l.id} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
                      <td className="px-3 py-2 text-[#71717a] tabular-nums whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-3 py-2 font-medium text-[#1a1a1a] whitespace-nowrap">
                        {l.actor_email || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill
                          label={l.action || 'unknown'}
                          tone={
                            /delete|danger|impersonate/i.test(l.action || '')
                              ? 'danger'
                              : /update|change|edit/i.test(l.action || '')
                                ? 'warn'
                                : 'neutral'
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-[#71717a] whitespace-nowrap">
                        <span className="text-[10px] uppercase tracking-wider text-[#9ca3af]">{l.target_type || '—'}</span>
                        <br />
                        <span className="font-mono text-[11px]">{l.target_id || '—'}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[#71717a]">{l.client_id || '—'}</td>
                      <td className="px-3 py-2 max-w-[320px]">
                        {l.metadata && Object.keys(l.metadata).length > 0 ? (
                          <details>
                            <summary className="cursor-pointer text-[#71717a] hover:text-[#1a1a1a] text-[11px]">
                              <FileText className="inline w-3 h-3 mr-1" />
                              {Object.keys(l.metadata).length} champ(s)
                            </summary>
                            <pre className="mt-1 text-[10px] bg-[#fafafa] border border-[#f0f0f0] rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
                              {JSON.stringify(l.metadata, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-[#9ca3af]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

export default AdminActionLogsView
