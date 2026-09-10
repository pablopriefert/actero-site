import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare,
  Plus,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronRight,
  Shield,
  Zap,
  X,
  Send,
} from 'lucide-react'

// ============================================================
// STATUS CONFIG
// ============================================================
const STATUS_CONFIG = {
  en_attente: {
    label: 'En attente',
    color: { dark: 'bg-amber-500/10 text-amber-400 border-amber-500/20', light: 'bg-amber-50 text-amber-700 border-amber-200' },
    icon: Clock,
  },
  en_cours: {
    label: 'En cours',
    color: { dark: 'bg-blue-500/10 text-blue-400 border-blue-500/20', light: 'bg-blue-50 text-blue-700 border-blue-200' },
    icon: Loader2,
  },
  termine: {
    label: 'Livré',
    color: { dark: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', light: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    icon: CheckCircle2,
  },
}

const PRIORITY_CONFIG = {
  high: { label: 'Urgent', color: { dark: 'bg-red-500/10 text-red-400 border-red-500/20', light: 'bg-red-50 text-red-700 border-red-200' } },
  normal: { label: 'Normal', color: { dark: 'bg-blue-500/10 text-blue-400 border-blue-500/20', light: 'bg-blue-50 text-blue-700 border-blue-200' } },
  low: { label: 'Basse', color: { dark: 'bg-gray-50 text-[#716D5C] border-gray-200', light: 'bg-[#FFFFFF] text-[#716D5C] border-gray-200' } },
}

// ============================================================
// NEW TICKET FORM
// ============================================================
const NewTicketForm = ({ onSubmit, onCancel, theme, isSubmitting }) => {
  const isLight = theme === 'light'
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('normal')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({ title: title.trim(), description: description.trim(), priority })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`p-6 rounded-2xl border ${isLight ? 'bg-white border-gray-200' : 'bg-[#FFFFFF] border-gray-200'}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-base font-bold ${isLight ? 'text-[#262626]' : 'text-[#262626]'}`}>
          Nouvelle demande
        </h3>
        <button onClick={onCancel} className={`p-1 rounded-lg ${isLight ? 'hover:bg-gray-100 text-[#716D5C]' : 'hover:bg-gray-50 text-[#716D5C]'}`}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={`block text-xs font-bold mb-1.5 ${isLight ? 'text-slate-700' : 'text-[#716D5C]'}`}>
            Titre de la demande *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Ajouter une automatisation de relance SMS..."
            className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
              isLight
                ? 'bg-[#FFFFFF] border-gray-200 text-[#262626] placeholder-slate-400'
                : 'bg-gray-50 border-gray-200 text-[#262626] placeholder-gray-400'
            }`}
          />
        </div>

        <div>
          <label className={`block text-xs font-bold mb-1.5 ${isLight ? 'text-slate-700' : 'text-[#716D5C]'}`}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez votre besoin en détail..."
            rows={3}
            className={`w-full px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
              isLight
                ? 'bg-[#FFFFFF] border-gray-200 text-[#262626] placeholder-slate-400'
                : 'bg-gray-50 border-gray-200 text-[#262626] placeholder-gray-400'
            }`}
          />
        </div>

        <div>
          <label className={`block text-xs font-bold mb-1.5 ${isLight ? 'text-slate-700' : 'text-[#716D5C]'}`}>
            Priorité
          </label>
          <div className="flex gap-2">
            {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPriority(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  priority === key
                    ? config.color[isLight ? 'light' : 'dark']
                    : (isLight ? 'border-gray-200 text-[#716D5C] hover:bg-[#FFFFFF]' : 'border-gray-200 text-[#716D5C] hover:bg-gray-50')
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className={`px-4 py-2 rounded-xl text-sm font-bold ${isLight ? 'text-[#716D5C] hover:bg-[#FFFFFF]' : 'text-[#716D5C] hover:bg-gray-50'}`}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!title.trim() || isSubmitting}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-[#262626] transition-all ${
              !title.trim() || isSubmitting
                ? 'bg-violet-600/50 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-500'
            }`}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Envoyer
          </button>
        </div>
      </form>
    </motion.div>
  )
}

