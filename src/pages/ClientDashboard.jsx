import React, { useState, useMemo } from 'react'
// eslint-disable-next-line no-unused-vars
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  ClipboardList,
  BrainCircuit,
  Database,
  Activity,
  Lightbulb,
  Download,

  Moon,

  Sun,
  Plus,
  FileText,
  AlertCircle,
  Clock,
  DollarSign,
  TerminalSquare,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  Menu,
  UserCheck,
  Users,
  Phone,
  CalendarCheck,
  ShoppingCart,
  Mail,
  Ticket,
  User,
  MessageSquare,
  MessageCircle,
  Gift,
  Plug,
  BookOpen,
  AlertTriangle,
  Shield,
  Mic,
  Network,
  Brain,
  Heart,
  Volume2,
  Handshake,
  ShieldCheck,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/layout/Logo'
import { Sidebar } from '../components/layout/Sidebar'
import { MetricCard } from '../components/dashboard/MetricCard'
import { ActivityChart } from '../components/dashboard/ActivityChart'
import { ROIGlowChart } from '../components/dashboard/ROIGlowChart'
import { HealthScoreIndicator, HealthScoreWidget } from '../components/dashboard/HealthScore'
import { MilestoneBadge } from '../components/dashboard/MilestoneBadge'
import { AnimatedCounter } from '../components/ui/animated-counter'
import { SkeletonRow } from '../components/ui/skeleton-row'
import { IntelligenceView } from '../components/dashboard/IntelligenceView'
import { ActivityView, useLiveActivityFeed, formatEvent, formatRelativeTime } from '../components/dashboard/ActivityView'
import { SupportTicketsView } from '../components/dashboard/SupportTicketsView'
import { ClientProfileView } from '../components/client/ClientProfileView'
import { ClientCopilotBubble } from '../components/client/ClientCopilotBubble'
import { ClientConversationsView } from '../components/client/ClientConversationsView'
import { ClientSystemsView } from '../components/client/ClientSystemsView'
import { ClientReferralView } from '../components/client/ClientReferralView'
import { ClientKnowledgeBaseView } from '../components/client/ClientKnowledgeBaseView'
import { ClientIntegrationsView } from '../components/client/ClientIntegrationsView'
import { OnboardingChecklist } from '../components/client/OnboardingChecklist'
import { OnboardingWizard } from '../components/client/OnboardingWizard'
import { AutoDiagnostic } from '../components/client/AutoDiagnostic'
import { GuardrailsEditor } from '../components/client/GuardrailsEditor'
import { PromptEditor } from '../components/client/PromptEditor'
import { ConversationSimulator } from '../components/client/ConversationSimulator'
import { TeamManager, canAccessTab } from '../components/client/TeamManager'
import { ClientEscalationsView } from '../components/client/ClientEscalationsView'
import { ClientSatisfactionScore, SatisfactionKPI } from '../components/client/ClientSatisfactionScore'
import { VoiceAgentView } from '../components/client/VoiceAgentView'
import { MultiAgentView } from '../components/client/MultiAgentView'
import { PromptInjectionView } from '../components/client/PromptInjectionView'
import { ClientMemoryView } from '../components/client/ClientMemoryView'
import { SentimentAnalysisView } from '../components/client/SentimentAnalysisView'
import { VoiceStudioView } from '../components/client/VoiceStudioView'
import { SupplierNegotiationView } from '../components/client/SupplierNegotiationView'
import { VoiceReportView } from '../components/client/VoiceReportView'
import { NotificationCenterView } from '../components/client/NotificationCenterView'
import { AgentImprovementWidget } from '../components/client/AgentImprovementWidget'
import { ChannelsView } from '../components/client/ChannelsView'
import { WorkflowBuilder } from '../components/client/WorkflowBuilder'

