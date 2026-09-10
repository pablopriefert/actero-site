import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  BrainCircuit,
  Sparkles,
  Shield,
  FileText,
  Activity,
  Database,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * ReasoningDrawer — slide-in panel that explains WHY the agent
 * answered the way it did.
 *
 * Data source : GET /api/engine/reasoning?conversation_id=:id
 *
 * Sections :
 *   1. Header — subject, close button
 *   2. Confidence + classification badge (verdict)
 *   3. Response preview (customer message → AI response)
 *   4. Sources used (KB entries retrieved during run)
 *   5. Reasoning steps (action_plan + steps)
 *   6. Technical metrics (agent, model, tokens, cost, duration)
 *   7. Guardrails / RAG check warning if flagged
 *
 * Design : white panel 480px (desktop), full-width mobile, slides from
 * the right. Framer Motion for animation. Consistent with Actero cream
 * design tokens.
 *
 * Props :
 *   - open (bool)
 *   - onClose (fn)
 *   - conversationId (uuid) — id of ai_conversations row to inspect
 */
export function ReasoningDrawer({ open, onClose, conversationId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expandedSection, setExpandedSection] = useState('sources')

  useEffect(() => {
    if (!open || !conversationId) return
    let cancelled = false
    const fetchReasoning = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        const res = await fetch(`/api/engine/reasoning?conversation_id=${conversationId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Erreur serveur')
        if (!cancelled) setData(json)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchReasoning()
    return () => { cancelled = true }
  }, [open, conversationId])

  // Esc to close
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-full md:w-[520px] bg-white z-50 shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.2)] flex flex-col"
            role="dialog"
            aria-label="Raisonnement de l'agent"
          >
            {/* Header */}
            <header className="flex-shrink-0 px-6 py-5 border-b border-[#f0f0f0] flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <BrainCircuit className="w-4 h-4 text-cta" strokeWidth={2} />
                  <span className="text-[11px] font-bold text-cta uppercase tracking-[0.12em]">
                    Raisonnement de l'agent
                  </span>
                </div>
                <h3 className="text-[17px] font-bold text-[#1A1A1A] truncate leading-tight">
                  {data?.conversation?.subject || 'Chargement…'}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 w-8 h-8 rounded-full bg-[#FFFFFF] hover:bg-[#F4F5F7] flex items-center justify-center text-[#716D5C] transition-colors"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {loading && <Loading />}
              {error && <ErrorState message={error} />}
              {data && !loading && !error && (
                <ReasoningContent
                  data={data}
                  expandedSection={expandedSection}
                  onToggle={(s) => setExpandedSection(expandedSection === s ? null : s)}
                />
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Sub-components ────────────────────────────────────────────

function Loading() {
  return (
    <div className="p-6 space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 bg-[#FFFFFF] rounded w-1/3 animate-pulse" />
          <div className="h-16 bg-[#FFFFFF] rounded-xl animate-pulse" />
        </div>
      ))}
    </div>
  )
}

function ErrorState({ message }) {
  return (
    <div className="p-6">
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-red-800">Impossible de charger le raisonnement</p>
          <p className="text-[13px] text-red-600 mt-1">{message}</p>
        </div>
      </div>
    </div>
  )
}

function ReasoningContent({ data, expandedSection, onToggle }) {
  const { conversation, run, sources, metrics } = data

  const confidenceColor =
    metrics.confidence_level === 'high'
      ? 'bg-cta/10 text-cta border-cta/30'
      : metrics.confidence_level === 'medium'
        ? 'bg-amber-500/10 text-amber-700 border-amber-500/30'
        : 'bg-red-500/10 text-red-700 border-red-500/30'

  const confidenceLabel =
    metrics.confidence_level === 'high'
      ? 'Confiance élevée'
      : metrics.confidence_level === 'medium'
        ? 'Confiance moyenne'
        : 'Confiance faible'

  return (
    <div className="p-6 space-y-5">
      {/* ── Verdict row : classification + confidence ── */}
      <div className="flex flex-wrap items-center gap-2">
        {run?.classification && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFFFFF] border border-[#E3E6EA] text-[12px] font-semibold text-[#1A1A1A]">
            <Sparkles className="w-3 h-3 text-cta" strokeWidth={2.5} />
            {prettyClassification(run.classification)}
          </span>
        )}
        {run?.agent_used && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E3E6EA] text-[12px] font-semibold text-[#716D5C]">
            Agent {run.agent_used}
          </span>
        )}
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-bold ${confidenceColor}`}>
          {confidenceLabel} · {metrics.confidence_pct}%
        </span>
      </div>

      {/* ── Flagged warning ── */}
      {run?.rag_check_flagged && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[12.5px] font-bold text-amber-900">Réponse signalée par le RAG check</p>
            <p className="text-[12px] text-amber-700 mt-0.5 leading-[1.5]">
              {run.rag_check_details?.reason || 'La réponse générée s\'écarte des sources officielles — escalade recommandée.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Response preview ── */}
      <Section
        icon={Activity}
        title="Échange"
        defaultOpen
        open={expandedSection === 'exchange'}
        onToggle={() => onToggle('exchange')}
      >
        <div className="space-y-3">
          <Bubble label="Message client" color="neutral">
            {conversation.customer_message}
          </Bubble>
          <Bubble label="Réponse de l'agent" color="cta">
            {conversation.ai_response || '—'}
          </Bubble>
        </div>
      </Section>

      {/* ── Sources KB ── */}
      <Section
        icon={Database}
        title={`Sources utilisées${sources.length ? ` · ${sources.length}` : ''}`}
        open={expandedSection === 'sources'}
        onToggle={() => onToggle('sources')}
      >
        {sources.length === 0 ? (
          <p className="text-[13px] text-[#9ca3af] italic">
            Aucune source de la base de connaissances n'a été utilisée pour cette réponse — l'agent a répondu sur ses connaissances produit Shopify directement.
          </p>
        ) : (
          <div className="space-y-2">
            {sources.map((s) => (
              <div key={s.id} className="p-3 rounded-xl border border-[#E3E6EA] bg-[#FFFFFF]">
                <div className="flex items-center gap-2 mb-1.5">
                  <FileText className="w-3.5 h-3.5 text-cta flex-shrink-0" />
                  <p className="text-[13px] font-bold text-[#1A1A1A] truncate">{s.title}</p>
                  {s.category && (
                    <span className="text-[10px] font-semibold text-[#716D5C] uppercase tracking-wider bg-white px-1.5 py-0.5 rounded">{s.category}</span>
                  )}
                </div>
                <p className="text-[12.5px] text-[#5A5A5A] leading-[1.55] line-clamp-3">{s.excerpt}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Reasoning steps ── */}
      <Section
        icon={BrainCircuit}
        title="Étapes du raisonnement"
        open={expandedSection === 'steps'}
        onToggle={() => onToggle('steps')}
      >
        <ReasoningSteps run={run} />
      </Section>

      {/* ── Escalation reason ── */}
      {conversation.escalation_reason && (
        <Section
          icon={Shield}
          title="Raison de l'escalade"
          open={expandedSection === 'escalation'}
          onToggle={() => onToggle('escalation')}
        >
          <p className="text-[13px] text-[#3A3A3A] leading-[1.6]">
            {prettyEscalation(conversation.escalation_reason)}
          </p>
        </Section>
      )}

      {/* ── Technical metrics ── */}
      <Section
        icon={Zap}
        title="Métriques techniques"
        open={expandedSection === 'metrics'}
        onToggle={() => onToggle('metrics')}
      >
        <MetricsGrid run={run} metrics={metrics} conversation={conversation} />
      </Section>
    </div>
  )
}

function Section({ icon: Icon, title, children, open, onToggle }) {
  return (
    <div className="rounded-2xl border border-[#f0f0f0] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-[#fafafa] transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-cta" strokeWidth={2} />
          <span className="text-[13px] font-bold text-[#1A1A1A]">{title}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#9ca3af] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Bubble({ label, color = 'neutral', children }) {
  const palettes = {
    neutral: 'bg-[#fafafa] border-[#f0f0f0] text-[#3A3A3A]',
    cta: 'bg-cta/[0.04] border-cta/15 text-[#1A1A1A]',
  }
  return (
    <div className={`p-3 rounded-xl border ${palettes[color]}`}>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#9ca3af] mb-1.5">{label}</p>
      <p className="text-[13px] leading-[1.55] whitespace-pre-wrap">{children}</p>
    </div>
  )
}

function ReasoningSteps({ run }) {
  const steps = Array.isArray(run?.steps) ? run.steps : []
  const plan = Array.isArray(run?.action_plan) ? run.action_plan : []

  if (!steps.length && !plan.length) {
    return (
      <p className="text-[13px] text-[#9ca3af] italic">
        Aucun détail de raisonnement enregistré pour ce run.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {plan.length > 0 && (
        <div className="p-3 rounded-xl bg-[#FFFFFF] border border-[#E3E6EA]">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#716D5C] mb-1.5">
            Plan d'action décidé
          </p>
          <div className="flex flex-wrap gap-1.5">
            {plan.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-[#E3E6EA] text-[11.5px] font-semibold text-[#1A1A1A]">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {steps.map((step, i) => {
        const tool = step.tool || step.name || step.type || `Étape ${i + 1}`
        const detail = step.description || step.detail || step.summary
        const success = step.status === 'success' || step.ok === true
        return (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-[#f0f0f0] bg-white">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FFFFFF] flex items-center justify-center font-mono text-[11px] font-bold text-[#716D5C]">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[13px] font-bold text-[#1A1A1A] truncate">{tool}</p>
                {success && <CheckCircle2 className="w-3.5 h-3.5 text-cta flex-shrink-0" />}
              </div>
              {detail && (
                <p className="text-[12px] text-[#5A5A5A] leading-[1.55] break-words">{detail}</p>
              )}
              {step.result && typeof step.result === 'string' && (
                <p className="text-[11.5px] text-[#9ca3af] mt-1 font-mono break-all line-clamp-3">{step.result}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MetricsGrid({ run, metrics, conversation }) {
  const cells = [
    { label: 'Modèle', value: run?.model_id || '—' },
    { label: 'Tokens', value: metrics.tokens_total ? metrics.tokens_total.toLocaleString('fr-FR') : '—' },
    { label: 'Coût', value: metrics.cost_eur != null ? `${metrics.cost_eur.toFixed(4)}€` : '—' },
    { label: 'Durée', value: run?.duration_ms ? `${(run.duration_ms / 1000).toFixed(2)}s` : (conversation?.response_time_ms ? `${(conversation.response_time_ms / 1000).toFixed(2)}s` : '—') },
    { label: 'RAG score', value: run?.rag_check_score != null ? `${Math.round(run.rag_check_score * 100)}%` : '—' },
    { label: 'Intent', value: conversation.intent || conversation.ticket_type || '—' },
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {cells.map((c) => (
        <div key={c.label} className="p-2.5 rounded-lg bg-[#fafafa] border border-[#f0f0f0]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9ca3af] leading-tight">
            {c.label}
          </p>
          <p className="text-[13px] font-bold text-[#1A1A1A] mt-1 tabular-nums truncate">{c.value}</p>
        </div>
      ))}
    </div>
  )
}

function prettyClassification(c) {
  if (!c) return '—'
  const map = {
    order_tracking: 'Suivi de commande',
    address_change: 'Changement d\'adresse',
    return_exchange: 'Retour / échange',
    product_info: 'Info produit',
    billing: 'Facturation',
    general: 'Général',
    aggressive: 'Ton agressif',
    complaint: 'Plainte',
  }
  return map[c] || c.replace(/_/g, ' ')
}

function prettyEscalation(r) {
  const map = {
    low_confidence: 'Confiance de l\'agent trop basse (< 60%) — escalade automatique vers un humain.',
    aggressive: 'Ton agressif détecté dans le message client — escalade vers un humain.',
    out_of_policy: 'Demande en dehors des politiques configurées — escalade requise.',
    error: 'Erreur technique pendant la génération de la réponse.',
  }
  return map[r] || r
}
