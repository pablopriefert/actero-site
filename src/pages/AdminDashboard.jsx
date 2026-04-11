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
  Handshake,
  Grid3x3,
  Shield,
  BookOpen,
  TrendingDown,
  Trophy,
  CreditCard,
  Coins,
  BellRing,
  ScrollText,
  UserCog,
  Inbox,
  Plug,
  MessageSquare,
  Eye,
  X,
  Settings,
  AlertTriangle
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
import { AdminEngineTestView } from '../components/admin/AdminEngineTestView'
import { AdminEngineRunsView } from '../components/admin/AdminEngineRunsView'
import { AdminManualReviewView } from '../components/admin/AdminManualReviewView'
import { AdminPlaybooksView } from '../components/admin/AdminPlaybooksView'
// Wave 2 components
import { AdminLiveRunsView } from '../components/admin/AdminLiveRunsView'
import { AdminAgentHeatmapView } from '../components/admin/AdminAgentHeatmapView'
import { AdminTopErrorsView } from '../components/admin/AdminTopErrorsView'
import { AdminCostTrackerView } from '../components/admin/AdminCostTrackerView'
import { AdminConnectorHealthView } from '../components/admin/AdminConnectorHealthView'
import { AdminClientsListView } from '../components/admin/AdminClientsListView'
import { AdminMRRView } from '../components/admin/AdminMRRView'
import { AdminChurnCohortView } from '../components/admin/AdminChurnCohortView'
import { AdminROILeaderboardView } from '../components/admin/AdminROILeaderboardView'
import { AdminTokensView } from '../components/admin/AdminTokensView'
import { AdminHallucinationView } from '../components/admin/AdminHallucinationView'
import { AdminAlertBuilderView } from '../components/admin/AdminAlertBuilderView'
import { useToast } from '../components/ui/Toast'