const FeedbackButtons = ({ eventId, currentFeedback, supabase }) => {
  const [feedback, setFeedback] = useState(currentFeedback || null);
  const [saving, setSaving] = useState(false);

  const handleFeedback = async (value) => {
    if (saving) return;
    const newValue = feedback === value ? null : value;
    setSaving(true);
    setFeedback(newValue);
    try {
      await supabase
        .from('automation_events')
        .update({ feedback: newValue, feedback_at: newValue ? new Date().toISOString() : null })
        .eq('id', eventId);
    } catch {}
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-0.5 flex-shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); handleFeedback('positive'); }}
        className={`p-1 rounded transition-colors ${feedback === 'positive' ? 'text-[#003725] bg-emerald-50' : 'text-gray-300 hover:text-[#003725] hover:bg-emerald-50'}`}
        title="Bonne reponse"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" /></svg>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleFeedback('negative'); }}
        className={`p-1 rounded transition-colors ${feedback === 'negative' ? 'text-red-500 bg-red-50' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}
        title="Mauvaise reponse"
      >
        <svg className="w-3.5 h-3.5 rotate-180" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" /></svg>
      </button>
    </div>
  );
};

const LiveActivityWidget = ({ supabase, setActiveTab, isLight }) => {
  const { events, isConnected } = useLiveActivityFeed(supabase);
  const recent = events.slice(0, 6);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#0F5F35] animate-pulse' : 'bg-red-500'}`} />
            <h3 className="font-bold text-[#262626] text-sm">Activite recente</h3>
          </div>
          <span className="text-[10px] font-bold text-[#716D5C] uppercase tracking-widest px-2 py-0.5 bg-[#F9F7F1] rounded-full">
            LIVE
          </span>
        </div>
        <button
          onClick={() => setActiveTab('activity')}
          className="text-xs font-bold text-[#003725] hover:underline"
        >
          Tout voir →
        </button>
      </div>
      <div className="divide-y divide-gray-100">
        {recent.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-[#716D5C]">
            Aucune activite recente. Les evenements apparaitront ici en temps reel.
          </div>
        ) : (
          recent.map((event, i) => {
            const formatted = formatEvent(event);
            return (
              <div key={event.id || i} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F9F7F1] transition-colors">
                <span className="text-lg flex-shrink-0">{formatted.icon}</span>
                <p className="text-sm text-[#262626] flex-1 truncate">{formatted.message}</p>
                <FeedbackButtons eventId={event.id} currentFeedback={event.feedback} supabase={supabase} />
                <span className="text-[10px] text-[#716D5C] flex-shrink-0 whitespace-nowrap">
                  {formatRelativeTime(event.created_at)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export const ClientDashboard = ({ onNavigate, onLogout, currentRoute }) => {
  // eslint-disable-next-line no-unused-vars
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState(() => localStorage.getItem("actero-theme") || "light");
  const [selectedPeriod, setSelectedPeriod] = useState("this_month");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // eslint-disable-next-line no-unused-vars
  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("actero-theme", newTheme);
  };

  const getTabFromRoute = (route) => {
    if (route === "/client/activity") return "activity";
    if (route === "/client/systems") return "systems";
    if (route === "/client/knowledge") return "knowledge";
    if (route === "/client/intelligence") return "intelligence";
    if (route === "/client/reports") return "reports";
    if (route === "/client/support") return "support";
    if (route === "/client/referral") return "referral";
    if (route === "/client/integrations") return "integrations";
    if (route === "/client/team") return "team";
    if (route === "/client/agent-config") return "agent-config";
    if (route === "/client/simulator") return "simulator";
    if (route === "/client/guardrails") return "guardrails";
    if (route === "/client/escalations") return "escalations";
    if (route === "/client/voice-agent") return "voice-agent";
    if (route === "/client/multi-agent") return "multi-agent";
    if (route === "/client/prompt-injection") return "prompt-injection";
    if (route === "/client/client-memory") return "client-memory";
    if (route === "/client/sentiment") return "sentiment";
    if (route === "/client/voice-studio") return "voice-studio";
    if (route === "/client/supplier-negotiation") return "supplier-negotiation";
    if (route === "/client/voice-report") return "voice-report";
    if (route === "/client/notifications") return "notifications";
    if (route === "/client/channels") return "channels";
    if (route === "/client/workflows") return "workflows";
    if (route === "/client/profile") return "profile";
    return "overview";
  };

  const activeTab = getTabFromRoute(currentRoute);
  
  const setActiveTab = (tab) => {
    const route = tab === "overview" ? "/client" : `/client/${tab}`;
    onNavigate(route);
  };

  // 1. Fetch Client Profile (via client_users link OR owner_user_id)
  const { data: currentClient, isLoading: clientLoading } = useQuery({
    queryKey: ["client-profile"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");

      // Try via client_users table first (invited users)
      const { data: link } = await supabase
        .from("client_users")
        .select("client_id, role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (link?.client_id) {
        const { data, error } = await supabase
          .from("clients")
          .select("id, brand_name, owner_user_id, created_at, client_type")
          .eq("id", link.client_id)
          .single();
        if (error && error.code !== "PGRST116") throw error;
        return { ...data, _userRole: link.role || 'owner' };
      }

      // Fallback: owner_user_id (legacy / owner accounts)
      const { data, error } = await supabase
        .from("clients")
        .select("id, brand_name, owner_user_id, created_at, client_type")
        .eq("owner_user_id", session.user.id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return { ...data, _userRole: 'owner' };
    },
    enabled: !!supabase,
  });

  // 2. Fetch Metrics (legacy/global)
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["client-metrics", currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("recompute_client_metrics", { p_client_id: currentClient.id });
      if (error) throw error;
      return data;
    },
    enabled: !!supabase && !!currentClient?.id,
  });

  // 3. Fetch Daily Metrics (wide range for trends and comparisons)
  const { data: dailyMetrics = [], isLoading: dailyMetricsLoading } = useQuery({
    queryKey: ["client-daily-metrics", currentClient?.id],
    queryFn: async () => {
      const startOfYear = new Date(2026, 0, 1);
      const { data, error } = await supabase
        .from("metrics_daily")
        .select("*")
        .eq("client_id", currentClient.id)
        .gte("date", startOfYear.toISOString())
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!supabase && !!currentClient?.id,
  });

  // (requests query removed — now handled by SupportTicketsView)

  // 5. Fetch Events (simplified for health score)
  const { data: events = [] } = useQuery({
    queryKey: ["client-events-brief", currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_events")
        .select("event_category, created_at")
        .eq("client_id", currentClient.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!supabase && !!currentClient?.id,
  });

  // 5b. Check Shopify connection (e-commerce clients only)
  const { data: shopifyConnected } = useQuery({
    queryKey: ["shopify-connection", currentClient?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_shopify_connections")
        .select("id")
        .eq("client_id", currentClient.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!currentClient?.id && currentClient?.client_type === 'ecommerce',
  });

  const showShopifyBanner = currentClient?.client_type === 'ecommerce' && shopifyConnected === false;

  // 6. Fetch Event counts by category (for vertical-specific KPIs)
  const { data: eventCounts = {} } = useQuery({
    queryKey: ["client-event-counts", currentClient?.id, selectedPeriod],
    queryFn: async () => {
      const now = new Date();
      let start;
      if (selectedPeriod === "this_month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (selectedPeriod === "last_month") {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      } else {
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      const { data, error } = await supabase
        .from("automation_events")
        .select("event_category")
        .eq("client_id", currentClient.id)
        .gte("created_at", start.toISOString());
      if (error) throw error;
      const counts = {};
      (data || []).forEach(e => { counts[e.event_category] = (counts[e.event_category] || 0) + 1; });
      return counts;
    },
    enabled: !!supabase && !!currentClient?.id,
  });

  // KPI Calculations
  const periodStats = useMemo(() => {
    if (!dailyMetrics.length) {
      return {
        time_saved: 0,
        time_saved_var: 0,
        roi: 0,
        roi_var: 0,
        active_automations: 0,
        active_automations_var: 0,
        tasks_executed: 0,
        tasks_executed_var: 0,
      };
    }

    const now = new Date();
    // Use the latest date in dailyMetrics as "today" for robustness if data hasn't updated yet
    const latestDate = new Date(dailyMetrics[dailyMetrics.length - 1].date);
    const referenceDate = latestDate > now ? now : latestDate;
    
    const startOfCurrentMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    const startOfPrevMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
    const startOfTwoMonthsAgo = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 2, 1);
    const thirtyDaysAgo = new Date(referenceDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(referenceDate.getTime() - 60 * 24 * 60 * 60 * 1000);

    const getPeriodData = (start, end) => dailyMetrics.filter(d => {
      const date = new Date(d.date);
      return date >= start && date <= end;
    });

    let currentPeriodArr = [];
    let comparisonPeriodArr = [];

    if (selectedPeriod === "this_month") {
      currentPeriodArr = getPeriodData(startOfCurrentMonth, referenceDate);
      comparisonPeriodArr = getPeriodData(startOfPrevMonth, new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0));
    } else if (selectedPeriod === "last_month") {
      currentPeriodArr = getPeriodData(startOfPrevMonth, new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0));
      comparisonPeriodArr = getPeriodData(startOfTwoMonthsAgo, new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 0));
    } else {
      currentPeriodArr = getPeriodData(thirtyDaysAgo, referenceDate);
      comparisonPeriodArr = getPeriodData(sixtyDaysAgo, thirtyDaysAgo);
    }

    const calcSum = (arr, field) => arr.reduce((sum, d) => sum + (Number(d[field]) || 0), 0);
    // eslint-disable-next-line no-unused-vars
    const calcAvg = (arr, field) => arr.length > 0 ? calcSum(arr, field) / arr.length : 0;
    const getLast = (arr, field) => arr.length > 0 ? Number(arr[arr.length - 1][field]) || 0 : 0;

    const computeVar = (currentVal, prevVal) => {
      // If no data in previous period, we assume they were at 0 or a base level
      // but to show growth we'll return 100 if they have current data
      if (!prevVal || prevVal === 0) return currentVal > 0 ? 100 : 0;
      return Math.round(((currentVal - prevVal) / prevVal) * 100);
    };

    return {
      time_saved: Math.round(calcSum(currentPeriodArr, 'time_saved_minutes') / 60),
      time_saved_var: computeVar(calcSum(currentPeriodArr, 'time_saved_minutes'), calcSum(comparisonPeriodArr, 'time_saved_minutes')),
      roi: Math.round(calcSum(currentPeriodArr, 'estimated_roi')),
      roi_var: computeVar(calcSum(currentPeriodArr, 'estimated_roi'), calcSum(comparisonPeriodArr, 'estimated_roi')),
      active_automations: getLast(currentPeriodArr, 'active_automations'),
      active_automations_var: computeVar(getLast(currentPeriodArr, 'active_automations'), getLast(comparisonPeriodArr, 'active_automations')),
      tasks_executed: calcSum(currentPeriodArr, 'tasks_executed'),
      tasks_executed_var: computeVar(calcSum(currentPeriodArr, 'tasks_executed'), calcSum(comparisonPeriodArr, 'tasks_executed')),
    };
  }, [dailyMetrics, selectedPeriod]);

  // Specific growthPct for the ROIGlowChart
  const growthPct = useMemo(() => {
    if (!dailyMetrics.length) return 0;
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const curMonth = dailyMetrics.filter(d => new Date(d.date) >= startOfCurrentMonth);
    const prevMonth = dailyMetrics.filter(d => {
      const date = new Date(d.date);
      return date >= startOfPrevMonth && date < startOfCurrentMonth;
    });
    if (prevMonth.length === 0) return 0;
    const curAvg = curMonth.reduce((sum, d) => sum + Number(d.estimated_roi), 0) / (curMonth.length || 1);
    const prevAvg = prevMonth.reduce((sum, d) => sum + Number(d.estimated_roi), 0) / prevMonth.length;
    if (prevAvg === 0) return curAvg > 0 ? 100 : 0;
    return Math.round(((curAvg - prevAvg) / prevAvg) * 100);
  }, [dailyMetrics]);

  // Count pending escalations for badge
  const { data: pendingEscalations = [] } = useQuery({
    queryKey: ['pending-escalation-count', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('client_id', currentClient.id)
        .eq('status', 'escalated')
        .is('human_response', null)
      if (error) return []
      return data || []
    },
    enabled: !!currentClient?.id,
  })

  const escalationCount = pendingEscalations.length;

  const sidebarItems = [
    { id: 'overview', label: 'Accueil', icon: LayoutDashboard },
    { id: 'activity', label: 'Activite', icon: Activity },
    { id: 'channels', label: 'Mes Canaux', icon: Plug },
    { id: 'workflows', label: 'Workflows', icon: Activity },

    { type: 'section', label: 'Mon Agent' },
    { id: 'agent-config', label: 'Configurer', icon: Sparkles },
    { id: 'simulator', label: 'Tester', icon: MessageCircle },
    { id: 'escalations', label: 'Escalades', icon: AlertTriangle, badge: escalationCount > 0 ? escalationCount : null, badgeColor: 'bg-red-100 text-red-600' },
    { id: 'guardrails', label: 'Regles & Limites', icon: Shield },

    { type: 'section', label: 'Vocal' },
    { id: 'voice-agent', label: 'Appels IA', icon: Phone },
    { id: 'voice-studio', label: 'Voix', icon: Mic },
    { id: 'voice-report', label: 'Rapports audio', icon: Volume2 },

    { type: 'section', label: 'Connexions' },
    { id: 'integrations', label: 'Integrations', icon: Plug },

    { type: 'expandable', label: 'Avance', icon: Database, defaultOpen: false, children: [
      { id: 'multi-agent', label: 'Multi-Agents', icon: Network },
      { id: 'prompt-injection', label: 'Securite', icon: ShieldCheck },
      { id: 'client-memory', label: 'Memoire', icon: Brain },
      { id: 'sentiment', label: 'Sentiment', icon: Heart },
      { id: 'supplier-negotiation', label: 'Negociation', icon: Handshake },
      { id: 'systems', label: 'Systemes', icon: Database },
    ]},

    { type: 'section', label: 'Compte' },
    { id: 'notifications', label: 'Notifications', icon: Volume2 },
    { id: 'support', label: 'Aide', icon: MessageSquare },
    { id: 'team', label: 'Equipe', icon: Users },
    { id: 'referral', label: 'Parrainage', icon: Gift },
    { id: 'profile', label: 'Mon Profil', icon: User },
  ];

  const userRole = currentClient?._userRole || 'owner';

  // Filter sidebar items based on user role
  const filteredSidebarItems = sidebarItems.map(item => {
    // Filter children of expandable sections
    if (item.type === 'expandable') {
      const filteredChildren = (item.children || []).filter(c => canAccessTab(userRole, c.id))
      if (filteredChildren.length === 0) return null
      return { ...item, children: filteredChildren }
    }
    return item
  }).filter(Boolean).filter(item => {
    if (item.type === 'section' || item.type === 'expandable') return true
    return canAccessTab(userRole, item.id);
  }).filter((item, i, arr) => {
    // Remove section headers with no items after them
    if (item.type === 'section') {
      const nextItem = arr[i + 1];
      return nextItem && nextItem.type !== 'section';
    }
    return true;
  });

  const isLoading = clientLoading || metricsLoading || dailyMetricsLoading;
  const isLight = theme === "light";

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans bg-[#F5F5F0] text-[#262626]">
      {/* Mobile Header */}
      <div className={`md:hidden h-16 flex items-center justify-between px-4 sticky top-0 z-50 ${isLight ? "bg-white border-b border-gray-200" : "bg-white border-b border-gray-100"}`}>
        <div className="flex items-center gap-2">
          <Logo className={`w-6 h-6 ${isLight ? "text-[#003725]" : "text-[#262626]"}`} />
          <span className={`font-bold text-lg ${isLight ? "text-[#262626]" : "text-[#262626]"}`}>Actero OS</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)}>
          <Menu className={`w-6 h-6 ${isLight ? "text-[#716D5C]" : "text-[#716D5C]"}`} />
        </button>
      </div>

      {/* Sidebar Desktop */}
      <div className="hidden md:block">
        <Sidebar 
          title="Actero OS"
          items={filteredSidebarItems}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onLogout={onLogout}
          theme={theme}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-500 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              className={`relative w-4/5 max-w-xs h-full shadow-2xl ${isLight ? "bg-white" : "bg-[#F9F7F1]"}`}
            >
              <Sidebar 
                title="Actero OS"
                items={filteredSidebarItems}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onLogout={onLogout}
                onClose={() => setIsMobileMenuOpen(false)}
                theme={theme}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className={`sticky top-0 z-40 backdrop-blur-md px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b ${isLight ? "bg-white/80 border-gray-200" : "bg-[#F9F7F1]/80 border-gray-200"}`}>
          <div className="flex items-center gap-6">
            <h1 className={`text-xl font-bold tracking-tight whitespace-nowrap ${isLight ? "text-[#262626]" : "text-[#262626]"}`}>
              {activeTab === "overview" && "Accueil"}
              {activeTab === "activity" && "Activite temps reel"}
              {activeTab === "systems" && "Mes Systemes"}
              {activeTab === "knowledge" && "Base de savoir"}
              {activeTab === "intelligence" && "Intelligence"}
              {activeTab === "support" && "Aide"}
              {activeTab === "referral" && "Parrainage"}
              {activeTab === "integrations" && "Intégrations"}
              {activeTab === "agent-config" && "Configurer l'agent"}
              {activeTab === "simulator" && "Tester l'agent"}
              {activeTab === "team" && "Equipe"}
              {activeTab === "guardrails" && "Regles & Limites"}
              {activeTab === "escalations" && "Escalades"}
              {activeTab === "voice-agent" && "Appels IA"}
              {activeTab === "multi-agent" && "Multi-Agents"}
              {activeTab === "prompt-injection" && "Securite IA"}
              {activeTab === "client-memory" && "Memoire Client"}
              {activeTab === "sentiment" && "Analyse de Sentiment"}
              {activeTab === "voice-studio" && "Voix"}
              {activeTab === "supplier-negotiation" && "Negociation Fournisseur"}
              {activeTab === "voice-report" && "Rapports audio"}
              {activeTab === "notifications" && "Notifications"}
              {activeTab === "channels" && "Mes Canaux"}
              {activeTab === "workflows" && "Workflows"}
            </h1>

            <div className="hidden lg:flex items-center gap-3">
              <HealthScoreIndicator metricsData={dailyMetrics.slice(-7)} eventsData={events} theme={theme} />
              <div className={`h-4 w-px mx-1 ${isLight ? "bg-gray-200" : "bg-gray-50"}`}></div>
              <div className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg ${isLight ? "bg-[#F9F7F1] border-gray-200" : "bg-gray-50 border-gray-200"}`}>
                <Clock className="w-3.5 h-3.5 text-[#003725]" />
                <span className={`text-xs font-bold ${isLight ? "text-[#262626]" : "text-[#262626]"}`}>
                  <AnimatedCounter value={metrics?.time_saved_minutes ? Math.round(metrics.time_saved_minutes/60) : 0} />h <span className="font-normal opacity-60">/mois</span>
                </span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg ${isLight ? "bg-[#F9F7F1] border-gray-200" : "bg-gray-50 border-gray-200"}`}>
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span className={`text-xs font-bold ${isLight ? "text-[#262626]" : "text-[#262626]"}`}>
                  <AnimatedCounter value={metrics?.estimated_roi || 0} />€ <span className="font-normal opacity-60">/mois</span>
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("activity")}
            className="text-sm font-bold text-[#716D5C] hover:text-[#716D5C] flex items-center gap-2 transition-colors"
          >
            Voir l'activité <ArrowRight className="w-4 h-4" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === "overview" && (
            <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h2 className={`text-3xl font-bold mb-2 tracking-tight ${isLight ? "text-[#262626]" : "text-[#262626]"}`}>
                    Bonjour{currentClient ? ` ${currentClient.brand_name}` : ""}, voici vos performances.
                  </h2>
                  <p className={`font-medium text-lg ${isLight ? "text-[#716D5C]" : "text-[#716D5C]"}`}>
                    {selectedPeriod === "this_month" ? "Synthèse du mois en cours." : selectedPeriod === "last_month" ? "Détails du mois dernier." : "Rapport des 30 derniers jours."}
                  </p>
                </div>

                <div className={`flex p-1 rounded-xl border ${isLight ? 'bg-gray-100 border-gray-200' : 'bg-gray-50 border-gray-200'}`}>
                  {[
                    { id: 'this_month', label: 'Ce mois' },
                    { id: 'last_month', label: 'Mois dernier' },
                    { id: 'last_30_days', label: '30 jours' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPeriod(p.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${selectedPeriod === p.id
                        ? (isLight ? 'bg-white text-[#003725] shadow-sm' : 'bg-gray-50 text-[#262626] shadow-lg')
                        : (isLight ? 'text-[#716D5C] hover:text-[#262626]' : 'text-[#716D5C] hover:text-[#716D5C]')
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Escalation alert */}
              {escalationCount > 0 && (
                <div
                  className="flex items-center gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors"
                  onClick={() => setActiveTab('escalations')}
                >
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold text-sm text-amber-800">
                      {escalationCount} ticket{escalationCount > 1 ? 's' : ''} en attente de reponse humaine
                    </p>
                    <p className="text-xs text-amber-600">
                      L'IA n'a pas pu resoudre ces demandes. Cliquez pour voir et repondre.
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-amber-600 shrink-0" />
                </div>
              )}

              {/* Onboarding Wizard (replaces old checklist) */}
              <OnboardingWizard
                clientId={currentClient?.id}
                clientType={currentClient?.client_type}
                setActiveTab={setActiveTab}
                theme={theme}
                onNavigate={onNavigate}
              />

              {/* Legacy Onboarding Checklist (shown if wizard dismissed) */}
              <OnboardingChecklist
                clientId={currentClient?.id}
                clientType={currentClient?.client_type}
                setActiveTab={setActiveTab}
                theme={theme}
              />

              {/* Agent Improvement Suggestions */}
              <AgentImprovementWidget clientId={currentClient?.id} theme={theme} />

              {/* Auto Diagnostic */}
              <AutoDiagnostic
                clientId={currentClient?.id}
                clientType={currentClient?.client_type}
                theme={theme}
              />

              <MilestoneBadge hoursSaved={periodStats?.time_saved || 0} theme={theme} />

              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                   {[...Array(4)].map((_, i) => <SkeletonRow key={i} height="h-40" className="rounded-2xl" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <MetricCard
                    title="Temps economise"
                    value={`${periodStats?.time_saved || 0}h`}
                    variation={periodStats?.time_saved_var}
                    icon={Clock}
                    color="emerald"
                    theme={theme}
                  />
                  <MetricCard
                    title="ROI Genere"
                    value={`${(periodStats?.roi || 0).toLocaleString()}€`}
                    variation={periodStats?.roi_var}
                    icon={DollarSign}
                    color="amber"
                    theme={theme}
                  />
                  {currentClient?.client_type === 'immobilier' ? (
                    <MetricCard
                      title="Leads qualifies"
                      value={eventCounts.lead_qualified || 0}
                      icon={UserCheck}
                      color="violet"
                      theme={theme}
                    />
                  ) : (
                    <MetricCard
                      title="Tickets resolus"
                      value={eventCounts.ticket_resolved || 0}
                      icon={Ticket}
                      color="emerald"
                      theme={theme}
                    />
                  )}
                  <MetricCard
                    title="Actions IA"
                    value={(periodStats?.tasks_executed || 0).toLocaleString()}
                    icon={TerminalSquare}
                    color="zinc"
                    theme={theme}
                  />
                  {currentClient?.id && (
                    <SatisfactionKPI clientId={currentClient.id} theme={theme} />
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-12">
                <div className="h-[400px]">
                  <ActivityChart theme={theme} supabase={supabase} selectedPeriod={selectedPeriod} />
                </div>
                <div className="h-[400px]">
                  <ROIGlowChart
                    theme={theme}
                    metrics={metrics}
                    growthPct={growthPct}
                    dailyMetrics={dailyMetrics}
                    selectedPeriod={selectedPeriod}
                  />
                </div>
              </div>

              {/* Live Activity Feed Widget */}
              <div className="mt-12">
                <LiveActivityWidget supabase={supabase} setActiveTab={setActiveTab} isLight={isLight} />
              </div>

              {/* Satisfaction Score + SLA Tracking (Features 5 & 6) */}
              {currentClient?.id && (
                <ClientSatisfactionScore clientId={currentClient.id} theme={theme} />
              )}

              <HealthScoreWidget metricsData={dailyMetrics.slice(-7)} eventsData={events} theme={theme} />

              <div className={`mt-12 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between shadow-xl ${isLight ? "bg-[#F9F7F1] text-[#262626]" : "bg-white"}`}>
                <div>
                  <h3 className="text-2xl font-bold mb-2">Un besoin d'aide ?</h3>
                  <p className="opacity-60">Contactez notre support ou soumettez une demande.</p>
                </div>
                <button
                   onClick={() => setActiveTab("support")}
                   className="mt-6 md:mt-0 bg-white text-[#262626] px-6 py-3.5 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-100 transition-all"
                >
                  Support & Demandes <ArrowUpRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {activeTab === "intelligence" && <IntelligenceView supabase={supabase} setActiveTab={setActiveTab} theme={theme} />}

          {activeTab === "activity" && <ActivityView supabase={supabase} theme={theme} />}

          {activeTab === "profile" && <ClientProfileView theme={theme} />}

          {activeTab === "support" && (
            <SupportTicketsView
              supabase={supabase}
              clientId={currentClient?.id}
              theme={theme}
            />
          )}

          {activeTab === "referral" && (
            <ClientReferralView
              clientId={currentClient?.id}
              theme={theme}
            />
          )}

          {activeTab === "systems" && (
            <ClientSystemsView
              clientId={currentClient?.id}
              clientName={currentClient?.brand_name}
              theme={theme}
            />
          )}

          {activeTab === "knowledge" && (
            <ClientKnowledgeBaseView
              clientId={currentClient?.id}
              clientType={currentClient?.client_type}
              theme={theme}
            />
          )}

          {activeTab === "integrations" && (
            <ClientIntegrationsView
              clientId={currentClient?.id}
              clientType={currentClient?.client_type}
              theme={theme}
            />
          )}

          {activeTab === "escalations" && (
            <ClientEscalationsView
              clientId={currentClient?.id}
              theme={theme}
            />
          )}

          {activeTab === "agent-config" && (
            <PromptEditor
              clientId={currentClient?.id}
              theme={theme}
            />
          )}

          {activeTab === "simulator" && (
            <ConversationSimulator
              clientId={currentClient?.id}
              clientType={currentClient?.client_type}
              theme={theme}
            />
          )}

          {activeTab === "team" && (
            <TeamManager clientId={currentClient?.id} />
          )}

          {activeTab === "guardrails" && (
            <GuardrailsEditor
              clientId={currentClient?.id}
              theme={theme}
            />
          )}

          {activeTab === "voice-agent" && (
            <VoiceAgentView clientId={currentClient?.id} theme={theme} />
          )}

          {activeTab === "multi-agent" && (
            <MultiAgentView clientId={currentClient?.id} theme={theme} />
          )}

          {activeTab === "prompt-injection" && (
            <PromptInjectionView clientId={currentClient?.id} theme={theme} />
          )}

          {activeTab === "client-memory" && (
            <ClientMemoryView clientId={currentClient?.id} theme={theme} />
          )}

          {activeTab === "sentiment" && (
            <SentimentAnalysisView clientId={currentClient?.id} theme={theme} />
          )}

          {activeTab === "voice-studio" && (
            <VoiceStudioView clientId={currentClient?.id} theme={theme} />
          )}

          {activeTab === "supplier-negotiation" && (
            <SupplierNegotiationView clientId={currentClient?.id} theme={theme} />
          )}

          {activeTab === "voice-report" && (
            <VoiceReportView clientId={currentClient?.id} theme={theme} />
          )}

          {activeTab === "notifications" && (
            <NotificationCenterView clientId={currentClient?.id} theme={theme} />
          )}

          {activeTab === "channels" && (
            <ChannelsView clientId={currentClient?.id} setActiveTab={setActiveTab} theme={theme} />
          )}

          {activeTab === "workflows" && (
            <WorkflowBuilder clientId={currentClient?.id} theme={theme} />
          )}

        </main>
      </div>

      {/* Copilot Chat Bubble */}
      {currentClient?.id && <ClientCopilotBubble clientId={currentClient.id} clientType={currentClient.client_type} theme={theme} />}
    </div>
  );
};
