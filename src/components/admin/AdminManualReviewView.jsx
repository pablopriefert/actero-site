import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, CheckCircle2, XCircle, Edit3, Loader2,
  Mail, User, Clock, Sparkles,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

export const AdminManualReviewView = () => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [acting, setActing] = useState(null)
  const [editingResponse, setEditingResponse] = useState({})

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['admin-reviews'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/engine/reviews', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      })
      if (!res.ok) throw new Error('Erreur chargement')
      const data = await res.json()
      return data.reviews || []
    },
    refetchInterval: 15000,
  })

  const handleAction = async (reviewId, action, modifiedResponse) => {
    setActing(reviewId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/engine/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          review_id: reviewId,
          action,
          modified_response: modifiedResponse || undefined,
        }),
      })
      if (!res.ok) throw new Error('Erreur')
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] })
      toast.success(action === 'approved' ? 'Approuve et envoye' : action === 'modified' ? 'Modifie et envoye' : 'Rejete')
    } catch (err) {
      toast.error(err.message)
    }
    setActing(null)
  }

  const pendingCount = reviews.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[24px] font-bold text-[#1a1a1a]">Manual Review</h2>
        <p className="text-[13px] text-[#71717a]">
          {pendingCount > 0 ? `${pendingCount} evenement${pendingCount > 1 ? 's' : ''} en attente de validation` : 'Aucun evenement en attente'}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#71717a]" /></div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 text-[#71717a]">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-[15px] font-bold">Tout est gere !</p>
          <p className="text-[13px]">Aucun evenement en attente de review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(review => {
            const event = review.engine_events || {}
            const normalized = event.normalized || {}
            const proposed = review.proposed_action || {}
            const isEditing = editingResponse[review.id] !== undefined

            return (
              <div key={review.id} className="bg-white border border-[#f0f0f0] rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 flex items-center gap-3 bg-amber-50 border-b border-amber-200">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <div className="flex-1">
                    <p className="font-bold text-[13px] text-[#1a1a1a]">
                      {normalized.customer_name || normalized.customer_email || 'Client'}
                    </p>
                    <p className="text-[12px] text-amber-600">
                      {review.reason === 'low_confidence' && 'Confiance insuffisante'}
                      {review.reason === 'error' && 'Erreur IA'}
                      {review.reason === 'rule' && 'Regle declenchee'}
                      {review.reason === 'sentiment' && 'Sentiment tres negatif'}
                      {review.reason === 'injection' && 'Injection detectee'}
                      {' — '}{new Date(review.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase">
                    {review.status}
                  </span>
                </div>

                {/* Customer message */}
                <div className="p-4 space-y-3">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                      <User className="w-3 h-3" /> Message client
                    </p>
                    <p className="text-[13px] text-[#1a1a1a]">{normalized.message || 'Pas de message'}</p>
                  </div>

                  {/* Proposed AI response */}
                  {proposed.ai_response && (
                    <div className="p-3 bg-emerald-50 rounded-xl">
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Reponse proposee par l'IA
                      </p>
                      {isEditing ? (
                        <textarea
                          value={editingResponse[review.id]}
                          onChange={(e) => setEditingResponse(prev => ({ ...prev, [review.id]: e.target.value }))}
                          rows={4}
                          className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-[13px] outline-none resize-y"
                        />
                      ) : (
                        <p className="text-[13px] text-[#1a1a1a]">{proposed.ai_response}</p>
                      )}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex flex-wrap gap-3 text-[12px] text-[#71717a]">
                    {proposed.classification && <span className="bg-[#ffffff] px-2 py-1 rounded">Classification: {proposed.classification}</span>}
                    {normalized.customer_email && <span className="bg-[#ffffff] px-2 py-1 rounded">{normalized.customer_email}</span>}
                    {event.source && <span className="bg-[#ffffff] px-2 py-1 rounded">Source: {event.source}</span>}
                  </div>

                  {/* Actions */}
                  {review.status === 'pending' && (
                    <div className="flex gap-2 pt-2 border-t border-[#f0f0f0]">
                      <button
                        onClick={() => handleAction(review.id, 'approved')}
                        disabled={acting === review.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#0F5F35] text-white text-[12px] font-bold rounded-lg hover:bg-[#003725] disabled:opacity-50"
                      >
                        {acting === review.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Approuver et envoyer
                      </button>
                      <button
                        onClick={() => {
                          if (isEditing) {
                            handleAction(review.id, 'modified', editingResponse[review.id])
                          } else {
                            setEditingResponse(prev => ({ ...prev, [review.id]: proposed.ai_response || '' }))
                          }
                        }}
                        disabled={acting === review.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 text-[12px] font-bold rounded-lg hover:bg-blue-100 disabled:opacity-50"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        {isEditing ? 'Envoyer la version modifiee' : 'Modifier'}
                      </button>
                      <button
                        onClick={() => handleAction(review.id, 'rejected')}
                        disabled={acting === review.id}
                        className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Rejeter
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