const GlobalSearchBar = ({ clients = [], funnel = [], onSelectClient, onNavigateTab }) => {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = React.useRef(null);

  const results = React.useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    const items = [];

    // Search clients
    clients.forEach(c => {
      if (`${c.brand_name} ${c.contact_email || ''} ${c.client_type || ''}`.toLowerCase().includes(q)) {
        items.push({ type: 'client', label: c.brand_name, sub: c.client_type || 'ecommerce', data: c });
      }
    });

    // Search funnel
    funnel.forEach(f => {
      if (`${f.company_name || ''} ${f.email || ''} ${f.slug || ''}`.toLowerCase().includes(q)) {
        items.push({ type: 'funnel', label: f.company_name || f.slug, sub: f.status || 'draft', data: f });
      }
    });

    return items.slice(0, 8);
  }, [query, clients, funnel]);

  const showResults = focused && results.length > 0;

  return (
    <div className="relative w-72">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
        placeholder="Rechercher un client, funnel..."
        className="w-full pl-9 pr-4 py-2 bg-[#fafafa] border border-[#f0f0f0] rounded-xl text-[13px] text-[#1a1a1a] placeholder-[#9ca3af] outline-none focus:bg-white focus:border-[#0F5F35]/30"
      />
      {showResults && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-[#f0f0f0] rounded-xl shadow-lg overflow-hidden z-50">
          {results.map((r, i) => (
            <button
              key={i}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#fafafa] transition-colors text-[13px]"
              onMouseDown={() => {
                if (r.type === 'client') {
                  onSelectClient(r.data);
                } else if (r.type === 'funnel') {
                  onNavigateTab('funnel');
                }
                setQuery('');
                setFocused(false);
              }}
            >
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                r.type === 'client' ? 'bg-emerald-50 text-[#0F5F35] border-emerald-200' : 'bg-blue-50 text-blue-600 border-blue-200'
              }`}>{r.type === 'client' ? 'Client' : 'Funnel'}</span>
              <span className="font-medium text-[#1a1a1a] truncate">{r.label}</span>
              <span className="text-[#71717a] text-[12px] ml-auto">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const QuickAddClientModal = ({ onClose, onSubmit }) => {
  const [brandName, setBrandName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!brandName.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        brand_name: brandName.trim(),
        contact_email: contactEmail.trim() || null,
        monthly_price: monthlyPrice ? Number(monthlyPrice) : null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-md bg-white rounded-2xl border border-[#f0f0f0] shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
          <h3 className="text-[15px] font-semibold text-[#1a1a1a]">Ajouter un client</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#fafafa] text-[#71717a]"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-1.5">Nom de l'entreprise</label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Actero, Maison Durand..."
              className="w-full px-3 py-2 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:border-[#0F5F35]/40 focus:bg-white"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-1.5">Email du contact</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@exemple.com"
              className="w-full px-3 py-2 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:border-[#0F5F35]/40 focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-1.5">Prix mensuel (EUR)</label>
            <input
              type="number"
              step="1"
              min="0"
              value={monthlyPrice}
              onChange={(e) => setMonthlyPrice(e.target.value)}
              placeholder="490"
              className="w-full px-3 py-2 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:border-[#0F5F35]/40 focus:bg-white"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[13px] font-semibold text-[#71717a] hover:bg-[#fafafa]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || !brandName.trim()}
              className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-[#0F5F35] text-white hover:bg-[#0F5F35]/90 disabled:opacity-50"
            >
              {submitting ? 'Creation...' : 'Creer'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export const AdminDashboard = ({ onNavigate, onLogout, currentRoute }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandKOpen, setIsCommandKOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [callNotesClient, setCallNotesClient] = useState(null);
  const [deploymentState, setDeploymentState] = useState(null); // { deploymentId, clientName }
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);

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
    if (route === "/admin/engine") return "engine";
    if (route === "/admin/engine-runs") return "engine-runs";
    if (route === "/admin/engine-reviews") return "engine-reviews";
    if (route === "/admin/engine-playbooks") return "engine-playbooks";
    // Wave 2 routes
    if (route === "/admin/live-runs") return "live-runs";
    if (route === "/admin/agent-heatmap") return "agent-heatmap";
    if (route === "/admin/top-errors") return "top-errors";
    if (route === "/admin/cost-tracker") return "cost-tracker";
    if (route === "/admin/connector-health") return "connector-health";
    if (route === "/admin/mrr") return "mrr";
    if (route === "/admin/churn-cohort") return "churn-cohort";
    if (route === "/admin/roi-leaderboard") return "roi-leaderboard";
    if (route === "/admin/alert-builder") return "alert-builder";
    if (route === "/admin/tokens") return "tokens";
    if (route === "/admin/hallucination") return "hallucination";
    if (route === "/admin/escalations-inbox") return "escalations-inbox";
    if (route === "/admin/conversations") return "conversations";
    if (route === "/admin/manual-review") return "manual-review";
    if (route === "/admin/playbooks") return "playbooks";
    if (route === "/admin/action-logs") return "action-logs";
    if (route === "/admin/team") return "team";
    if (route === "/admin/settings") return "settings";
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
    { type: 'section', label: 'WORKSPACE' },
    { id: 'overview', label: 'Accueil equipe', icon: LayoutDashboard },

    { type: 'section', label: 'Clients' },
    { id: 'clients', label: 'Tous les clients', icon: Users },
    { id: 'conversations', label: 'Conversations live', icon: MessageSquare },
    { id: 'escalations-inbox', label: 'Inbox escalades', icon: Inbox },
    { id: 'health', label: 'Sante clients', icon: Heart },
    { id: 'funnel', label: 'Nouveau client', icon: UserPlus },

    { type: 'section', label: 'AI Engine' },
    {
      type: 'expandable',
      label: 'Monitoring',
      icon: Activity,
      defaultOpen: true,
      children: [
        { id: 'live-runs', label: 'Live runs', icon: Zap, badge: 'LIVE', badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
        { id: 'agent-heatmap', label: 'Heatmap agents', icon: Grid3x3 },
        { id: 'top-errors', label: 'Top erreurs', icon: AlertTriangle },
        { id: 'connector-health', label: 'Sante connecteurs', icon: Plug },
        { id: 'engine-runs', label: 'Historique runs', icon: ScrollText },
      ],
    },
    {
      type: 'expandable',
      label: 'Qualite IA',
      icon: Shield,
      children: [
        { id: 'hallucination', label: 'Hallucinations', icon: AlertCircle },
        { id: 'manual-review', label: 'Review manuelle', icon: Eye, badge: requests.length > 0 ? requests.length : null },
        { id: 'playbooks', label: 'Playbooks', icon: BookOpen },
        { id: 'ratings', label: 'Notations', icon: FileText },
        { id: 'engine', label: 'Webhook test', icon: TerminalSquare },
      ],
    },

    { type: 'section', label: 'Analytics' },
    { id: 'mrr', label: 'MRR & Revenus', icon: DollarSign },
    { id: 'churn-cohort', label: 'Cohortes de retention', icon: TrendingDown },
    { id: 'roi-leaderboard', label: 'ROI classement', icon: Trophy },
    { id: 'cost-tracker', label: 'Couts Claude', icon: CreditCard },
    { id: 'tokens', label: 'Consommation tokens', icon: Coins },
    { id: 'pipeline', label: 'Pipeline commercial', icon: GitBranch },
    { id: 'billing', label: 'Facturation', icon: Receipt },

    { type: 'section', label: 'Operations' },
    { id: 'alert-builder', label: 'Alertes Slack', icon: BellRing },
    { id: 'action-logs', label: 'Journal audit', icon: ScrollText },
    { id: 'shopify', label: 'App Shopify', icon: ShoppingBag },

    { type: 'section', label: 'Reseau' },
    { id: 'referrals', label: 'Parrainages', icon: Gift },
    { id: 'ambassadors', label: 'Ambassadeurs', icon: Heart },
    { id: 'partners', label: 'Partenaires', icon: Handshake },

    { type: 'section', label: 'Systeme' },
    { id: 'team', label: 'Equipe Actero', icon: UserCog },
    { id: 'settings', label: 'Parametres', icon: Settings },
  ];

  const handleAddClient = () => setIsAddClientOpen(true);

  const handleAddClientSubmit = async (payload) => {
    try {
      const { error } = await supabase.from("clients").insert([payload]);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      setIsAddClientOpen(false);
      toast.success?.('Client ajoute avec succes');
    } catch (err) {
      toast.error("Erreur: " + err.message);
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
      toast.error('Erreur deploiement: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col md:flex-row font-sans text-[#1a1a1a]">
      {/* Mobile Header */}
      <div className="md:hidden h-16 bg-white border-b border-[#f0f0f0] flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Logo className="w-6 h-6 text-[#1a1a1a]" />
          <span className="font-semibold text-[15px]">Actero Admin</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)}>
          <Menu className="w-6 h-6 text-[#71717a]" />
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
              className="relative w-4/5 max-w-xs bg-[#ffffff] h-full shadow-2xl"
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
        <header className="hidden md:flex h-16 bg-white border-b border-[#f0f0f0] items-center px-8 justify-between">
          <h1 className="text-[18px] font-semibold tracking-tight text-[#1a1a1a]">
            {{
              overview: 'Accueil equipe',
              clients: 'Tous les clients',
              conversations: 'Conversations live',
              'escalations-inbox': 'Inbox escalades',
              health: 'Sante clients',
              funnel: 'Nouveau client',
              'live-runs': 'Live runs',
              'agent-heatmap': 'Heatmap agents',
              'top-errors': 'Top erreurs',
              'connector-health': 'Sante connecteurs',
              'engine-runs': 'Historique runs',
              hallucination: 'Hallucinations IA',
              'manual-review': 'Review manuelle',
              playbooks: 'Playbooks',
              ratings: 'Notations IA',
              engine: 'Webhook test',
              mrr: 'MRR et revenus',
              'churn-cohort': 'Cohortes de retention',
              'roi-leaderboard': 'ROI classement',
              'cost-tracker': 'Couts Claude',
              tokens: 'Consommation tokens',
              pipeline: 'Pipeline commercial',
              billing: 'Facturation',
              'alert-builder': 'Alertes Slack',
              'action-logs': 'Journal audit',
              shopify: 'App Shopify',
              referrals: 'Parrainages',
              ambassadors: 'Ambassadeurs',
              partners: 'Partenaires',
              team: 'Equipe Actero',
              settings: 'Parametres',
              requests: 'Demandes IA',
              leads: 'Leads captures',
            }[activeTab] || activeTab.replace('-', ' ')}
          </h1>
          <GlobalSearchBar
            clients={clients}
            funnel={overviewData?.funnel || []}
            onSelectClient={(c) => { setSelectedClient(c); }}
            onNavigateTab={setActiveTab}
          />
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

          {activeTab === "engine" && <AdminEngineTestView />}
          {activeTab === "engine-runs" && <AdminEngineRunsView />}
          {activeTab === "engine-reviews" && <AdminManualReviewView />}
          {activeTab === "engine-playbooks" && <AdminPlaybooksView />}

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
                    className="relative bg-white rounded-2xl border border-[#f0f0f0] p-5 shadow-sm overflow-hidden group hover:border-gray-300 transition-colors"
                  >
                    <div className={`absolute -top-6 -right-6 w-20 h-20 bg-${kpi.color}-500/10 rounded-full blur-2xl group-hover:bg-${kpi.color}-500/20 transition-colors`} />
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-semibold text-[#71717a] uppercase tracking-wider">{kpi.label}</span>
                      <kpi.icon className={`w-4 h-4 text-${kpi.color}-400`} />
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-[30px] font-bold text-[#1a1a1a] font-mono tracking-tight">
                        {kpi.isPercent ? (
                          <>{overviewData?.autoRate || 0}</>
                        ) : (
                          <AnimatedCounter value={kpi.value} />
                        )}
                      </span>
                      <span className="text-[13px] font-medium text-[#71717a] mb-0.5">{kpi.suffix}</span>
                    </div>
                    {kpi.trend !== undefined && Number(kpi.trend) !== 0 && (
                      <div className={`flex items-center gap-1 mt-2 text-[12px] font-medium ${Number(kpi.trend) > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
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
                <div className="lg:col-span-2 bg-white rounded-2xl border border-[#f0f0f0] p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-[13px] font-bold text-[#1a1a1a]">Activité 14 derniers jours</h3>
                      <p className="text-[12px] text-[#71717a] mt-0.5">Événements traités par jour</p>
                    </div>
                    <BarChart3 className="w-4 h-4 text-[#71717a]" />
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
                                ? 'bg-emerald-500/60 hover:bg-emerald-500/80'
                                : 'bg-[#fafafa]'
                            }`}
                          />
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-[#1a1a1a] text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            {day.events} évén.
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2">
                    {(overviewData?.dailyActivity || []).filter((_, i) => i % 2 === 0).map((day, i) => (
                      <span key={i} className="text-[10px] text-[#71717a]">{day.label}</span>
                    ))}
                  </div>
                </div>

                {/* Recent events feed */}
                <div className="bg-white rounded-2xl border border-[#f0f0f0] p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[13px] font-bold text-[#1a1a1a]">Derniers événements</h3>
                    <span className="text-[10px] text-[#71717a] font-medium">LIVE</span>
                  </div>
                  <div className="space-y-3">
                    {(overviewData?.recentEvents || []).slice(0, 6).map((event, i) => {
                      const categoryLabels = {
                        ticket_resolved: { label: 'Ticket résolu', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                        ticket_escalated: { label: 'Escaladé', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                        cart_email_sent: { label: 'Email panier', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                        cart_recovered: { label: 'Panier récupéré', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                        visit_scheduled: { label: 'Visite planifiée', color: 'text-violet-400', bg: 'bg-violet-500/10' },
                        lead_qualified: { label: 'Lead qualifié', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                        visit_reply_sent: { label: 'Réponse visite', color: 'text-purple-400', bg: 'bg-purple-500/10' },
                        match_found: { label: 'Match trouvé', color: 'text-pink-400', bg: 'bg-pink-500/10' },
                      };
                      const cat = categoryLabels[event.event_category] || { label: event.event_category, color: 'text-[#71717a]', bg: 'bg-[#fafafa]' };
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
                            <p className="text-[12px] font-medium text-[#1a1a1a] truncate">{cat.label}</p>
                            <p className="text-[10px] text-[#71717a] truncate">{event.clients?.brand_name || '—'}</p>
                          </div>
                          <span className="text-[10px] text-[#71717a] whitespace-nowrap">{timeAgo}</span>
                        </motion.div>
                      );
                    })}
                    {(!overviewData?.recentEvents || overviewData.recentEvents.length === 0) && (
                      <p className="text-[12px] text-[#71717a] text-center py-4">Aucun événement récent</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: Clients overview + Funnel + Event breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Clients list */}
                <div className="bg-white rounded-2xl border border-[#f0f0f0] p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[13px] font-bold text-[#1a1a1a]">Clients actifs</h3>
                    <button onClick={() => setActiveTab('clients')} className="text-[10px] text-emerald-500 font-medium hover:text-emerald-300 transition-colors">Voir tout →</button>
                  </div>
                  <div className="space-y-3">
                    {clients.map((client, i) => (
                      <motion.div
                        key={client.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-[#fafafa] hover:bg-[#ffffff] transition-colors cursor-pointer"
                        onClick={() => setSelectedClient(client)}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[13px] font-bold ${
                          client.client_type === 'immobilier'
                            ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        }`}>
                          {client.client_type === 'immobilier' ? <Building2 className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[#1a1a1a] truncate">{client.brand_name}</p>
                          <p className="text-[10px] text-[#71717a] capitalize">{client.client_type || 'ecommerce'}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          client.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : 'bg-[#fafafa]0/10 text-[#71717a] border border-gray-500/20'
                        }`}>
                          {client.status === 'active' ? 'ACTIF' : 'INACTIF'}
                        </span>
                      </motion.div>
                    ))}
                    {clients.length === 0 && (
                      <p className="text-[12px] text-[#71717a] text-center py-4">Aucun client</p>
                    )}
                  </div>
                </div>

                {/* Funnel pipeline */}
                <div className="bg-white rounded-2xl border border-[#f0f0f0] p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[13px] font-bold text-[#1a1a1a]">Pipeline Funnel</h3>
                    <Target className="w-4 h-4 text-[#71717a]" />
                  </div>
                  <div className="space-y-3">
                    {(overviewData?.funnel || []).map((f, i) => {
                      const statusColors = {
                        draft: { label: 'Brouillon', color: 'text-[#71717a]', bg: 'bg-[#fafafa]0/10 border-gray-500/20' },
                        sent: { label: 'Envoyé', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                        paid: { label: 'Payé', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                        canceled: { label: 'Annulé', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
                      };
                      const s = statusColors[f.status] || statusColors.draft;
                      return (
                        <motion.div
                          key={f.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center gap-3 p-3 rounded-xl bg-[#fafafa]"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[#1a1a1a] truncate">{f.company_name}</p>
                            <p className="text-[10px] text-[#71717a]">{f.setup_price}€ setup + {f.monthly_price}€/mois</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${s.bg} ${s.color}`}>
                            {s.label.toUpperCase()}
                          </span>
                        </motion.div>
                      );
                    })}
                    {(!overviewData?.funnel || overviewData.funnel.length === 0) && (
                      <p className="text-[12px] text-[#71717a] text-center py-4">Aucun prospect dans le funnel</p>
                    )}
                  </div>
                </div>

                {/* Event breakdown by type */}
                <div className="bg-white rounded-2xl border border-[#f0f0f0] p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[13px] font-bold text-[#1a1a1a]">Répartition événements</h3>
                    <TrendingUp className="w-4 h-4 text-[#71717a]" />
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
                              <span className="text-[12px] text-[#71717a]">{labels[cat] || cat}</span>
                              <span className="text-[12px] font-mono text-[#71717a]">{count} ({pct}%)</span>
                            </div>
                            <div className="h-1.5 bg-[#fafafa] rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ delay: i * 0.05, duration: 0.5 }}
                                className={`h-full rounded-full ${colors[cat] || 'bg-[#fafafa]0'}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    {(!overviewData?.eventsByCategory || Object.keys(overviewData.eventsByCategory).length === 0) && (
                      <p className="text-[12px] text-[#71717a] text-center py-4">Aucune donnée</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 4: Leads preview */}
              {leads.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#f0f0f0] p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-[13px] font-bold text-[#1a1a1a]">Derniers leads</h3>
                      <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md">{leads.length}</span>
                    </div>
                    <button onClick={() => setActiveTab('leads')} className="text-[10px] text-emerald-500 font-medium hover:text-emerald-300 transition-colors">Voir tout →</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {leads.slice(0, 3).map((lead, i) => (
                      <motion.div
                        key={lead.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-3 rounded-xl bg-[#fafafa] border border-[#f0f0f0]"
                      >
                        <p className="text-[13px] font-medium text-[#1a1a1a]">{lead.brand_name}</p>
                        <p className="text-[12px] text-[#71717a] mt-0.5">{lead.email}</p>
                        <p className="text-[10px] text-[#71717a] mt-1">{new Date(lead.created_at).toLocaleDateString('fr-FR')}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "clients" && (
            <div className="max-w-7xl mx-auto animate-fade-in-up">
              <AdminClientsListView />
            </div>
          )}

          {/* Wave 2 render blocks */}
          {activeTab === "live-runs" && <div className="max-w-7xl mx-auto animate-fade-in-up"><AdminLiveRunsView /></div>}
          {activeTab === "agent-heatmap" && <div className="max-w-7xl mx-auto animate-fade-in-up"><AdminAgentHeatmapView /></div>}
          {activeTab === "top-errors" && <div className="max-w-7xl mx-auto animate-fade-in-up"><AdminTopErrorsView /></div>}
          {activeTab === "cost-tracker" && <div className="max-w-7xl mx-auto animate-fade-in-up"><AdminCostTrackerView /></div>}
          {activeTab === "connector-health" && <div className="max-w-7xl mx-auto animate-fade-in-up"><AdminConnectorHealthView /></div>}
          {activeTab === "mrr" && <div className="max-w-7xl mx-auto animate-fade-in-up"><AdminMRRView /></div>}
          {activeTab === "churn-cohort" && <div className="max-w-7xl mx-auto animate-fade-in-up"><AdminChurnCohortView /></div>}
          {activeTab === "roi-leaderboard" && <div className="max-w-7xl mx-auto animate-fade-in-up"><AdminROILeaderboardView /></div>}
          {activeTab === "tokens" && <div className="max-w-7xl mx-auto animate-fade-in-up"><AdminTokensView /></div>}
          {activeTab === "hallucination" && <div className="max-w-7xl mx-auto animate-fade-in-up"><AdminHallucinationView /></div>}
          {activeTab === "alert-builder" && <div className="max-w-7xl mx-auto animate-fade-in-up"><AdminAlertBuilderView /></div>}
          {activeTab === "manual-review" && <div className="max-w-7xl mx-auto animate-fade-in-up"><AdminManualReviewView /></div>}
          {activeTab === "playbooks" && <div className="max-w-7xl mx-auto animate-fade-in-up"><AdminPlaybooksView /></div>}

          {/* Placeholder routes for items announced in sidebar but not yet wired */}
          {(activeTab === "conversations" || activeTab === "escalations-inbox" || activeTab === "action-logs" || activeTab === "team" || activeTab === "settings") && (
            <div className="max-w-4xl mx-auto py-20 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#fafafa] border border-[#f0f0f0] mb-4">
                <Sparkles className="w-5 h-5 text-[#71717a]" />
              </div>
              <h3 className="text-[18px] font-bold text-[#1a1a1a] mb-2">Bientot disponible</h3>
              <p className="text-[13px] text-[#71717a]">Cette section sera activee dans une prochaine release.</p>
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
                <h2 className="text-[30px] font-bold mb-2">Leads Capturés</h2>
                <p className="text-[#71717a]">Contacts intéressés via l'Audit IA.</p>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-20">
                  <Sparkles className="w-8 h-8 animate-pulse text-[#71717a]" />
                </div>
              ) : leads.length === 0 ? (
                <div className="text-center py-20 bg-[#ffffff] rounded-2xl border border-[#f0f0f0]">
                  <Users className="w-12 h-12 text-[#71717a] mx-auto mb-4" />
                  <p className="text-[#71717a]">Aucun lead pour le moment.</p>
                </div>
              ) : (
                <div className="bg-[#ffffff] border border-[#f0f0f0] rounded-2xl overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="border-b border-[#f0f0f0] bg-white">
                        <th className="px-6 py-4 text-[12px] font-bold text-[#71717a] uppercase tracking-widest">Entreprise</th>
                        <th className="px-6 py-4 text-[12px] font-bold text-[#71717a] uppercase tracking-widest">Email</th>
                        <th className="px-6 py-4 text-[12px] font-bold text-[#71717a] uppercase tracking-widest">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-[13px]">
                      {leads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-[#fafafa] transition-colors">
                          <td className="px-6 py-4 font-bold">{lead.brand_name}</td>
                          <td className="px-6 py-4 text-[#71717a]">{lead.email}</td>
                          <td className="px-6 py-4 text-[#71717a]">
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

      {isAddClientOpen && (
        <QuickAddClientModal
          onClose={() => setIsAddClientOpen(false)}
          onSubmit={handleAddClientSubmit}
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
