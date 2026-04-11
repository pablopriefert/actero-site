import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Wallet,
  AlertTriangle,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../ui/PageHeader'
import { KpiCard, KpiRow } from '../ui/KpiCard'
import { SectionCard } from '../ui/SectionCard'
import { ListItem } from '../ui/ListItem'
import { EmptyState } from '../ui/EmptyState'
import { StatusPill } from '../ui/StatusPill'

const CLIENT_BUDGET_ALERT = 50 // USD / month

function formatCurrency(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return '$0.00'
  if (v >= 100) return `$${v.toFixed(2)}`
  if (v >= 1) return `$${v.toFixed(3)}`
  return `$${v.toFixed(4)}`
}

export const AdminCostTrackerView = () => {
  // Fetch last 30d runs (keep payload small: client_id, cost, tokens, created_at)
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['admin-cost-tracker'],
    queryFn: async () => {
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('engine_runs_v2')
        .select('id, client_id, cost_usd, tokens_in, tokens_out, created_at')
        .gte('created_at', start)
        .not('cost_usd', 'is', null)
        .limit(20000)
      if (error) throw error
      return data || []
    },
    refetchInterval: 30000,
  })

  // Fetch clients for brand_name mapping
  const { data: clients = [] } = useQuery({
    queryKey: ['admin-cost-tracker-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, brand_name')
      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60 * 1000,
  })

  const clientMap = useMemo(() => {
    const m = new Map()
    for (const c of clients) m.set(c.id, c.brand_name || 'Client')
    return m
  }, [clients])

  const stats = useMemo(() => {
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000
    let cost24h = 0
    let cost30d = 0
    let runs24h = 0
    const byClient = new Map()

    for (const r of runs) {
      const cost = Number(r.cost_usd) || 0
      const ts = new Date(r.created_at).getTime()
      const age = now - ts
      cost30d += cost
      if (age <= day) {
        cost24h += cost
        runs24h += 1
      }
      if (!byClient.has(r.client_id)) {
        byClient.set(r.client_id, {
          client_id: r.client_id,
          total: 0,
          runs: 0,
          tokens: 0,
        })
      }
      const bucket = byClient.get(r.client_id)
      bucket.total += cost
      bucket.runs += 1
      bucket.tokens += (Number(r.tokens_in) || 0) + (Number(r.tokens_out) || 0)
    }

    const avgCost24h = runs24h > 0 ? cost24h / runs24h : 0

    // Month-to-date projection: cost over days_elapsed of current month * 30
    const daysElapsed = Math.max(1, Math.min(30, 30)) // simple: window is 30d
    const projection = cost30d // already 30d window

    const clientRows = Array.from(byClient.values())
      .map((b) => ({
        ...b,
        brand_name: clientMap.get(b.client_id) || `#${String(b.client_id).slice(0, 6)}`,
        avg_tokens: b.runs > 0 ? Math.round(b.tokens / b.runs) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)

    return {
      cost24h,
      cost30d,
      avgCost24h,
      projection,
      clientRows,
    }
  }, [runs, clientMap])

  const chartData = useMemo(
    () =>
      stats.clientRows.slice(0, 10).map((c) => ({
        name: (c.brand_name || '').slice(0, 16),
        total: Number(c.total.toFixed(2)),
      })),
    [stats]
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Cost tracker Claude"
        subtitle="Coûts LLM par client (30 derniers jours)"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#fafafa]">
        <KpiRow>
          <KpiCard
            label="Cout total 24h"
            value={formatCurrency(stats.cost24h)}
            icon={DollarSign}
            color="brand"
            loading={isLoading}
          />
          <KpiCard
            label="Cout total 30j"
            value={formatCurrency(stats.cost30d)}
            icon={Wallet}
            color="info"
            loading={isLoading}
          />
          <KpiCard
            label="Cout moyen / run 24h"
            value={formatCurrency(stats.avgCost24h)}
            icon={TrendingUp}
            color="success"
            loading={isLoading}
          />
          <KpiCard
            label="Projection fin de mois"
            value={formatCurrency(stats.projection)}
            icon={Calendar}
            color="warning"
            loading={isLoading}
          />
        </KpiRow>

        <SectionCard
          title="Cout par client (30 derniers jours)"
          subtitle="Top 20 par cout cumule"
          icon={Wallet}
        >
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-[#fafafa] animate-pulse" />
              ))}
            </div>
          ) : stats.clientRows.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="Aucun cout enregistre"
              description="Les runs n'ont pas encore de cost_usd rempli."
            />
          ) : (
            <div className="-mx-5">
              {stats.clientRows.map((c) => {
                const alert = c.total >= CLIENT_BUDGET_ALERT
                return (
                  <ListItem
                    key={c.client_id}
                    avatar={c.brand_name}
                    title={c.brand_name}
                    subtitle={`${c.runs} runs - ${c.avg_tokens} tokens moy.`}
                    meta={
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-[13px] font-semibold text-[#1a1a1a] tabular-nums">
                          {formatCurrency(c.total)}
                        </span>
                        {alert && (
                          <StatusPill variant="danger" size="sm" icon={AlertTriangle}>
                            {'>$50'}
                          </StatusPill>
                        )}
                      </div>
                    }
                  />
                )
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Top 10 clients par cout"
          subtitle="Bar chart 30 derniers jours"
          icon={TrendingUp}
        >
          {chartData.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="Pas encore de donnees"
              description="Le chart se remplira des qu'il y aura des runs."
            />
          ) : (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 16, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f0f0f0"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11, fill: '#71717a' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#fafafa' }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #f0f0f0',
                      fontSize: 12,
                    }}
                    formatter={(val) => [`$${val}`, 'Cout 30j']}
                  />
                  <Bar dataKey="total" fill="#0F5F35" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

export default AdminCostTrackerView
