import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Gauge, PauseCircle, TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { SectionCard } from '../ui/SectionCard'
import { StatusPill } from '../ui/StatusPill'
import { PLANS } from '../../lib/plans'

/**
 * AdminQuotaWatchPanel — qui approche (ou a atteint) son plafond de tickets.
 *
 * Depuis le passage en plafond strict, un client qui atteint son quota voit son
 * agent se mettre en pause. C'est à la fois un risque support (ses clients ne
 * sont plus répondus) et le meilleur signal d'upsell qui existe. Cette donnée
 * vivait uniquement dans `usage_counters` et n'était visible nulle part.
 *
 * Aucune donnée simulée : consommation réelle du mois en cours.
 */
const PLAN_LABELS = { free: 'Free', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' }

function ticketLimitFor(plan) {
  const limit = PLANS[plan]?.limits?.tickets_per_month
  return typeof limit === 'number' ? limit : null
}

export function AdminQuotaWatchPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-quota-watch'],
    queryFn: async () => {
      const period = new Date().toISOString().slice(0, 7)
      const [{ data: usage, error: usageError }, { data: clients }] = await Promise.all([
        supabase
          .from('usage_counters')
          .select('client_id, tickets_used, alerted_80_at, alerted_100_at')
          .eq('period', period),
        supabase.from('clients').select('id, brand_name, plan, status'),
      ])
      if (usageError) throw usageError

      const byClient = Object.fromEntries((usage || []).map((u) => [u.client_id, u]))
      const rows = (clients || [])
        .filter((c) => c.status !== 'canceled')
        .map((c) => {
          const u = byClient[c.id]
          const used = u?.tickets_used || 0
          const limit = ticketLimitFor(c.plan || 'free')
          const pct = limit && limit > 0 ? Math.round((used / limit) * 100) : null
          return {
            id: c.id,
            name: c.brand_name,
            plan: c.plan || 'free',
            used,
            limit,
            pct,
            paused: !!u?.alerted_100_at || (limit != null && used >= limit),
            warned: !!u?.alerted_80_at,
          }
        })
        .filter((r) => r.pct !== null && r.used > 0)
        .sort((a, b) => b.pct - a.pct)

      return { rows, period }
    },
    staleTime: 60_000,
  })

  const rows = data?.rows || []
  const paused = rows.filter((r) => r.paused)
  const atRisk = rows.filter((r) => !r.paused && r.pct >= 80)

  return (
    <SectionCard title="Quotas & upsell" icon={Gauge}>
      {isLoading && (
        <div className="space-y-2" aria-busy="true">
          <div className="h-10 rounded-xl bg-surface animate-pulse" />
          <div className="h-10 rounded-xl bg-surface animate-pulse" />
        </div>
      )}

      {!isLoading && error && (
        <p className="text-[13px] text-red-600">Impossible de charger la consommation.</p>
      )}

      {!isLoading && !error && rows.length === 0 && (
        <div className="text-center py-6">
          <Gauge className="w-6 h-6 text-[#d4d4d8] mx-auto mb-2" />
          <p className="text-[13px] font-semibold text-[#1a1a1a]">Aucune consommation ce mois-ci</p>
          <p className="text-[12px] text-[#9ca3af] mt-1">
            Les clients apparaîtront ici dès qu&apos;ils traiteront des tickets.
          </p>
        </div>
      )}

      {!isLoading && !error && rows.length > 0 && (
        <div className="space-y-4">
          {(paused.length > 0 || atRisk.length > 0) && (
            <div className="flex gap-2">
              {paused.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-2.5 py-1.5 text-[12px] font-semibold text-red-700">
                  <PauseCircle className="w-3.5 h-3.5" />
                  {paused.length} agent{paused.length > 1 ? 's' : ''} en pause
                </span>
              )}
              {atRisk.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[12px] font-semibold text-amber-800">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {atRisk.length} à surveiller (≥ 80 %)
                </span>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            {rows.slice(0, 8).map((r) => {
              const barColor = r.paused ? 'bg-red-500' : r.pct >= 80 ? 'bg-[#f59e0b]' : 'bg-cta'
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-[#f0f0f0] bg-white px-3.5 py-2.5">
                  <div className="min-w-0 w-40">
                    <p className="text-[13px] font-semibold text-[#1a1a1a] truncate">{r.name}</p>
                    <p className="text-[11px] text-[#9ca3af]">{PLAN_LABELS[r.plan] || r.plan}</p>
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, r.pct)}%` }} />
                  </div>
                  <span className="text-[12px] font-mono text-[#71717a] w-24 text-right tabular-nums">
                    {r.used}/{r.limit}
                  </span>
                  {r.paused ? (
                    <StatusPill variant="danger" size="sm">En pause</StatusPill>
                  ) : r.pct >= 80 ? (
                    <StatusPill variant="warning" size="sm">{r.pct}%</StatusPill>
                  ) : (
                    <StatusPill variant="neutral" size="sm">{r.pct}%</StatusPill>
                  )}
                </div>
              )
            })}
          </div>

          {rows.length > 8 && (
            <p className="text-[11px] text-[#9ca3af]">
              {rows.length - 8} autre{rows.length - 8 > 1 ? 's' : ''} client
              {rows.length - 8 > 1 ? 's' : ''} non affiché{rows.length - 8 > 1 ? 's' : ''}.
            </p>
          )}
        </div>
      )}
    </SectionCard>
  )
}
