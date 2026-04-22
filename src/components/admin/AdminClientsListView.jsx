import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Users,
  Activity,
  DollarSign,
  UserPlus,
  Plus,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  X,
  Building2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import { PageHeader } from '../ui/PageHeader'
import { KpiCard, KpiRow } from '../ui/KpiCard'
import { SectionCard } from '../ui/SectionCard'
import { SearchInput } from '../ui/SearchInput'
import { StatusPill } from '../ui/StatusPill'
import { EmptyState } from '../ui/EmptyState'
import { ExportCsvButton } from '../ui/ExportCsvButton'
import { AdminClientQuickActions } from './AdminClientQuickActions'

const FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'active', label: 'Actifs' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'churned', label: 'Churned' },
  { id: 'at_risk', label: 'À risque' },
]

const STATUS_VARIANTS = {
  active: 'success',
  onboarding: 'info',
  churned: 'danger',
  at_risk: 'warning',
  paused: 'warning',
}

const STATUS_LABEL = {
  active: 'Actif',
  onboarding: 'Onboarding',
  churned: 'Churned',
  at_risk: 'À risque',
  paused: 'En pause',
}

/**
 * AdminClientsListView — Liste clients enrichie pour admin.
 * B1: filtres + tri + KPIs globaux.
 * B7: quick actions par ligne (via AdminClientQuickActions).
 */
