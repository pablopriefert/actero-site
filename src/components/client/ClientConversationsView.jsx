import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Tag,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const StatusBadge = ({ status }) => {
  const isResolved = status === 'ticket_resolved' || status === 'resolved';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
      isResolved
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    }`}>
      {isResolved ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
      {isResolved ? 'Resolu' : 'Escalade'}
    </span>
  );
};

const RatingButtons = ({ conversation, onRate }) => {
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState(conversation.rating_comment || '')

  const handleRate = (rating) => {
    if (rating === 'negative') {
      setShowComment(true)
    }
    onRate({ id: conversation.id, rating, comment: rating === 'positive' ? null : comment })
  }

  const submitComment = () => {
    onRate({ id: conversation.id, rating: 'negative', comment })
    setShowComment(false)
  }

  if (conversation.rating === 'positive') {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => onRate({ id: conversation.id, rating: null, comment: null })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold transition-all hover:bg-emerald-500/20"
        >
          <ThumbsUp className="w-3.5 h-3.5 fill-current" />
          Approuve
        </button>
      </div>
    )
  }

  if (conversation.rating === 'negative') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onRate({ id: conversation.id, rating: null, comment: null })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold transition-all hover:bg-red-500/20"
          >
            <ThumbsDown className="w-3.5 h-3.5 fill-current" />
            Insatisfait
          </button>
        </div>
        {!conversation.rating_comment && !showComment && (
          <button
            onClick={() => setShowComment(true)}
            className="text-xs text-[#716D5C] hover:text-[#716D5C] transition-colors"
          >
            Ajouter un commentaire
          </button>
        )}
        {conversation.rating_comment && (
          <p className="text-xs text-[#716D5C] italic bg-gray-50 rounded-lg px-3 py-2">
            {conversation.rating_comment}
          </p>
        )}
        {showComment && !conversation.rating_comment && (
          <div className="flex gap-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              placeholder="Qu'est-ce qui n'allait pas dans cette reponse ?"
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-[#262626] outline-none resize-none"
              rows={2}
            />
            <button
              onClick={submitComment}
              className="px-3 py-2 rounded-lg bg-gray-50 text-[#262626] text-xs font-bold hover:bg-gray-100 transition-all self-end"
            >
              OK
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleRate('positive')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-[#716D5C] text-xs font-bold transition-all hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => handleRate('negative')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-[#716D5C] text-xs font-bold transition-all hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

const SatisfactionGauge = ({ rate, totalRated }) => {
  const circumference = 2 * Math.PI * 36
  const progress = rate !== null ? (rate / 100) * circumference : 0
  const color = rate >= 80 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#ef4444'

  if (totalRated < 10) {
    return (
      <div className="bg-[#F9F7F1] border border-gray-200 rounded-xl px-5 py-3 flex items-center gap-3">
        <ThumbsUp className="w-4 h-4 text-[#716D5C]" />
        <div>
          <p className="text-xs text-[#716D5C]">Satisfaction</p>
          <p className="text-sm font-bold text-[#716D5C]">Pas assez de donnees</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#F9F7F1] border border-gray-200 rounded-xl px-5 py-3 flex items-center gap-4">
      <div className="relative w-14 h-14">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
          <circle
            cx="40" cy="40" r="36" fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-[#262626]">{rate}%</span>
        </div>
      </div>
      <div>
        <p className="text-xs text-[#716D5C]">Taux de satisfaction</p>
        <p className="text-sm font-bold text-[#262626]">{rate}% de reponses approuvees</p>
        <p className="text-[10px] text-[#716D5C]">{totalRated} reponses notees</p>
      </div>
    </div>
  )
}

const ConversationCard = ({ event, onRate, isFromAiConversations }) => {
  const [expanded, setExpanded] = useState(false);

  // Support both automation_events and ai_conversations formats
  const meta = event.metadata || {};
  const customerMessage = isFromAiConversations ? event.customer_message : (meta.customer_message || null);
  const aiResponse = isFromAiConversations ? event.ai_response : (meta.ai_response || null);
  const ticketType = isFromAiConversations ? event.ticket_type : (meta.ticket_type || event.event_type || null);
  const status = isFromAiConversations ? event.status : event.event_category;
  const fallbackText = event.description || event.subject || 'Aucun detail disponible';

  const displayMessage = customerMessage || fallbackText;
  const displayResponse = aiResponse || null;

  const ts = new Date(event.created_at);
  const formattedDate = ts.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      layout
      className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden hover:border-gray-300 transition-colors"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-start gap-4"
      >
        <div className="mt-0.5">
          <MessageCircle className="w-5 h-5 text-[#716D5C]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            <StatusBadge status={status} />
            {ticketType && (
              <span className="inline-flex items-center gap-1 text-xs text-[#716D5C]">
                <Tag className="w-3 h-3" />
                {ticketType}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-[#716D5C]">
              <Clock className="w-3 h-3" />
              {formattedDate} {formattedTime}
            </span>
            {event.response_time_ms && (
              <span className="inline-flex items-center gap-1 text-xs text-[#716D5C]">
                {Math.round(event.response_time_ms / 1000)}s
              </span>
            )}
          </div>
          <p className="text-sm text-[#716D5C] line-clamp-2">{displayMessage}</p>
        </div>
        <div className="mt-1 text-[#716D5C]">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
              <div>
                <p className="text-xs font-bold text-[#716D5C] mb-1.5 uppercase tracking-wider">Message client</p>
                <p className="text-sm text-[#716D5C] bg-gray-50 rounded-xl px-4 py-3 whitespace-pre-wrap">
                  {customerMessage || fallbackText}
                </p>
              </div>
              {displayResponse && (
                <div>
                  <p className="text-xs font-bold text-[#716D5C] mb-1.5 uppercase tracking-wider">Reponse IA</p>
                  <p className="text-sm text-[#716D5C] bg-blue-500/5 border border-blue-500/10 rounded-xl px-4 py-3 whitespace-pre-wrap">
                    {displayResponse}
                  </p>
                </div>
              )}
              {/* Rating buttons */}
              {isFromAiConversations && (
                <div className="pt-2">
                  <p className="text-xs font-bold text-[#716D5C] mb-2 uppercase tracking-wider">Votre avis</p>
                  <RatingButtons conversation={event} onRate={onRate} />
                </div>
              )}
              {!isFromAiConversations && meta && Object.keys(meta).length > 0 && (
                <div>
                  <p className="text-xs font-bold text-[#716D5C] mb-1.5 uppercase tracking-wider">Details</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(meta)
                      .filter(([k]) => !['customer_message', 'ai_response', 'ticket_type'].includes(k))
                      .map(([k, v]) => (
                        <div key={k} className="bg-gray-50 rounded-lg px-3 py-2">
                          <p className="text-xs text-[#716D5C]">{k}</p>
                          <p className="text-xs text-[#716D5C] truncate">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const ClientConversationsView = ({ clientId }) => {
  const queryClient = useQueryClient()

  // Fetch from ai_conversations table first (preferred)
  const {
    data: aiConversations = [],
    isLoading: aiLoading,
    refetch: refetchAi,
  } = useQuery({
    queryKey: ['ai-conversations', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) {
        // Table might not exist yet, silently fall back to automation_events.
        return []
      }
      return data
    },
    enabled: !!clientId,
  })

  // Fallback: fetch from automation_events if ai_conversations is empty
  const {
    data: eventConversations = [],
    isLoading: eventsLoading,
    isError: eventsError,
    refetch: refetchEvents,
    isFetching: eventsFetching,
  } = useQuery({
    queryKey: ['client-conversations-events', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_events')
        .select('id, event_category, event_type, description, metadata, created_at')
        .eq('client_id', clientId)
        .in('event_category', ['ticket_resolved', 'ticket_escalated'])
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!clientId && aiConversations.length === 0,
  });

  const handleRetry = () => {
    refetchAi()
    refetchEvents()
  }

  const rateMutation = useMutation({
    mutationFn: async ({ id, rating, comment }) => {
      const updateData = {
        rating,
        rating_comment: comment,
        rated_at: rating ? new Date().toISOString() : null,
      }
      const { error } = await supabase
        .from('ai_conversations')
        .update(updateData)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-conversations', clientId] })
    },
  })

  const useAiConversations = aiConversations.length > 0
  const conversations = useAiConversations ? aiConversations : eventConversations
  const isLoading = aiLoading || eventsLoading

  const resolvedCount = useAiConversations
    ? conversations.filter(c => c.status === 'resolved').length
    : conversations.filter(c => c.event_category === 'ticket_resolved').length
  const escalatedCount = useAiConversations
    ? conversations.filter(c => c.status === 'escalated').length
    : conversations.filter(c => c.event_category === 'ticket_escalated').length

  // Satisfaction rate
  const ratedConversations = aiConversations.filter(c => c.rating)
  const positiveCount = ratedConversations.filter(c => c.rating === 'positive').length
  const satisfactionRate = ratedConversations.length >= 10
    ? Math.round((positiveCount / ratedConversations.length) * 100)
    : null

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <h2 className="text-2xl font-bold text-[#262626] tracking-tight mb-1">Conversations IA</h2>
        <p className="text-[#716D5C] text-sm">Historique des echanges traites par l&apos;intelligence artificielle.</p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4">
        <div className="bg-[#F9F7F1] border border-gray-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <div>
            <p className="text-xs text-[#716D5C]">Resolus</p>
            <p className="text-lg font-bold text-[#262626]">{resolvedCount}</p>
          </div>
        </div>
        <div className="bg-[#F9F7F1] border border-gray-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <div>
            <p className="text-xs text-[#716D5C]">Escalades</p>
            <p className="text-lg font-bold text-[#262626]">{escalatedCount}</p>
          </div>
        </div>
        <SatisfactionGauge rate={satisfactionRate} totalRated={ratedConversations.length} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16" role="status" aria-label="Chargement des conversations">
          <Loader2 className="w-6 h-6 animate-spin text-[#716D5C]" />
        </div>
      ) : eventsError ? (
        <div
          className="bg-white border border-gray-200 rounded-2xl p-10 text-center"
          role="alert"
        >
          <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <p className="text-sm font-semibold text-[#262626] mb-1">
            Impossible de charger les conversations
          </p>
          <p className="text-xs text-[#716D5C] mb-5">
            Verifiez votre connexion et reessayez.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={eventsFetching}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#262626] text-white text-xs font-semibold hover:bg-[#1a1a1a] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${eventsFetching ? 'animate-spin' : ''}`} />
            {eventsFetching ? 'Rechargement...' : 'Reessayer'}
          </button>
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full bg-[#0F5F35]/5" />
            <div className="absolute inset-2 rounded-full bg-[#0F5F35]/10 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-[#0F5F35]" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
              <Sparkles className="w-3 h-3 text-[#0F5F35]" />
            </div>
          </div>
          <p className="text-base font-semibold text-[#262626] mb-1">
            Aucune conversation pour le moment
          </p>
          <p className="text-sm text-[#716D5C] max-w-sm mx-auto mb-6">
            Des que votre agent IA traitera ses premiers echanges, ils apparaitront ici avec leurs notes et statuts.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={eventsFetching}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-[#262626] hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${eventsFetching ? 'animate-spin' : ''}`} />
            Rafraichir
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((event) => (
            <ConversationCard
              key={event.id}
              event={event}
              isFromAiConversations={useAiConversations}
              onRate={(data) => rateMutation.mutate(data)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
