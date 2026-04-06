import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu,
  Search,
  Plus,
  AlertCircle,
  Users,
  LayoutDashboard,
  TerminalSquare,
  Sparkles,
  UserPlus,
  MoreVertical,
  Bot,
  Clock,
  DollarSign,
  Zap,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Target,
  BarChart3,
  Building2,
  ShoppingBag,
  Copy,
  Check,
  Wifi,
  GitBranch,
  Receipt,
  Heart,
  Gift,
  Rocket,
  FileText,
  Award,
  Handshake
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AdminClientSettingsModal } from '../components/admin/AdminClientSettingsModal'
import { Logo } from '../components/layout/Logo'
import { Sidebar } from '../components/layout/Sidebar'
import { CommandKModal } from '../components/layout/CommandKModal'
import { AdminKanbanBoard } from '../components/admin/AdminKanbanBoard'
import { AnimatedCounter } from '../components/ui/animated-counter'
import { IntelligenceView } from '../components/dashboard/IntelligenceView'
import { AdminFunnelView } from '../components/admin/AdminFunnelView'
import { AdminMonitoringView } from '../components/admin/AdminMonitoringView'
import { AdminPipelineView } from '../components/admin/AdminPipelineView'
import { AdminBillingView } from '../components/admin/AdminBillingView'
import { AdminClientHealthView } from '../components/admin/AdminClientHealthView'
import { AdminReferralsView } from '../components/admin/AdminReferralsView'
import { CallNotesWizard } from '../components/admin/CallNotesWizard'
import { DeploymentProgress } from '../components/admin/DeploymentProgress'
import { AdminNegativeRatingsView } from '../components/admin/AdminNegativeRatingsView'
import { AdminAmbassadorsView } from '../components/admin/AdminAmbassadorsView'
import { AdminPartnersView } from '../components/admin/AdminPartnersView'
import { AdminShopifyView } from '../components/admin/AdminShopifyView'

