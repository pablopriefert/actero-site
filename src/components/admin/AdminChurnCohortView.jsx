import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, TrendingDown, TrendingUp, Percent, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../ui/PageHeader'
import { SectionCard } from '../ui/SectionCard'
import { KpiCard, KpiRow } from '../ui/KpiCard'
import { EmptyState } from '../ui/EmptyState'

const MONTH_LABELS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

/**
 * Interpolate from red (#ef4444) at 0% to green (#10b981) at 100%.
 * Returns an rgba-style background color.
 */
function retentionColor(pct) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return { bg: '#fafafa', text: '#9ca3af' }
  const p = Math.max(0, Math.min(100, pct)) / 100
  // red (239, 68, 68) -> green (16, 185, 129)
  const r = Math.round(239 + (16 - 239) * p)
  const g = Math.round(68 + (185 - 68) * p)
  const b = Math.round(68 + (129 - 68) * p)
  // Text dark on light background
  return {
    bg: `rgba(${r}, ${g}, ${b}, 0.14)`,
    border: `rgba(${r}, ${g}, ${b}, 0.35)`,
    text: `rgb(${Math.round(r * 0.6)}, ${Math.round(g * 0.6)}, ${Math.round(b * 0.6)})`,
  }
}

/**
 * Status considered "retained" (still a customer).
 * We treat anything except churned / inactive / cancelled as active.
 */
const isChurned = (status) => {
  if (!status) return false
  const s = String(status).toLowerCase()
  return s === 'churned' || s === 'cancelled' || s === 'canceled' || s === 'inactive' || s === 'lost'
}

/**
 * AdminChurnCohortView — Grille de cohortes mensuelles (D2).
 */
