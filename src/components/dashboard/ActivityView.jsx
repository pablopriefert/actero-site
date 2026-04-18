import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, CheckCircle2, AlertTriangle, Mail, ShoppingCart, Package, MapPin, RotateCcw, HelpCircle, Eye, MousePointer, Cog, ChevronDown, User as UserIcon, Bot, Loader2, MessageSquare } from 'lucide-react'

// eslint-disable-next-line react-refresh/only-export-components
export const formatRelativeTime = (date) => {
  const now = new Date();
  // Supabase returns `timestamp without time zone` stored as UTC.
  // If the string has no timezone suffix, append 'Z' so JS parses it as UTC.
  const dateStr = typeof date === 'string' && !date.endsWith('Z') && !date.includes('+') ? date + 'Z' : date;
  const diff = now - new Date(dateStr);
  const seconds = Math.floor(diff / 1000);

  if (seconds < 0 || seconds < 60) return "À l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLiveActivityFeed = (supabase) => {
  const [events, setEvents] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    // Fetch initial 50 events
    const fetchInitial = async () => {
      setIsLoading(true);
      const { data, error: _fetchError } = await supabase
        .from('automation_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (mounted) {
        if (data) setEvents(data);
        setIsLoading(false);
      }
    };
    fetchInitial();

    // Subscribe to new events
    const channel = supabase
      .channel('live-activity-feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'automation_events',
        },
        (payload) => {
          if (mounted) {
            setEvents((prev) => [payload.new, ...prev].slice(0, 100));
          }
        }
      )
      .subscribe((status) => {
        if (mounted) {
          setIsConnected(status === 'SUBSCRIBED');
        }
      });

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return { events, isConnected, isLoading };
};

// Map ticket_type to readable French labels
const TICKET_TYPE_LABELS = {
  order_tracking: 'Suivi de commande',
  address_change: 'Changement d\'adresse',
  return_exchange: 'Retour / Echange',
  product_info: 'Question produit',
  general: 'Question client',
};

// eslint-disable-next-line react-refresh/only-export-components
export const formatEvent = (event) => {
  const cat = event.event_category;
  const type = event.ticket_type;
  const meta = event.metadata || {};
  const timeSaved = event.time_saved_seconds ? Math.round(event.time_saved_seconds / 60) : 0;
  const timeSavedLabel = timeSaved > 0 ? `${timeSaved} min économisées` : null;
  const confidence = meta.confidence ? `${Math.round(meta.confidence * 100)}%` : null;
  const orderId = meta.order_id;
  const source = meta.source || event.source_channel;

  if (cat === 'ticket_resolved') {
    const typeLabel = TICKET_TYPE_LABELS[type] || 'Ticket';
    const orderSuffix = orderId ? ` — ${orderId}` : '';
    const IconComponent = type === 'order_tracking' ? Package
      : type === 'address_change' ? MapPin
      : type === 'return_exchange' ? RotateCcw
      : type === 'product_info' ? HelpCircle
      : CheckCircle2;
    return {
      IconComponent,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      message: `${typeLabel} resolu${orderSuffix}`,
      detail: timeSavedLabel,
      confidence,
      source,
    };
  }
  if (cat === 'ticket_escalated') {
    return {
      IconComponent: AlertTriangle,
      color: "text-amber-600",
      bg: "bg-amber-50",
      message: "Ticket escalade vers support humain",
      detail: meta.reason || "Besoin d'expertise",
      confidence,
      source,
    };
  }
  if (cat === 'cart_email_sent') {
    return {
      IconComponent: Mail,
      color: "text-blue-600",
      bg: "bg-blue-50",
      message: "Email panier abandonne envoye",
      detail: meta.cart_value ? `Valeur: ${meta.cart_value}EUR` : null,
      confidence: null,
      source,
    };
  }
  if (cat === 'cart_recovered') {
    return {
      IconComponent: ShoppingCart,
      color: "text-violet-600",
      bg: "bg-violet-50",
      message: `Panier recupere — +${event.revenue_amount || 0}EUR`,
      detail: null,
      confidence: null,
      source,
    };
  }
  if (cat === 'email_opened') {
    return {
      IconComponent: Eye,
      color: "text-slate-500",
      bg: "bg-slate-50",
      message: "Email ouvert",
      detail: null,
      confidence: null,
      source,
    };
  }
  if (cat === 'email_clicked') {
    return {
      IconComponent: MousePointer,
      color: "text-slate-500",
      bg: "bg-slate-50",
      message: "Lien clique dans l'email",
      detail: null,
      confidence: null,
      source,
    };
  }

  // Fallback: clean up the description field if present
  const fallbackMsg = event.description
    ? event.description.replace(/^\[Engine\]\s*/, '').replace(/\s*—\s*completed.*$/, '')
    : (TICKET_TYPE_LABELS[type] || cat?.replace(/_/g, ' ') || 'Action automatisee');
  return {
    IconComponent: Cog,
    color: "text-slate-400",
    bg: "bg-gray-50",
    message: fallbackMsg,
    detail: timeSavedLabel,
    confidence,
    source,
  };
};

