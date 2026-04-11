import React, { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bell,
  Plus,
  Pencil,
  Trash2,
  Play,
  X,
  AlertTriangle,
  Activity,
  Clock,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../ui/PageHeader'
import { SectionCard } from '../ui/SectionCard'
import { KpiCard, KpiRow } from '../ui/KpiCard'
import { StatusPill } from '../ui/StatusPill'
import { EmptyState } from '../ui/EmptyState'

const TRIGGER_TYPES = [
  { value: 'event_threshold', label: 'Seuil d\'events' },
  { value: 'client_metric', label: 'Métrique client' },
  { value: 'engine_error', label: 'Erreurs moteur' },
  { value: 'webhook_failure', label: 'Échec webhook' },
]

const EVENT_TYPE_OPTIONS = [
  'escalation_created',
  'widget_chat_started',
  'order_status',
  'refund_requested',
  'return_requested',
  'review_negative',
]

const METRIC_OPTIONS = [
  { value: 'health_score', label: 'Health score' },
  { value: 'csat', label: 'CSAT' },
  { value: 'escalation_rate', label: 'Taux d\'escalation' },
  { value: 'response_time_p95', label: 'Temps réponse P95' },
]

function timeAgo(iso) {
  if (!iso) return 'jamais'
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const s = Math.floor(diff / 1000)
  if (s < 60) return `il y a ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  return `il y a ${Math.floor(h / 24)}j`
}

function summarizeCondition(rule) {
  const c = rule.condition || {}
  switch (rule.trigger_type) {
    case 'event_threshold':
      return `Si ${c.threshold ?? '?'} events \`${c.event_type || '?'}\` en ${c.window_minutes ?? '?'} min → ${rule.slack_channel}`
    case 'client_metric':
      return `Si ${c.metric || '?'} ${c.operator || '?'} ${c.value ?? '?'} → ${rule.slack_channel}`
    case 'engine_error':
      return `Si taux d'erreur > ${c.threshold_pct ?? '?'}% sur ${c.window_hours ?? '?'}h → ${rule.slack_channel}`
    case 'webhook_failure':
      return `Si ${c.threshold ?? '?'} webhooks échoués en ${c.window_minutes ?? '?'} min → ${rule.slack_channel}`
    default:
      return rule.slack_channel || ''
  }
}