// ============================================================
// TICKET CARD
// ============================================================
const TicketCard = ({ ticket, theme }) => {
  const isLight = theme === 'light'
  const statusKey = ticket.status || 'en_attente'
  const status = STATUS_CONFIG[statusKey] || STATUS_CONFIG.en_attente
  const priorityKey = ticket.priority || 'normal'
  const priorityConf = PRIORITY_CONFIG[priorityKey] || PRIORITY_CONFIG.normal
  const StatusIcon = status.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-2xl border transition-colors ${
        isLight ? 'bg-white border-gray-200 hover:border-slate-300' : 'bg-[#FFFFFF] border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${status.color[isLight ? 'light' : 'dark']}`}>
              <StatusIcon className={`w-3 h-3 ${statusKey === 'en_cours' ? 'animate-spin' : ''}`} />
              {status.label}
            </span>
            {priorityKey === 'high' && (
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${priorityConf.color[isLight ? 'light' : 'dark']}`}>
                Urgent
              </span>
            )}
          </div>
          <h4 className={`text-sm font-bold ${isLight ? 'text-[#262626]' : 'text-[#262626]'}`}>
            {ticket.title}
          </h4>
          {ticket.description && (
            <p className={`text-xs mt-1 line-clamp-2 ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>
              {ticket.description}
            </p>
          )}
        </div>
        <span className={`text-[10px] tabular-nums shrink-0 ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>
          {new Date(ticket.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </motion.div>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export const SupportTicketsView = ({ supabase, clientId, theme }) => {
  const isLight = theme === 'light'
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('all')

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['client-tickets', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!clientId && !!supabase,
  })

  const createTicket = useMutation({
    mutationFn: async ({ title, description, priority }) => {
      const { data, error } = await supabase
        .from('requests')
        .insert({
          client_id: clientId,
          title,
          description,
          priority,
          status: 'en_attente',
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-tickets', clientId] })
      setShowForm(false)
    },
  })

  const filteredTickets = filter === 'all'
    ? tickets
    : tickets.filter(t => {
        const status = t.status || 'en_attente'
        if (filter === 'active') return ['en_attente', 'en_cours', 'nouveau', 'analyse'].includes(status)
        if (filter === 'done') return ['termine', 'valide', 'deploye'].includes(status)
        return true
      })

  const activeCount = tickets.filter(t => !['termine', 'valide', 'deploye'].includes(t.status || 'en_attente')).length
  const doneCount = tickets.filter(t => ['termine', 'valide', 'deploye'].includes(t.status)).length

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold mb-2 tracking-tight ${isLight ? 'text-[#262626]' : 'text-[#262626]'}`}>
          Support & Demandes
        </h2>
        <p className={`font-medium text-lg ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>
          Demandez des ajustements, de nouvelles automatisations ou signalez un problème.
        </p>
      </div>

      {/* SLA Banner */}
      <div className={`flex items-center gap-4 p-4 rounded-2xl border ${
        isLight ? 'bg-violet-50 border-violet-200' : 'bg-violet-500/5 border-violet-500/15'
      }`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          isLight ? 'bg-violet-100' : 'bg-violet-500/10'
        }`}>
          <Shield className={`w-5 h-5 ${isLight ? 'text-violet-600' : 'text-violet-400'}`} />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-bold ${isLight ? 'text-violet-900' : 'text-violet-300'}`}>
            Support Premium inclus
          </p>
          <p className={`text-xs ${isLight ? 'text-violet-600' : 'text-violet-400/70'}`}>
            Réponse garantie sous 24h — Temps de traitement moyen : 4h
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className={`text-xs font-bold ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
            SLA actif
          </span>
        </div>
      </div>

      {/* Stats + Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex gap-3">
          {[
            { id: 'all', label: 'Toutes', count: tickets.length },
            { id: 'active', label: 'En cours', count: activeCount },
            { id: 'done', label: 'Livrées', count: doneCount },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === f.id
                  ? (isLight ? 'bg-white text-violet-600 shadow-sm border border-gray-200' : 'bg-gray-50 text-[#262626]')
                  : (isLight ? 'text-[#716D5C] hover:text-slate-700' : 'text-[#716D5C] hover:text-[#716D5C]')
              }`}
            >
              {f.label}
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                filter === f.id
                  ? (isLight ? 'bg-violet-50 text-violet-600' : 'bg-gray-50 text-[#262626]')
                  : (isLight ? 'bg-gray-100 text-[#716D5C]' : 'bg-gray-50 text-[#716D5C]')
              }`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 transition-all"
        >
          <Plus className="w-4 h-4" />
          Nouvelle demande
        </button>
      </div>

      {/* New Ticket Form */}
      <AnimatePresence>
        {showForm && (
          <NewTicketForm
            onSubmit={(data) => createTicket.mutate(data)}
            onCancel={() => setShowForm(false)}
            theme={theme}
            isSubmitting={createTicket.isPending}
          />
        )}
      </AnimatePresence>

      {/* Tickets List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className={`h-24 rounded-2xl animate-pulse ${isLight ? 'bg-gray-100' : 'bg-white'}`} />
            ))}
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className={`text-center py-16 rounded-2xl border ${isLight ? 'bg-white border-gray-200' : 'bg-[#FFFFFF] border-gray-200'}`}>
            <MessageSquare className={`w-10 h-10 mx-auto mb-3 ${isLight ? 'text-slate-300' : 'text-[#716D5C]'}`} />
            <p className={`text-sm font-bold mb-1 ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>
              {filter === 'all' ? 'Aucune demande' : 'Aucune demande dans cette catégorie'}
            </p>
            <p className={`text-xs ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>
              Créez votre première demande pour une nouvelle automatisation ou un ajustement.
            </p>
          </div>
        ) : (
          filteredTickets.map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} theme={theme} />
          ))
        )}
      </div>
    </div>
  )
}
