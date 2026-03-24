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
  X,
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
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Ajouter un commentaire
          </button>
        )}
        {conversation.rating_comment && (
          <p className="text-xs text-zinc-500 italic bg-white/5 rounded-lg px-3 py-2">
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
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none resize-none"
              rows={2}
            />
            <button
              onClick={submitComment}
              className="px-3 py-2 rounded-lg bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-all self-end"
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-zinc-500 text-xs font-bold transition-all hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => handleRate('negative')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-zinc-500 text-xs font-bold transition-all hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
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
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl px-5 py-3 flex items-center gap-3">
        <ThumbsUp className="w-4 h-4 text-zinc-600" />
        <div>
          <p className="text-xs text-zinc-500">Satisfaction</p>
          <p className="text-sm font-bold text-zinc-500">Pas assez de donnees</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl px-5 py-3 flex items-center gap-4">
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
          <span className="text-xs font-bold text-white">{rate}%</span>
        </div>
      </div>
      <div>
        <p className="text-xs text-zinc-500">Taux de satisfaction</p>
        <p className="text-sm font-bold text-white">{rate}% de reponses approuvees</p>
        <p className="text-[10px] text-zinc-600">{totalRated} reponses notees</p>
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
      className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden hover:border-white/15 transition-colors"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-start gap-4"
      >
        <div className="mt-0.5">
          <MessageCircle className="w-5 h-5 text-zinc-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            <StatusBadge status={status} />
            {ticketType && (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                <Tag className="w-3 h-3" />
                {ticketType}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
              <Clock className="w-3 h-3" />
              {formattedDate} {formattedTime}
            </span>
            {event.response_time_ms && (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
                {Math.round(event.response_time_ms / 1000)}s
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-300 line-clamp-2">{displayMessage}</p>
        </div>
        <div className="mt-1 text-zinc-600">
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
            <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
              <div>
                <p className="text-xs font-bold text-zinc-500 mb-1.5 uppercase tracking-wider">Message client</p>
                <p className="text-sm text-zinc-300 bg-white/5 rounded-xl px-4 py-3 whitespace-pre-wrap">
                  {customerMessage || fallbackText}
                </p>
              </div>
              {displayResponse && (
                <div>
                  <p className="text-xs font-bold text-zinc-500 mb-1.5 uppercase tracking-wider">Reponse IA</p>
                  <p className="text-sm text-zinc-300 bg-blue-500/5 border border-blue-500/10 rounded-xl px-4 py-3 whitespace-pre-wrap">
                    {displayResponse}
                  </p>
                </div>
              )}
              {/* Rating buttons */}
              {isFromAiConversations && (
                <div className="pt-2">
                  <p className="text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">Votre avis</p>
                  <RatingButtons conversation={event} onRate={onRate} />
                </div>
              )}
              {!isFromAiConversations && meta && Object.keys(meta).length > 0 && (
                <div>
                  <p className="text-xs font-bold text-zinc-500 mb-1.5 uppercase tracking-wider">Details</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(meta)
                      .filter(([k]) => !['customer_message', 'ai_response', 'ticket_type'].includes(k))
                      .map(([k, v]) => (
                        <div key={k} className="bg-white/5 rounded-lg px-3 py-2">
                          <p className="text-xs text-zinc-500">{k}</p>
                          <p className="text-xs text-zinc-300 truncate">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</p>
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
  const { data: aiConversations = [], isLoading: aiLoading } = useQuery({
    queryKey: ['ai-conversations', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) {
        // Table might not exist yet, fall back
        console.warn('ai_conversations not available:', error.message)
        return []
      }
      return data
    },
    enabled: !!clientId,
  })

  // Fallback: fetch from automation_events if ai_conversations is empty
  const { data: eventConversations = [], isLoading: eventsLoading } = useQuery({
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
        <h2 className="text-2xl font-bold text-white tracking-tight mb-1">Conversations IA</h2>
        <p className="text-zinc-500 text-sm">Historique des echanges traites par l&apos;intelligence artificielle.</p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4">
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl px-5 py-3 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <div>
            <p className="text-xs text-zinc-500">Resolus</p>
            <p className="text-lg font-bold text-white">{resolvedCount}</p>
          </div>
        </div>
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl px-5 py-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <div>
            <p className="text-xs text-zinc-500">Escalades</p>
            <p className="text-lg font-bold text-white">{escalatedCount}</p>
          </div>
        </div>
        <SatisfactionGauge rate={satisfactionRate} totalRated={ratedConversations.length} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircle className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Aucune conversation IA pour le moment.</p>
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
