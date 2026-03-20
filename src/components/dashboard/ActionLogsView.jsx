import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Filter,
  Ticket,
  ShoppingCart,
  Mail,
  Phone,
  CalendarCheck,
  UserCheck,
  AlertTriangle,
  Clock,
  DollarSign,
  ChevronDown,
  Search,
} from 'lucide-react'

// ============================================================
// EVENT CONFIG
// ============================================================
const EVENT_CONFIG = {
  ticket_resolved: { icon: Ticket, label: 'Ticket résolu', color: 'emerald', emoji: '✅' },
  ticket_escalated: { icon: AlertTriangle, label: 'Ticket escaladé', color: 'amber', emoji: '⚠️' },
  cart_email_sent: { icon: Mail, label: 'Email panier envoyé', color: 'blue', emoji: '📧' },
  cart_recovered: { icon: ShoppingCart, label: 'Panier récupéré', color: 'emerald', emoji: '🛒' },
  email_opened: { icon: Mail, label: 'Email ouvert', color: 'blue', emoji: '📬' },
  email_clicked: { icon: Mail, label: 'Clic email', color: 'violet', emoji: '🔗' },
  lead_qualified: { icon: UserCheck, label: 'Lead qualifié', color: 'violet', emoji: '🎯' },
  call_scheduled: { icon: Phone, label: 'Appel planifié', color: 'blue', emoji: '📞' },
  visit_scheduled: { icon: CalendarCheck, label: 'Visite planifiée', color: 'amber', emoji: '📅' },
  sms_sent: { icon: Phone, label: 'SMS envoyé', color: 'emerald', emoji: '💬' },
  lead_scored: { icon: UserCheck, label: 'Lead scoré', color: 'violet', emoji: '📊' },
  default: { icon: Activity, label: 'Action IA', color: 'zinc', emoji: '⚡' },
}

const FILTERS = [
  { id: 'all', label: 'Tout' },
  { id: 'tickets', label: 'Tickets', categories: ['ticket_resolved', 'ticket_escalated'] },
  { id: 'emails', label: 'Emails', categories: ['cart_email_sent', 'email_opened', 'email_clicked'] },
  { id: 'leads', label: 'Leads', categories: ['lead_qualified', 'lead_scored', 'call_scheduled', 'visit_scheduled'] },
  { id: 'commerce', label: 'Commerce', categories: ['cart_recovered', 'cart_email_sent'] },
]

