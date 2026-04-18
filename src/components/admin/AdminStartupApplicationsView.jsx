import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Rocket, Loader2, Check, X, ExternalLink, Mail, Calendar, Globe,
  DollarSign, FileText, Filter, Copy, CheckCircle2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * Admin Startup Applications — review incoming /startups applications.
 *
 * Features :
 *   - Stats pills (total / pending / accepted / rejected)
 *   - Status filter
 *   - Click application row -> detail panel with full info + actions
 *   - Accept -> Stripe promo code created + email sent via Resend
 *   - Reject -> email polite sent
 *   - Copy promo code button when accepted
 */

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token || ''}`,
  }
}

const STATUS_STYLES = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'En attente' },
  accepted: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Accepté' },
  rejected: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Refusé' },
}

export const AdminStartupApplicationsView = () => {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('pending')
  const [selected, setSelected] = useState(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [copied, setCopied] = useState(false)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-startup-applications', filter],
    queryFn: async () => {
      const url = filter === 'all'
        ? '/api/admin/startup-applications'
        : `/api/admin/startup-applications?status=${filter}`
      const res = await fetch(url, { headers: await authHeaders() })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur')
      return res.json()
    },
  })

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action, notes }) => {
      const res = await fetch('/api/admin/startup-applications', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ id, action, notes }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-startup-applications'] })
    },
  })

  const applications = data?.applications || []
  const stats = data?.stats || { total: 0, pending: 0, accepted: 0, rejected: 0 }

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* noop */ }
  }

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 pt-6 pb-16 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cta/10 flex items-center justify-center">
            <Rocket className="w-5 h-5 text-cta" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-[#1a1a1a] tracking-tight">Candidatures Startups</h1>
            <p className="text-[13px] text-[#71717a] mt-0.5">
              Programme Actero for Startups — review des candidatures à -50% pendant 6 mois.
            </p>
          </div>
        </div>
      </div>

      {/* Stats pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatPill label="Total" value={stats.total} />
        <StatPill label="En attente" value={stats.pending} color="amber" />
        <StatPill label="Acceptées" value={stats.accepted} color="emerald" />
        <StatPill label="Refusées" value={stats.rejected} color="red" />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af] mr-2">
          <Filter className="w-3 h-3 inline mr-1" />
          Filtre :
        </span>
        {['pending', 'accepted', 'rejected', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all ${
              filter === f
                ? 'bg-cta text-white'
                : 'bg-white border border-[#f0f0f0] text-[#71717a] hover:bg-zinc-50'
            }`}
          >
            {f === 'pending' ? 'En attente' : f === 'accepted' ? 'Acceptées' : f === 'rejected' ? 'Refusées' : 'Toutes'}
          </button>
        ))}
        {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9ca3af] ml-2" />}
      </div>

      {/* List + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        {/* Applications list */}
        <div className="bg-white rounded-2xl border border-[#f0f0f0] overflow-hidden">
          {isLoading ? (
            <div className="px-5 py-10 text-center text-[13px] text-[#71717a]">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
              Chargement…
            </div>
          ) : applications.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-[#9ca3af]">
              Aucune candidature {filter !== 'all' ? `(${filter})` : ''}.
            </div>
          ) : (
            <div className="divide-y divide-[#f0f0f0] max-h-[70vh] overflow-y-auto">
              {applications.map((app) => {
                const status = STATUS_STYLES[app.status] || STATUS_STYLES.pending
                const isSelected = selected?.id === app.id
                return (
                  <button
                    key={app.id}
                    onClick={() => setSelected(app)}
                    className={`w-full text-left px-4 py-3 hover:bg-zinc-50 transition-colors ${
                      isSelected ? 'bg-cta/[0.03] border-l-2 border-l-cta' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[13px] font-semibold text-[#1a1a1a] truncate">{app.boutique_name}</span>
                      </div>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0 ${status.bg} ${status.text}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#71717a] truncate">
                      <span className="font-mono">{app.email}</span>
                      {' · '}
                      {app.platform}
                      {' · '}
                      <span className="text-[#9ca3af]">
                        {new Date(app.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="bg-white rounded-2xl border border-[#f0f0f0] p-5 h-fit sticky top-6">
          {!selected ? (
            <div className="text-center py-12 text-[13px] text-[#9ca3af]">
              Sélectionnez une candidature pour voir le détail.
            </div>
          ) : (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-[16px] font-bold text-[#1a1a1a]">{selected.boutique_name}</h2>
                  <p className="text-[11px] text-[#9ca3af] mt-0.5">
                    Reçue le {new Date(selected.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${STATUS_STYLES[selected.status]?.bg} ${STATUS_STYLES[selected.status]?.text}`}>
                  {STATUS_STYLES[selected.status]?.label}
                </span>
              </div>

              {/* Fields */}
              <div className="space-y-3 text-[13px]">
                <DetailRow icon={Globe} label="URL">
                  <a href={selected.url} target="_blank" rel="noopener noreferrer" className="text-cta hover:underline inline-flex items-center gap-1">
                    {selected.url}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </DetailRow>
                <DetailRow icon={Mail} label="Email">
                  <a href={`mailto:${selected.email}`} className="text-cta hover:underline font-mono">{selected.email}</a>
                </DetailRow>
                <DetailRow icon={DollarSign} label="CA annuel">{selected.revenue}</DetailRow>
                <DetailRow icon={Globe} label="Plateforme">{selected.platform}</DetailRow>
                <DetailRow icon={FileText} label="Motivation">
                  <p className="text-[#1a1a1a] leading-relaxed">{selected.motivation}</p>
                </DetailRow>
              </div>

              {/* Promo code if accepted */}
              {selected.status === 'accepted' && selected.promo_code && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1">Code promo envoyé</div>
                      <div className="font-mono text-[13px] font-bold text-emerald-900 truncate">{selected.promo_code}</div>
                      {selected.accepted_email_sent_at && (
                        <div className="text-[10px] text-emerald-700 mt-1">
                          Email envoyé le {new Date(selected.accepted_email_sent_at).toLocaleString('fr-FR')}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => copyCode(selected.promo_code)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 transition-colors flex-shrink-0"
                    >
                      {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copié' : 'Copier'}
                    </button>
                  </div>
                </div>
              )}

              {/* Notes if present */}
              {selected.notes && (
                <div className="p-3 rounded-lg bg-zinc-50 border border-[#f0f0f0] text-[12px]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1">Notes</div>
                  <div className="text-[#71717a]">{selected.notes}</div>
                </div>
              )}

              {/* Actions */}
              {selected.status === 'pending' && (
                <div className="pt-3 border-t border-[#f0f0f0] space-y-2">
                  <textarea
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    placeholder="Notes (optionnel, envoyées dans l'email de refus)"
                    rows={2}
                    className="w-full px-3 py-2 border border-[#f0f0f0] rounded-lg text-[12px] resize-none focus:outline-none focus:border-cta/30"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => reviewMutation.mutate({ id: selected.id, action: 'accept' })}
                      disabled={reviewMutation.isPending}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-[12px] font-bold bg-cta text-white hover:bg-[#003725] transition-colors disabled:opacity-50"
                    >
                      {reviewMutation.isPending && reviewMutation.variables?.action === 'accept' ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Traitement…</>
                      ) : (
                        <><Check className="w-3.5 h-3.5" /> Accepter + Envoyer code</>
                      )}
                    </button>
                    <button
                      onClick={() => reviewMutation.mutate({ id: selected.id, action: 'reject', notes: rejectNotes })}
                      disabled={reviewMutation.isPending}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-[12px] font-semibold bg-white border border-[#f0f0f0] text-[#71717a] hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors disabled:opacity-50"
                    >
                      {reviewMutation.isPending && reviewMutation.variables?.action === 'reject' ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Traitement…</>
                      ) : (
                        <><X className="w-3.5 h-3.5" /> Refuser</>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {reviewMutation.isSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[12px] text-emerald-800">
                  ✓ Candidature {reviewMutation.data.action === 'accepted' ? 'acceptée' : 'refusée'}.
                  {reviewMutation.data.email_sent && <> Email envoyé.</>}
                  {!reviewMutation.data.email_sent && reviewMutation.data.email_error && (
                    <> ⚠️ Email échec : {reviewMutation.data.email_error}</>
                  )}
                </div>
              )}
              {reviewMutation.isError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-800">
                  ✗ {reviewMutation.error?.message || 'Erreur'}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatPill({ label, value, color = 'zinc' }) {
  const colors = {
    zinc: 'bg-white border-[#f0f0f0] text-[#1a1a1a]',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  }[color]
  return (
    <div className={`rounded-xl border p-3 ${colors}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-75 mb-1">{label}</div>
      <div className="text-[20px] font-bold tabular-nums">{value}</div>
    </div>
  )
}

function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-[#9ca3af] mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af] mb-0.5">{label}</div>
        <div className="text-[#1a1a1a] break-words">{children}</div>
      </div>
    </div>
  )
}
