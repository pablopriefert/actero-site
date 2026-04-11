import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Trophy, Clock, Euro, Zap, ExternalLink, Loader2, TrendingUp,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../ui/PageHeader'
import { SectionCard } from '../ui/SectionCard'
import { KpiCard, KpiRow } from '../ui/KpiCard'
import { EmptyState } from '../ui/EmptyState'

const HOURLY_RATE = 25 // € per hour default
const BRAND = '#0F5F35'

const formatEuro = (v) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v || 0)

const formatHours = (seconds) => {
  const hours = (seconds || 0) / 3600
  return `${hours.toFixed(hours < 10 ? 1 : 0)}h`
}

/**
 * AdminROILeaderboardView — Top 20 clients ROI sur 30j (D3).
 */
export default function AdminROILeaderboardView() {
  const start30d = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString()
  }, [])

  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['admin-roi-events-30d'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_events')
        .select('client_id, time_saved_seconds, revenue_amount, created_at')
        .gte('created_at', start30d)
      if (error) throw error
      return Array.isArray(data) ? data : []
    },
  })

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['admin-roi-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, brand_name, contact_email')
      if (error) throw error
      return Array.isArray(data) ? data : []
    },
  })

  const isLoading = loadingEvents || loadingClients

  const leaderboard = useMemo(() => {
    if (!events.length) return []

    const byClient = new Map()
    for (const ev of events) {
      const cid = ev?.client_id
      if (!cid) continue
      if (!byClient.has(cid)) {
        byClient.set(cid, {
          client_id: cid,
          total_time_saved: 0,
          total_revenue: 0,
          total_runs: 0,
        })
      }
      const acc = byClient.get(cid)
      acc.total_time_saved += Number(ev.time_saved_seconds || 0)
      acc.total_revenue += Number(ev.revenue_amount || 0)
      acc.total_runs += 1
    }

    const clientMap = new Map(clients.map((c) => [c.id, c]))

    const rows = Array.from(byClient.values()).map((r) => {
      const client = clientMap.get(r.client_id)
      const hours = (Number(r.total_time_saved) || 0) / 3600
      const timeSavings = hours * HOURLY_RATE
      // Priorite: time-based (heures * taux). revenue_amount n'est pas encore
      // peuple par le backend, donc c'est un fallback additif.
      const totalSavings = timeSavings + (Number(r.total_revenue) || 0)
      return {
        ...r,
        brand_name: client?.brand_name || 'Client',
        email: client?.contact_email || '—',
        hours,
        time_savings_euro: timeSavings,
        total_savings: totalSavings,
      }
    })

    return rows.sort((a, b) => b.total_savings - a.total_savings).slice(0, 20)
  }, [events, clients])

  const kpis = useMemo(() => {
    const totalROI = leaderboard.reduce((acc, r) => acc + r.total_savings, 0)
    const totalHours = leaderboard.reduce((acc, r) => acc + r.hours, 0)
    const avgROI = leaderboard.length > 0 ? totalROI / leaderboard.length : 0
    // If we need ALL clients roi (not only top 20) we could recompute, but
    // top 20 typically represent most of the signal.
    return { totalROI, totalHours, avgROI }
  }, [leaderboard])

  const topValue = leaderboard[0]?.total_savings || 0

  return (
    <div>
      <PageHeader
        title="Classement ROI clients"
        subtitle="Top 20 clients par économies générées sur 30 jours"
      />

      <div className="p-4 md:p-6 space-y-6">
        <KpiRow>
          <KpiCard
            label="ROI total (30j)"
            value={formatEuro(kpis.totalROI)}
            sublabel={`Base ${HOURLY_RATE} €/h + revenus`}
            icon={TrendingUp}
            color="brand"
            loading={isLoading}
          />
          <KpiCard
            label="ROI moyen / client"
            value={formatEuro(kpis.avgROI)}
            sublabel={`Sur ${leaderboard.length} clients`}
            icon={Euro}
            color="success"
            loading={isLoading}
          />
          <KpiCard
            label="Heures économisées"
            value={`${Math.round(kpis.totalHours)}h`}
            sublabel={`Valorisé à ${HOURLY_RATE} €/h`}
            icon={Clock}
            color="info"
            loading={isLoading}
          />
          <KpiCard
            label="Runs automatisés"
            value={leaderboard.reduce((a, r) => a + r.total_runs, 0)}
            sublabel="Événements 30j"
            icon={Zap}
            color="warning"
            loading={isLoading}
          />
        </KpiRow>

        <SectionCard title="Top 20 clients ROI" icon={Trophy}>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[#9ca3af]" />
            </div>
          ) : leaderboard.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Aucun événement automation"
              description="Aucune donnée automation_events sur les 30 derniers jours."
            />
          ) : (
            <div className="-mx-5 -mb-5">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#f0f0f0]">
                      <th className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider px-5 py-2.5 w-12">#</th>
                      <th className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider px-3 py-2.5">Client</th>
                      <th className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider px-3 py-2.5 text-right whitespace-nowrap">Heures</th>
                      <th className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider px-3 py-2.5 text-right whitespace-nowrap">Runs</th>
                      <th className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider px-3 py-2.5 text-right whitespace-nowrap">Économies</th>
                      <th className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider px-5 py-2.5 w-40">ROI relatif</th>
                      <th className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider px-5 py-2.5 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((row, idx) => {
                      const rank = idx + 1
                      const isPodium = rank <= 3
                      const trophyColor =
                        rank === 1 ? '#f59e0b' : rank === 2 ? '#9ca3af' : '#b45309'
                      const pct = topValue > 0 ? (row.total_savings / topValue) * 100 : 0
                      return (
                        <tr
                          key={row.client_id}
                          className="border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors"
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              {isPodium ? (
                                <Trophy className="w-4 h-4" style={{ color: trophyColor }} />
                              ) : (
                                <span className="w-4 inline-block" />
                              )}
                              <span className="text-[12px] font-semibold text-[#1a1a1a] tabular-nums">
                                #{rank}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 min-w-[160px]">
                            <div className="text-[13px] font-medium text-[#1a1a1a] truncate max-w-[220px]">
                              {row.brand_name}
                            </div>
                            <div className="text-[11px] text-[#9ca3af] truncate max-w-[220px]">
                              {row.email}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right text-[12px] text-[#71717a] tabular-nums whitespace-nowrap">
                            {formatHours(row.total_time_saved)}
                          </td>
                          <td className="px-3 py-3 text-right text-[12px] text-[#71717a] tabular-nums whitespace-nowrap">
                            {row.total_runs}
                          </td>
                          <td className="px-3 py-3 text-right text-[13px] font-semibold text-[#1a1a1a] tabular-nums whitespace-nowrap">
                            {formatEuro(row.total_savings)}
                          </td>
                          <td className="px-5 py-3">
                            <div className="w-full h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.max(2, Math.min(100, pct))}%`,
                                  backgroundColor: BRAND,
                                }}
                              />
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <a
                              href={`/admin/clients/${row.client_id}`}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F5F35] hover:underline"
                            >
                              Voir
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

export { AdminROILeaderboardView }