export const AdminDashboard = ({ onNavigate, onLogout, currentRoute }) => {
  const queryClient = useQueryClient();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandKOpen, setIsCommandKOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [callNotesClient, setCallNotesClient] = useState(null);
  const [deploymentState, setDeploymentState] = useState(null); // { deploymentId, clientName }

  const getAdminTabFromRoute = (route) => {
    if (route === "/admin/clients") return "clients";
    if (route === "/admin/requests") return "requests";
    if (route === "/admin/leads") return "leads";
    if (route === "/admin/intelligence") return "intelligence";
    if (route === "/admin/funnel") return "funnel";
    if (route === "/admin/monitoring") return "monitoring";
    if (route === "/admin/pipeline") return "pipeline";
    if (route === "/admin/billing") return "billing";
    if (route === "/admin/health") return "health";
    if (route === "/admin/referrals") return "referrals";
    if (route === "/admin/ambassadors") return "ambassadors";
    if (route === "/admin/partners") return "partners";
    if (route === "/admin/ratings") return "ratings";
    if (route === "/admin/shopify") return "shopify";
    return "overview";
  };

  const activeTab = getAdminTabFromRoute(currentRoute);
  
  const setActiveTab = (tab) => {
    const route = tab === "overview" ? "/admin" : `/admin/${tab}`;
    onNavigate(route);
  };

  // Command-K Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandKOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetching Data with React Query
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['admin-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch integration status for all clients (for badges in client list)
  const { data: allIntegrations = [] } = useQuery({
    queryKey: ['admin-all-integrations'],
    queryFn: async () => {
      const { data: integrations } = await supabase
        .from('client_integrations')
        .select('client_id, provider, status');
      const { data: shopifyConns } = await supabase
        .from('client_shopify_connections')
        .select('client_id, shop_domain');
      return [...(integrations || []), ...(shopifyConns || []).map(s => ({ client_id: s.client_id, provider: 'shopify', status: 'active' }))];
    },
  });

  const getClientIntegrations = (clientId) => allIntegrations.filter(i => i.client_id === clientId);

  const { data: requests = [], isLoading: requestsLoading, refetch: refetchRequests } = useQuery({
    queryKey: ['admin-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, client_id, title, description, stack, priority, status, created_at, clients(brand_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['admin-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Overview data: metrics_daily aggregated
  const { data: overviewData } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const [metricsRes, eventsRes, recentEventsRes, funnelRes] = await Promise.all([
        supabase.from("metrics_daily").select("client_id, date, tickets_total, tickets_auto, tasks_executed, time_saved_minutes, estimated_roi, active_automations").order("date", { ascending: false }),
        supabase.from("automation_events").select("id, client_id, event_category, time_saved_seconds, revenue_amount, created_at").order("created_at", { ascending: false }),
        supabase.from("automation_events").select("id, client_id, event_category, ticket_type, time_saved_seconds, revenue_amount, created_at, clients(brand_name)").order("created_at", { ascending: false }).limit(8),
        supabase.from("funnel_clients").select("id, company_name, email, status, client_type, created_at, setup_price, monthly_price").order("created_at", { ascending: false }),
      ]);

      const metrics = metricsRes.data || [];
      const events = eventsRes.data || [];
      const recentEvents = recentEventsRes.data || [];
      const funnel = funnelRes.data || [];

      // Aggregate metrics
      const totalHoursSaved = Math.round(metrics.reduce((s, m) => s + (Number(m.time_saved_minutes) || 0), 0) / 60);
      const totalRevenue = metrics.reduce((s, m) => s + (Number(m.estimated_roi) || 0), 0);
      const totalTickets = metrics.reduce((s, m) => s + (Number(m.tickets_total) || 0), 0);
      const totalTicketsAuto = metrics.reduce((s, m) => s + (Number(m.tickets_auto) || 0), 0);
      const totalTasksExecuted = metrics.reduce((s, m) => s + (Number(m.tasks_executed) || 0), 0);
      const autoRate = totalTickets > 0 ? ((totalTicketsAuto / totalTickets) * 100).toFixed(1) : 0;

      // Last 7 days vs previous 7 days
      const today = new Date();
      const last7 = metrics.filter(m => {
        const d = new Date(m.date);
        return (today - d) / 86400000 <= 7;
      });
      const prev7 = metrics.filter(m => {
        const d = new Date(m.date);
        const diff = (today - d) / 86400000;
        return diff > 7 && diff <= 14;
      });
      const last7Revenue = last7.reduce((s, m) => s + (Number(m.estimated_roi) || 0), 0);
      const prev7Revenue = prev7.reduce((s, m) => s + (Number(m.estimated_roi) || 0), 0);
      const revenueTrend = prev7Revenue > 0 ? (((last7Revenue - prev7Revenue) / prev7Revenue) * 100).toFixed(0) : 0;
      const last7Hours = last7.reduce((s, m) => s + (Number(m.time_saved_minutes) || 0), 0);
      const prev7Hours = prev7.reduce((s, m) => s + (Number(m.time_saved_minutes) || 0), 0);
      const hoursTrend = prev7Hours > 0 ? (((last7Hours - prev7Hours) / prev7Hours) * 100).toFixed(0) : 0;

      // Events by category
      const eventsByCategory = {};
      events.forEach(e => {
        eventsByCategory[e.event_category] = (eventsByCategory[e.event_category] || 0) + 1;
      });

      // Daily activity for chart (last 14 days)
      const dailyActivity = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayMetrics = metrics.filter(m => m.date === dateStr);
        const dayEvents = events.filter(e => e.created_at?.startsWith(dateStr));
        dailyActivity.push({
          date: dateStr,
          label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
          tickets: dayMetrics.reduce((s, m) => s + (Number(m.tickets_total) || 0), 0),
          events: dayEvents.length,
          revenue: dayMetrics.reduce((s, m) => s + (Number(m.revenue_recovered) || 0), 0),
        });
      }

      return {
        totalHoursSaved, totalRevenue, totalTickets, totalTicketsAuto, totalTasksExecuted,
        autoRate, revenueTrend, hoursTrend, last7Revenue,
        eventsByCategory, recentEvents, funnel, dailyActivity,
        totalEvents: events.length,
      };
    }
  });

  const isLoading = clientsLoading || requestsLoading || leadsLoading;

  const sidebarItems = [
    { id: "overview", label: "Vue Globale", icon: LayoutDashboard },
    { id: "clients", label: "Clients", icon: Users },
    { id: "health", label: "Santé Clients", icon: Heart },
    { id: "pipeline", label: "Pipeline", icon: GitBranch },
    { type: 'section', label: 'Opérations' },
    { id: "monitoring", label: "Monitoring n8n", icon: Wifi },
    { id: "billing", label: "Facturation", icon: Receipt },
    { id: "referrals", label: "Parrainages", icon: Gift },
    { id: "ambassadors", label: "Ambassadeurs", icon: Award },
    { id: "partners", label: "Partenaires", icon: Handshake },
    { type: 'section', label: 'Outils' },
    { id: "requests", label: "Demandes IA", icon: Sparkles, badge: requests.length > 0 ? requests.length : null, badgeColor: "bg-emerald-100 text-emerald-700" },
    { id: "ratings", label: "Notations IA", icon: FileText },
    { id: "funnel", label: "Nouveau client", icon: UserPlus },
    { id: "shopify", label: "App Shopify", icon: ShoppingBag },
  ];

  const handleAddClient = async () => {
    const brandName = prompt("Nom de l'entreprise du nouveau client :");
    if (!brandName) return;
    try {
      const { error } = await supabase.from("clients").insert([{ brand_name: brandName }]);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
    } catch (err) {
      alert("Erreur: " + err.message);
    }
  };

  const handleDeployReady = async (clientId) => {
    const client = clients.find(c => c.id === clientId);
    try {
      const res = await fetch('/api/deploy/full-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(err.error || `Erreur ${res.status}`);
      }
      const data = await res.json();
      setCallNotesClient(null);
      setDeploymentState({ deploymentId: data.deployment_id, clientName: client?.brand_name || 'Client' });
    } catch (err) {
      alert('Erreur deploiement: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row font-sans text-[#262626]">
      {/* Mobile Header */}
      <div className="md:hidden h-16 bg-[#F9F7F1] border-b border-gray-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Logo className="w-6 h-6 text-[#262626]" />
          <span className="font-bold text-lg">Actero Admin</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)}>
          <Menu className="w-6 h-6 text-[#716D5C]" />
        </button>
      </div>

      {/* Sidebar Desktop */}
      <div className="hidden md:block">
        <Sidebar 
          title="Actero Admin"
          items={sidebarItems}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onLogout={onLogout}
        />
      </div>

      {/* Sidebar Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              className="relative w-4/5 max-w-xs bg-[#F9F7F1] h-full shadow-2xl"
            >
              <Sidebar 
                title="Actero Admin"
                items={sidebarItems}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onLogout={onLogout}
                onClose={() => setIsMobileMenuOpen(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CommandKModal 
        isOpen={isCommandKOpen} 
        onClose={() => setIsCommandKOpen(false)} 
        clients={clients} 
        setActiveTab={setActiveTab} 
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="hidden md:flex h-16 bg-[#F9F7F1] border-b border-gray-200 items-center px-8">
          <h1 className="text-xl font-bold capitalize tracking-tight">
            {activeTab.replace("-", " ")}
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === "funnel" && (
            <div className="max-w-6xl mx-auto">
              <AdminFunnelView />
            </div>
          )}
          
          {activeTab === "monitoring" && <AdminMonitoringView />}

          {activeTab === "pipeline" && <AdminPipelineView />}

          {activeTab === "billing" && <AdminBillingView />}

          {activeTab === "health" && <AdminClientHealthView />}

          {activeTab === "referrals" && <AdminReferralsView />}

          {activeTab === "ambassadors" && <AdminAmbassadorsView />}

          {activeTab === "partners" && <AdminPartnersView />}

          {activeTab === "shopify" && <AdminShopifyView />}

          {activeTab === "ratings" && <AdminNegativeRatingsView />}

          {activeTab === "intelligence" && (
            <div className="max-w-6xl mx-auto">
              <IntelligenceView supabase={supabase} theme="light" />
            </div>
          )}

          {activeTab === "overview" && (
            <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">
              {/* Row 1: Key KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: "Revenus récupérés",
                    value: overviewData?.totalRevenue || 0,
                    suffix: "€",
                    icon: DollarSign,
                    color: "emerald",
                    trend: overviewData?.revenueTrend,
                  },
                  {
                    label: "Heures économisées",
                    value: overviewData?.totalHoursSaved || 0,
                    suffix: "h",
                    icon: Clock,
                    color: "blue",
                    trend: overviewData?.hoursTrend,
                  },
                  {
                    label: "Taux d'automatisation",
                    value: overviewData?.autoRate || 0,
                    suffix: "%",
                    icon: Zap,
                    color: "violet",
                    isPercent: true,
                  },
                  {
                    label: "Événements traités",
                    value: overviewData?.totalEvents || 0,
                    suffix: "",
                    icon: Activity,
                    color: "amber",
                  },
                ].map((kpi, i) => (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="relative bg-[#F9F7F1] rounded-2xl border border-gray-200 p-5 overflow-hidden group hover:border-gray-300 transition-colors"
                  >
                    <div className={`absolute -top-6 -right-6 w-20 h-20 bg-${kpi.color}-500/10 rounded-full blur-2xl group-hover:bg-${kpi.color}-500/20 transition-colors`} />
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-semibold text-[#716D5C] uppercase tracking-wider">{kpi.label}</span>
                      <kpi.icon className={`w-4 h-4 text-${kpi.color}-400`} />
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-bold text-[#262626] font-mono tracking-tight">
                        {kpi.isPercent ? (
                          <>{overviewData?.autoRate || 0}</>
                        ) : (
                          <AnimatedCounter value={kpi.value} />
                        )}
                      </span>
                      <span className="text-sm font-medium text-[#716D5C] mb-0.5">{kpi.suffix}</span>
                    </div>
                    {kpi.trend !== undefined && Number(kpi.trend) !== 0 && (
                      <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${Number(kpi.trend) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {Number(kpi.trend) > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(Number(kpi.trend))}% vs 7j précédents
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Row 2: Activity chart + Recent events */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Activity mini-chart */}
                <div className="lg:col-span-2 bg-[#F9F7F1] rounded-2xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-sm font-bold text-[#262626]">Activité 14 derniers jours</h3>
                      <p className="text-xs text-[#716D5C] mt-0.5">Événements traités par jour</p>
                    </div>
                    <BarChart3 className="w-4 h-4 text-[#716D5C]" />
                  </div>
                  <div className="flex items-end gap-1.5 h-32">
                    {(overviewData?.dailyActivity || Array.from({ length: 14 }, () => ({ events: 0, label: '' }))).map((day, i) => {
                      const maxEvents = Math.max(...(overviewData?.dailyActivity || []).map(d => d.events), 1);
                      const height = Math.max((day.events / maxEvents) * 100, 4);
                      return (
                        <motion.div
                          key={i}
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ delay: i * 0.03, duration: 0.4 }}
                          className="flex-1 group relative"
                        >
                          <div
                            className={`w-full h-full rounded-md transition-colors ${
                              day.events > 0
                                ? 'bg-emerald-500/60 hover:bg-emerald-400/80'
                                : 'bg-gray-50'
                            }`}
                          />
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-[#262626] text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            {day.events} évén.
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2">
                    {(overviewData?.dailyActivity || []).filter((_, i) => i % 2 === 0).map((day, i) => (
                      <span key={i} className="text-[10px] text-[#716D5C]">{day.label}</span>
                    ))}
                  </div>
                </div>

                {/* Recent events feed */}
                <div className="bg-[#F9F7F1] rounded-2xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[#262626]">Derniers événements</h3>
                    <span className="text-[10px] text-[#716D5C] font-medium">LIVE</span>
                  </div>
                  <div className="space-y-3">
                    {(overviewData?.recentEvents || []).slice(0, 6).map((event, i) => {
                      const categoryLabels = {
                        ticket_resolved: { label: 'Ticket résolu', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                        ticket_escalated: { label: 'Escaladé', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                        cart_email_sent: { label: 'Email panier', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                        cart_recovered: { label: 'Panier récupéré', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                        visit_scheduled: { label: 'Visite planifiée', color: 'text-violet-400', bg: 'bg-violet-500/10' },
                        lead_qualified: { label: 'Lead qualifié', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                        visit_reply_sent: { label: 'Réponse visite', color: 'text-purple-400', bg: 'bg-purple-500/10' },
                        match_found: { label: 'Match trouvé', color: 'text-pink-400', bg: 'bg-pink-500/10' },
                      };
                      const cat = categoryLabels[event.event_category] || { label: event.event_category, color: 'text-[#716D5C]', bg: 'bg-gray-50' };
                      const timeAgo = (() => {
                        const diff = (Date.now() - new Date(event.created_at).getTime()) / 1000;
                        if (diff < 60) return "à l'instant";
                        if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
                        if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
                        return `il y a ${Math.floor(diff / 86400)}j`;
                      })();
                      return (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center gap-3"
                        >
                          <div className={`w-2 h-2 rounded-full ${cat.color.replace('text-', 'bg-')}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[#262626] truncate">{cat.label}</p>
                            <p className="text-[10px] text-[#716D5C] truncate">{event.clients?.brand_name || '—'}</p>
                          </div>
                          <span className="text-[10px] text-[#716D5C] whitespace-nowrap">{timeAgo}</span>
                        </motion.div>
                      );
                    })}
                    {(!overviewData?.recentEvents || overviewData.recentEvents.length === 0) && (
                      <p className="text-xs text-[#716D5C] text-center py-4">Aucun événement récent</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: Clients overview + Funnel + Event breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Clients list */}
                <div className="bg-[#F9F7F1] rounded-2xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[#262626]">Clients actifs</h3>
                    <button onClick={() => setActiveTab('clients')} className="text-[10px] text-emerald-400 font-medium hover:text-emerald-300 transition-colors">Voir tout →</button>
                  </div>
                  <div className="space-y-3">
                    {clients.map((client, i) => (
                      <motion.div
                        key={client.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-[#F9F7F1] transition-colors cursor-pointer"
                        onClick={() => setSelectedClient(client)}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${
                          client.client_type === 'immobilier'
                            ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {client.client_type === 'immobilier' ? <Building2 className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#262626] truncate">{client.brand_name}</p>
                          <p className="text-[10px] text-[#716D5C] capitalize">{client.client_type || 'ecommerce'}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          client.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-gray-500/10 text-[#716D5C] border border-gray-500/20'
                        }`}>
                          {client.status === 'active' ? 'ACTIF' : 'INACTIF'}
                        </span>
                      </motion.div>
                    ))}
                    {clients.length === 0 && (
                      <p className="text-xs text-[#716D5C] text-center py-4">Aucun client</p>
                    )}
                  </div>
                </div>

                {/* Funnel pipeline */}
                <div className="bg-[#F9F7F1] rounded-2xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[#262626]">Pipeline Funnel</h3>
                    <Target className="w-4 h-4 text-[#716D5C]" />
                  </div>
                  <div className="space-y-3">
                    {(overviewData?.funnel || []).map((f, i) => {
                      const statusColors = {
                        draft: { label: 'Brouillon', color: 'text-[#716D5C]', bg: 'bg-gray-500/10 border-gray-500/20' },
                        sent: { label: 'Envoyé', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                        paid: { label: 'Payé', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                        canceled: { label: 'Annulé', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
                      };
                      const s = statusColors[f.status] || statusColors.draft;
                      return (
                        <motion.div
                          key={f.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center gap-3 p-3 rounded-xl bg-gray-50"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#262626] truncate">{f.company_name}</p>
                            <p className="text-[10px] text-[#716D5C]">{f.setup_price}€ setup + {f.monthly_price}€/mois</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${s.bg} ${s.color}`}>
                            {s.label.toUpperCase()}
                          </span>
                        </motion.div>
                      );
                    })}
                    {(!overviewData?.funnel || overviewData.funnel.length === 0) && (
                      <p className="text-xs text-[#716D5C] text-center py-4">Aucun prospect dans le funnel</p>
                    )}
                  </div>
                </div>

                {/* Event breakdown by type */}
                <div className="bg-[#F9F7F1] rounded-2xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[#262626]">Répartition événements</h3>
                    <TrendingUp className="w-4 h-4 text-[#716D5C]" />
                  </div>
                  <div className="space-y-2.5">
                    {Object.entries(overviewData?.eventsByCategory || {})
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, count], i) => {
                        const total = overviewData?.totalEvents || 1;
                        const pct = ((count / total) * 100).toFixed(0);
                        const labels = {
                          ticket_resolved: 'Tickets résolus',
                          ticket_escalated: 'Escaladés',
                          cart_email_sent: 'Emails panier',
                          cart_recovered: 'Paniers récupérés',
                          visit_scheduled: 'Visites planifiées',
                          lead_qualified: 'Leads qualifiés',
                          visit_reply_sent: 'Réponses visite',
                          match_found: 'Matchs trouvés',
                          email_opened: 'Emails ouverts',
                          email_clicked: 'Emails cliqués',
                          lead_escalated: 'Leads escaladés',
                        };
                        const colors = {
                          ticket_resolved: 'bg-emerald-500',
                          ticket_escalated: 'bg-amber-500',
                          cart_email_sent: 'bg-blue-500',
                          cart_recovered: 'bg-cyan-500',
                          visit_scheduled: 'bg-violet-500',
                          lead_qualified: 'bg-pink-500',
                          visit_reply_sent: 'bg-purple-500',
                          match_found: 'bg-rose-500',
                          email_opened: 'bg-sky-500',
                          email_clicked: 'bg-indigo-500',
                          lead_escalated: 'bg-orange-500',
                        };
                        return (
                          <div key={cat}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-[#716D5C]">{labels[cat] || cat}</span>
                              <span className="text-xs font-mono text-[#716D5C]">{count} ({pct}%)</span>
                            </div>
                            <div className="h-1.5 bg-gray-50 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ delay: i * 0.05, duration: 0.5 }}
                                className={`h-full rounded-full ${colors[cat] || 'bg-gray-500'}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    {(!overviewData?.eventsByCategory || Object.keys(overviewData.eventsByCategory).length === 0) && (
                      <p className="text-xs text-[#716D5C] text-center py-4">Aucune donnée</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 4: Leads preview */}
              {leads.length > 0 && (
                <div className="bg-[#F9F7F1] rounded-2xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-bold text-[#262626]">Derniers leads</h3>
                      <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md">{leads.length}</span>
                    </div>
                    <button onClick={() => setActiveTab('leads')} className="text-[10px] text-emerald-400 font-medium hover:text-emerald-300 transition-colors">Voir tout →</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {leads.slice(0, 3).map((lead, i) => (
                      <motion.div
                        key={lead.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-3 rounded-xl bg-gray-50 border border-gray-100"
                      >
                        <p className="text-sm font-medium text-[#262626]">{lead.brand_name}</p>
                        <p className="text-xs text-[#716D5C] mt-0.5">{lead.email}</p>
                        <p className="text-[10px] text-[#716D5C] mt-1">{new Date(lead.created_at).toLocaleDateString('fr-FR')}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "clients" && (
            <div className="max-w-6xl mx-auto animate-fade-in-up space-y-6">
              {/* Header with search + add */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-[#262626]">Clients</h2>
                  <p className="text-sm text-[#716D5C] mt-1">{clients.length} client{clients.length > 1 ? 's' : ''} au total</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#716D5C]" />
                    <input
                      type="text"
                      placeholder="Rechercher..."
                      className="pl-9 pr-4 py-2 bg-[#F9F7F1] border border-gray-200 rounded-xl text-sm w-full sm:w-64 outline-none focus:border-gray-300 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Summary row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#F9F7F1] rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span className="text-[11px] font-semibold text-[#716D5C] uppercase tracking-wider">Actifs</span>
                  </div>
                  <p className="text-2xl font-bold font-mono text-emerald-400">{clients.filter(c => c.status === 'active').length}</p>
                </div>
                <div className="bg-[#F9F7F1] rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingBag className="w-4 h-4 text-blue-400" />
                    <span className="text-[11px] font-semibold text-[#716D5C] uppercase tracking-wider">E-commerce</span>
                  </div>
                  <p className="text-2xl font-bold font-mono text-[#262626]">{clients.filter(c => !c.client_type || c.client_type === 'ecommerce').length}</p>
                </div>
                <div className="bg-[#F9F7F1] rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-violet-400" />
                    <span className="text-[11px] font-semibold text-[#716D5C] uppercase tracking-wider">Immobilier</span>
                  </div>
                  <p className="text-2xl font-bold font-mono text-[#262626]">{clients.filter(c => c.client_type === 'immobilier').length}</p>
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-20">
                  <Sparkles className="w-8 h-8 animate-pulse text-[#716D5C]" />
                </div>
              ) : clients.length === 0 ? (
                <div className="bg-[#F9F7F1] border border-gray-200 rounded-2xl p-16 text-center flex flex-col items-center">
                  <Users className="w-12 h-12 text-[#716D5C] mb-4" />
                  <h3 className="text-xl font-bold mb-2">Aucun client pour le moment</h3>
                  <button onClick={handleAddClient} className="bg-white text-[#262626] px-5 py-2.5 rounded-xl text-sm font-bold mt-4">
                    Ajouter un client
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {clients.map((client, i) => (
                    <motion.div
                      key={client.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setSelectedClient(client)}
                      className="bg-[#F9F7F1] border border-gray-200 rounded-2xl p-5 flex items-center gap-5 hover:border-gray-300 transition-all cursor-pointer group"
                    >
                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        client.client_type === 'immobilier'
                          ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {client.client_type === 'immobilier' ? <Building2 className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <p className="text-base font-bold text-[#262626] truncate">{client.brand_name}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            client.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-gray-500/10 text-[#716D5C] border-gray-500/20'
                          }`}>
                            {client.status === 'active' ? 'ACTIF' : 'INACTIF'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                          <span className="text-xs text-[#716D5C] capitalize">{client.client_type || 'ecommerce'}</span>
                          <span className="text-xs text-[#716D5C]">{client.contact_email || 'Pas d\'email'}</span>
                          <span className="text-[10px] text-[#716D5C]">Créé le {new Date(client.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                        {/* Integration status badges */}
                        {getClientIntegrations(client.id).length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {getClientIntegrations(client.id).map((integ, j) => (
                              <span key={j} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border capitalize ${
                                integ.status === 'active'
                                  ? 'bg-emerald-50 text-[#003725] border-emerald-200'
                                  : integ.status === 'error'
                                  ? 'bg-red-50 text-red-600 border-red-200'
                                  : integ.status === 'expired'
                                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                                  : 'bg-gray-50 text-[#716D5C] border-gray-200'
                              }`}>
                                {integ.provider}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[10px] font-mono text-[#716D5C]">{client.id}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(client.id);
                              setCopiedId(client.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="p-0.5 rounded hover:bg-gray-50 transition-colors"
                            title="Copier l'ID"
                          >
                            {copiedId === client.id
                              ? <Check className="w-3 h-3 text-emerald-400" />
                              : <Copy className="w-3 h-3 text-[#716D5C] hover:text-[#716D5C]" />
                            }
                          </button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setCallNotesClient(client); }}
                          className="text-[#716D5C] hover:text-emerald-400 transition-colors p-2 rounded-lg hover:bg-emerald-500/10"
                          title="Notes de call"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedClient(client); }}
                          className="text-[#716D5C] hover:text-[#262626] transition-colors p-2 rounded-lg hover:bg-gray-50"
                          title="Configurer"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "requests" && (
            <div className="max-w-6xl mx-auto animate-fade-in-up">
              <AdminKanbanBoard requests={requests} onRefresh={refetchRequests} />
            </div>
          )}

          {activeTab === "leads" && (
            <div className="max-w-6xl mx-auto animate-fade-in-up">
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2">Leads Capturés</h2>
                <p className="text-[#716D5C]">Contacts intéressés via l'Audit IA.</p>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-20">
                  <Sparkles className="w-8 h-8 animate-pulse text-[#716D5C]" />
                </div>
              ) : leads.length === 0 ? (
                <div className="text-center py-20 bg-[#F9F7F1] rounded-2xl border border-gray-200">
                  <Users className="w-12 h-12 text-[#716D5C] mx-auto mb-4" />
                  <p className="text-[#716D5C]">Aucun lead pour le moment.</p>
                </div>
              ) : (
                <div className="bg-[#F9F7F1] border border-gray-200 rounded-2xl overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="border-b border-gray-100 bg-white">
                        <th className="px-6 py-4 text-xs font-bold text-[#716D5C] uppercase tracking-widest">Entreprise</th>
                        <th className="px-6 py-4 text-xs font-bold text-[#716D5C] uppercase tracking-widest">Email</th>
                        <th className="px-6 py-4 text-xs font-bold text-[#716D5C] uppercase tracking-widest">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                      {leads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-bold">{lead.brand_name}</td>
                          <td className="px-6 py-4 text-[#716D5C]">{lead.email}</td>
                          <td className="px-6 py-4 text-[#716D5C]">
                            {new Date(lead.created_at).toLocaleDateString("fr-FR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {selectedClient && (
        <AdminClientSettingsModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['admin-clients'] })}
          onOpenCallNotes={() => { setCallNotesClient(selectedClient); setSelectedClient(null); }}
        />
      )}

      <AnimatePresence>
        {callNotesClient && (
          <CallNotesWizard
            client={callNotesClient}
            onClose={() => setCallNotesClient(null)}
            onDeployReady={handleDeployReady}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deploymentState && (
          <DeploymentProgress
            deploymentId={deploymentState.deploymentId}
            clientName={deploymentState.clientName}
            onClose={() => {
              setDeploymentState(null);
              queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
