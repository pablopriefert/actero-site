import React, { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  User,
  Shield,
  Zap,
} from 'lucide-react'

// ============================================================
// STATUS CONFIG
// ============================================================
const STATUS_OPTIONS = [
  { value: 'en_attente', label: 'En attente', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Clock },
  { value: 'en_cours', label: 'En cours', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Loader2 },
  { value: 'termine', label: 'Livré', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
]

const PRIORITY_COLORS = {
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
  normal: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  low: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
}

// ============================================================
// STATUS DROPDOWN
// ============================================================
const StatusDropdown = ({ currentStatus, onUpdate, isUpdating }) => {
  const [open, setOpen] = useState(false)
  const current = STATUS_OPTIONS.find(s => s.value === currentStatus) || STATUS_OPTIONS[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={isUpdating}
        className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg border transition-all ${current.color}`}
      >
        {isUpdating ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <current.icon className={`w-3 h-3 ${currentStatus === 'en_cours' ? 'animate-spin' : ''}`} />
        )}
        {current.label}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-[#111] border border-white/10 rounded-xl shadow-2xl p-1.5 min-w-[140px]">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onUpdate(opt.value)
                  setOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                  opt.value === currentStatus
                    ? 'bg-white/5 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <opt.icon className="w-3.5 h-3.5" />
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================
// REQUEST CARD
// ============================================================
const RequestCard = ({ request, supabase }) => {
  const queryClient = useQueryClient()
  const clientName = request.clients?.brand_name || 'Client inconnu'
  const status = request.status || 'en_attente'
  const priority = request.priority || 'normal'

  const updateStatus = useMutation({
    mutationFn: async (newStatus) => {
      const { error } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', request.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-requests'] })
    },
  })

  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {priority === 'high' && (
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${PRIORITY_COLORS.high}`}>
              Urgent
            </span>
          )}
          <h4 className="text-sm font-bold text-white truncate">{request.title}</h4>
        </div>
        {request.description && (
          <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{request.description}</p>
        )}
        <p className="text-[10px] text-zinc-600 mt-1.5">
          {new Date(request.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      <StatusDropdown
        currentStatus={status}
        onUpdate={(newStatus) => updateStatus.mutate(newStatus)}
        isUpdating={updateStatus.isPending}
      />
    </div>
  )
}

// ============================================================
// CLIENT GROUP
// ============================================================
const ClientGroup = ({ clientName, clientId, requests, supabase, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen)
  const activeCount = requests.filter(r => !['termine', 'valide', 'deploye'].includes(r.status || 'en_attente')).length

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#0a0a0a]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-400">
          {clientName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-white">{clientName}</p>
          <p className="text-[10px] text-zinc-600">
            {requests.length} demande{requests.length > 1 ? 's' : ''} — {activeCount} active{activeCount > 1 ? 's' : ''}
          </p>
        </div>
        {activeCount > 0 && (
          <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-[10px] font-bold flex items-center justify-center">
            {activeCount}
          </span>
        )}
        <ChevronRight className={`w-4 h-4 text-zinc-600 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {requests.map((req) => (
                <RequestCard key={req.id} request={req} supabase={supabase} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export const AdminRequestsView = ({ requests, supabase }) => {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Filter
  const filtered = useMemo(() => {
    let result = requests
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(r =>
        (r.title || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.clients?.brand_name || '').toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        result = result.filter(r => !['termine', 'valide', 'deploye'].includes(r.status || 'en_attente'))
      } else if (statusFilter === 'done') {
        result = result.filter(r => ['termine', 'valide', 'deploye'].includes(r.status))
      }
    }
    return result
  }, [requests, search, statusFilter])

  // Group by client
  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(req => {
      const clientName = req.clients?.brand_name || 'Client inconnu'
      const clientId = req.client_id || 'unknown'
      if (!map[clientId]) map[clientId] = { clientName, clientId, requests: [] }
      map[clientId].requests.push(req)
    })
    // Sort by most recent request first
    return Object.values(map).sort((a, b) => {
      const aDate = new Date(a.requests[0]?.created_at || 0)
      const bDate = new Date(b.requests[0]?.created_at || 0)
      return bDate - aDate
    })
  }, [filtered])

  // Stats
  const totalActive = requests.filter(r => !['termine', 'valide', 'deploye'].includes(r.status || 'en_attente')).length
  const totalDone = requests.filter(r => ['termine', 'valide', 'deploye'].includes(r.status)).length

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold mb-2 tracking-tight text-white">
          Demandes clients
        </h2>
        <p className="font-medium text-lg text-zinc-500">
          Toutes les demandes de vos clients, groupées par compte.
        </p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border bg-[#0a0a0a] border-white/10">
          <MessageSquare className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-bold text-white">{requests.length}</span>
          <span className="text-xs text-zinc-500">total</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border bg-[#0a0a0a] border-white/10">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-white">{totalActive}</span>
          <span className="text-xs text-zinc-500">en cours</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border bg-[#0a0a0a] border-white/10">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold text-white">{totalDone}</span>
          <span className="text-xs text-zinc-500">livrées</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border bg-[#0a0a0a] border-white/10">
          <User className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-bold text-white">{grouped.length}</span>
          <span className="text-xs text-zinc-500">clients</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-[#0a0a0a] border-white/10 flex-1">
          <Search className="w-4 h-4 text-zinc-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par titre, description ou client..."
            className="bg-transparent text-sm outline-none text-white placeholder-zinc-600 w-full"
          />
        </div>
        <div className="flex p-1 rounded-xl border bg-white/5 border-white/10">
          {[
            { id: 'all', label: 'Toutes' },
            { id: 'active', label: 'Actives' },
            { id: 'done', label: 'Livrées' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === f.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Client Groups */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border bg-[#0a0a0a] border-white/10">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
          <p className="text-sm font-bold text-zinc-500">Aucune demande</p>
          <p className="text-xs text-zinc-600 mt-1">Les demandes de vos clients apparaîtront ici.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((group, i) => (
            <ClientGroup
              key={group.clientId}
              clientName={group.clientName}
              clientId={group.clientId}
              requests={group.requests}
              supabase={supabase}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}