export function AdminAlertBuilderView() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState(null)

  const {
    data: rules = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin-alert-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_alert_rules')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const authFetch = useCallback(async (url, init = {}) => {
    const { data: { session } } = await supabase.auth.getSession()
    const headers = {
      'Content-Type': 'application/json',
      ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
      ...(init.headers || {}),
    }
    const resp = await fetch(url, { ...init, headers })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${resp.status}`)
    }
    return resp.json()
  }, [])

  const kpis = useMemo(() => {
    const active = rules.filter((r) => r.enabled).length
    const last = rules
      .map((r) => r.last_triggered_at)
      .filter(Boolean)
      .sort()
      .pop()
    const since24h = Date.now() - 24 * 3600 * 1000
    const triggers24h = rules.reduce((sum, r) => {
      if (r.last_triggered_at && new Date(r.last_triggered_at).getTime() >= since24h) {
        return sum + (r.last_24h_count || 1)
      }
      return sum
    }, 0)
    return { active, triggers24h, last }
  }, [rules])

  const openCreate = () => {
    setEditingRule(null)
    setModalOpen(true)
  }
  const openEdit = (rule) => {
    setEditingRule(rule)
    setModalOpen(true)
  }

  const handleToggle = async (rule) => {
    try {
      await authFetch('/api/admin/alert-rules', {
        method: 'PATCH',
        body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }),
      })
      await refetch()
    } catch (err) {
      alert(`Erreur: ${err.message}`)
    }
  }

  const handleDelete = async (rule) => {
    if (!confirm(`Supprimer l'alerte "${rule.name}" ?`)) return
    try {
      await authFetch(`/api/admin/alert-rules?id=${encodeURIComponent(rule.id)}`, {
        method: 'DELETE',
      })
      await refetch()
    } catch (err) {
      alert(`Erreur: ${err.message}`)
    }
  }

  const handleTest = (rule) => {
    alert(
      `Test d'alerte "${rule.name}"\n\nCondition: ${summarizeCondition(rule)}\n\n(L'exécution réelle sera branchée au cron une fois la feature activée.)`
    )
  }

  const handleSave = async (payload) => {
    if (editingRule?.id) {
      await authFetch('/api/admin/alert-rules', {
        method: 'PATCH',
        body: JSON.stringify({ id: editingRule.id, ...payload }),
      })
    } else {
      await authFetch('/api/admin/alert-rules', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    }
    setModalOpen(false)
    setEditingRule(null)
    await refetch()
  }

  return (
    <div className="space-y-0">
      <PageHeader
        title="Alertes Slack"
        subtitle="Builder de règles d'alerte routées vers Slack"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F5F35] text-white text-[12px] font-semibold hover:bg-[#0d5030]"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouvelle alerte
          </button>
        }
      />

      <div className="p-6 space-y-6">
        <KpiRow className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            label="Alertes actives"
            value={kpis.active}
            sublabel={`${rules.length} au total`}
            icon={Bell}
            color="brand"
          />
          <KpiCard
            label="Déclenchements 24h"
            value={kpis.triggers24h}
            icon={Activity}
            color="info"
          />
          <KpiCard
            label="Dernière alerte"
            value={kpis.last ? timeAgo(kpis.last) : '—'}
            icon={Clock}
            color="warning"
          />
        </KpiRow>

        {isLoading && (
          <div className="text-[12px] text-[#9ca3af] text-center py-8">Chargement…</div>
        )}

        {!isLoading && rules.length === 0 && (
          <SectionCard title="Règles configurées" icon={Bell}>
            <EmptyState
              icon={Bell}
              title="Aucune règle d'alerte"
              description="Crée ta première règle pour être notifié sur Slack quand un seuil est franchi."
              action={
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F5F35] text-white text-[12px] font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nouvelle alerte
                </button>
              }
            />
          </SectionCard>
        )}

        {!isLoading && rules.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {rules.map((rule) => (
              <SectionCard
                key={rule.id}
                title={rule.name}
                icon={Bell}
                action={
                  <div className="flex items-center gap-2">
                    <StatusPill variant={rule.enabled ? 'success' : 'neutral'}>
                      {rule.enabled ? 'Active' : 'Inactive'}
                    </StatusPill>
                    <button
                      type="button"
                      onClick={() => handleToggle(rule)}
                      className="text-[11px] font-semibold text-[#0F5F35] hover:underline"
                    >
                      {rule.enabled ? 'Désactiver' : 'Activer'}
                    </button>
                  </div>
                }
              >
                <div className="space-y-3">
                  {rule.description && (
                    <p className="text-[12px] text-[#71717a] leading-relaxed">
                      {rule.description}
                    </p>
                  )}
                  <div className="rounded-lg bg-[#fafafa] border border-[#f0f0f0] px-3 py-2 font-mono text-[11px] text-[#1a1a1a]">
                    {summarizeCondition(rule)}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#9ca3af]">
                    <div>Cooldown: {rule.cooldown_min ?? 15} min</div>
                    <div>Dernière: {timeAgo(rule.last_triggered_at)}</div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleTest(rule)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#f0f0f0] text-[11px] font-semibold text-[#1a1a1a] hover:bg-[#fafafa]"
                    >
                      <Play className="w-3 h-3" /> Tester
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(rule)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#f0f0f0] text-[11px] font-semibold text-[#1a1a1a] hover:bg-[#fafafa]"
                    >
                      <Pencil className="w-3 h-3" /> Éditer
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(rule)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-red-200 text-[11px] font-semibold text-[#ef4444] hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3" /> Supprimer
                    </button>
                  </div>
                </div>
              </SectionCard>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-800 leading-relaxed">
            Note : ce builder crée et stocke les règles. L'exécution effective (cron qui check les règles et envoie Slack) sera branchée dans une phase suivante.
          </div>
        </div>
      </div>

      {modalOpen && (
        <AlertRuleModal
          initial={editingRule}
          onClose={() => {
            setModalOpen(false)
            setEditingRule(null)
          }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

/* -------------------- Modal -------------------- */

function AlertRuleModal({ initial, onClose, onSave }) {
  const isEdit = !!initial?.id
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [triggerType, setTriggerType] = useState(initial?.trigger_type || 'event_threshold')
  const [condition, setCondition] = useState(
    initial?.condition || defaultConditionFor('event_threshold')
  )
  const [slackChannel, setSlackChannel] = useState(initial?.slack_channel || '#ops')
  const [cooldownMin, setCooldownMin] = useState(initial?.cooldown_min ?? 15)
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleTypeChange = (val) => {
    setTriggerType(val)
    setCondition(defaultConditionFor(val))
  }

  const preview = useMemo(
    () =>
      summarizeCondition({
        trigger_type: triggerType,
        condition,
        slack_channel: slackChannel,
      }),
    [triggerType, condition, slackChannel]
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!name.trim() || !slackChannel.trim()) {
      setError('Nom et channel Slack requis')
      return
    }
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        trigger_type: triggerType,
        condition,
        slack_channel: slackChannel.trim(),
        cooldown_min: Number(cooldownMin) || 15,
        enabled,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-[#f0f0f0] shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
          <div className="text-[14px] font-semibold text-[#1a1a1a]">
            {isEdit ? 'Éditer l\'alerte' : 'Nouvelle alerte Slack'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[#fafafa] text-[#9ca3af]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Nom de l'alerte">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Burst d'escalations"
              className="w-full rounded-lg border border-[#f0f0f0] bg-white px-3 py-2 text-[13px] text-[#1a1a1a] focus:outline-none focus:border-[#0F5F35]/40"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Contexte / pourquoi cette alerte"
              className="w-full resize-none rounded-lg border border-[#f0f0f0] bg-white px-3 py-2 text-[13px] text-[#1a1a1a] focus:outline-none focus:border-[#0F5F35]/40"
            />
          </Field>

          <Field label="Type de trigger">
            <select
              value={triggerType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full rounded-lg border border-[#f0f0f0] bg-white px-3 py-2 text-[13px] text-[#1a1a1a] focus:outline-none focus:border-[#0F5F35]/40"
            >
              {TRIGGER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <ConditionFields
            type={triggerType}
            value={condition}
            onChange={setCondition}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Channel Slack">
              <input
                type="text"
                value={slackChannel}
                onChange={(e) => setSlackChannel(e.target.value)}
                placeholder="#ops"
                className="w-full rounded-lg border border-[#f0f0f0] bg-white px-3 py-2 text-[13px] text-[#1a1a1a] focus:outline-none focus:border-[#0F5F35]/40"
              />
            </Field>
            <Field label="Cooldown (min)">
              <input
                type="number"
                min={1}
                value={cooldownMin}
                onChange={(e) => setCooldownMin(e.target.value)}
                className="w-full rounded-lg border border-[#f0f0f0] bg-white px-3 py-2 text-[13px] text-[#1a1a1a] focus:outline-none focus:border-[#0F5F35]/40"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-[12px] text-[#1a1a1a]">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded"
            />
            Activer immédiatement
          </label>

          <div className="rounded-lg bg-[#0F5F35]/5 border border-[#0F5F35]/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-[#0F5F35] font-semibold mb-1">
              Preview
            </div>
            <div className="text-[12px] text-[#1a1a1a] font-mono">{preview}</div>
          </div>

          {error && (
            <div className="text-[12px] text-[#ef4444]">{error}</div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f0f0f0]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#71717a] hover:bg-[#fafafa]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-[#0F5F35] text-white text-[12px] font-semibold disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-[#71717a] uppercase tracking-wider mb-1">
        {label}
      </div>
      {children}
    </div>
  )
}

function defaultConditionFor(type) {
  switch (type) {
    case 'event_threshold':
      return { event_type: 'escalation_created', threshold: 10, window_minutes: 60 }
    case 'client_metric':
      return { metric: 'health_score', operator: '<', value: 50 }
    case 'engine_error':
      return { threshold_pct: 10, window_hours: 1 }
    case 'webhook_failure':
      return { threshold: 5, window_minutes: 30 }
    default:
      return {}
  }
}

function ConditionFields({ type, value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch })
  const inputCls =
    'w-full rounded-lg border border-[#f0f0f0] bg-white px-3 py-2 text-[13px] text-[#1a1a1a] focus:outline-none focus:border-[#0F5F35]/40'

  if (type === 'event_threshold') {
    return (
      <div className="grid grid-cols-3 gap-3">
        <Field label="Event type">
          <select
            value={value.event_type || ''}
            onChange={(e) => set({ event_type: e.target.value })}
            className={inputCls}
          >
            {EVENT_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Seuil">
          <input
            type="number"
            min={1}
            value={value.threshold ?? ''}
            onChange={(e) => set({ threshold: Number(e.target.value) })}
            className={inputCls}
          />
        </Field>
        <Field label="Fenêtre (min)">
          <input
            type="number"
            min={1}
            value={value.window_minutes ?? ''}
            onChange={(e) => set({ window_minutes: Number(e.target.value) })}
            className={inputCls}
          />
        </Field>
      </div>
    )
  }

  if (type === 'client_metric') {
    return (
      <div className="grid grid-cols-3 gap-3">
        <Field label="Metric">
          <select
            value={value.metric || ''}
            onChange={(e) => set({ metric: e.target.value })}
            className={inputCls}
          >
            {METRIC_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Opérateur">
          <select
            value={value.operator || '<'}
            onChange={(e) => set({ operator: e.target.value })}
            className={inputCls}
          >
            <option value="<">{'<'}</option>
            <option value=">">{'>'}</option>
            <option value="=">=</option>
          </select>
        </Field>
        <Field label="Valeur">
          <input
            type="number"
            value={value.value ?? ''}
            onChange={(e) => set({ value: Number(e.target.value) })}
            className={inputCls}
          />
        </Field>
      </div>
    )
  }

  if (type === 'engine_error') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="Seuil (%)">
          <input
            type="number"
            min={0}
            max={100}
            value={value.threshold_pct ?? ''}
            onChange={(e) => set({ threshold_pct: Number(e.target.value) })}
            className={inputCls}
          />
        </Field>
        <Field label="Fenêtre (h)">
          <input
            type="number"
            min={1}
            value={value.window_hours ?? ''}
            onChange={(e) => set({ window_hours: Number(e.target.value) })}
            className={inputCls}
          />
        </Field>
      </div>
    )
  }

  if (type === 'webhook_failure') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="Seuil">
          <input
            type="number"
            min={1}
            value={value.threshold ?? ''}
            onChange={(e) => set({ threshold: Number(e.target.value) })}
            className={inputCls}
          />
        </Field>
        <Field label="Fenêtre (min)">
          <input
            type="number"
            min={1}
            value={value.window_minutes ?? ''}
            onChange={(e) => set({ window_minutes: Number(e.target.value) })}
            className={inputCls}
          />
        </Field>
      </div>
    )
  }

  return null
}

export default AdminAlertBuilderView