export default function AdminChurnCohortView() {
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['admin-churn-cohort-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, created_at, status')
        .order('created_at', { ascending: false })
        .limit(1000)
      if (error) throw error
      return Array.isArray(data) ? data : []
    },
  })

  const { cohorts, kpis, hasEnoughData } = useMemo(() => {
    const result = { cohorts: [], kpis: { churn30: 0, ret30: 0, ret90: 0 }, hasEnoughData: false }
    if (!clients.length || clients.length < 5) return result

    const now = new Date()
    const monthsToShow = 12 // last 12 cohorts
    const cohortMap = new Map()

    for (const c of clients) {
      if (!c?.created_at) continue
      const d = new Date(c.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!cohortMap.has(key)) {
        cohortMap.set(key, {
          key,
          label: `${MONTH_LABELS_FR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
          year: d.getFullYear(),
          month: d.getMonth(),
          clients: [],
        })
      }
      cohortMap.get(key).clients.push(c)
    }

    // Sort cohorts chronologically and keep the last N
    const sortedCohorts = Array.from(cohortMap.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })

    const recentCohorts = sortedCohorts.slice(-monthsToShow)

    // For each cohort compute retention at M+0, M+1, M+2, M+3, M+6.
    // Since we only have current status (no churn history), we approximate:
    //   - A client is considered "retained at M+k" if (now - created_at) >= k months
    //     AND status is not churned.
    //   - If (now - created_at) < k months, the cell is "—" (not enough time).
    const offsets = [0, 1, 2, 3, 6]

    const cohortsOut = recentCohorts.map((c) => {
      const total = c.clients.length
      const monthsSinceSignup = (now.getFullYear() - c.year) * 12 + (now.getMonth() - c.month)
      const cells = offsets.map((k) => {
        if (k === 0) {
          return { offset: k, pct: 100, count: total, total, available: true }
        }
        if (monthsSinceSignup < k) {
          return { offset: k, pct: null, count: null, total, available: false }
        }
        const retained = c.clients.filter((cl) => !isChurned(cl.status)).length
        return {
          offset: k,
          pct: total > 0 ? Math.round((retained / total) * 100) : 0,
          count: retained,
          total,
          available: true,
        }
      })
      return { key: c.key, label: c.label, total, cells }
    })

    // KPIs (global, not cohort-based)
    const churnedNow = clients.filter((c) => isChurned(c.status)).length
    const totalClients = clients.length
    const churn30 = totalClients > 0 ? Math.round((churnedNow / totalClients) * 100) : 0
    const ret30 = 100 - churn30

    const d90 = new Date(now)
    d90.setDate(d90.getDate() - 90)
    const clients90 = clients.filter((c) => c?.created_at && new Date(c.created_at) <= d90)
    const clients90Retained = clients90.filter((c) => !isChurned(c.status)).length
    const ret90 = clients90.length > 0 ? Math.round((clients90Retained / clients90.length) * 100) : 0

    return {
      cohorts: cohortsOut,
      kpis: { churn30, ret30, ret90 },
      hasEnoughData: true,
    }
  }, [clients])

  const offsets = [0, 1, 2, 3, 6]

  return (
    <div>
      <PageHeader
        title="Analyse de rétention (cohortes)"
        subtitle="Rétention mensuelle des clients depuis leur signup"
      />

      <div className="p-4 md:p-6 space-y-6">
        <KpiRow>
          <KpiCard
            label="Churn rate (global)"
            value={`${kpis.churn30}%`}
            sublabel="Clients churned / total"
            icon={TrendingDown}
            color="danger"
            loading={isLoading}
          />
          <KpiCard
            label="Retention (30j)"
            value={`${kpis.ret30}%`}
            sublabel="Clients encore actifs"
            icon={TrendingUp}
            color="success"
            loading={isLoading}
          />
          <KpiCard
            label="Retention (90j)"
            value={`${kpis.ret90}%`}
            sublabel="Clients >90j encore actifs"
            icon={Percent}
            color="brand"
            loading={isLoading}
          />
          <KpiCard
            label="Clients analysés"
            value={clients.length}
            sublabel="1000 derniers max"
            icon={Users}
            color="info"
            loading={isLoading}
          />
        </KpiRow>

        <SectionCard title="Cohortes mensuelles">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[#9ca3af]" />
            </div>
          ) : !hasEnoughData ? (
            <EmptyState
              icon={Users}
              title="Pas assez de données"
              description="Il faut au moins 5 clients pour générer des cohortes."
            />
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr>
                    <th className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider text-left pb-3 pr-3 whitespace-nowrap">
                      Cohorte
                    </th>
                    <th className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider text-right pb-3 pr-3 whitespace-nowrap">
                      Clients
                    </th>
                    {offsets.map((k) => (
                      <th
                        key={k}
                        className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider text-center pb-3 px-2 whitespace-nowrap"
                      >
                        M+{k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((c) => (
                    <tr key={c.key} className="group">
                      <td className="py-1.5 pr-3 text-[12px] font-medium text-[#1a1a1a] whitespace-nowrap">
                        {c.label}
                      </td>
                      <td className="py-1.5 pr-3 text-[12px] text-[#71717a] text-right tabular-nums">
                        {c.total}
                      </td>
                      {c.cells.map((cell) => {
                        if (!cell.available) {
                          return (
                            <td key={cell.offset} className="py-1.5 px-1">
                              <div className="h-8 rounded-md bg-[#fafafa] border border-[#f0f0f0] text-[10px] text-[#9ca3af] flex items-center justify-center">
                                —
                              </div>
                            </td>
                          )
                        }
                        const colors = retentionColor(cell.pct)
                        return (
                          <td key={cell.offset} className="py-1.5 px-1">
                            <div
                              title={`${cell.count}/${cell.total} (${cell.pct}%)`}
                              className="h-8 rounded-md text-[11px] font-semibold flex items-center justify-center tabular-nums border transition-transform group-hover:scale-[1.02]"
                              style={{
                                backgroundColor: colors.bg,
                                borderColor: colors.border,
                                color: colors.text,
                              }}
                            >
                              {cell.pct}%
                            </div>
                          </td>
                        )
                      })}
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

export { AdminChurnCohortView }
