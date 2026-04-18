import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bug, Loader2, RefreshCw, Check, Clock, AlertCircle, X, User,
  Globe, Monitor, ExternalLink, MessageSquare, Server
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const STATUS_CONFIG = {
  open: { label: 'Nouveau', color: 'text-red-600 bg-red-50 border-red-100', icon: AlertCircle },
  investigating: { label: 'En cours', color: 'text-amber-600 bg-amber-50 border-amber-100', icon: Clock },
  resolved: { label: 'Résolu', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: Check },
  closed: { label: 'Fermé', color: 'text-gray-500 bg-gray-100 border-gray-200', icon: X },
}

export const AdminErrorReportsView = () => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const { data: reports = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-error-reports', statusFilter],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : ''
      const res = await fetch(`/api/admin/error-reports${params}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data.reports || []
    },
    refetchInterval: 30000, // refresh every 30s
    staleTime: 0, // always consider data stale so manual refetch works
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/admin/error-reports?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data.report
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin-error-reports'] })
      if (selected?.id === updated.id) setSelected(updated)
      toast.success('Mis à jour')
    },
    onError: (err) => toast.error(err.message),
  })

  const counts = {
    all: reports.length,
    open: reports.filter(r => r.status === 'open').length,
    investigating: reports.filter(r => r.status === 'investigating').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1a1a1a] flex items-center gap-2">
            <Bug className="w-6 h-6 text-red-500" />
            Erreurs clients
          </h2>
          <p className="text-sm text-[#71717a] mt-1">
            Signalements envoyés par les clients depuis leur dashboard
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50 disabled:opacity-60 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Actualisation…' : 'Rafraîchir'}
        </button>
      </div>

      {/* Status filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { id: 'all', label: 'Tous', count: counts.all },
          { id: 'open', label: 'Nouveaux', count: counts.open },
          { id: 'investigating', label: 'En cours', count: counts.investigating },
          { id: 'resolved', label: 'Résolus', count: counts.resolved },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === f.id
                ? 'bg-cta text-white'
                : 'bg-white border border-gray-200 text-[#71717a] hover:border-gray-300'
            }`}
          >
            {f.label}
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
              statusFilter === f.id ? 'bg-white/20' : 'bg-gray-100'
            }`}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Reports table */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-[#71717a]" /></div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center">
            <Bug className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-[#1a1a1a]">Aucun signalement</p>
            <p className="text-xs text-[#71717a] mt-1">Les erreurs reportées par les clients apparaîtront ici.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reports.map((r) => {
              const conf = STATUS_CONFIG[r.status] || STATUS_CONFIG.open
              const StatusIcon = conf.icon
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="w-full text-left p-5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${conf.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {conf.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-[#1a1a1a]">{r.brand_name || r.user_email || 'Anonyme'}</p>
                        <span className="text-xs text-[#9ca3af]">·</span>
                        <span className="text-xs text-[#71717a]">
                          {new Date(r.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      <p className="text-sm text-[#4a4a4a] line-clamp-2">{r.description}</p>
                      {r.url && (
                        <p className="text-xs text-[#9ca3af] mt-1 truncate">
                          <Globe className="w-3 h-3 inline mr-1" />
                          {r.url.replace(/^https?:\/\//, '')}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <ReportDetail
            report={selected}
            onClose={() => setSelected(null)}
            onUpdate={(payload) => updateMutation.mutate({ id: selected.id, ...payload })}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

const ReportDetail = ({ report, onClose, onUpdate }) => {
  const [notes, setNotes] = useState(report.admin_notes || '')
  const [logs, setLogs] = useState(null)
  const [logsLoading, setLogsLoading] = useState(false)

  const fetchLogs = async () => {
    setLogsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      // Fetch logs in a ±5min window around the report creation
      const reported = new Date(report.created_at).getTime()
      const since = new Date(reported - 5 * 60 * 1000).toISOString()
      const until = new Date(reported + 5 * 60 * 1000).toISOString()
      const res = await fetch(`/api/admin/error-reports?vercel_logs=1&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const data = await res.json()
      setLogs(data)
    } catch (err) {
      setLogs({ error: err.message, logs: [] })
    }
    setLogsLoading(false)
  }

  const conf = STATUS_CONFIG[report.status] || STATUS_CONFIG.open
  const StatusIcon = conf.icon

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/40 z-50 flex items-stretch justify-end"
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white h-full overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${conf.color}`}>
              <StatusIcon className="w-3 h-3" />
              {conf.label}
            </span>
            <h3 className="text-base font-bold text-[#1a1a1a]">Signalement #{report.id.slice(0, 8)}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-[#71717a]" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <Field icon={User} label="Client" value={report.brand_name || '—'} />
            <Field icon={User} label="Utilisateur" value={report.user_email || '—'} />
            <Field icon={Clock} label="Envoyé" value={new Date(report.created_at).toLocaleString('fr-FR')} />
            <Field icon={Globe} label="URL" value={report.url || '—'} mono truncate />
          </div>

          {/* Description */}
          <div>
            <h4 className="text-xs font-semibold text-[#71717a] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Description du client
            </h4>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-[#1a1a1a] whitespace-pre-wrap leading-relaxed">
              {report.description}
            </div>
          </div>

          {/* Context */}
          {report.context && Object.keys(report.context).length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#71717a] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5" />
                Contexte technique
              </h4>
              <pre className="bg-[#18181b] text-[#a1a1aa] rounded-xl p-3 text-[11px] font-mono overflow-x-auto">
                {JSON.stringify(report.context, null, 2)}
              </pre>
            </div>
          )}

          {/* Vercel logs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-[#71717a] uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" />
                Logs Vercel (±5 min)
              </h4>
              <button
                onClick={fetchLogs}
                disabled={logsLoading}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-cta hover:bg-cta/5 transition-colors disabled:opacity-50"
              >
                {logsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                {logs ? 'Rafraîchir' : 'Charger'}
              </button>
            </div>
            {logs?.error && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                {logs.error}
              </div>
            )}
            {logs?.logs && logs.logs.length > 0 ? (
              <pre className="bg-[#18181b] text-[#a1a1aa] rounded-xl p-3 text-[11px] font-mono overflow-x-auto max-h-96">
                {logs.logs.map((l, i) => (
                  <div key={i} className="py-0.5 border-b border-white/5">
                    <span className="text-[#6b7280]">
                      {l.timestamp ? new Date(l.timestamp).toLocaleTimeString('fr-FR') : ''}
                    </span>
                    {' '}
                    <span className={l.level === 'error' ? 'text-red-400' : l.level === 'warning' ? 'text-amber-400' : ''}>
                      [{l.level || 'info'}]
                    </span>
                    {' '}
                    {l.message || l.payload?.text || JSON.stringify(l).slice(0, 200)}
                  </div>
                ))}
              </pre>
            ) : logs?.logs ? (
              <p className="text-xs text-[#9ca3af] italic">Aucun log dans cette fenêtre.</p>
            ) : null}
          </div>

          {/* Admin notes */}
          <div>
            <h4 className="text-xs font-semibold text-[#71717a] uppercase tracking-wider mb-2">Notes internes</h4>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (notes !== (report.admin_notes || '')) onUpdate({ admin_notes: notes })
              }}
              rows={3}
              placeholder="Investigation, diagnostic, résolution…"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cta/20"
            />
          </div>

          {/* Status actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => onUpdate({ status: 'investigating' })}
              disabled={report.status === 'investigating'}
              className="flex-1 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 disabled:opacity-50 transition-colors"
            >
              Marquer en cours
            </button>
            <button
              onClick={() => onUpdate({ status: 'resolved' })}
              disabled={report.status === 'resolved'}
              className="flex-1 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50 transition-colors"
            >
              Marquer résolu
            </button>
            <button
              onClick={() => onUpdate({ status: 'closed' })}
              disabled={report.status === 'closed'}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

const Field = ({ icon: Icon, label, value, mono, truncate }) => (
  <div>
    <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1 flex items-center gap-1">
      <Icon className="w-3 h-3" />
      {label}
    </p>
    <p className={`text-sm text-[#1a1a1a] ${mono ? 'font-mono' : ''} ${truncate ? 'truncate' : ''}`}>{value}</p>
  </div>
)
