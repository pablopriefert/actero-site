import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ShieldCheck,
  Flag,
  Percent,
  Sparkles,
  ChevronDown,
  ChevronRight,
  BarChart3,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../ui/PageHeader'
import { SectionCard } from '../ui/SectionCard'
import { KpiCard, KpiRow } from '../ui/KpiCard'
import { StatusPill } from '../ui/StatusPill'
import { EmptyState } from '../ui/EmptyState'
import { ListItem } from '../ui/ListItem'

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const s = Math.floor(diff / 1000)
  if (s < 60) return `il y a ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  return `il y a ${Math.floor(h / 24)}j`
}

function pillVariantFor(score) {
  if (score == null) return 'neutral'
  if (score < 0.4) return 'danger'
  if (score < 0.6) return 'warning'
  if (score < 0.8) return 'info'
  return 'success'
}

export function AdminHallucinationView() {
  const [expandedId, setExpandedId] = useState(null)

  // Aggregates from all runs with a rag score (limited window)
  const { data: scoredRuns = [], isLoading: loadingAll } = useQuery({
    queryKey: ['admin-halluc-all'],
    queryFn: async () => {
      const since = new Date()
      since.setDate(since.getDate() - 30)
      const { data, error } = await supabase
        .from('engine_runs_v2')
        .select('id, rag_check_score, rag_check_flagged, created_at')
        .not('rag_check_score', 'is', null)
        .gte('created_at', since.toISOString())
        .limit(5000)
      if (error) throw error
      return data || []
    },
  })

  // Flagged runs with details
  const { data: flaggedRuns = [], isLoading: loadingFlagged } = useQuery({
    queryKey: ['admin-halluc-flagged'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engine_runs_v2')
        .select(
          'id, classification, created_at, rag_check_score, rag_check_flagged, rag_check_details, clients(brand_name)'
        )
        .eq('rag_check_flagged', true)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data || []
    },
  })

  const kpis = useMemo(() => {
    const analyzed = scoredRuns.length
    const avg =
      analyzed > 0
        ? scoredRuns.reduce((s, r) => s + (Number(r.rag_check_score) || 0), 0) / analyzed
        : 0
    const flagged = scoredRuns.filter((r) => r.rag_check_flagged).length
    const rate = analyzed > 0 ? (flagged / analyzed) * 100 : 0
    return { analyzed, avg, flagged, rate }
  }, [scoredRuns])

  const histogram = useMemo(() => {
    const bins = [
      { name: '0.0–0.2', min: 0, max: 0.2, value: 0 },
      { name: '0.2–0.4', min: 0.2, max: 0.4, value: 0 },
      { name: '0.4–0.6', min: 0.4, max: 0.6, value: 0 },
      { name: '0.6–0.8', min: 0.6, max: 0.8, value: 0 },
      { name: '0.8–1.0', min: 0.8, max: 1.0001, value: 0 },
    ]
    for (const r of scoredRuns) {
      const s = Number(r.rag_check_score) || 0
      const bin = bins.find((b) => s >= b.min && s < b.max)
      if (bin) bin.value += 1
    }
    return bins
  }, [scoredRuns])

  const binColor = (idx) => {
    const palette = ['#ef4444', '#f59e0b', '#f59e0b', '#3b82f6', '#10b981']
    return palette[idx] || '#9ca3af'
  }

  const isLoading = loadingAll || loadingFlagged
  const noData = !isLoading && kpis.analyzed === 0

  return (
    <div className="space-y-0">
      <PageHeader
        title="Détecteur d'hallucinations"
        subtitle="Scoring RAG automatique des réponses IA"
      />

      <div className="p-6 space-y-6">
        <div className="rounded-xl border border-[#f0f0f0] bg-white p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0F5F35]/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-[#0F5F35]" />
          </div>
          <div className="text-[12px] text-[#71717a] leading-relaxed">
            Les réponses générées par le Brain sont scorées automatiquement contre la knowledge base du client. Un score faible indique un risque que l'IA invente des informations non présentes dans la base de connaissance.
          </div>
        </div>

        <KpiRow>
          <KpiCard
            label="Runs analysés 30j"
            value={kpis.analyzed.toLocaleString('fr-FR')}
            icon={ShieldCheck}
            color="info"
          />
          <KpiCard
            label="Score moyen"
            value={kpis.analyzed > 0 ? kpis.avg.toFixed(2) : '—'}
            icon={Sparkles}
            color="brand"
          />
          <KpiCard
            label="Runs flaggés"
            value={kpis.flagged.toLocaleString('fr-FR')}
            icon={Flag}
            color="danger"
          />
          <KpiCard
            label="Taux de flag"
            value={`${kpis.rate.toFixed(1)}%`}
            icon={Percent}
            color="warning"
          />
        </KpiRow>

        {noData && (
          <SectionCard title="Données" icon={ShieldCheck}>
            <EmptyState
              icon={ShieldCheck}
              title="Aucun run scoré"
              description="Le scoring RAG est calculé en temps réel par le Brain quand cette feature est activée au niveau du Logger. Si vous voyez 0 runs ici, la feature n'est pas encore activée."
            />
          </SectionCard>
        )}

        {!noData && (
          <>
            <SectionCard title="Runs flaggés récemment" icon={AlertTriangle}>
              {flaggedRuns.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="Aucun run flaggé"
                  description="Toutes les réponses IA passent le seuil de confiance RAG."
                />
              ) : (
                <div className="-mx-5">
                  {flaggedRuns.map((run) => {
                    const expanded = expandedId === run.id
                    const score = Number(run.rag_check_score) || 0
                    return (
                      <div key={run.id}>
                        <ListItem
                          icon={<AlertTriangle className="w-4 h-4 text-[#f59e0b]" />}
                          title={`${run.classification || 'run'} · ${run.clients?.brand_name || '—'}`}
                          subtitle={`Score: ${score.toFixed(2)} · ${timeAgo(run.created_at)}`}
                          meta={
                            <StatusPill variant={pillVariantFor(score)}>
                              {score.toFixed(2)}
                            </StatusPill>
                          }
                          action={
                            expanded ? (
                              <ChevronDown className="w-4 h-4 text-[#9ca3af]" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-[#9ca3af]" />
                            )
                          }
                          onClick={() => setExpandedId(expanded ? null : run.id)}
                        />
                        {expanded && (
                          <div className="bg-[#fafafa] px-5 py-4 border-b border-[#f0f0f0]">
                            <ExpandedRunDetails run={run} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Distribution des scores" icon={BarChart3}>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
                  <BarChart data={histogram}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: 11 }} />
                    <YAxis stroke="#9ca3af" style={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        fontSize: 11,
                        borderRadius: 8,
                        border: '1px solid #f0f0f0',
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {histogram.map((_, idx) => (
                        <Cell key={idx} fill={binColor(idx)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </>
        )}

        <div className="text-[11px] text-[#9ca3af] leading-relaxed">
          Note : le scoring RAG est calculé en temps réel par le Brain quand cette feature est activée. Si vous voyez 0 runs, la feature n'est pas encore activée au niveau du Logger.
        </div>
      </div>
    </div>
  )
}

function ExpandedRunDetails({ run }) {
  const details = run.rag_check_details || {}
  const sources = Array.isArray(details.sources) ? details.sources : []
  const missing = Array.isArray(details.missing_claims) ? details.missing_claims : []
  const reason = details.reason || details.explanation
  const responseText = details.response || details.response_text || ''

  return (
    <div className="space-y-3">
      {responseText && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-semibold mb-1">
            Réponse IA
          </div>
          <div className="rounded-lg border border-[#f0f0f0] bg-white p-3 text-[12px] text-[#1a1a1a] whitespace-pre-wrap leading-relaxed">
            {responseText}
          </div>
        </div>
      )}

      {reason && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-semibold mb-1">
            Raison du flag
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
            {reason}
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-semibold mb-1">
            Claims non couverts par la KB ({missing.length})
          </div>
          <ul className="space-y-1">
            {missing.map((c, i) => (
              <li
                key={i}
                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[12px] text-red-800"
              >
                {typeof c === 'string' ? c : JSON.stringify(c)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sources.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-semibold mb-1">
            Sources knowledge base ({sources.length})
          </div>
          <ul className="space-y-1">
            {sources.map((s, i) => (
              <li
                key={i}
                className="rounded-md border border-[#f0f0f0] bg-white px-2 py-1 text-[12px] text-[#1a1a1a]"
              >
                <span className="font-mono text-[11px] text-[#9ca3af] mr-2">
                  {typeof s.score === 'number' ? s.score.toFixed(2) : ''}
                </span>
                {s.title || s.text || s.url || JSON.stringify(s)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!responseText && !reason && missing.length === 0 && sources.length === 0 && (
        <div className="text-[11px] text-[#9ca3af]">
          Aucun détail structuré disponible pour ce run.
        </div>
      )}
    </div>
  )
}

export default AdminHallucinationView