const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  if (email.includes('@anonymous.actero.fr')) return 'Client anonyme (widget)';
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const maskedLocal = local.length > 3 ? `${local.slice(0, 2)}${'*'.repeat(local.length - 2)}` : local;
  return `${maskedLocal}@${domain}`;
};

export const ActivityView = ({ supabase, theme = "dark" }) => {
  const { events, isConnected, isLoading } = useLiveActivityFeed(supabase);
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  // eventId -> { loading, conversation, error }
  const [conversationCache, setConversationCache] = useState({});

  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    if (filter === "tickets") return events.filter(e => e.event_category?.includes('ticket'));
    if (filter === "carts") return events.filter(e => e.event_category?.includes('cart'));
    if (filter === "escalations") return events.filter(e => e.event_category === 'ticket_escalated');
    return events;
  }, [events, filter]);

  const fetchConversation = useCallback(async (event) => {
    if (!supabase || !event?.id || !event?.created_at) return;
    // Already cached (loaded or loading)
    if (conversationCache[event.id]) return;

    setConversationCache((prev) => ({ ...prev, [event.id]: { loading: true } }));

    try {
      // Match by client_id + timestamp window (±8 seconds around the event).
      // ai_conversations is written ~400ms after the automation_event in the
      // same run, so this window is safe.
      const eventTime = new Date(event.created_at + (event.created_at.endsWith('Z') ? '' : 'Z'));
      const start = new Date(eventTime.getTime() - 8000).toISOString();
      const end = new Date(eventTime.getTime() + 8000).toISOString();

      let query = supabase
        .from('ai_conversations')
        .select('id, subject, customer_message, ai_response, customer_email, customer_name, confidence_score, ticket_type, status, escalation_reason, human_response, created_at')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: true });

      if (event.client_id) query = query.eq('client_id', event.client_id);

      const { data, error } = await query.limit(5);
      if (error) throw error;

      // Pick the closest conversation in time to the event
      let best = null;
      if (Array.isArray(data) && data.length > 0) {
        let bestDelta = Infinity;
        for (const c of data) {
          const t = new Date(c.created_at + (c.created_at.endsWith('Z') ? '' : 'Z')).getTime();
          const delta = Math.abs(t - eventTime.getTime());
          if (delta < bestDelta) {
            bestDelta = delta;
            best = c;
          }
        }
      }

      setConversationCache((prev) => ({
        ...prev,
        [event.id]: { loading: false, conversation: best, error: null },
      }));
    } catch (err) {
      setConversationCache((prev) => ({
        ...prev,
        [event.id]: { loading: false, conversation: null, error: err.message || 'Erreur' },
      }));
    }
  }, [supabase, conversationCache]);

  const toggleExpand = useCallback((event) => {
    if (expandedId === event.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(event.id);
    fetchConversation(event);
  }, [expandedId, fetchConversation]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">
              Activité en direct
            </h2>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border border-[#e5e5e5]">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-400"}`} />
              <span className="text-[10px] font-medium text-[#888] uppercase tracking-wider">
                {isConnected ? "Live" : "Hors ligne"}
              </span>
            </div>
          </div>
          <p className="text-sm text-[#888]">
            Flux temps reel de vos automatisations.
          </p>
        </div>

        <div className="flex p-0.5 rounded-lg bg-[#f5f5f5] border border-[#e5e5e5]">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'tickets', label: 'Tickets' },
            { id: 'carts', label: 'Paniers' },
            { id: 'escalations', label: 'Escalades' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${filter === t.id
                ? 'bg-white text-[#1a1a1a] shadow-sm'
                : 'text-[#888] hover:text-[#555]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event list */}
      <div className="bg-white rounded-2xl border border-[#e5e5e5] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
        {isLoading && events.length === 0 ? (
          <div className="p-8 space-y-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 items-center animate-pulse">
                <div className="w-10 h-10 bg-[#f5f5f5] rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-[#f5f5f5] rounded w-2/5" />
                  <div className="h-3 bg-[#f5f5f5] rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="w-14 h-14 bg-[#fafafa] rounded-full flex items-center justify-center mb-4 border border-[#eee]">
              <Activity className="w-7 h-7 text-[#ccc]" />
            </div>
            <h3 className="text-base font-semibold text-[#1a1a1a] mb-1">
              Aucune activite
            </h3>
            <p className="text-sm text-[#888] max-w-xs">
              Les evenements apparaitront ici en temps reel.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#f0f0f0]">
            <AnimatePresence initial={false}>
              {filteredEvents.map((event) => {
                const details = formatEvent(event);
                const Icon = details.IconComponent;
                const isExpanded = expandedId === event.id;
                const cache = conversationCache[event.id];
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={event.id}
                    className="group"
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpand(event)}
                      className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[#fafafa] transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${details.bg}`}>
                          <Icon className={`w-[18px] h-[18px] ${details.color}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#1a1a1a] truncate">
                            {details.message}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {details.detail && (
                              <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                {details.detail}
                              </span>
                            )}
                            {details.confidence && (
                              <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                {details.confidence} confiance
                              </span>
                            )}
                            {details.source && (
                              <span className="text-[11px] font-medium text-[#888] bg-[#f5f5f5] px-1.5 py-0.5 rounded capitalize">
                                {details.source}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        <div className="text-right flex flex-col items-end">
                          <span className="text-[12px] text-[#999] font-medium whitespace-nowrap">
                            {formatRelativeTime(event.created_at)}
                          </span>
                          <span className="text-[10px] font-mono text-[#ccc] mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {event.id?.split('-')[0]}
                          </span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-[#9ca3af] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          key="expansion"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="overflow-hidden bg-[#fafafa] border-t border-[#f0f0f0]"
                        >
                          <div className="px-6 py-5">
                            {cache?.loading && (
                              <div className="flex items-center gap-2 text-[12px] text-[#9ca3af]">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Chargement de la conversation...
                              </div>
                            )}

                            {!cache?.loading && cache?.conversation && (
                              <div className="space-y-4">
                                {/* Header meta */}
                                <div className="flex items-start justify-between flex-wrap gap-2">
                                  <div>
                                    <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-0.5">
                                      Sujet
                                    </p>
                                    <p className="text-[13px] font-semibold text-[#1a1a1a]">
                                      {cache.conversation.subject || 'Sans sujet'}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-0.5">
                                      Client
                                    </p>
                                    <p className="text-[12px] font-medium text-[#71717a]">
                                      {cache.conversation.customer_name || maskEmail(cache.conversation.customer_email)}
                                    </p>
                                  </div>
                                </div>

                                {/* User message bubble */}
                                {cache.conversation.customer_message && (
                                  <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white border border-[#f0f0f0] flex items-center justify-center flex-shrink-0">
                                      <UserIcon className="w-4 h-4 text-[#71717a]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[11px] font-semibold text-[#9ca3af] mb-1">Client</p>
                                      <div className="bg-white rounded-2xl rounded-tl-sm border border-[#f0f0f0] px-4 py-3">
                                        <p className="text-[13px] text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">
                                          {cache.conversation.customer_message}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* AI response bubble */}
                                {cache.conversation.ai_response && (
                                  <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-cta/10 border border-cta/20 flex items-center justify-center flex-shrink-0">
                                      <Bot className="w-4 h-4 text-cta" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[11px] font-semibold text-cta mb-1">Agent IA</p>
                                      <div className="bg-cta/5 rounded-2xl rounded-tl-sm border border-cta/15 px-4 py-3">
                                        <p className="text-[13px] text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">
                                          {cache.conversation.ai_response}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Human response bubble (if escalated + replied) */}
                                {cache.conversation.human_response && (
                                  <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                                      <UserIcon className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[11px] font-semibold text-amber-600 mb-1">Reponse humaine</p>
                                      <div className="bg-amber-50/60 rounded-2xl rounded-tl-sm border border-amber-200 px-4 py-3">
                                        <p className="text-[13px] text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">
                                          {cache.conversation.human_response}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Escalation reason */}
                                {cache.conversation.escalation_reason && (
                                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50/60 border border-amber-200">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-amber-700">
                                      <span className="font-semibold">Raison de l'escalade : </span>
                                      {cache.conversation.escalation_reason}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {!cache?.loading && !cache?.conversation && !cache?.error && (
                              <div className="flex items-center gap-2 text-[12px] text-[#9ca3af]">
                                <MessageSquare className="w-4 h-4" />
                                Aucune conversation associée à cet événement.
                              </div>
                            )}

                            {!cache?.loading && cache?.error && (
                              <div className="text-[12px] text-red-600">
                                Erreur de chargement : {cache.error}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
