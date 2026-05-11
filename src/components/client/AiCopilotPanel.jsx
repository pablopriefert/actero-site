import React, { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Heart,
  ScrollText,
  Wrench,
  RefreshCw,
  ChevronDown,
  AlertTriangle,
  Check,
  Copy,
  Zap,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { trackEvent } from '../../lib/analytics'

/**
 * AiCopilotPanel — inspiré de Fin AI Copilot (Intercom).
 *
 * Quand un ticket escalade vers un humain, ce panneau génère :
 *   - un résumé contextuel
 *   - 3 brouillons de réponse (empathique / factuel / résolutif)
 *   - des actions métier suggérées
 *
 * Data : POST /api/engine/copilot-drafts { conversation_id }
 *
 * Accessibility (ui-ux-pro-max) :
 *   - touch-target 44px sur les boutons d'action (py-2.5 + text size)
 *   - focus-visible ring sur tous les boutons
 *   - aria-expanded sur sections repliables
 *   - aria-live="polite" sur l'état de chargement pour lecteurs d'écran
 *   - reduced-motion respecté par framer-motion par défaut
 *
 * Props :
 *   - conversationId (uuid) — ai_conversations.id
 *   - onUseDraft (fn: (body: string) => void) — callback quand l'utilisateur
 *     clique "Utiliser ce brouillon" → remplit le textarea de réponse
 */
export function AiCopilotPanel({ conversationId, onUseDraft }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(true)
  const [copiedDraftIdx, setCopiedDraftIdx] = useState(null)

  const fetchDrafts = useCallback(async () => {
    if (!conversationId) return
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/engine/copilot-drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ conversation_id: conversationId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur serveur')
      setData(json)
      trackEvent('Copilot_Drafts_Loaded', {
        conversation_id: conversationId,
        drafts_count: json.drafts?.length || 0,
        actions_count: json.suggested_actions?.length || 0,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  // Auto-fetch on mount + when conversation changes
  /* eslint-disable react-hooks/set-state-in-effect -- async fetch: setState is inside awaited callback */
  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleUseDraft = (draft, idx) => {
    trackEvent('Copilot_Draft_Used', {
      conversation_id: conversationId,
      tone: draft.tone,
    })
    onUseDraft?.(draft.body)
    setCopiedDraftIdx(idx)
    setTimeout(() => setCopiedDraftIdx(null), 2000)
  }

  const handleCopyDraft = (draft, idx) => {
    navigator.clipboard.writeText(draft.body).catch(() => {})
    setCopiedDraftIdx(`copy-${idx}`)
    setTimeout(() => setCopiedDraftIdx(null), 1500)
  }

  const handleActionClick = (action) => {
    trackEvent('Copilot_Action_Clicked', {
      conversation_id: conversationId,
      action_type: action.action_type,
    })
    // Pour le MVP, on affiche juste un hint dans la réponse ; les actions
    // concrètes (rembourser, créer bon d'achat…) seront câblées à la V2.
    onUseDraft?.(`Action à effectuer : ${action.label}\n\n${action.description}`)
  }

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/40 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-100/60 to-violet-50/60 hover:from-violet-100/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        aria-expanded={expanded}
        aria-controls="copilot-body"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <div className="text-left">
            <p className="text-[13px] font-bold text-violet-900 leading-tight">
              Copilote IA
            </p>
            <p className="text-[11px] text-violet-700 leading-tight">
              Brouillons et actions suggérés pour vous aider à répondre
            </p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-violet-700 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="copilot-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {loading && <LoadingState />}
              {error && <ErrorState message={error} onRetry={fetchDrafts} />}
              {data && !loading && !error && (
                <>
                  {/* Context summary */}
                  {data.context_summary && (
                    <div className="p-3 rounded-xl bg-white border border-violet-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700 mb-1.5">
                        Contexte
                      </p>
                      <p className="text-[13px] text-[#3A3A3A] leading-[1.55]">
                        {data.context_summary}
                      </p>
                    </div>
                  )}

                  {/* Drafts */}
                  {Array.isArray(data.drafts) && data.drafts.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700">
                          Brouillons ({data.drafts.length})
                        </p>
                        <button
                          type="button"
                          onClick={fetchDrafts}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded px-1.5 py-0.5"
                          aria-label="Régénérer les brouillons"
                        >
                          <RefreshCw className="w-3 h-3" strokeWidth={2.2} />
                          Régénérer
                        </button>
                      </div>
                      <div className="space-y-2">
                        {data.drafts.map((draft, idx) => (
                          <DraftCard
                            key={idx}
                            draft={draft}
                            idx={idx}
                            copiedState={copiedDraftIdx}
                            onUse={() => handleUseDraft(draft, idx)}
                            onCopy={() => handleCopyDraft(draft, idx)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested actions */}
                  {Array.isArray(data.suggested_actions) && data.suggested_actions.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700 mb-2">
                        Actions suggérées ({data.suggested_actions.length})
                      </p>
                      <div className="space-y-1.5">
                        {data.suggested_actions.map((action, idx) => (
                          <ActionButton
                            key={idx}
                            action={action}
                            onClick={() => handleActionClick(action)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────

function LoadingState() {
  return (
    <div aria-live="polite" aria-busy="true" className="space-y-3">
      <div className="flex items-center gap-2 text-[12px] text-violet-700">
        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
        <span>Le copilote analyse le ticket…</span>
      </div>
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-3 rounded-xl bg-white border border-violet-100 space-y-2">
            <div className="h-3 bg-violet-100 rounded w-1/3 animate-pulse" />
            <div className="h-2.5 bg-violet-50 rounded w-full animate-pulse" />
            <div className="h-2.5 bg-violet-50 rounded w-5/6 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-bold text-red-800">Copilote indisponible</p>
        <p className="text-[11.5px] text-red-600 mt-0.5 break-words">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-red-700 hover:text-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded px-1.5 py-0.5"
        >
          <RefreshCw className="w-3 h-3" />
          Réessayer
        </button>
      </div>
    </div>
  )
}

const TONE_META = {
  empathique: { Icon: Heart, color: 'rose', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', pill: 'bg-rose-100 text-rose-800' },
  factuel: { Icon: ScrollText, color: 'blue', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', pill: 'bg-blue-100 text-blue-800' },
  'résolutif': { Icon: Wrench, color: 'emerald', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', pill: 'bg-emerald-100 text-emerald-800' },
}

function DraftCard({ draft, idx, copiedState, onUse, onCopy }) {
  const meta = TONE_META[draft.tone] || TONE_META.factuel
  const { Icon } = meta
  const usedJustNow = copiedState === idx
  const copiedJustNow = copiedState === `copy-${idx}`

  return (
    <div className={`rounded-xl border ${meta.border} bg-white overflow-hidden`}>
      <div className={`flex items-center justify-between px-3 py-2 ${meta.bg}`}>
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`w-3.5 h-3.5 ${meta.text} flex-shrink-0`} strokeWidth={2.2} />
          <span className={`text-[10.5px] font-bold uppercase tracking-[0.08em] ${meta.pill} px-2 py-0.5 rounded-full`}>
            {draft.tone}
          </span>
          <p className="text-[12px] font-semibold text-[#1A1A1A] truncate">{draft.title}</p>
        </div>
      </div>
      <div className="p-3">
        <p className="text-[12.5px] text-[#3A3A3A] leading-[1.55] whitespace-pre-wrap">
          {draft.body}
        </p>
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={onUse}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 transition-colors"
          >
            {usedJustNow ? <Check className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
            {usedJustNow ? 'Inséré' : 'Utiliser ce brouillon'}
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-lg bg-white border border-gray-200 text-[12px] font-semibold text-[#5A5A5A] hover:border-gray-300 hover:text-[#1A1A1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 transition-colors"
            aria-label="Copier le brouillon dans le presse-papier"
          >
            {copiedJustNow ? <Check className="w-3.5 h-3.5 text-cta" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedJustNow ? 'Copié' : 'Copier'}
          </button>
        </div>
      </div>
    </div>
  )
}

const ACTION_ICONS = {
  refund: '💰',
  partial_refund: '💸',
  store_credit: '🎟️',
  resend_shipment: '📦',
  create_return: '↩️',
  escalate_manager: '🆙',
  update_address: '📍',
  other: '✨',
}

function ActionButton({ action, onClick }) {
  const icon = ACTION_ICONS[action.action_type] || '✨'
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-3 p-2.5 rounded-xl bg-white border border-violet-100 hover:border-violet-300 hover:bg-violet-50 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 transition-colors"
    >
      <span className="text-[18px] flex-shrink-0 mt-0.5" aria-hidden="true">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-bold text-[#1A1A1A] leading-tight">{action.label}</p>
        <p className="text-[11.5px] text-[#716D5C] mt-0.5 leading-[1.45]">
          {action.description}
        </p>
      </div>
    </button>
  )
}