export function AdminClientsListView() {
  const toast = useToast()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState({ col: 'created_at', dir: 'desc' })
  const [showAddModal, setShowAddModal] = useState(false)

  // KPI state (global)
  const [kpi, setKpi] = useState({
    total: 0,
    active7d: 0,
    mrr: 0,
    new30d: 0,
  })

  const loadClients = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1) Base clients
      const { data: rows, error: cErr } = await supabase
        .from('clients')
        .select('id, brand_name, contact_email, created_at, status, client_type, plan, owner_user_id')
        .order('created_at', { ascending: false })
      if (cErr) throw cErr
      const baseClients = rows || []

      const ids = baseClients.map((c) => c.id)

      // 2) Engine runs 7j (last activity + count per client)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      let runMap = {}
      if (ids.length > 0) {
        const { data: runs } = await supabase
          .from('engine_runs_v2')
          .select('client_id, created_at')
          .in('client_id', ids)
          .gte('created_at', sevenDaysAgo)
        ;(runs || []).forEach((r) => {
          const prev = runMap[r.client_id]
          if (!prev || new Date(r.created_at) > new Date(prev.last)) {
            runMap[r.client_id] = {
              count: (prev?.count || 0) + 1,
              last: r.created_at,
            }
          } else {
            runMap[r.client_id] = {
              count: (prev?.count || 0) + 1,
              last: prev.last,
            }
          }
        })
      }

      // 3) Client settings (whatsapp/voice agent flags)
      let settingsMap = {}
      if (ids.length > 0) {
        const { data: settings } = await supabase
          .from('client_settings')
          .select('client_id, whatsapp_agent_enabled, voice_agent_enabled')
          .in('client_id', ids)
        ;(settings || []).forEach((s) => {
          settingsMap[s.client_id] = s
        })
      }

      // 4) Escalades (table reelle = escalation_tickets)
      let escalationMap = {}
      if (ids.length > 0) {
        const { data: esc, error: escErr } = await supabase
          .from('escalation_tickets')
          .select('client_id')
          .in('client_id', ids)
        if (escErr) {
          console.warn('[AdminClientsListView] escalation_tickets load failed:', escErr)
        }
        ;(esc || []).forEach((e) => {
          escalationMap[e.client_id] = (escalationMap[e.client_id] || 0) + 1
        })
      }

      // Enrichissement final
      const enriched = baseClients.map((c) => {
        const runs = runMap[c.id]
        const settings = settingsMap[c.id]
        return {
          ...c,
          agent_enabled: settings?.whatsapp_agent_enabled || settings?.voice_agent_enabled || false,
          last_activity_at: runs?.last || null,
          runs_7d: runs?.count || 0,
          escalations_count: escalationMap[c.id] || 0,
          // health score placeholder 0-100
          health_score: computeHealthScore({
            runs7d: runs?.count || 0,
            escalations: escalationMap[c.id] || 0,
            status: c.status,
            lastActivity: runs?.last || null,
          }),
        }
      })

      setClients(enriched)
    } catch (err) {
      console.error('[AdminClientsListView] load error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadKpi = useCallback(async () => {
    try {
      // Total + new 30d from clients
      const { count: total } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { count: new30d } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo)

      // Active 7d = distinct client_id with a run in last 7d
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: activeRuns } = await supabase
        .from('engine_runs_v2')
        .select('client_id')
        .gte('created_at', sevenDaysAgo)
      const activeSet = new Set((activeRuns || []).map((r) => r.client_id))

      // MRR from v_admin_mrr_snapshot (sum if table has multiple rows) — fall back to 0
      let mrr = 0
      try {
        const { data: mrrRows } = await supabase
          .from('v_admin_mrr_snapshot')
          .select('mrr')
        if (Array.isArray(mrrRows) && mrrRows.length > 0) {
          mrr = mrrRows.reduce((acc, r) => acc + Number(r.mrr || 0), 0)
        }
      } catch {
        /* view may not exist yet */
      }

      setKpi({
        total: total || 0,
        active7d: activeSet.size,
        mrr,
        new30d: new30d || 0,
      })
    } catch (err) {
      console.error('[AdminClientsListView] kpi error:', err)
    }
  }, [])

  useEffect(() => {
    loadClients()
    loadKpi()
  }, [loadClients, loadKpi])

  const filteredSorted = useMemo(() => {
    let rows = [...clients]

    // Filter preset
    // Note: 'at_risk' n'existe pas dans clients.status (enum DB).
    // On le calcule cote client via health_score < 50.
    if (filter === 'at_risk') {
      rows = rows.filter((r) => typeof r.health_score === 'number' && r.health_score < 50)
    } else if (filter !== 'all') {
      rows = rows.filter((r) => (r.status || 'active') === filter)
    }

    // Search
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (r) =>
          (r.brand_name || '').toLowerCase().includes(q) ||
          (r.contact_email || '').toLowerCase().includes(q)
      )
    }

    // Sort
    rows.sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1
      const av = a[sort.col]
      const bv = b[sort.col]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })

    return rows
  }, [clients, filter, search, sort])

  const handleSort = (col) => {
    setSort((prev) => {
      if (prev.col === col) return { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      return { col, dir: 'asc' }
    })
  }

  const handleRowClick = (client) => {
    // Navigate to the 360° detail view. Must dispatch popstate so the
    // AdminDashboard router picks up the new path and swaps the tab.
    if (window.location.pathname.startsWith('/admin')) {
      window.history.pushState({}, '', `/admin/clients/${client.id}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} clients au total`}
        actions={
          <div className="flex items-center gap-2">
            <ExportCsvButton
              filename="actero-clients"
              rows={clients}
              columns={[
                { key: 'brand_name', label: 'Brand' },
                { key: 'contact_email', label: 'Email' },
                { key: 'plan', label: 'Plan' },
                { key: 'status', label: 'Status' },
                { key: 'client_type', label: 'Type' },
                { key: 'mrr', label: 'MRR €' },
                { key: 'health_score', label: 'Health' },
                { key: 'trial_ends_at', label: 'Trial ends' },
                { key: 'created_at', label: 'Created' },
              ]}
            />
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-cta hover:bg-[#0a4a29] text-white text-[12px] font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter un client
            </button>
          </div>
        }
      />

      <div className="px-6 space-y-4">
        {/* KPIs */}
        <KpiRow>
          <KpiCard
            label="Total clients"
            value={kpi.total.toLocaleString('fr-FR')}
            icon={Users}
            color="brand"
            loading={loading && kpi.total === 0}
          />
          <KpiCard
            label="Actifs 7j"
            value={kpi.active7d.toLocaleString('fr-FR')}
            sublabel={kpi.total > 0 ? `${Math.round((kpi.active7d / kpi.total) * 100)}% de la base` : undefined}
            icon={Activity}
            color="success"
            loading={loading && kpi.active7d === 0}
          />
          <KpiCard
            label="MRR total"
            value={`${kpi.mrr.toLocaleString('fr-FR')} €`}
            icon={DollarSign}
            color="brand"
            loading={loading && kpi.mrr === 0}
          />
          <KpiCard
            label="Nouveaux 30j"
            value={kpi.new30d.toLocaleString('fr-FR')}
            icon={UserPlus}
            color="info"
            loading={loading && kpi.new30d === 0}
          />
        </KpiRow>

        {/* Search + filter pills */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1 max-w-md">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
              placeholder="Rechercher brand ou email..."
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTERS.map((f) => {
              const active = filter === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`inline-flex items-center h-7 px-2.5 rounded-full border text-[11px] font-semibold transition-all ${
                    active
                      ? 'bg-cta border-cta text-white'
                      : 'bg-white border-[#f0f0f0] text-[#71717a] hover:bg-[#fafafa] hover:text-[#1a1a1a]'
                  }`}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Table */}
        <SectionCard title="Liste clients" subtitle={`${filteredSorted.length} résultats`} padding="sm">
          {error ? (
            <EmptyState
              icon={AlertTriangle}
              title="Erreur de chargement"
              description={error}
            />
          ) : loading ? (
            <div className="py-12 text-center text-[12px] text-[#9ca3af]">Chargement…</div>
          ) : filteredSorted.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Aucun client"
              description="Aucun client ne correspond aux filtres actuels."
            />
          ) : (
            <div className="overflow-x-auto -mx-4">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 z-10 bg-[#fafafa] border-y border-[#f0f0f0]">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-[#9ca3af]">
                    <Th label="Logo" col={null} />
                    <Th label="Brand" col="brand_name" sort={sort} onSort={handleSort} />
                    <Th label="Email" col="contact_email" sort={sort} onSort={handleSort} />
                    <Th label="Plan" col="plan" sort={sort} onSort={handleSort} />
                    <Th label="MRR" col="plan" sort={sort} onSort={handleSort} align="right" />
                    <Th label="Health" col="health_score" sort={sort} onSort={handleSort} align="right" />
                    <Th label="Dernière activité" col="last_activity_at" sort={sort} onSort={handleSort} />
                    <Th label="Owner" col="owner_user_id" sort={sort} onSort={handleSort} />
                    <Th label="Status" col="status" sort={sort} onSort={handleSort} />
                    <Th label="" col={null} />
                  </tr>
                </thead>
                <tbody>
                  {filteredSorted.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => handleRowClick(c)}
                      className="border-b border-[#f0f0f0] hover:bg-[#fafafa] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <div className="w-7 h-7 rounded-lg bg-cta/10 flex items-center justify-center text-[11px] font-bold text-cta">
                          {initials(c.brand_name)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-[#1a1a1a] truncate max-w-[180px]">
                          {c.brand_name || '—'}
                        </div>
                        {c.client_type && (
                          <div className="text-[10px] text-[#9ca3af] truncate">{c.client_type}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[#71717a] truncate max-w-[180px]">{c.contact_email || '—'}</td>
                      <td className="px-4 py-2.5">
                        <PlanPill plan={c.plan} />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[#1a1a1a]">
                        {c.plan === 'starter' ? '99€' : c.plan === 'pro' ? '399€' : c.plan === 'enterprise' ? '999€+' : '0€'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <HealthDot score={c.health_score} />
                      </td>
                      <td className="px-4 py-2.5 text-[#71717a]">{formatRelative(c.last_activity_at)}</td>
                      <td className="px-4 py-2.5 text-[#71717a] truncate max-w-[120px]">
                        {c.owner_user_id ? c.owner_user_id.slice(0, 8) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill
                          variant={STATUS_VARIANTS[c.status] || 'neutral'}
                          dot
                        >
                          {STATUS_LABEL[c.status] || c.status || 'active'}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <AdminClientQuickActions
                          client={c}
                          onAction={(action) => {
                            // Refresh after mutation
                            if (['pause_agent', 'resume_agent', 'rotate_keys', 'delete_client', 'clear_memory'].includes(action)) {
                              loadClients()
                              loadKpi()
                            }
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {showAddModal && (
        <AddClientModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false)
            loadClients()
            loadKpi()
            toast.success('Client créé')
          }}
        />
      )}
    </div>
  )
}

/* -------------------- sub components -------------------- */

const PLAN_PILL_STYLES = {
  free: 'bg-gray-100 text-gray-600 border-gray-200',
  starter: 'bg-blue-50 text-blue-700 border-blue-200',
  pro: 'bg-emerald-50 text-cta border-emerald-200',
  enterprise: 'bg-amber-50 text-amber-700 border-amber-200',
}

function PlanPill({ plan }) {
  const p = plan || 'free'
  const style = PLAN_PILL_STYLES[p] || PLAN_PILL_STYLES.free
  return (
    <span className={`inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-bold uppercase ${style}`}>
      {p}
    </span>
  )
}

function Th({ label, col, sort, onSort, align = 'left' }) {
  const sortable = !!col && !!onSort
  const active = sort?.col === col
  return (
    <th
      scope="col"
      className={`px-4 py-2 font-semibold ${align === 'right' ? 'text-right' : 'text-left'} ${
        sortable ? 'cursor-pointer select-none hover:text-[#1a1a1a]' : ''
      }`}
      onClick={sortable ? () => onSort(col) : undefined}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        {sortable && active && (
          sort.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        )}
      </span>
    </th>
  )
}

function HealthDot({ score }) {
  if (score == null) return <span className="text-[#9ca3af]">—</span>
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums font-semibold text-[#1a1a1a]">
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {score}
    </span>
  )
}

function computeHealthScore({ runs7d, escalations, status, lastActivity }) {
  if (status === 'churned') return 0
  let score = 50
  score += Math.min(runs7d * 5, 40)
  score -= Math.min(escalations * 3, 30)
  if (!lastActivity) score -= 15
  return Math.max(0, Math.min(100, Math.round(score)))
}

function initials(name) {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')
}

function formatRelative(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'à l\'instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h}h`
  const days = Math.floor(h / 24)
  return `il y a ${days}j`
}

/* -------------------- Add client modal -------------------- */

function AddClientModal({ onClose, onCreated }) {
  const toast = useToast()
  const [brand, setBrand] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!brand.trim() || !email.trim()) {
      toast.error('Brand et email requis')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.from('clients').insert({
        brand_name: brand.trim(),
        contact_email: email.trim(),
        status: 'onboarding',
      })
      if (error) {
        console.error('[AdminClientsListView] insert client failed (RLS?):', error)
        throw error
      }
      onCreated?.()
    } catch (err) {
      toast.error(`Création : ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white border border-[#f0f0f0] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
          <div className="text-[14px] font-semibold text-[#1a1a1a]">Ajouter un client</div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-[#fafafa] text-[#9ca3af] hover:text-[#1a1a1a] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form className="p-5 space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="block text-[11px] font-semibold text-[#71717a] mb-1.5">
              Brand name
            </label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full h-9 px-3 rounded-xl bg-[#fafafa] border border-[#f0f0f0] text-[13px] text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-cta/20 focus:border-cta/30"
              placeholder="Acme Inc."
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#71717a] mb-1.5">
              Email de contact
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 px-3 rounded-xl bg-[#fafafa] border border-[#f0f0f0] text-[13px] text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-cta/20 focus:border-cta/30"
              placeholder="contact@acme.com"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3 rounded-lg text-[12px] font-semibold text-[#71717a] hover:bg-[#fafafa]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-9 px-4 rounded-lg bg-cta hover:bg-[#0a4a29] text-white text-[12px] font-semibold disabled:opacity-60"
            >
              {loading ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AdminClientsListView
