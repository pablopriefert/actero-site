import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
  TrendingUp,
  Coins,
  Package,
  BookOpen,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../ui/PageHeader'
import { SectionCard } from '../ui/SectionCard'
import { KpiCard, KpiRow } from '../ui/KpiCard'
import { EmptyState } from '../ui/EmptyState'

const DAYS = 30

function isoDay(d) {
  return new Date(d).toISOString().slice(0, 10)
}

function fmtUsd(n) {
  if (!n && n !== 0) return '—'
  const v = Number(n)
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`
  return `$${v.toFixed(2)}`
}

function fmtInt(n) {
  if (!n && n !== 0) return '—'
  return Number(n).toLocaleString('fr-FR')
}

export function AdminTokensView() {
  const sinceIso = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - DAYS)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [])

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['admin-tokens-runs', sinceIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engine_runs_v2')
        .select(
          'id, client_id, playbook_id, created_at, tokens_in, tokens_out, cost_usd, clients(brand_name)'
        )
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(5000)
      if (error) throw error
      return data || []
    },
  })

  const aggregates = useMemo(() => {
    const totalIn = runs.reduce((s, r) => s + (r.tokens_in || 0), 0)
    const totalOut = runs.reduce((s, r) => s + (r.tokens_out || 0), 0)
    const totalCost = runs.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0)

    // Projection fin de mois : daily avg * days in current month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const elapsed = Math.max(1, Math.ceil((now - startOfMonth) / (24 * 3600 * 1000)))
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const monthCost = runs
      .filter((r) => new Date(r.created_at) >= startOfMonth)
      .reduce((s, r) => s + (Number(r.cost_usd) || 0), 0)
    const projection = (monthCost / elapsed) * daysInMonth

    // Daily series
    const dayMap = new Map()
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = isoDay(d)
      dayMap.set(key, { date: key, tokens_in_cost: 0, tokens_out_cost: 0, cost: 0 })
    }
    for (const r of runs) {
      const key = isoDay(r.created_at)
      if (!dayMap.has(key)) continue
      const row = dayMap.get(key)
      const cost = Number(r.cost_usd) || 0
      const ratio =
        (r.tokens_in || 0) + (r.tokens_out || 0) > 0
          ? (r.tokens_in || 0) / ((r.tokens_in || 0) + (r.tokens_out || 0))
          : 0.5
      row.tokens_in_cost += cost * ratio
      row.tokens_out_cost += cost * (1 - ratio)
      row.cost += cost
    }
    const daily = Array.from(dayMap.values())

    // Top clients
    const byClient = new Map()
    for (const r of runs) {
      if (!r.client_id) continue
      const row =
        byClient.get(r.client_id) || {
          client_id: r.client_id,
          brand_name: r.clients?.brand_name || '—',
          cost: 0,
          runs: 0,
          tokens: 0,
        }
      row.cost += Number(r.cost_usd) || 0
      row.runs += 1
      row.tokens += (r.tokens_in || 0) + (r.tokens_out || 0)
      byClient.set(r.client_id, row)
    }
    const topClients = Array.from(byClient.values())
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10)

    // Top playbooks
    const byPb = new Map()
    for (const r of runs) {
      if (!r.playbook_id) continue
      const row =
        byPb.get(r.playbook_id) || {
          playbook_id: r.playbook_id,
          cost: 0,
          runs: 0,
          tokens: 0,
        }
      row.cost += Number(r.cost_usd) || 0
      row.runs += 1
      row.tokens += (r.tokens_in || 0) + (r.tokens_out || 0)
      byPb.set(r.playbook_id, row)
    }
    const topPlaybooks = Array.from(byPb.values())
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5)

    return {
      totalIn,
      totalOut,
      totalCost,
      projection,
      daily,
      topClients,
      topPlaybooks,
      hasCostData: runs.some((r) => r.cost_usd != null && Number(r.cost_usd) > 0),
    }
  }, [runs])

  const showEmpty = !isLoading && !aggregates.hasCostData

  return (
    <div className="space-y-0">
      <PageHeader
        title="Consommation Claude"
        subtitle={`Tokens & coût sur les ${DAYS} derniers jours`}
      />

      <div className="p-6 space-y-6">
        <KpiRow>
          <KpiCard
            label="Tokens IN 30j"
            value={fmtInt(aggregates.totalIn)}
            icon={ArrowDownCircle}
            color="info"
          />
          <KpiCard
            label="Tokens OUT 30j"
            value={fmtInt(aggregates.totalOut)}
            icon={ArrowUpCircle}
            color="brand"
          />
          <KpiCard
            label="Coût 30j"
            value={fmtUsd(aggregates.totalCost)}
            icon={DollarSign}
            color="warning"
          />
          <KpiCard
            label="Projection fin de mois"
            value={fmtUsd(aggregates.projection)}
            icon={TrendingUp}
            color="success"
          />
        </KpiRow>

        {showEmpty && (
          <SectionCard title="Données" icon={Coins}>
            <EmptyState
              icon={Coins}
              title="Aucune donnée de coût encore"
              description="Les colonnes tokens_in, tokens_out et cost_usd sur engine_runs_v2 ne sont pas encore remplies. Active le logging côté Brain pour voir ces stats se remplir."
            />
          </SectionCard>
        )}

        {!showEmpty && (
          <>
            <SectionCard title="Évolution quotidienne" icon={TrendingUp}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={aggregates.daily}>
                    <defs>
                      <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0F5F35" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0F5F35" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      stroke="#9ca3af"
                      style={{ fontSize: 10 }}
                      tickFormatter={(v) => v.slice(5)}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      style={{ fontSize: 10 }}
                      tickFormatter={(v) => `$${v.toFixed(0)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 11,
                        borderRadius: 8,
                        border: '1px solid #f0f0f0',
                      }}
                      formatter={(v) => [fmtUsd(v), '']}
                    />
                    <Area
                      type="monotone"
                      dataKey="tokens_in_cost"
                      stackId="1"
                      stroke="#3b82f6"
                      fill="url(#gIn)"
                      name="Tokens IN"
                    />
                    <Area
                      type="monotone"
                      dataKey="tokens_out_cost"
                      stackId="1"
                      stroke="#0F5F35"
                      fill="url(#gOut)"
                      name="Tokens OUT"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Top 10 clients par coût" icon={Package}>
              {aggregates.topClients.length === 0 ? (
                <EmptyState icon={Package} title="Pas de runs" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-[#9ca3af] border-b border-[#f0f0f0]">
                        <th className="py-2 pr-3">#</th>
                        <th className="py-2 pr-3">Client</th>
                        <th className="py-2 pr-3 text-right">Coût total</th>
                        <th className="py-2 pr-3 text-right">Runs</th>
                        <th className="py-2 pr-3 text-right">Coût/run</th>
                        <th className="py-2 pr-3 text-right">Tokens/run</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aggregates.topClients.map((c, idx) => (
                        <tr
                          key={c.client_id}
                          className="border-b border-[#f0f0f0] last:border-b-0 hover:bg-[#fafafa]"
                        >
                          <td className="py-2 pr-3 text-[#9ca3af] tabular-nums">{idx + 1}</td>
                          <td className="py-2 pr-3 font-medium text-[#1a1a1a]">{c.brand_name}</td>
                          <td className="py-2 pr-3 text-right tabular-nums font-semibold text-[#1a1a1a]">
                            {fmtUsd(c.cost)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-[#71717a]">
                            {fmtInt(c.runs)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-[#71717a]">
                            {fmtUsd(c.runs > 0 ? c.cost / c.runs : 0)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-[#71717a]">
                            {fmtInt(c.runs > 0 ? Math.round(c.tokens / c.runs) : 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Top 5 playbooks par coût" icon={BookOpen}>
              {aggregates.topPlaybooks.length === 0 ? (
                <EmptyState icon={BookOpen} title="Pas de playbook loggé" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-[#9ca3af] border-b border-[#f0f0f0]">
                        <th className="py-2 pr-3">#</th>
                        <th className="py-2 pr-3">Playbook</th>
                        <th className="py-2 pr-3 text-right">Coût</th>
                        <th className="py-2 pr-3 text-right">Runs</th>
                        <th className="py-2 pr-3 text-right">Coût/run</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aggregates.topPlaybooks.map((p, idx) => (
                        <tr
                          key={p.playbook_id}
                          className="border-b border-[#f0f0f0] last:border-b-0 hover:bg-[#fafafa]"
                        >
                          <td className="py-2 pr-3 text-[#9ca3af] tabular-nums">{idx + 1}</td>
                          <td className="py-2 pr-3 font-mono text-[#1a1a1a]">
                            {p.playbook_id}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums font-semibold text-[#1a1a1a]">
                            {fmtUsd(p.cost)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-[#71717a]">
                            {fmtInt(p.runs)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-[#71717a]">
                            {fmtUsd(p.runs > 0 ? p.cost / p.runs : 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </>
        )}
      </div>
    </div>
  )
}

export default AdminTokensView
