import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Webhook, Plus, Copy, Check, Eye, EyeOff, Trash2, Edit3,
  AlertCircle, CheckCircle2, X, Loader2, ExternalLink,
  Activity, RefreshCw, Clock
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const EVENT_CATALOG = [
  { id: 'ticket.resolved', label: 'Ticket résolu', group: 'Tickets' },
  { id: 'ticket.escalated', label: 'Ticket escaladé', group: 'Tickets' },
  { id: 'ticket.response_failed', label: 'Échec de réponse', group: 'Tickets' },
  { id: 'conversation.created', label: 'Nouvelle conversation', group: 'Conversations' },
  { id: 'conversation.sentiment_negative', label: 'Sentiment négatif', group: 'Conversations' },
  { id: 'usage.threshold_reached', label: 'Seuil de consommation atteint', group: 'Usage' },
  { id: 'integration.connected', label: 'Intégration connectée', group: 'Intégrations' },
  { id: 'integration.disconnected', label: 'Intégration déconnectée', group: 'Intégrations' },
  { id: 'playbook.activated', label: 'Playbook activé', group: 'Playbooks' },
]

const GROUPS = ['Tickets', 'Conversations', 'Usage', 'Intégrations', 'Playbooks']

export const WebhooksManager = ({ clientId }) => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [newSecret, setNewSecret] = useState(null) // shown once after creation

  const { data: webhooks = [], isLoading, error } = useQuery({
    queryKey: ['client-webhooks', clientId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/client/webhooks', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data.webhooks || []
    },
    enabled: !!clientId,
  })

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/client/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data.webhook
    },
    onSuccess: (wh) => {
      queryClient.invalidateQueries({ queryKey: ['client-webhooks'] })
      setShowCreate(false)
      if (wh?.secret) setNewSecret({ id: wh.id, secret: wh.secret, label: wh.label })
      toast.success('Webhook créé')
    },
    onError: (err) => toast.error(err.message),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/client/webhooks?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ is_active }),
      })
      if (!res.ok) throw new Error('Échec')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-webhooks'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/client/webhooks?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) throw new Error('Échec')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-webhooks'] })
      toast.success('Webhook supprimé')
    },
  })

  const copySecret = (secret, id) => {
    navigator.clipboard.writeText(secret)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success('Secret copié')
  }

  if (error?.message?.includes('Pro')) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
        <AlertCircle className="w-4 h-4 text-amber-500" />
        <span className="text-xs font-medium text-amber-700">Les webhooks sortants sont réservés au plan Pro</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#71717a]">
          {webhooks.length} webhook{webhooks.length > 1 ? 's' : ''} configuré{webhooks.length > 1 ? 's' : ''}
        </p>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F5F35] text-white text-xs font-semibold hover:bg-[#003725] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Nouveau webhook
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateWebhookForm
          onCancel={() => setShowCreate(false)}
          onSubmit={(payload) => createMutation.mutate(payload)}
          loading={createMutation.isPending}
        />
      )}

      {/* New secret banner (shown once after creation) */}
      {newSecret && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs font-bold text-amber-800 mb-1">⚠️ Copiez ce secret maintenant</p>
          <p className="text-[11px] text-amber-700 mb-2">
            Ce secret ne sera plus affiché. Utilisez-le pour vérifier la signature HMAC des webhooks de <strong>{newSecret.label}</strong>.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-white border border-amber-200 text-xs font-mono text-[#1a1a1a] truncate">
              {newSecret.secret}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newSecret.secret)
                toast.success('Secret copié')
              }}
              className="px-3 py-2 rounded-lg bg-[#0F5F35] text-white text-xs font-semibold hover:bg-[#003725]"
            >
              Copier
            </button>
            <button
              onClick={() => setNewSecret(null)}
              className="p-2 rounded-lg text-amber-700 hover:bg-amber-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="py-8 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#71717a]" />
        </div>
      ) : webhooks.length === 0 && !showCreate ? (
        <div className="py-8 text-center bg-gray-50 border border-gray-100 rounded-xl">
          <Webhook className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-[#1a1a1a]">Aucun webhook</p>
          <p className="text-xs text-[#71717a] mt-1">Créez votre premier webhook pour recevoir les événements en temps réel.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {webhooks.map((w) => (
            <WebhookRow
              key={w.id}
              webhook={w}
              expanded={expanded === w.id}
              onToggleExpand={() => setExpanded(expanded === w.id ? null : w.id)}
              onToggleActive={() => toggleMutation.mutate({ id: w.id, is_active: !w.is_active })}
              onDelete={() => window.confirm(`Supprimer ${w.label} ?`) && deleteMutation.mutate(w.id)}
              onCopySecret={(s) => copySecret(s, w.id)}
              copied={copiedId === w.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const CreateWebhookForm = ({ onCancel, onSubmit, loading }) => {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState([])

  const toggleEvent = (id) => {
    setEvents((e) => e.includes(id) ? e.filter(x => x !== id) : [...e, id])
  }

  const canSubmit = label.trim() && url.trim() && events.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="overflow-hidden"
    >
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div>
          <label className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Nom du webhook</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Sync Zapier, Relais CRM..."
            className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">URL de destination</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://hooks.zapier.com/..."
            className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20"
          />
          <p className="text-[10px] text-[#9ca3af] mt-1">HTTPS uniquement. Chaque appel sera signé HMAC-SHA256.</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Événements à écouter</label>
          <div className="mt-2 space-y-3">
            {GROUPS.map((group) => (
              <div key={group}>
                <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1.5">{group}</p>
                <div className="flex flex-wrap gap-1.5">
                  {EVENT_CATALOG.filter((e) => e.group === group).map((ev) => {
                    const checked = events.includes(ev.id)
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => toggleEvent(ev.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                          checked
                            ? 'bg-[#0F5F35]/5 border-[#0F5F35]/30 text-[#0F5F35]'
                            : 'bg-white border-gray-200 text-[#71717a] hover:border-gray-300'
                        }`}
                      >
                        {checked && <Check className="w-3 h-3" />}
                        <code className="font-mono">{ev.id}</code>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs text-[#71717a] hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => onSubmit({ label: label.trim(), url: url.trim(), events })}
            disabled={!canSubmit || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F5F35] text-white text-xs font-semibold hover:bg-[#003725] disabled:opacity-40 transition-colors"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Créer
          </button>
        </div>
      </div>
    </motion.div>
  )
}

const WebhookRow = ({ webhook, expanded, onToggleExpand, onToggleActive, onDelete, onCopySecret, copied }) => {
  const statusColor = !webhook.is_active
    ? 'text-gray-400 bg-gray-100'
    : webhook.last_delivery_status && webhook.last_delivery_status >= 200 && webhook.last_delivery_status < 300
    ? 'text-emerald-600 bg-emerald-50'
    : webhook.failure_count > 0
    ? 'text-amber-600 bg-amber-50'
    : 'text-blue-600 bg-blue-50'

  const [deliveries, setDeliveries] = React.useState(null)
  const [loadingDeliveries, setLoadingDeliveries] = React.useState(false)

  React.useEffect(() => {
    if (expanded && !deliveries) {
      setLoadingDeliveries(true)
      supabase.auth.getSession().then(({ data: { session } }) => {
        fetch(`/api/client/webhooks?id=${webhook.id}&deliveries=1`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        })
          .then((r) => r.json())
          .then((data) => setDeliveries(data.deliveries || []))
          .finally(() => setLoadingDeliveries(false))
      })
    }
  }, [expanded, webhook.id, deliveries])

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusColor}`}>
          <Webhook className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#1a1a1a] truncate">{webhook.label}</p>
          <p className="text-[11px] text-[#71717a] truncate font-mono">{webhook.url}</p>
        </div>
        <span className="text-[10px] text-[#9ca3af] hidden sm:inline">
          {webhook.events?.length || 0} event{(webhook.events?.length || 0) > 1 ? 's' : ''}
        </span>
        <button
          onClick={onToggleActive}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
            webhook.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
          }`}
        >
          {webhook.is_active ? 'Actif' : 'Inactif'}
        </button>
        <button
          onClick={onToggleExpand}
          className="p-2 rounded-lg hover:bg-gray-50 transition-colors"
          title="Détails"
        >
          <Activity className="w-4 h-4 text-[#71717a]" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-4 h-4 text-red-400" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50">
          <p className="text-[10px] text-[#9ca3af] italic">
            Le secret de signature (whsec_…) n'est affiché qu'à la création pour des raisons de sécurité.
          </p>

          {/* Events */}
          <div>
            <p className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider mb-1">Événements ({webhook.events?.length || 0})</p>
            <div className="flex flex-wrap gap-1">
              {(webhook.events || []).map((ev) => (
                <code key={ev} className="text-[10px] font-mono text-[#0F5F35] bg-[#0F5F35]/5 border border-[#0F5F35]/20 rounded px-1.5 py-0.5">{ev}</code>
              ))}
            </div>
          </div>

          {/* Recent deliveries */}
          <div>
            <p className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider mb-1">Livraisons récentes</p>
            {loadingDeliveries ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#71717a]" />
            ) : deliveries?.length ? (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {deliveries.slice(0, 10).map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-[11px] bg-white border border-gray-100 rounded px-2 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${d.succeeded ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {d.response_status || '—'}
                    </span>
                    <code className="text-[10px] text-[#71717a]">{d.event_type}</code>
                    <span className="ml-auto text-[10px] text-[#9ca3af]">
                      {new Date(d.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[#9ca3af]">Aucune livraison pour le moment.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
