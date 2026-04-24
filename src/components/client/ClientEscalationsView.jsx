import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, Clock, User, Mail, ShoppingCart, Send,
  CheckCircle2, X, Loader2, BookOpen, ChevronDown, TrendingDown,
  MessageCircle, FileText, Check, Edit3, Pen, Save, Search, Sparkles,
  Mic, Volume2, BrainCircuit
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from '../../lib/toast'
import { generateAndUploadAudio } from '../../hooks/useTTS'
import { ReasoningDrawer } from './ReasoningDrawer'
import { AiCopilotPanel } from './AiCopilotPanel'
import { SkeletonList } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'

const ESCALATION_REASONS = {
  aggressive: 'Message agressif detecte',
  low_confidence: 'Confiance IA insuffisante',
  out_of_policy: 'Demande hors politique',
  legal_mention: 'Mention juridique',
  error: 'Erreur de traitement',
  default: 'Escalade automatique',
}

const SUBJECT_LABELS = {
  autre: 'Demande generale',
  general: 'Demande generale',
  suivi_commande: 'Suivi de commande',
  order_tracking: 'Suivi de commande',
  retour_produit: 'Retour produit',
  return_exchange: 'Retour / Echange',
  remboursement: 'Demande de remboursement',
  question_produit: 'Question sur un produit',
  product_info: 'Information produit',
  reclamation: 'Reclamation client',
  aggressive: 'Client mecontent',
  billing: 'Facturation',
  livraison: 'Livraison',
  error: 'Erreur de traitement',
}

function formatCustomerName(conv) {
  // If real email exists, show name or email
  if (conv.customer_email && !conv.customer_email.includes('@anonymous.actero.fr')) {
    return conv.customer_name || conv.customer_email
  }
  // Anonymous widget visitors
  if (conv.customer_name) return conv.customer_name
  return 'Visiteur du site'
}

