import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Activity,
  AlertCircle,
  CreditCard,
  Users,
  Globe,
  FileText,
  TrendingUp,
  Zap,
  ExternalLink,
  Gauge,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../ui/PageHeader'
import { SectionCard } from '../ui/SectionCard'
import { KpiCard, KpiRow } from '../ui/KpiCard'
import { StatusPill } from '../ui/StatusPill'
import { EmptyState } from '../ui/EmptyState'
import { AdminClientQuickActions } from './AdminClientQuickActions'
import { AdminClientNotesPanel } from './AdminClientNotesPanel'

/**
 * Admin 360° view of a single client.
 *
 * URL: /admin/clients/:id (path resolved via querystring ?id=… for simplicity
 * since AdminDashboard uses a flat route map, not a real router).
 *
 * Sections:
 *  1. Header (brand, plan, status, quick actions)
 *  2. KPI strip (MRR, tickets, ROI, health)
 *  3. Recent runs (last 20)
 *  4. Recent escalations
 *  5. Notes (editable)
 *  6. Integrations connected
 */
/**
 * Backtest tickets card — triggers the DRY-RUN ticket backtest harness and
 * shows the latest result ("X% des N tickets passés auraient été résolus").
 */
function BacktestCard({ clientId }) {
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState(null)

  const { data: latest, refetch, isFetching } = useQuery({
    queryKey: ['admin-client-backtest', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const { data } = await supabase
        .from('ticket_backtests')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data || null
    },
    enabled: !!clientId,
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 5000 : false),
  })

  const handleLaunch = async () => {
    setLaunching(true)
    setLaunchError(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      const resp = await fetch('/api/jobs/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ client_id: clientId }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(json.error || `Erreur ${resp.status}`)
      }
      await refetch()
    } catch (err) {
      setLaunchError(err.message || 'Échec du lancement')
    } finally {
      setLaunching(false)
    }
  }

  const isRunning = latest?.status === 'running'
  const sample = Array.isArray(latest?.sample) ? latest.sample : []

  return (
    <SectionCard
      title="Backtest tickets"
      icon={Gauge}
      action={
        <button
          type="button"
          onClick={handleLaunch}
          disabled={launching || isRunning}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-[#003725] text-white text-[11px] font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {launching || isRunning ? 'En cours…' : 'Lancer le backtest'}
        </button>
      }
    >
      {!latest ? (
        <p className="text-[12px] text-[#71717a] py-2">
          Aucun backtest. Rejoue les tickets historiques importés en dry-run pour
          mesurer le taux de résolution d'Actero.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <StatusPill
              label={latest.status}
              tone={
                latest.status === 'completed'
                  ? 'ok'
                  : latest.status === 'failed'
                    ? 'danger'
                    : 'warn'
              }
            />
            {isFetching && (
              <span className="text-[10px] text-[#9ca3af]">actualisation…</span>
            )}
          </div>

          {latest.status === 'completed' && (
            <div className="rounded-lg bg-[#fdfcf7] border border-[#f0ead8] p-3">
              <p className="text-[22px] font-bold text-[#003725] tabular-nums">
                {Number(latest.resolution_rate ?? 0).toFixed(1)}%
              </p>
              <p className="text-[12px] text-[#71717a]">
                des {latest.total_tickets} tickets passés auraient été résolus
                par Actero
              </p>
              <p className="text-[11px] text-[#9ca3af] mt-1">
                {latest.would_resolve_count} résolus ·{' '}
                {latest.would_escalate_count} escaladés
              </p>
            </div>
          )}

          {latest.status === 'failed' && latest.error && (
            <p className="text-[11px] text-[#b91c1c] break-words">{latest.error}</p>
          )}

          {sample.length > 0 && (
            <ul className="divide-y divide-[#f0f0f0]">
              {sample.map((s, i) => (
                <li key={i} className="py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold text-[#9ca3af]">
                      {s.classification || '—'}
                    </span>
                    <StatusPill
                      label={s.would_resolve ? 'résolu' : 'escaladé'}
                      tone={s.would_resolve ? 'ok' : 'warn'}
                    />
                  </div>
                  <p className="text-[11px] text-[#71717a] truncate">{s.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {launchError && (
        <p className="text-[11px] text-[#b91c1c] mt-2">{launchError}</p>
      )}
    </SectionCard>
  )
}

/**
 * Widget Install QA card — triggers a headless storefront check (E2B sandbox)
 * that verifies the Actero chat widget is actually present & visible on the
 * client's live boutique, and shows the latest widget_health row.
 */
function relTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (Number.isNaN(diff)) return '—'
  const m = Math.round(diff / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `il y a ${h} h`
  const days = Math.round(h / 24)
  return `il y a ${days} j`
}

function WidgetQaCard({ clientId }) {
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState(null)

  const { data: latest, refetch, isFetching } = useQuery({
    queryKey: ['admin-client-widget-health', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const { data } = await supabase
        .from('widget_health')
        .select('*')
        .eq('client_id', clientId)
        .order('checked_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data || null
    },
    enabled: !!clientId,
    // Poll while a check is still pending (row not yet checked_at-stamped).
    refetchInterval: (q) =>
      q.state.data && !q.state.data.checked_at ? 5000 : false,
  })

  const handleLaunch = async () => {
    setLaunching(true)
    setLaunchError(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      const resp = await fetch('/api/jobs/widget-qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ client_id: clientId }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(json.error || `Erreur ${resp.status}`)
      }
      await refetch()
    } catch (err) {
      setLaunchError(err.message || 'Échec du lancement')
    } finally {
      setLaunching(false)
    }
  }

  const pending = latest && !latest.checked_at && !latest.error
  let variant = 'neutral'
  let StatusIcon = AlertTriangle
  let label = 'Non vérifié'
  if (latest?.error) {
    variant = 'danger'
    StatusIcon = XCircle
    label = 'Erreur'
  } else if (latest?.checked_at) {
    if (latest.widget_found && latest.widget_visible) {
      variant = 'success'
      StatusIcon = CheckCircle2
      label = 'Installé & visible'
    } else if (latest.widget_found) {
      variant = 'warning'
      StatusIcon = AlertTriangle
      label = 'Présent mais désactivé'
    } else {
      variant = 'warning'
      StatusIcon = AlertTriangle
      label = 'Introuvable'
    }
  }

  return (
    <SectionCard
      title="Widget installé ?"
      icon={Globe}
      action={
        <button
          type="button"
          onClick={handleLaunch}
          disabled={launching || pending}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-[#003725] text-white text-[11px] font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {launching || pending ? 'Vérification…' : 'Vérifier le widget'}
        </button>
      }
    >
      {!latest ? (
        <p className="text-[12px] text-[#71717a] py-2">
          Aucune vérification. Visite la boutique en ligne du client pour
          confirmer que le widget de chat Actero est bien présent et visible.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <StatusPill variant={variant} icon={StatusIcon}>
              {pending ? 'Vérification en cours…' : label}
            </StatusPill>
            {isFetching && (
              <span className="text-[10px] text-[#9ca3af]">actualisation…</span>
            )}
          </div>

          {latest.url_checked && (
            <p className="text-[11px] text-[#71717a] break-all">
              {latest.url_checked}
            </p>
          )}

          {latest.error && (
            <p className="text-[11px] text-[#b91c1c] break-words">
              {latest.error}
            </p>
          )}

          <p className="text-[11px] text-[#9ca3af]">
            {latest.checked_at
              ? `Vérifié ${relTime(latest.checked_at)}`
              : 'En attente du résultat…'}
          </p>
        </div>
      )}

      {launchError && (
        <p className="text-[11px] text-[#b91c1c] mt-2">{launchError}</p>
      )}
    </SectionCard>
  )
}

export function AdminClientDetailView() {
  // Client ID resolution: first try querystring, fallback to last segment of pathname.
  const clientId = useMemo(() => {
    if (typeof window === 'undefined') return null
    const search = new URLSearchParams(window.location.search)
    const qs = search.get('id') || search.get('client_id')
    if (qs) return qs
    const seg = window.location.pathname.split('/').filter(Boolean).pop()
    // UUID v4-ish heuristic
    if (seg && /^[0-9a-f-]{32,}$/i.test(seg)) return seg
    return null
  }, [])

  const { data: client, isLoading: clientLoading, refetch: refetchClient } = useQuery({
    queryKey: ['admin-client-detail', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!clientId,
  })

  const { data: kpis } = useQuery({
    queryKey: ['admin-client-kpis', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const { data } = await supabase
        .from('client_metrics_latest')
        .select('tickets_handled_month, time_saved_minutes, estimated_roi, active_automations, health_score, churn_risk')
        .eq('client_id', clientId)
        .maybeSingle()
      return data
    },
    enabled: !!clientId,
  })

  const { data: recentRuns = [] } = useQuery({
    queryKey: ['admin-client-runs', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data } = await supabase
        .from('engine_runs_v2')
        .select('id, playbook_slug, status, duration_ms, cost_usd, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(20)
      return data || []
    },
    enabled: !!clientId,
  })

  const { data: escalations = [] } = useQuery({
    queryKey: ['admin-client-escalations', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data } = await supabase
        .from('escalation_tickets')
        .select('id, subject, customer_email, status, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(10)
      return data || []
    },
    enabled: !!clientId,
  })

  const { data: integrations = [] } = useQuery({
    queryKey: ['admin-client-integrations', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data } = await supabase
        .from('client_integrations')
        .select('provider, provider_label, status, connected_at')
        .eq('client_id', clientId)
      return data || []
    },
    enabled: !!clientId,
  })

  const handleBack = () => {
    window.history.pushState({}, '', '/admin/clients')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  if (!clientId) {
    return (
      <div className="p-8">
        <EmptyState
          icon={AlertCircle}
          title="Aucun client sélectionné"
          description="Ouvrez ce panneau depuis la liste clients."
        />
      </div>
    )
  }

  if (clientLoading) {
    return <div className="p-12 text-center text-[#71717a] text-[13px]">Chargement…</div>
  }

  if (!client) {
    return (
      <div className="p-8">
        <EmptyState
          icon={AlertCircle}
          title="Client introuvable"
          description={`Aucun client avec l'ID ${clientId}`}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={client.brand_name || 'Client sans nom'}
        subtitle={
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill label={client.plan || 'free'} tone={client.plan === 'free' ? 'neutral' : 'ok'} />
            <StatusPill label={client.status || 'active'} tone={client.status === 'churned' ? 'danger' : client.status === 'trialing' ? 'warn' : 'ok'} />
            <span className="text-[11px] text-[#71717a]">
              {client.client_type || 'ecommerce'} · Créé {new Date(client.created_at).toLocaleDateString('fr-FR')}
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#f0f0f0] bg-white text-[12px] font-semibold hover:bg-[#fafafa]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Retour
            </button>
            <AdminClientQuickActions client={client} onAction={() => refetchClient()} />
          </div>
        }
      />

      <div className="px-6 space-y-4">
        {/* KPIs */}
        <KpiRow>
          <KpiCard label="MRR" value={`${(client.mrr || 0).toLocaleString('fr-FR')}€`} icon={CreditCard} />
          <KpiCard label="Tickets (mois)" value={kpis?.tickets_handled_month ?? '—'} icon={Activity} />
          <KpiCard label="ROI estimé" value={`${Math.round(kpis?.estimated_roi ?? 0)}€`} icon={TrendingUp} />
          <KpiCard
            label="Health score"
            value={kpis?.health_score != null ? `${kpis.health_score}/100` : '—'}
            icon={Zap}
          />
        </KpiRow>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Recent runs */}
            <SectionCard title="20 derniers runs" icon={Activity}>
              {recentRuns.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="Aucun run"
                  description="Ce client n'a pas encore exécuté l'agent."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead className="bg-[#fafafa] text-[#71717a] uppercase text-[10px] font-bold">
                      <tr>
                        <th className="text-left px-3 py-2">Quand</th>
                        <th className="text-left px-3 py-2">Playbook</th>
                        <th className="text-left px-3 py-2">Status</th>
                        <th className="text-right px-3 py-2">Durée</th>
                        <th className="text-right px-3 py-2">Coût</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRuns.map((r) => (
                        <tr key={r.id} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
                          <td className="px-3 py-2 text-[#71717a] whitespace-nowrap">{new Date(r.created_at).toLocaleString('fr-FR')}</td>
                          <td className="px-3 py-2 font-mono text-[11px]">{r.playbook_slug || '—'}</td>
                          <td className="px-3 py-2">
                            <StatusPill
                              label={r.status || 'unknown'}
                              tone={r.status === 'error' ? 'danger' : r.status === 'ok' ? 'ok' : 'neutral'}
                            />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.duration_ms ? `${Math.round(r.duration_ms)}ms` : '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(4)}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            {/* Recent escalations */}
            <SectionCard title="Escalades récentes" icon={AlertCircle}>
              {escalations.length === 0 ? (
                <p className="text-[12px] text-[#71717a] py-4 text-center">Aucune escalade.</p>
              ) : (
                <ul className="divide-y divide-[#f0f0f0]">
                  {escalations.map((e) => (
                    <li key={e.id} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[#1a1a1a] truncate">{e.subject || '(sans sujet)'}</p>
                        <p className="text-[11px] text-[#71717a]">
                          {e.customer_email} · {new Date(e.created_at).toLocaleString('fr-FR')}
                        </p>
                      </div>
                      <StatusPill label={e.status || 'open'} tone={e.status === 'resolved' ? 'ok' : 'warn'} />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          {/* Side column */}
          <div className="space-y-4">
            <SectionCard title="Infos" icon={Globe}>
              <dl className="text-[12px] space-y-2">
                <div>
                  <dt className="text-[10px] uppercase font-bold text-[#9ca3af]">Email contact</dt>
                  <dd className="text-[#1a1a1a]">{client.contact_email || '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase font-bold text-[#9ca3af]">Owner user id</dt>
                  <dd className="font-mono text-[11px] text-[#71717a] break-all">{client.owner_user_id || '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase font-bold text-[#9ca3af]">Stripe customer</dt>
                  <dd className="font-mono text-[11px] text-[#71717a] break-all">
                    {client.stripe_customer_id ? (
                      <a
                        href={`https://dashboard.stripe.com/customers/${client.stripe_customer_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-cta hover:underline"
                      >
                        {client.stripe_customer_id}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase font-bold text-[#9ca3af]">Trial ends</dt>
                  <dd className="text-[#1a1a1a]">
                    {client.trial_ends_at ? new Date(client.trial_ends_at).toLocaleDateString('fr-FR') : '—'}
                  </dd>
                </div>
              </dl>
            </SectionCard>

            <SectionCard title="Intégrations" icon={FileText}>
              {integrations.length === 0 ? (
                <p className="text-[12px] text-[#71717a]">Aucune intégration active.</p>
              ) : (
                <ul className="space-y-1.5">
                  {integrations.map((i) => (
                    <li key={i.provider} className="flex items-center justify-between text-[12px]">
                      <span className="font-medium text-[#1a1a1a]">{i.provider_label || i.provider}</span>
                      <StatusPill label={i.status} tone={i.status === 'active' ? 'ok' : 'warn'} />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <BacktestCard clientId={clientId} />

            <WidgetQaCard clientId={clientId} />

            <SectionCard title="Notes internes" icon={Users}>
              <AdminClientNotesPanel clientId={clientId} />
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminClientDetailView
