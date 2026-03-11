import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity } from 'lucide-react'

export const formatRelativeTime = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return "À l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Il y a ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  return new Date(date).toLocaleDateString();
};

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
      const { data, error } = await supabase
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

export const formatEvent = (event) => {
  const cat = event.event_category;
  const type = event.ticket_type;
  const meta = event.metadata || {};
  const timeSaved = event.time_saved_seconds ? Math.round(event.time_saved_seconds / 60) : 0;
  const orderId = meta.order_id || "#0000";

  if (cat === 'ticket_resolved' && type === 'order_tracking') {
    return { icon: "📦", color: "text-emerald-500", bg: "bg-emerald-500/10", message: `Ticket tracking résolu — Commande ${orderId} — ${timeSaved} min économisées` };
  }
  if (cat === 'ticket_resolved' && type === 'address_change') {
    return { icon: "📍", color: "text-emerald-500", bg: "bg-emerald-500/10", message: `Adresse modifiée — Commande ${orderId} — ${timeSaved} min économisées` };
  }
  if (cat === 'ticket_resolved' && type === 'return_exchange') {
    return { icon: "🔄", color: "text-emerald-500", bg: "bg-emerald-500/10", message: `Retour traité — Commande ${orderId} — ${timeSaved} min économisées` };
  }
  if (cat === 'ticket_resolved' && type === 'product_info') {
    return { icon: "❓", color: "text-emerald-500", bg: "bg-emerald-500/10", message: `Question produit résolue — ${timeSaved} min économisées` };
  }
  if (cat === 'ticket_escalated') {
    return { icon: "⚠️", color: "text-amber-500", bg: "bg-amber-500/10", message: `Ticket escaladé → support humain — ${meta.reason || "Besoin d'expertise"}` };
  }
  if (cat === 'cart_email_sent') {
    return { icon: "📧", color: "text-blue-500", bg: "bg-blue-500/10", message: `Email panier abandonné envoyé — Valeur: ${meta.cart_value || 0}€` };
  }
  if (cat === 'cart_recovered') {
    return { icon: "💰", color: "text-violet-500", bg: "bg-violet-500/10", message: `Panier récupéré ! +${event.revenue_amount || 0}€` };
  }
  if (cat === 'email_opened') {
    return { icon: "👁️", color: "text-slate-400", bg: "bg-slate-400/10", message: "Email ouvert" };
  }
  if (cat === 'email_clicked') {
    return { icon: "🖱️", color: "text-slate-400", bg: "bg-slate-400/10", message: "Lien cliqué dans l'email" };
  }

  return { icon: "⚙️", color: "text-gray-400", bg: "bg-gray-400/10", message: event.ticket_type || event.event_category || "Action automatisée" };
};

export const ActivityView = ({ supabase, theme = "dark" }) => {
  const isLight = theme === "light";
  const { events, isConnected, isLoading } = useLiveActivityFeed(supabase);
  const [filter, setFilter] = useState("all");

  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    if (filter === "tickets") return events.filter(e => e.event_category?.includes('ticket'));
    if (filter === "carts") return events.filter(e => e.event_category?.includes('cart'));
    if (filter === "escalations") return events.filter(e => e.event_category === 'ticket_escalated');
    return events;
  }, [events, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className={`text-3xl font-bold tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
              Activité en direct
            </h2>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10">
              <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" : "bg-rose-500"}`}></div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {isConnected ? "Connecté" : "Déconnecté"}
              </span>
            </div>
          </div>
          <p className={`font-medium ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
            Flux temps réel des automatisations Actero.
          </p>
        </div>

        <div className={`flex p-1 rounded-xl border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'}`}>
          {[
            { id: 'all', label: 'Tous' },
            { id: 'tickets', label: 'Tickets' },
            { id: 'carts', label: 'Paniers' },
            { id: 'escalations', label: 'Escalades' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filter === t.id
                ? (isLight ? 'bg-white text-blue-600 shadow-sm' : 'bg-white/10 text-white shadow-lg')
                : (isLight ? 'text-slate-500 hover:text-slate-900' : 'text-zinc-500 hover:text-zinc-300')
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`border rounded-3xl overflow-hidden ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-[#0a0a0a] border-white/10 shadow-2xl"}`}>
        {isLoading && events.length === 0 ? (
          <div className="p-12 space-y-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 items-center animate-pulse">
                <div className="w-12 h-12 bg-white/5 rounded-2xl"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/5 rounded w-1/3"></div>
                  <div className="h-3 bg-white/5 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5">
              <Activity className="w-10 h-10 text-gray-500" />
            </div>
            <h3 className={`text-xl font-bold mb-2 ${isLight ? "text-slate-900" : "text-white"}`}>
              Le système est en veille
            </h3>
            <p className="text-gray-500 max-w-sm">
              Les events apparaîtront ici dès qu'une action sera exécutée dans votre infrastructure.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            <AnimatePresence initial={false}>
              {filteredEvents.map((event) => {
                const details = formatEvent(event);
                return (
                  <motion.div
                    layout
                    initial={{ height: 0, opacity: 0, y: -20 }}
                    animate={{ height: "auto", opacity: 1, y: 0 }}
                    key={event.id}
                    className="p-5 flex items-center justify-between group hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${details.bg} ${details.color}`}>
                        {details.icon}
                      </div>
                      <div>
                        <p className={`font-bold transition-colors ${isLight ? "text-slate-900" : "text-white"}`}>
                          {details.message}
                        </p>
                        <p className={`text-xs font-bold uppercase tracking-widest mt-0.5 ${isLight ? "text-slate-400" : "text-zinc-500"}`}>
                          {(event.event_category || "").replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className={`text-xs font-bold ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
                        {formatRelativeTime(event.created_at)}
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] font-mono text-zinc-600">ID: {event.id.split('-')[0]}</span>
                      </div>
                    </div>
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