function formatSubject(conv) {
  if (!conv.subject) return null
  // Check if it's a technical classification key
  const label = SUBJECT_LABELS[conv.subject.toLowerCase()]
  if (label) return label
  // If it looks like a real subject, return it
  if (conv.subject.length > 3 && !conv.subject.match(/^[a-z_]+$/)) return conv.subject
  return SUBJECT_LABELS[conv.subject] || 'Demande generale'
}

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return ''
  const diffMs = new Date() - new Date(dateStr)
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `Il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `Il y a ${days}j`
}

const isOverdue = (dateStr) => {
  if (!dateStr) return false
  return (new Date() - new Date(dateStr)) > 24 * 60 * 60 * 1000
}

const EscalationDrawer = ({ conversation, onClose, clientId }) => {
  const queryClient = useQueryClient()
  const [response, setResponse] = useState('')
  const [addToKb, setAddToKb] = useState(false)
  const [attachAudio, setAttachAudio] = useState(false)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null)
  const [audioGenerating, setAudioGenerating] = useState(false)
  const [audioError, setAudioError] = useState(null)
  const [autoSend, setAutoSend] = useState(false)

  const [emailSentStatus, setEmailSentStatus] = useState(null)
  const [emailErrorMsg, setEmailErrorMsg] = useState(null)
  const [actionMode, setActionMode] = useState(null) // null | 'ai-send' | 'ai-edit' | 'custom'
  const [reasoningOpen, setReasoningOpen] = useState(false)

  // Templates state
  const [templateSearch, setTemplateSearch] = useState('')
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false)
  const [newTplName, setNewTplName] = useState('')
  const [newTplCategory, setNewTplCategory] = useState('')
  const [savingTpl, setSavingTpl] = useState(false)

  const isRealEmail = conversation.customer_email && !conversation.customer_email.includes('@anonymous.actero.fr')

  // Templates query
  const { data: templates = [] } = useQuery({
    queryKey: ['response-templates', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_response_templates')
        .select('*')
        .eq('client_id', clientId)
        .order('usage_count', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return templates
    const q = templateSearch.toLowerCase()
    return templates.filter(t =>
      (t.name || '').toLowerCase().includes(q) ||
      (t.shortcut || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q) ||
      (t.body || '').toLowerCase().includes(q)
    )
  }, [templates, templateSearch])

  const applyTemplate = async (tpl) => {
    setResponse((prev) => prev ? `${prev}\n${tpl.body}` : tpl.body)
    setShowTemplatePicker(false)
    setTemplateSearch('')
    // increment usage_count
    try {
      await supabase
        .from('client_response_templates')
        .update({ usage_count: (tpl.usage_count || 0) + 1, updated_at: new Date().toISOString() })
        .eq('id', tpl.id)
      queryClient.invalidateQueries({ queryKey: ['response-templates', clientId] })
    } catch (e) {
      // non-blocking
    }
  }

  const saveCurrentAsTemplate = async () => {
    if (!newTplName.trim() || !response.trim()) return
    setSavingTpl(true)
    try {
      const { error } = await supabase
        .from('client_response_templates')
        .insert({
          client_id: clientId,
          name: newTplName.trim(),
          category: newTplCategory.trim() || null,
          body: response,
        })
      if (error) throw error
      toast.success('Template sauvegardé')
      setShowSaveTemplateModal(false)
      setNewTplName('')
      setNewTplCategory('')
      queryClient.invalidateQueries({ queryKey: ['response-templates', clientId] })
    } catch (e) {
      toast.error('Erreur sauvegarde template')
    }
    setSavingTpl(false)
  }

  const respondMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()

      // Step 1 — if audio attached, generate it NOW (before the send).
      // Uses the already-generated preview if available, otherwise re-generates.
      let audioUrl = audioPreviewUrl
      if (attachAudio && !audioUrl) {
        try {
          setAudioGenerating(true)
          const result = await generateAndUploadAudio({
            text: response,
            conversationId: conversation.id,
            purpose: 'escalation_reply',
          })
          audioUrl = result.audio_url
          setAudioPreviewUrl(audioUrl)
        } catch (err) {
          setAudioError(err.message || 'Génération audio échouée')
          // Still send the reply without audio rather than blocking the flow.
          audioUrl = null
        } finally {
          setAudioGenerating(false)
        }
      }

      // Step 2 — send the reply (with or without audio URL)
      const res = await fetch('/api/escalation/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          conversation_id: conversation.id,
          response,
          add_to_kb: addToKb,
          audio_url: attachAudio ? audioUrl : null,
        }),
      })
      if (!res.ok) {
        // Fallback: update directly via Supabase
        const { error } = await supabase
          .from('ai_conversations')
          .update({
            human_response: response,
            human_responded_at: new Date().toISOString(),
            status: 'resolved',
          })
          .eq('id', conversation.id)
        if (error) throw error

        if (addToKb) {
          await supabase.from('client_knowledge_base').insert({
            client_id: clientId,
            category: 'faq',
            title: conversation.subject || 'Question client',
            content: `Q: ${conversation.customer_message}\nR: ${response}`,
          })
          fetch('/api/sync-brand-context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: clientId }),
          }).catch(() => {})
        }
        return { email_sent: false }
      }
      return await res.json()
    },
    onSuccess: (data) => {
      if (data?.email_sent) {
        setEmailSentStatus('sent')
      } else if (data?.email_error) {
        setEmailSentStatus('error')
        setEmailErrorMsg(data.email_error)
      } else {
        setEmailSentStatus('not_sent')
      }
      // Reset audio state after successful send
      setAudioPreviewUrl(null)
      setAudioError(null)
      queryClient.invalidateQueries({ queryKey: ['escalations', clientId] })
      queryClient.invalidateQueries({ queryKey: ['escalation-stats', clientId] })
      queryClient.invalidateQueries({ queryKey: ['all-escalations', clientId] })
      // Wait to show status, longer for errors so user can read
      setTimeout(() => onClose(), data?.email_sent ? 2000 : data?.email_error ? 5000 : 500)
    },
  })

  const ignoreMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('ai_conversations')
        .update({ status: 'resolved', human_responded_at: new Date().toISOString() })
        .eq('id', conversation.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalations', clientId] })
      queryClient.invalidateQueries({ queryKey: ['escalation-stats', clientId] })
      onClose()
    },
  })

  // Auto-send flow when user picks "Envoyer la reponse IA telle quelle"
  useEffect(() => {
    if (autoSend && response.trim() && !respondMutation.isPending) {
      setAutoSend(false)
      respondMutation.mutate()
    }
  }, [autoSend, response]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleQuickActionSendAI = () => {
    const ai = conversation.ai_response || ''
    if (!ai.trim()) return
    setResponse(ai)
    setActionMode('ai-send')
    setAutoSend(true)
  }

  const handleQuickActionEditAI = () => {
    const ai = conversation.ai_response || ''
    setResponse(ai)
    setActionMode('ai-edit')
  }

  const handleQuickActionCustom = () => {
    setResponse('')
    setActionMode('custom')
  }

  const reason = ESCALATION_REASONS[conversation.escalation_reason] || ESCALATION_REASONS.default

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-[#f0f0f0] rounded-2xl shadow-sm w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#f0f0f0]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-[#1a1a1a] font-bold">Ticket escalade</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {reason}
                </span>
                <span className={`text-xs ${isOverdue(conversation.created_at) ? 'text-red-400' : 'text-[#9ca3af]'}`}>
                  <Clock className="w-3 h-3 inline mr-1" />
                  {formatTimeAgo(conversation.created_at)}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-[#9ca3af] hover:text-[#1a1a1a]"><X className="w-5 h-5" /></button>
        </div>

        {/* Client info */}
        <div className="px-6 py-4 border-b border-[#f0f0f0]">
          <div className="flex flex-wrap gap-4 text-xs text-[#9ca3af]">
            <span className="flex items-center gap-1"><User className="w-3 h-3" /> {formatCustomerName(conversation)}</span>
            {conversation.customer_email && !conversation.customer_email.includes('@anonymous.actero.fr') && (
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {conversation.customer_email}</span>
            )}
            {formatSubject(conversation) && (
              <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {formatSubject(conversation)}</span>
            )}
            {conversation.order_id && (
              <span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> {conversation.order_id}</span>
            )}
            {conversation.ticket_id && (
              <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {conversation.ticket_id}</span>
            )}
          </div>
        </div>

        {/* Conversation */}
        <div className="p-6 space-y-4">
          <div>
            <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">Message du client</p>
            <div className="bg-[#fafafa] rounded-xl px-4 py-3 text-sm text-[#9ca3af] whitespace-pre-wrap">
              {conversation.customer_message}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">Reponse IA</p>
              <button
                type="button"
                onClick={() => setReasoningOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F9F7F1] border border-[#E8DFC9] text-[11px] font-semibold text-[#1A1A1A] hover:border-cta hover:text-cta transition-colors"
                aria-label="Voir le raisonnement de l'agent"
              >
                <BrainCircuit className="w-3 h-3" strokeWidth={2.2} />
                Voir le raisonnement
              </button>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl px-4 py-3 text-sm text-[#9ca3af] italic">
              {conversation.ai_response || 'L\'IA n\'a pas pu repondre a ce message.'}
            </div>
          </div>
        </div>

        <ReasoningDrawer
          open={reasoningOpen}
          onClose={() => setReasoningOpen(false)}
          conversationId={conversation.id}
        />

        {/* ── AI Copilot — drafts + suggested actions ── */}
        <div className="px-6 pb-2">
          <AiCopilotPanel
            conversationId={conversation.id}
            onUseDraft={(body) => setResponse(body)}
          />
        </div>

        {/* Response area */}
        {!conversation.human_response ? (
          <div className="p-6 border-t border-[#f0f0f0] space-y-4">
            {/* Email notification banner */}
            {isRealEmail ? (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <Mail className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div className="text-[12px] text-emerald-700">
                  <p>Votre réponse sera envoyée automatiquement par email à <span className="font-semibold">{conversation.customer_email}</span></p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">Envoyé depuis votre adresse email connectée (SMTP) ou via Actero si non configuré.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-[12px] text-amber-700">
                  Ce client n&apos;a pas fourni d&apos;email. Votre réponse sera enregistrée mais ne sera pas envoyée.
                </p>
              </div>
            )}

            {/* Email sent confirmation */}
            {emailSentStatus === 'sent' && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <p className="text-[12px] text-emerald-700 font-semibold">Email envoyé à {conversation.customer_email}</p>
              </div>
            )}
            {emailSentStatus === 'error' && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[12px] text-red-700 font-semibold">Email non envoyé</p>
                  <p className="text-[11px] text-red-600 mt-0.5">{emailErrorMsg || 'Vérifiez votre configuration SMTP dans Intégrations.'}</p>
                </div>
              </div>
            )}

            {/* Feature 14: Quick action buttons */}
            {conversation.ai_response && (
              <div>
                <p className="text-[11px] text-[#9ca3af] mb-2">
                  L&apos;IA propose une réponse — choisissez comment procéder :
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleQuickActionSendAI}
                    disabled={respondMutation.isPending}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-50 ${
                      actionMode === 'ai-send'
                        ? 'bg-emerald-600 text-white border border-emerald-600'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    Envoyer la réponse IA telle quelle
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickActionEditAI}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-semibold transition-all ${
                      actionMode === 'ai-edit'
                        ? 'bg-[#1a1a1a] text-white border border-[#1a1a1a]'
                        : 'bg-[#f5f5f5] text-[#1a1a1a] border border-[#ebebeb] hover:bg-[#ececec]'
                    }`}
                  >
                    <Edit3 className="w-4 h-4" />
                    Modifier la réponse IA
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickActionCustom}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-semibold transition-all ${
                      actionMode === 'custom'
                        ? 'bg-white text-[#1a1a1a] border border-[#1a1a1a]'
                        : 'bg-white text-[#71717a] border border-[#ebebeb] hover:text-[#1a1a1a] hover:border-[#d1d5db]'
                    }`}
                  >
                    <Pen className="w-4 h-4" />
                    Écrire ma propre réponse
                  </button>
                </div>
              </div>
            )}

            {/* Feature 16: Template selector */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">Votre réponse</label>
                <button
                  type="button"
                  onClick={() => setShowTemplatePicker((v) => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#f5f5f5] text-[#1a1a1a] border border-[#ebebeb] hover:bg-[#ececec] transition-all"
                >
                  <Sparkles className="w-3 h-3" />
                  Insérer un template
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              {showTemplatePicker && (
                <div className="mb-2 bg-white border border-[#ebebeb] rounded-lg shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-[#f0f0f0]">
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#fafafa] border border-[#ebebeb]">
                      <Search className="w-3.5 h-3.5 text-[#9ca3af]" />
                      <input
                        autoFocus
                        type="text"
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        placeholder="Rechercher un template..."
                        className="flex-1 bg-transparent outline-none text-[12px] text-[#1a1a1a] placeholder-[#9ca3af]"
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {filteredTemplates.length === 0 ? (
                      <div className="px-4 py-6 text-center text-[12px] text-[#9ca3af]">
                        {templates.length === 0 ? 'Aucun template. Sauvegardez votre première réponse !' : 'Aucun résultat'}
                      </div>
                    ) : (
                      filteredTemplates.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => applyTemplate(tpl)}
                          className="w-full text-left px-3 py-2 hover:bg-[#fafafa] border-b border-[#f0f0f0] last:border-0 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[12px] font-semibold text-[#1a1a1a] truncate">{tpl.name}</span>
                              {tpl.category && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#f0f0f0] text-[#71717a] border border-[#ebebeb]">
                                  {tpl.category}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#9ca3af] flex-shrink-0">{tpl.usage_count || 0} util.</span>
                          </div>
                          <p className="text-[11px] text-[#9ca3af] mt-0.5 line-clamp-1">{tpl.body}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={5}
                placeholder="Redigez votre reponse..."
                className="w-full bg-[#fafafa] border border-[#ebebeb] rounded-lg px-4 py-3 text-[13px] text-[#1a1a1a] outline-none resize-none focus:border-cta/30"
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={addToKb}
                onChange={(e) => setAddToKb(e.target.checked)}
                className="mt-0.5 rounded border-white/20 bg-[#fafafa] text-blue-500"
              />
              <div>
                <span className="text-sm text-[#9ca3af] group-hover:text-[#1a1a1a] transition-colors">
                  Ajouter cette réponse à ma base de connaissances
                </span>
                <p className="text-xs text-[#9ca3af] mt-0.5">
                  L&apos;IA saura répondre à cette question la prochaine fois
                </p>
              </div>
            </label>

            {/* Voice reply toggle — ElevenLabs feature */}
            <div className="rounded-xl border border-[#f0f0f0] bg-gradient-to-br from-cta/[0.03] to-transparent p-3.5">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={attachAudio}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setAttachAudio(checked)
                    if (!checked) {
                      setAudioPreviewUrl(null)
                      setAudioError(null)
                    }
                  }}
                  className="mt-0.5 rounded border-cta/30 bg-white text-cta"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Mic className="w-3.5 h-3.5 text-cta" />
                    <span className="text-[13px] font-semibold text-[#1a1a1a] group-hover:text-cta transition-colors">
                      Joindre un message vocal
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-cta/10 text-cta px-1.5 py-0.5 rounded">
                      Premium
                    </span>
                  </div>
                  <p className="text-xs text-[#71717a] mt-1 leading-relaxed">
                    Votre réponse sera aussi envoyée sous forme de message audio naturel
                    pour une touche plus chaleureuse.
                  </p>

                  {attachAudio && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!response.trim() || audioGenerating) return
                          try {
                            setAudioGenerating(true)
                            setAudioError(null)
                            const result = await generateAndUploadAudio({
                              text: response,
                              conversationId: conversation.id,
                              purpose: 'escalation_reply_preview',
                            })
                            setAudioPreviewUrl(result.audio_url)
                          } catch (err) {
                            setAudioError(err.message || 'Erreur')
                          } finally {
                            setAudioGenerating(false)
                          }
                        }}
                        disabled={!response.trim() || audioGenerating}
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold bg-white border border-cta/20 text-cta hover:bg-cta/[0.04] transition-all disabled:opacity-50"
                      >
                        {audioGenerating ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Génération audio…</>
                        ) : audioPreviewUrl ? (
                          <><Volume2 className="w-3 h-3" /> Régénérer</>
                        ) : (
                          <><Volume2 className="w-3 h-3" /> Prévisualiser</>
                        )}
                      </button>
                      {audioPreviewUrl && !audioGenerating && (
                        <audio
                          controls
                          src={audioPreviewUrl}
                          className="h-8 rounded-full flex-1 min-w-[200px] max-w-[400px]"
                          style={{ accentColor: '#0E653A' }}
                        />
                      )}
                      {audioError && (
                        <span className="text-[11px] text-red-600">{audioError}</span>
                      )}
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => respondMutation.mutate()}
                disabled={!response.trim() || respondMutation.isPending || audioGenerating}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[12px] font-semibold bg-cta text-white hover:bg-[#003725] transition-all disabled:opacity-50"
              >
                {(respondMutation.isPending || audioGenerating) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {audioGenerating
                  ? 'Génération audio…'
                  : (attachAudio && !audioPreviewUrl ? 'Envoyer avec audio' : (isRealEmail ? 'Envoyer par email' : 'Enregistrer la réponse'))}
              </button>
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(true)}
                disabled={!response.trim()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold bg-white text-[#1a1a1a] border border-[#ebebeb] hover:bg-[#fafafa] transition-all disabled:opacity-50"
                title="Sauvegarder cette réponse comme template réutilisable"
              >
                <Save className="w-4 h-4" />
                Sauvegarder comme template
              </button>
              <button
                onClick={() => ignoreMutation.mutate()}
                disabled={ignoreMutation.isPending}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#9ca3af] hover:text-[#1a1a1a] transition-colors"
              >
                Ignorer
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 border-t border-[#f0f0f0]">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Repondu</p>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-4 py-3 text-sm text-[#9ca3af] whitespace-pre-wrap">
              {conversation.human_response}
            </div>
            <p className="text-xs text-[#9ca3af] mt-2">
              Repondu le {new Date(conversation.human_responded_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}

        {/* Save template modal */}
        <AnimatePresence>
          {showSaveTemplateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
              onClick={() => setShowSaveTemplateModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white border border-[#f0f0f0] rounded-2xl shadow-2xl w-full max-w-md"
              >
                <div className="flex items-center justify-between p-5 border-b border-[#f0f0f0]">
                  <h3 className="text-[14px] font-bold text-[#1a1a1a]">Sauvegarder comme template</h3>
                  <button onClick={() => setShowSaveTemplateModal(false)} className="text-[#9ca3af] hover:text-[#1a1a1a]">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label htmlFor="esc-template-name" className="block text-[11px] font-semibold text-[#71717a] uppercase tracking-wider mb-1.5">Nom du template *</label>
                    <input
                      id="esc-template-name"
                      type="text"
                      value={newTplName}
                      onChange={(e) => setNewTplName(e.target.value)}
                      placeholder="Ex : Remboursement livraison retardee"
                      className="w-full bg-[#fafafa] border border-[#ebebeb] rounded-lg px-3 py-2 text-[13px] text-[#1a1a1a] outline-none focus:border-cta/30"
                    />
                  </div>
                  <div>
                    <label htmlFor="esc-template-category" className="block text-[11px] font-semibold text-[#71717a] uppercase tracking-wider mb-1.5">Categorie</label>
                    <input
                      id="esc-template-category"
                      type="text"
                      value={newTplCategory}
                      onChange={(e) => setNewTplCategory(e.target.value)}
                      placeholder="Ex : Remboursement, Livraison, SAV..."
                      className="w-full bg-[#fafafa] border border-[#ebebeb] rounded-lg px-3 py-2 text-[13px] text-[#1a1a1a] outline-none focus:border-cta/30"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] font-semibold text-[#71717a] uppercase tracking-wider mb-1.5">Apercu</span>
                    <div className="bg-[#fafafa] border border-[#ebebeb] rounded-lg p-3 text-[12px] text-[#71717a] max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {response}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 p-5 border-t border-[#f0f0f0]">
                  <button
                    type="button"
                    onClick={() => setShowSaveTemplateModal(false)}
                    className="px-4 py-2 rounded-lg text-[12px] font-semibold text-[#9ca3af] hover:text-[#1a1a1a]"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={saveCurrentAsTemplate}
                    disabled={!newTplName.trim() || savingTpl}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold bg-cta text-white hover:bg-[#003725] transition-all disabled:opacity-50"
                  >
                    {savingTpl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Sauvegarder
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toasts now go through the global Sonner Toaster mounted in App.jsx. */}
      </motion.div>
    </motion.div>
  )
}

export const ClientEscalationsView = ({ clientId, theme = 'dark' }) => {
  const isLight = theme === 'light'
  const [filter, setFilter] = useState('pending')
  const [selectedConversation, setSelectedConversation] = useState(null)

  const { data: escalations = [], isLoading } = useQuery({
    queryKey: ['escalations', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'escalated')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!clientId,
  })

  const { data: allEscalations = [] } = useQuery({
    queryKey: ['all-escalations', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('client_id', clientId)
        .or('status.eq.escalated,human_response.not.is.null')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!clientId,
  })

  const { data: stats } = useQuery({
    queryKey: ['escalation-stats', clientId],
    queryFn: async () => {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const { data: monthEscalations } = await supabase
        .from('ai_conversations')
        .select('id, created_at, human_responded_at')
        .eq('client_id', clientId)
        .or('status.eq.escalated,human_response.not.is.null')
        .gte('created_at', startOfMonth)

      const { count: totalConvos } = await supabase
        .from('ai_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .gte('created_at', startOfMonth)

      const responded = (monthEscalations || []).filter(e => e.human_responded_at)
      const avgResponseTime = responded.length > 0
        ? responded.reduce((sum, e) => sum + (new Date(e.human_responded_at) - new Date(e.created_at)), 0) / responded.length / 3600000
        : 0

      return {
        monthCount: (monthEscalations || []).length,
        avgResponseHours: Math.round(avgResponseTime * 10) / 10,
        escalationRate: totalConvos > 0 ? (((monthEscalations || []).length / totalConvos) * 100).toFixed(1) : 0,
      }
    },
    enabled: !!clientId,
  })

  // Realtime subscription
  useEffect(() => {
    if (!clientId) return
    const channel = supabase
      .channel('escalations-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ai_conversations',
        filter: `client_id=eq.${clientId}`,
      }, () => {
        // Invalidate will be handled by React Query
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [clientId])

  const filtered = filter === 'pending'
    ? allEscalations.filter(e => e.status === 'escalated' && !e.human_response)
    : filter === 'resolved'
      ? allEscalations.filter(e => e.human_response)
      : allEscalations

  const pendingCount = allEscalations.filter(e => e.status === 'escalated' && !e.human_response).length

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <h2
          className="text-2xl italic tracking-tight text-[#1a1a1a]"
          style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 }}
        >
          Escalades
        </h2>
        <p className="text-[15px] text-[#5A5A5A] mt-1">
          Les tickets qui nécessitent ton intervention — ton agent a identifié une situation délicate.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`rounded-xl border p-4 bg-white border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)]`}>
          <p className={`text-xs font-bold uppercase tracking-wider text-[#9ca3af]`}>Escalades ce mois</p>
          <p className={`text-2xl font-bold mt-1 text-[#1a1a1a]`}>{stats?.monthCount || 0}</p>
        </div>
        <div className={`rounded-xl border p-4 bg-white border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)]`}>
          <p className={`text-xs font-bold uppercase tracking-wider text-[#9ca3af]`}>Temps moyen de reponse</p>
          <p className={`text-2xl font-bold mt-1 text-[#1a1a1a]`}>{stats?.avgResponseHours || 0}h</p>
        </div>
        <div className={`rounded-xl border p-4 bg-white border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)]`}>
          <p className={`text-xs font-bold uppercase tracking-wider text-[#9ca3af]`}>Taux d&apos;escalade</p>
          <p className={`text-2xl font-bold mt-1 text-[#1a1a1a]`}>{stats?.escalationRate || 0}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex p-1 rounded-xl border border-[#f0f0f0] bg-[#fafafa] w-fit">
        {[
          { id: 'pending', label: 'À traiter', count: pendingCount },
          { id: 'resolved', label: 'Traités' },
          { id: 'all', label: 'Tous' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-all flex items-center gap-2 ${
              filter === f.id
                ? 'bg-white text-[#1a1a1a] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                : 'text-[#9ca3af] hover:text-[#1a1a1a]'
            }`}
          >
            {f.label}
            {f.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400">{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {pendingCount > 0 && (
        <p className={`text-sm font-medium ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>
          <AlertTriangle className="w-4 h-4 inline mr-1" />
          {pendingCount} ticket{pendingCount > 1 ? 's' : ''} en attente de reponse
        </p>
      )}

      {/* List */}
      {isLoading ? (
        <div aria-busy="true" aria-label="Chargement des escalades">
          <SkeletonList n={5} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-white border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <EmptyState
            icon={CheckCircle2}
            tone="success"
            title={filter === 'pending' ? 'Aucune escalade en attente' : 'Aucune escalade pour le moment'}
            description={filter === 'pending'
              ? 'Ton agent gère tout en autonomie. Les tickets qui nécessitent ton intervention apparaîtront ici.'
              : 'Dès qu\'un ticket sera escaladé à ton équipe, tu le verras apparaître ici avec le raisonnement de l\'agent.'}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((conv) => {
            const overdue = isOverdue(conv.created_at) && !conv.human_response
            const reason = ESCALATION_REASONS[conv.escalation_reason] || ESCALATION_REASONS.default
            return (
              <motion.div
                key={conv.id}
                layout
                onClick={() => setSelectedConversation(conv)}
                className={`rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] bg-white p-5 cursor-pointer transition-all hover:border-gray-300 ${overdue ? 'border-l-2 border-l-red-500' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {conv.human_response ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Resolu
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          En attente
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fafafa] text-[#9ca3af] border border-[#f0f0f0]">
                        {reason}
                      </span>
                      <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-red-400' : 'text-[#9ca3af]'}`}>
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(conv.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium text-[#1a1a1a]`}>
                        {formatCustomerName(conv)}
                        {formatSubject(conv) ? ` — ${formatSubject(conv)}` : ''}
                      </p>
                      {conv.customer_email && !conv.customer_email.includes('@anonymous.actero.fr') && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                          <Mail className="w-2.5 h-2.5" /> Email
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-1 line-clamp-1 text-[#9ca3af]`}>
                      {conv.customer_message}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {selectedConversation && (
          <EscalationDrawer
            conversation={selectedConversation}
            onClose={() => setSelectedConversation(null)}
            clientId={clientId}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
