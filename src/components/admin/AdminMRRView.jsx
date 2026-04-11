import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Euro, TrendingUp, TrendingDown, Sparkles, Users, Loader2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../ui/PageHeader'
import { SectionCard } from '../ui/SectionCard'
import { KpiCard, KpiRow } from '../ui/KpiCard'
import { ListItem } from '../ui/ListItem'
import { StatusPill } from '../ui/StatusPill'
import { EmptyState } from '../ui/EmptyState'

const BRAND = '#0F5F35'
const CHART_COLORS = {
  active: '#10b981',
  new: '#3b82f6',
  churned: '#ef4444',
}

const formatEuro = (amount) => {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '0 €'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

const MONTH_LABELS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

/**
 * Map mrr_status row -> pill variant.
 */
const statusVariant = (status) => {
  switch (status) {
    case 'active':
      return { variant: 'success', label: 'Actif' }
    case 'new':
      return { variant: 'info', label: 'Nouveau' }
    case 'churned':
      return { variant: 'danger', label: 'Churn' }
    default:
      return { variant: 'neutral', label: status || '—' }
  }
}

/**
 * AdminMRRView — Dashboard revenus récurrents (D1).
 *
 * KPIs: MRR total, New MRR 30j, Churned MRR 30j, Net New MRR.
 * Chart line: évolution 12 derniers mois (fallback construit depuis clients.created_at
 * si v_admin_mrr_snapshot ne contient pas d'historique).
 * Top 20 clients par MRR (liste) + donut chart répartition par statut.
 */
export default function AdminMRRView() {
  // Query v_admin_mrr_snapshot — best-effort. Colonnes probables :
  //   brand_name, email, client_id, mrr, mrr_status, created_at
  const { data: snapshot = [], isLoading, error } = useQuery({
    queryKey: ['admin-mrr-snapshot'],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('v_admin_mrr_snapshot')
        .select('*')
        .order('mrr', { ascending: false })
      if (err) throw err
      return Array.isArray(data) ? data : []
    },
    retry: false,
  })

  // Fallback clients for MRR timeline (12 months)
  const { data: clientsForTimeline = [] } = useQuery({
    queryKey: ['admin-mrr-clients-timeline'],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('clients')
        .select('id, created_at, status')
        .order('created_at', { ascending: true })
      if (err) return []
      return Array.isArray(data) ? data : []
    },
  })

  const kpis = useMemo(() => {
    let mrrTotal = 0
    let newMrr = 0
    let churnedMrr = 0
    for (const row of snapshot) {
      const amount = Number(row?.mrr || 0)
      const status = row?.mrr_status
      if (status === 'active' || status === 'new') mrrTotal += amount
      if (status === 'new') newMrr += amount
      if (status === 'churned') churnedMrr += amount
    }
    const netNew = newMrr - churnedMrr
    return { mrrTotal, newMrr, churnedMrr, netNew }
  }, [snapshot])

  const timeline = useMemo(() => {
    // Build 12 monthly buckets ending at current month
    const now = new Date()
    const buckets = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: MONTH_LABELS_FR[d.getMonth()],
        year: d.getFullYear(),
        month: d.getMonth(),
        mrr: 0,
      })
    }

    // Prefer snapshot with created_at if available
    const source = snapshot.length > 0 && snapshot.some((r) => r?.created_at)
      ? snapshot
      : clientsForTimeline

    if (!source.length) return buckets

    // For each bucket, sum MRR of clients active (or created) at end of bucket month.
    // Simplification : count cumulative signups × average MRR (fallback) OR cumulative
    // from snapshot's mrr field if present.
    const avgMrr = snapshot.length
      ? snapshot.reduce((acc, r) => acc + Number(r?.mrr || 0), 0) / Math.max(1, snapshot.length)
      : 0

    const hasRealMrr = snapshot.length > 0 && snapshot.some((r) => Number(r?.mrr) > 0)

    buckets.forEach((b) => {
      const endOfMonth = new Date(b.year, b.month + 1, 0, 23, 59, 59)
      const activeClients = source.filter((r) => {
        const created = r?.created_at ? new Date(r.created_at) : null
        if (!created) return false
        if (created > endOfMonth) return false
        if (r?.mrr_status === 'churned' && r?.churned_at) {
          const churned = new Date(r.churned_at)
          if (churned <= endOfMonth) return false
        }
        return true
      })
      if (hasRealMrr) {
        b.mrr = activeClients.reduce((acc, r) => acc + Number(r?.mrr || 0), 0)
      } else {
        // Rough fallback: 49€ per active client (standard Actero plan)
        b.mrr = activeClients.length * (avgMrr || 49)
      }
    })

    return buckets
  }, [snapshot, clientsForTimeline])

  const topClients = useMemo(() => {
    return [...snapshot]
      .filter((r) => Number(r?.mrr || 0) > 0)
      .sort((a, b) => Number(b?.mrr || 0) - Number(a?.mrr || 0))
      .slice(0, 20)
  }, [snapshot])

  const statusBreakdown = useMemo(() => {
    const counts = { active: 0, new: 0, churned: 0 }
    for (const row of snapshot) {
      const s = row?.mrr_status
      if (s && counts[s] !== undefined) counts[s] += 1
    }
    return [
      { name: 'Actifs', value: counts.active, color: CHART_COLORS.active },
      { name: 'Nouveaux', value: counts.new, color: CHART_COLORS.new },
      { name: 'Churned', value: counts.churned, color: CHART_COLORS.churned },
    ].filter((d) => d.value > 0)
  }, [snapshot])

  const isEmpty = !isLoading && (snapshot.length === 0 || !!error)

  return (
    <div>
      <PageHeader
        title="Revenus récurrents"
        subtitle="MRR, new, churn et top clients"
      />

      <div className="p-4 md:p-6 space-y-6">
        <KpiRow>
          <KpiCard
            label="MRR total"
            value={formatEuro(kpis.mrrTotal)}
            sublabel="Actifs + nouveaux"
            icon={Euro}
            color="brand"
            loading={isLoading}
          />
          <KpiCard
            label="New MRR (30j)"
            value={formatEuro(kpis.newMrr)}
            sublabel="Nouveaux abonnements"
            icon={Sparkles}
            color="info"
            loading={isLoading}
          />
          <KpiCard
            label="Churned MRR (30j)"
            value={`- ${formatEuro(kpis.churnedMrr)}`}
            sublabel="Clients perdus"
            icon={TrendingDown}
            color="danger"
            loading={isLoading}
          />
          <KpiCard
            label="Net new MRR"
            value={formatEuro(kpis.netNew)}
            sublabel="New - Churn"
            icon={TrendingUp}
            color={kpis.netNew >= 0 ? 'success' : 'danger'}
            loading={isLoading}
          />
        </KpiRow>

        <SectionCard title="Évolution MRR (12 derniers mois)" icon={TrendingUp}>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[#9ca3af]" />
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                <LineChart data={timeline} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={{ stroke: '#f0f0f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={{ stroke: '#f0f0f0' }}
                    tickLine={false}
                    tickFormatter={(v) => `${Math.round(v)} €`}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #f0f0f0',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value) => [formatEuro(value), 'MRR']}
                  />
                  <Line
                    type="monotone"
                    dataKey="mrr"
                    stroke={BRAND}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: BRAND }}
                    activeDot={{ r: 5, fill: BRAND }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SectionCard title="Top 20 clients par MRR" icon={Users}>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-[#9ca3af]" />
                </div>
              ) : isEmpty || topClients.length === 0 ? (
                <EmptyState
                  icon={Euro}
                  title="Aucune donnée MRR"
                  description="La vue v_admin_mrr_snapshot est vide ou indisponible."
                />
              ) : (
                <div className="-mx-5 -mb-5">
                  {topClients.map((row) => {
                    const { variant, label } = statusVariant(row?.mrr_status)
                    return (
                      <ListItem
                        key={row?.client_id || row?.id || row?.email}
                        avatar={row?.brand_name || '??'}
                        title={row?.brand_name || 'Client'}
                        subtitle={row?.email || row?.client_id}
                        meta={
                          <div className="flex items-center gap-2 justify-end">
                            <StatusPill variant={variant} size="sm">{label}</StatusPill>
                            <span className="tabular-nums font-semibold text-[#1a1a1a]">
                              {formatEuro(Number(row?.mrr || 0))}/mo
                            </span>
                          </div>
                        }
                      />
                    )
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Répartition par statut">
            {statusBreakdown.length === 0 ? (
              <EmptyState icon={Users} title="Aucune donnée" />
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {statusBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#fff',
                        border: '1px solid #f0f0f0',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      wrapperStyle={{ fontSize: 11, color: '#71717a' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

export { AdminMRRView }
