import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, Clock, User, Mail, ShoppingCart, Send,
  CheckCircle2, X, Loader2, BookOpen, ChevronDown, TrendingDown,
  MessageCircle, FileText
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const ESCALATION_REASONS = {
  aggressive: 'Message agressif detecte',
  low_confidence: 'Confiance IA < 60%',
  out_of_policy: 'Demande hors politique',
  legal_mention: 'Mention juridique',
  default: 'Escalade automatique',
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

  const respondMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/escalation/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversation.id,
          response,
          add_to_kb: addToKb,
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
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalations', clientId] })
      queryClient.invalidateQueries({ queryKey: ['escalation-stats', clientId] })
      onClose()
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
        className="bg-white border border-gray-100 rounded-2xl shadow-sm w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-[#262626] font-bold">Ticket escalade</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {reason}
                </span>
                <span className={`text-xs ${isOverdue(conversation.created_at) ? 'text-red-400' : 'text-[#716D5C]'}`}>
                  <Clock className="w-3 h-3 inline mr-1" />
                  {formatTimeAgo(conversation.created_at)}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-[#716D5C] hover:text-[#262626]"><X className="w-5 h-5" /></button>
        </div>

        {/* Client info */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex flex-wrap gap-4 text-xs text-[#716D5C]">
            {conversation.customer_name && (
              <span className="flex items-center gap-1"><User className="w-3 h-3" /> {conversation.customer_name}</span>
            )}
            {conversation.customer_email && (
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {conversation.customer_email}</span>
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
            <p className="text-xs font-bold text-[#716D5C] uppercase tracking-wider mb-2">Message du client</p>
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-[#716D5C] whitespace-pre-wrap">
              {conversation.customer_message}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-[#716D5C] uppercase tracking-wider mb-2">Reponse IA</p>
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl px-4 py-3 text-sm text-[#716D5C] italic">
              {conversation.ai_response || 'L\'IA n\'a pas pu repondre a ce message.'}
            </div>
          </div>
        </div>

        {/* Response area */}
        {!conversation.human_response ? (
          <div className="p-6 border-t border-gray-200 space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#716D5C] uppercase tracking-wider mb-2">Votre reponse</label>
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={5}
                placeholder="Redigez votre reponse..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#262626] outline-none resize-none focus:border-gray-400"
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={addToKb}
                onChange={(e) => setAddToKb(e.target.checked)}
                className="mt-0.5 rounded border-white/20 bg-gray-50 text-blue-500"
              />
              <div>
                <span className="text-sm text-[#716D5C] group-hover:text-[#262626] transition-colors">
                  Ajouter cette reponse a ma base de connaissances
                </span>
                <p className="text-xs text-[#716D5C] mt-0.5">
                  L&apos;IA saura repondre a cette question la prochaine fois
                </p>
              </div>
            </label>

            <div className="flex items-center gap-3">
              <button
                onClick={() => respondMutation.mutate()}
                disabled={!response.trim() || respondMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-[#262626] hover:bg-gray-100 transition-all disabled:opacity-50"
              >
                {respondMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Envoyer la reponse
              </button>
              <button
                onClick={() => ignoreMutation.mutate()}
                disabled={ignoreMutation.isPending}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#716D5C] hover:text-[#262626] transition-colors"
              >
                Ignorer
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Repondu</p>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-4 py-3 text-sm text-[#716D5C] whitespace-pre-wrap">
              {conversation.human_response}
            </div>
            <p className="text-xs text-[#716D5C] mt-2">
              Repondu le {new Date(conversation.human_responded_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}
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
        <h2 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-[#262626]' : 'text-[#262626]'}`}>
          Escalades
        </h2>
        <p className={`text-sm mt-1 ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>
          Tickets necessitant votre intervention.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`rounded-xl border p-4 ${isLight ? 'bg-white border-gray-200' : 'bg-white border-gray-100 shadow-sm'}`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>Escalades ce mois</p>
          <p className={`text-2xl font-bold mt-1 ${isLight ? 'text-[#262626]' : 'text-[#262626]'}`}>{stats?.monthCount || 0}</p>
        </div>
        <div className={`rounded-xl border p-4 ${isLight ? 'bg-white border-gray-200' : 'bg-white border-gray-100 shadow-sm'}`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>Temps moyen de reponse</p>
          <p className={`text-2xl font-bold mt-1 ${isLight ? 'text-[#262626]' : 'text-[#262626]'}`}>{stats?.avgResponseHours || 0}h</p>
        </div>
        <div className={`rounded-xl border p-4 ${isLight ? 'bg-white border-gray-200' : 'bg-white border-gray-100 shadow-sm'}`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>Taux d&apos;escalade</p>
          <p className={`text-2xl font-bold mt-1 ${isLight ? 'text-[#262626]' : 'text-[#262626]'}`}>{stats?.escalationRate || 0}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className={`flex p-1 rounded-xl border w-fit ${isLight ? 'bg-gray-100 border-gray-200' : 'bg-gray-50 border-gray-200'}`}>
        {[
          { id: 'pending', label: 'A traiter', count: pendingCount },
          { id: 'resolved', label: 'Traites' },
          { id: 'all', label: 'Tous' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              filter === f.id
                ? (isLight ? 'bg-white text-[#003725] shadow-sm' : 'bg-gray-50 text-[#262626]')
                : (isLight ? 'text-[#716D5C] hover:text-[#262626]' : 'text-[#716D5C] hover:text-[#716D5C]')
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
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#716D5C]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={`text-center py-16 rounded-2xl border ${isLight ? 'bg-white border-gray-200' : 'bg-white border-gray-100 shadow-sm'}`}>
          <CheckCircle2 className={`w-10 h-10 mx-auto mb-3 ${isLight ? 'text-slate-300' : 'text-[#716D5C]'}`} />
          <p className={`text-sm ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>
            {filter === 'pending' ? 'Aucun ticket en attente.' : 'Aucune escalade trouvee.'}
          </p>
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
                className={`rounded-2xl border p-5 cursor-pointer transition-all ${
                  isLight
                    ? 'bg-white border-gray-200 hover:border-slate-300'
                    : 'bg-white border-gray-100 shadow-sm hover:border-gray-300'
                } ${overdue ? 'border-l-2 border-l-red-500' : ''}`}
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
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 text-[#716D5C] border border-gray-200">
                        {reason}
                      </span>
                      <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-red-400' : 'text-[#716D5C]'}`}>
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(conv.created_at)}
                      </span>
                    </div>
                    <p className={`text-sm font-medium ${isLight ? 'text-[#262626]' : 'text-[#262626]'}`}>
                      {conv.customer_name || conv.customer_email || 'Client'}
                      {conv.subject ? ` — ${conv.subject}` : ''}
                    </p>
                    <p className={`text-xs mt-1 line-clamp-1 ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>
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
