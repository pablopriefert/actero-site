import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Plus,
  Send,
  ExternalLink,
  Star,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Mail,
  MailOpen,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const SITE_URL = window.location.origin

// ── Status badge ─────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: { label: 'En attente', icon: Clock, color: 'bg-gray-50 text-gray-600 border-gray-200' },
  sent: { label: 'Envoyé', icon: Mail, color: 'bg-blue-50 text-blue-600 border-blue-200' },
  opened: { label: 'Ouvert', icon: MailOpen, color: 'bg-amber-50 text-amber-600 border-amber-200' },
  replied: { label: 'Répondu', icon: MessageSquare, color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
}

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  )
}

// ── Score ring ───────────────────────────────────────────────────────

function ScoreRing({ score }) {
  const color = score >= 70 ? 'text-emerald-500' : score >= 40 ? 'text-amber-500' : 'text-red-500'
  const bgColor = score >= 70 ? 'bg-emerald-50' : score >= 40 ? 'bg-amber-50' : 'bg-red-50'
  return (
    <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center`}>
      <span className={`text-lg font-bold ${color}`}>{score}</span>
    </div>
  )
}

// ── New Audit modal ──────────────────────────────────────────────────

function NewAuditModal({ onClose, onSubmit, isLoading }) {
  const [form, setForm] = useState({
    store_name: '',
    store_url: '',
    contact_email: '',
    contact_name: '',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.store_name.trim()) return
    onSubmit(form)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-md bg-white rounded-2xl border border-[#f0f0f0] shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
          <h3 className="text-[15px] font-semibold text-[#1a1a1a]">Nouvel audit prospect</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#fafafa] text-[#71717a]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-1.5">Nom de la boutique *</label>
            <input
              type="text"
              value={form.store_name}
              onChange={(e) => setForm(f => ({ ...f, store_name: e.target.value }))}
              placeholder="Ex: Maison Durand"
              className="w-full px-3 py-2 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:border-cta/40 focus:bg-white"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-1.5">URL du site</label>
            <input
              type="url"
              value={form.store_url}
              onChange={(e) => setForm(f => ({ ...f, store_url: e.target.value }))}
              placeholder="https://maison-durand.com"
              className="w-full px-3 py-2 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:border-cta/40 focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-1.5">Email du contact</label>
            <input
              type="email"
              value={form.contact_email}
              onChange={(e) => setForm(f => ({ ...f, contact_email: e.target.value }))}
              placeholder="contact@maison-durand.com"
              className="w-full px-3 py-2 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:border-cta/40 focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-1.5">Nom du contact</label>
            <input
              type="text"
              value={form.contact_name}
              onChange={(e) => setForm(f => ({ ...f, contact_name: e.target.value }))}
              placeholder="Jean Dupont"
              className="w-full px-3 py-2 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:border-cta/40 focus:bg-white"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !form.store_name.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#003725] text-white text-[13px] font-semibold hover:bg-[#004d33] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyse en cours (~15s)...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Lancer l'audit IA
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

// ── Expanded audit detail row ────────────────────────────────────────

function AuditDetailPanel({ audit }) {
  const [copied, setCopied] = useState(false)
  const analysis = audit.analysis || {}
  const reportLink = `${SITE_URL}/audit-report/${audit.report_token}`

  const copyLink = () => {
    navigator.clipboard.writeText(reportLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden"
    >
      <div className="px-6 py-4 bg-[#fafafa] border-t border-[#f0f0f0]">
        {/* Summary */}
        <p className="text-[13px] text-[#1a1a1a] mb-4 leading-relaxed">
          {analysis.summary || 'Aucun résumé disponible.'}
        </p>

        {/* Top issues */}
        {analysis.top_issues?.length > 0 && (
          <div className="mb-4">
            <div className="text-[11px] font-bold text-[#71717a] uppercase tracking-wider mb-2">Problèmes identifiés</div>
            <div className="space-y-2">
              {analysis.top_issues.map((issue, i) => (
                <div key={i} className="flex items-center gap-3 text-[13px]">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                    issue.severity === 'critical'
                      ? 'bg-red-50 text-red-600 border-red-200'
                      : issue.severity === 'high'
                        ? 'bg-amber-50 text-amber-600 border-amber-200'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  }`}>
                    {issue.severity}
                  </span>
                  <span className="text-[#1a1a1a] font-medium">{issue.category}</span>
                  <span className="text-[#71717a]">— {issue.percentage}% des avis</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {analysis.recommendations?.length > 0 && (
          <div className="mb-4">
            <div className="text-[11px] font-bold text-[#71717a] uppercase tracking-wider mb-2">Recommandations Actero</div>
            <div className="space-y-1.5">
              {analysis.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-[13px]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-[#1a1a1a]">{rec.title}</span>
                    <span className="text-[#71717a]"> — {rec.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estimated savings */}
        {analysis.estimated_savings && (
          <div className="mb-4 flex gap-4">
            {analysis.estimated_savings.hours_per_month && (
              <div className="px-3 py-2 bg-white rounded-lg border border-[#f0f0f0] text-center">
                <div className="text-lg font-bold text-[#003725]">{analysis.estimated_savings.hours_per_month}h</div>
                <div className="text-[10px] text-[#71717a]">gagnées/mois</div>
              </div>
            )}
            {analysis.estimated_savings.tickets_automatable && (
              <div className="px-3 py-2 bg-white rounded-lg border border-[#f0f0f0] text-center">
                <div className="text-lg font-bold text-[#003725]">{analysis.estimated_savings.tickets_automatable}%</div>
                <div className="text-[10px] text-[#71717a]">automatisable</div>
              </div>
            )}
            {analysis.estimated_savings.response_time_improvement && (
              <div className="px-3 py-2 bg-white rounded-lg border border-[#f0f0f0] text-center">
                <div className="text-lg font-bold text-[#003725]">{analysis.estimated_savings.response_time_improvement}</div>
                <div className="text-[10px] text-[#71717a]">temps réponse</div>
              </div>
            )}
          </div>
        )}

        {/* Report link */}
        <div className="flex items-center gap-2">
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#f0f0f0] text-[12px] font-medium text-[#1a1a1a] hover:bg-white transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copié !' : 'Copier le lien rapport'}
          </button>
          <a
            href={reportLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#f0f0f0] text-[12px] font-medium text-[#1a1a1a] hover:bg-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Voir le rapport
          </a>
        </div>

        {/* Email hook preview */}
        {analysis.email_hook && (
          <div className="mt-3 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg">
            <div className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-1">Accroche email</div>
            <p className="text-[13px] text-[#1a1a1a] italic">"{analysis.email_hook}"</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main view ────────────────────────────────────────────────────────

export function AdminProspectAuditsView() {
  const queryClient = useQueryClient()
  const [showNewModal, setShowNewModal] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [search, setSearch] = useState('')

  // Fetch all audits
  const { data: audits = [], isLoading } = useQuery({
    queryKey: ['prospect-audits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prospect_audits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data
    },
    refetchInterval: 30_000,
  })

  // Run new audit mutation
  const runAudit = useMutation({
    mutationFn: async (form) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/leads/audit-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur serveur' }))
        throw new Error(err.error || `Erreur ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospect-audits'] })
      setShowNewModal(false)
    },
  })

  // Send email mutation
  const sendEmail = useMutation({
    mutationFn: async (auditId) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/leads/audit-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ audit_id: auditId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur serveur' }))
        throw new Error(err.error || `Erreur ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospect-audits'] })
    },
  })

  // Filter
  const filtered = audits.filter(a => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (a.store_name || '').toLowerCase().includes(s) ||
      (a.contact_email || '').toLowerCase().includes(s) ||
      (a.contact_name || '').toLowerCase().includes(s)
    )
  })

  // Stats
  const stats = {
    total: audits.length,
    sent: audits.filter(a => a.email_status === 'sent').length,
    opened: audits.filter(a => a.email_status === 'opened').length,
    replied: audits.filter(a => a.email_status === 'replied').length,
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[30px] font-bold text-[#1a1a1a]">Audits Prospects</h2>
          <p className="text-[#71717a] text-sm">Scrape les avis, analyse avec l'IA, envoie un cold email personnalisé.</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#003725] text-white text-[13px] font-semibold hover:bg-[#004d33] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvel audit
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total audits', value: stats.total, icon: Search },
          { label: 'Emails envoyés', value: stats.sent, icon: Mail },
          { label: 'Emails ouverts', value: stats.opened, icon: MailOpen },
          { label: 'Réponses', value: stats.replied, icon: MessageSquare },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-[#f0f0f0] p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className="w-4 h-4 text-[#71717a]" />
              <span className="text-[11px] font-bold text-[#71717a] uppercase tracking-wider">{s.label}</span>
            </div>
            <div className="text-2xl font-bold text-[#1a1a1a]">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, email..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#f0f0f0] bg-white text-[13px] text-[#1a1a1a] focus:outline-none focus:border-cta/40"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-[#f0f0f0] rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Sparkles className="w-8 h-8 animate-pulse text-[#71717a]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Search className="w-12 h-12 text-[#71717a] mx-auto mb-4 opacity-40" />
            <p className="text-[#71717a] text-sm">Aucun audit pour le moment.</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-4 text-[13px] font-semibold text-[#003725] hover:underline"
            >
              Lancer le premier audit →
            </button>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="grid grid-cols-[1fr_140px_80px_100px_120px_80px] gap-2 px-6 py-3 border-b border-[#f0f0f0] bg-[#fafafa]">
              <span className="text-[11px] font-bold text-[#71717a] uppercase tracking-wider">Boutique</span>
              <span className="text-[11px] font-bold text-[#71717a] uppercase tracking-wider">Email</span>
              <span className="text-[11px] font-bold text-[#71717a] uppercase tracking-wider text-center">Score</span>
              <span className="text-[11px] font-bold text-[#71717a] uppercase tracking-wider">Statut</span>
              <span className="text-[11px] font-bold text-[#71717a] uppercase tracking-wider">Date</span>
              <span className="text-[11px] font-bold text-[#71717a] uppercase tracking-wider text-center">Actions</span>
            </div>

            {/* Rows */}
            {filtered.map((audit) => (
              <div key={audit.id}>
                <div
                  className="grid grid-cols-[1fr_140px_80px_100px_120px_80px] gap-2 px-6 py-3 border-b border-[#f0f0f0] hover:bg-[#fafafa] cursor-pointer transition-colors items-center"
                  onClick={() => setExpandedId(expandedId === audit.id ? null : audit.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ScoreRing score={audit.support_score || 0} />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[#1a1a1a] truncate">{audit.store_name}</div>
                      {audit.contact_name && (
                        <div className="text-[11px] text-[#71717a] truncate">{audit.contact_name}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-[12px] text-[#71717a] truncate">{audit.contact_email || '—'}</div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-[12px] font-medium text-[#1a1a1a]">{audit.average_rating || '—'}</span>
                    </div>
                    <div className="text-[10px] text-[#71717a]">{audit.total_reviews || 0} avis</div>
                  </div>
                  <StatusBadge status={audit.email_status} />
                  <div className="text-[12px] text-[#71717a]">
                    {new Date(audit.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    {audit.email_status === 'pending' && audit.contact_email && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          sendEmail.mutate(audit.id)
                        }}
                        disabled={sendEmail.isPending}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                        title="Envoyer l'email"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    {expandedId === audit.id ? (
                      <ChevronUp className="w-4 h-4 text-[#71717a]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#71717a]" />
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === audit.id && <AuditDetailPanel audit={audit} />}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New audit modal */}
      <AnimatePresence>
        {showNewModal && (
          <NewAuditModal
            onClose={() => setShowNewModal(false)}
            onSubmit={(form) => runAudit.mutate(form)}
            isLoading={runAudit.isPending}
          />
        )}
      </AnimatePresence>

      {/* Error toasts */}
      {runAudit.isError && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-[13px] font-medium shadow-lg">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          {runAudit.error?.message || 'Erreur lors de l\'audit'}
        </div>
      )}
      {sendEmail.isError && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-[13px] font-medium shadow-lg">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          {sendEmail.error?.message || 'Erreur envoi email'}
        </div>
      )}
      {sendEmail.isSuccess && (
        <div className="fixed bottom-4 right-4 z-50 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-[13px] font-medium shadow-lg">
          <CheckCircle2 className="w-4 h-4 inline mr-2" />
          Email envoyé !
        </div>
      )}
    </div>
  )
}
