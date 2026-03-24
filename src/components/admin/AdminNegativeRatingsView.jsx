import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ThumbsDown, AlertTriangle, MessageCircle, User, Clock, Loader2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

export const AdminNegativeRatingsView = () => {
  const [selectedClientId, setSelectedClientId] = useState(null)

  const { data: clients = [] } = useQuery({
    queryKey: ['admin-clients-ratings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, brand_name, client_type')
        .order('brand_name')
      if (error) throw error
      return data || []
    },
  })

  const { data: ratingsData = [], isLoading } = useQuery({
    queryKey: ['admin-negative-ratings', selectedClientId],
    queryFn: async () => {
      let query = supabase
        .from('ai_conversations')
        .select('id, client_id, customer_email, customer_name, subject, customer_message, ai_response, rating, rating_comment, rated_at, created_at')
        .eq('rating', 'negative')
        .order('rated_at', { ascending: false })
        .limit(100)

      if (selectedClientId) {
        query = query.eq('client_id', selectedClientId)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
  })

  // Calculate satisfaction rates per client
  const { data: satisfactionByClient = {} } = useQuery({
    queryKey: ['admin-satisfaction-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('client_id, rating')
        .not('rating', 'is', null)
      if (error) return {}

      const byClient = {}
      ;(data || []).forEach(c => {
        if (!byClient[c.client_id]) byClient[c.client_id] = { positive: 0, total: 0 }
        byClient[c.client_id].total++
        if (c.rating === 'positive') byClient[c.client_id].positive++
      })

      const rates = {}
      Object.entries(byClient).forEach(([clientId, counts]) => {
        rates[clientId] = counts.total >= 5
          ? Math.round((counts.positive / counts.total) * 100)
          : null
      })
      return rates
    },
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <h2 className="text-2xl font-bold text-white">Notations negatives</h2>
        <p className="text-sm text-gray-500 mt-1">Reponses IA mal notees par les clients — analyse des problemes de brand_context</p>
      </div>

      {/* Client satisfaction overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {clients.map(client => {
          const rate = satisfactionByClient[client.id]
          const isLow = rate !== null && rate < 80
          return (
            <button
              key={client.id}
              onClick={() => setSelectedClientId(selectedClientId === client.id ? null : client.id)}
              className={`rounded-xl border p-3 text-left transition-all ${
                selectedClientId === client.id
                  ? 'bg-white/10 border-white/20'
                  : 'bg-[#0a0a0a] border-white/10 hover:border-white/20'
              }`}
            >
              <p className="text-sm font-bold text-white truncate">{client.brand_name}</p>
              <div className="flex items-center gap-2 mt-1">
                {rate !== null ? (
                  <span className={`text-xs font-bold ${isLow ? 'text-red-400' : 'text-emerald-400'}`}>
                    {rate}%
                  </span>
                ) : (
                  <span className="text-xs text-zinc-600">—</span>
                )}
                {isLow && <AlertTriangle className="w-3 h-3 text-red-400" />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Alerts */}
      {Object.entries(satisfactionByClient).filter(([, rate]) => rate !== null && rate < 80).length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <p className="text-sm font-bold text-red-400">Clients sous 80% de satisfaction</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(satisfactionByClient)
              .filter(([, rate]) => rate !== null && rate < 80)
              .map(([clientId, rate]) => {
                const client = clients.find(c => c.id === clientId)
                return (
                  <button
                    key={clientId}
                    onClick={() => setSelectedClientId(clientId)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-all"
                  >
                    {client?.brand_name || 'Client'} ({rate}%)
                  </button>
                )
              })}
          </div>
        </div>
      )}

      {/* Negative ratings list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      ) : ratingsData.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border bg-[#0a0a0a] border-white/10">
          <ThumbsDown className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Aucune notation negative{selectedClientId ? ' pour ce client' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ratingsData.map((conv) => {
            const client = clients.find(c => c.id === conv.client_id)
            return (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ThumbsDown className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-bold text-white">{client?.brand_name || 'Client'}</span>
                    {conv.customer_name && (
                      <span className="text-xs text-zinc-500">
                        <User className="w-3 h-3 inline mr-1" />{conv.customer_name}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-600">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {conv.rated_at ? new Date(conv.rated_at).toLocaleDateString('fr-FR') : '—'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Message client</p>
                    <p className="text-xs text-zinc-400 bg-white/5 rounded-lg px-3 py-2 line-clamp-3">
                      {conv.customer_message}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Reponse IA</p>
                    <p className="text-xs text-zinc-400 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2 line-clamp-3">
                      {conv.ai_response}
                    </p>
                  </div>
                </div>

                {conv.rating_comment && (
                  <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2">
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">Commentaire du client</p>
                    <p className="text-xs text-amber-300">{conv.rating_comment}</p>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