// ============================================================
// TIME FORMAT
// ============================================================
function timeAgo(dateStr) {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "À l'instant"
  if (diffMin < 60) return `Il y a ${diffMin} min`
  if (diffHr < 24) return `Il y a ${diffHr}h`
  if (diffDays < 7) return `Il y a ${diffDays}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ============================================================
// EVENT ROW
// ============================================================
const EventRow = ({ event, theme }) => {
  const isLight = theme === 'light'
  const config = EVENT_CONFIG[event.event_category] || EVENT_CONFIG.default
  const Icon = config.icon

  const metadata = event.metadata || {}
  const timeSaved = event.time_saved_seconds ? `${Math.round(event.time_saved_seconds / 60)} min` : null
  const value = Number(event.revenue_amount) || metadata.cart_value || metadata.order_value || null

  const colorClasses = {
    emerald: isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    amber: isLight ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    blue: isLight ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    violet: isLight ? 'bg-violet-50 border-violet-200 text-violet-600' : 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    zinc: isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-white/5 border-white/10 text-zinc-500',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-colors ${
        isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'
      }`}
    >
      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${colorClasses[config.color]}`}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {config.label}
          </p>
          {value && (
            <span className={`text-xs font-bold ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
              +{value}€
            </span>
          )}
        </div>
        <p className={`text-xs truncate ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
          {event.event_description || `Action automatisée par l'IA`}
        </p>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 shrink-0">
        {timeSaved && (
          <div className={`flex items-center gap-1 text-[10px] font-bold ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>
            <Clock className="w-3 h-3" />
            {timeSaved}
          </div>
        )}
        <span className={`text-xs tabular-nums ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
          {formatTime(event.created_at)}
        </span>
      </div>
    </motion.div>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export const ActionLogsView = ({ supabase, clientId, theme }) => {
  const isLight = theme === 'light'
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [limit, setLimit] = useState(50)

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['action-logs', clientId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_events')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data
    },
    enabled: !!clientId && !!supabase,
    refetchInterval: 30000,
  })

  // Filter events
  const filteredEvents = useMemo(() => {
    let result = events
    if (filter !== 'all') {
      const filterDef = FILTERS.find(f => f.id === filter)
      if (filterDef?.categories) {
        result = result.filter(e => filterDef.categories.includes(e.event_category))
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(e =>
        (e.event_description || '').toLowerCase().includes(q) ||
        (e.event_category || '').toLowerCase().includes(q)
      )
    }
    return result
  }, [events, filter, searchQuery])

  // Group by date
  const groupedEvents = useMemo(() => {
    const groups = {}
    filteredEvents.forEach(event => {
      const dateKey = new Date(event.created_at).toDateString()
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(event)
    })
    return Object.entries(groups).map(([dateKey, evts]) => ({
      date: dateKey,
      label: formatDate(evts[0].created_at),
      events: evts,
    }))
  }, [filteredEvents])

  // Stats — query all events for accurate totals (not just visible 50)
  const { data: monthStats = {} } = useQuery({
    queryKey: ['action-logs-stats', clientId],
    queryFn: async () => {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const today = new Date().toISOString().split('T')[0]
      const [revResult, todayResult] = await Promise.all([
        supabase.from('automation_events').select('revenue_amount').eq('client_id', clientId).gte('created_at', startOfMonth).gt('revenue_amount', 0),
        supabase.from('automation_events').select('id', { count: 'exact', head: true }).eq('client_id', clientId).gte('created_at', today + 'T00:00:00')
      ])
      const totalRevenue = (revResult.data || []).reduce((sum, e) => sum + (Number(e.revenue_amount) || 0), 0)
      return { todayCount: todayResult.count || 0, totalValue: totalRevenue }
    },
    enabled: !!clientId && !!supabase,
    refetchInterval: 30000,
  })
  const todayCount = monthStats.todayCount || 0
  const totalValue = monthStats.totalValue || 0

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold mb-2 tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
          Journal des actions IA
        </h2>
        <p className={`font-medium text-lg ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
          Chaque action exécutée par votre infrastructure, en temps réel.
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-3">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${isLight ? 'bg-white border-slate-200' : 'bg-[#0a0a0a] border-white/10'}`}>
          <Activity className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
          <span className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{todayCount}</span>
          <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>actions aujourd'hui</span>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${isLight ? 'bg-white border-slate-200' : 'bg-[#0a0a0a] border-white/10'}`}>
          <DollarSign className={`w-4 h-4 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
          <span className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{totalValue}€</span>
          <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>valeur générée</span>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${isLight ? 'bg-white border-slate-200' : 'bg-[#0a0a0a] border-white/10'}`}>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className={`text-xs font-bold ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>Mise à jour auto 30s</span>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className={`flex p-1 rounded-xl border flex-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'}`}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === f.id
                  ? (isLight ? 'bg-white text-blue-600 shadow-sm' : 'bg-white/10 text-white')
                  : (isLight ? 'text-slate-500 hover:text-slate-700' : 'text-zinc-500 hover:text-zinc-300')
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${isLight ? 'bg-white border-slate-200' : 'bg-[#0a0a0a] border-white/10'}`}>
          <Search className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            className={`bg-transparent text-sm outline-none w-40 ${isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-zinc-600'}`}
          />
        </div>
      </div>

      {/* Events list */}
      <div className={`rounded-2xl border overflow-hidden ${isLight ? 'bg-white border-slate-200' : 'bg-[#0a0a0a] border-white/10'}`}>
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className={`h-14 rounded-xl animate-pulse ${isLight ? 'bg-slate-100' : 'bg-zinc-900'}`} />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-16">
            <Activity className={`w-10 h-10 mx-auto mb-3 ${isLight ? 'text-slate-300' : 'text-zinc-700'}`} />
            <p className={`text-sm font-bold ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>Aucune action trouvée</p>
            <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>Les actions apparaîtront ici en temps réel.</p>
          </div>
        ) : (
          <div className="divide-y divide-transparent">
            {groupedEvents.map((group) => (
              <div key={group.date}>
                <div className={`px-4 py-2 sticky top-0 z-10 ${isLight ? 'bg-slate-50' : 'bg-[#0e0e0e]'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
                    {group.label}
                  </p>
                </div>
                {group.events.map((event) => (
                  <EventRow key={event.id} event={event} theme={theme} />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Load more */}
        {filteredEvents.length >= limit && (
          <div className={`p-4 text-center border-t ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
            <button
              onClick={() => setLimit(prev => prev + 50)}
              className={`flex items-center gap-2 mx-auto px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                isLight ? 'text-slate-500 hover:bg-slate-50' : 'text-zinc-500 hover:bg-white/5'
              }`}
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Charger plus d'actions
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
