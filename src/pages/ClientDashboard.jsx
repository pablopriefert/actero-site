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
  Phone,
  CalendarCheck,
  ShoppingCart,
  Mail,
  Ticket,
  Rocket,
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
import { ActivityView } from '../components/dashboard/ActivityView'
import { UpsellsView } from '../components/dashboard/UpsellsView'
import { CopilotPanel } from '../components/dashboard/CopilotPanel'

export const ClientDashboard = ({ onNavigate, onLogout, currentRoute }) => {
  // eslint-disable-next-line no-unused-vars
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState(() => localStorage.getItem("actero-theme") || "dark");
  const [selectedPeriod, setSelectedPeriod] = useState("this_month");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // eslint-disable-next-line no-unused-vars
  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("actero-theme", newTheme);
  };

  const getTabFromRoute = (route) => {
    if (route === "/client/requests") return "requests";
    if (route === "/client/architect") return "architect";
    if (route === "/client/activity") return "activity";
    if (route === "/client/systems") return "systems";
    if (route === "/client/intelligence") return "intelligence";
    if (route === "/client/reports") return "reports";
    if (route === "/client/upsells") return "upsells";
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
        .select("client_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (link?.client_id) {
        const { data, error } = await supabase
          .from("clients")
          .select("id, brand_name, owner_user_id, created_at, client_type")
          .eq("id", link.client_id)
          .single();
        if (error && error.code !== "PGRST116") throw error;
        return data;
      }

      // Fallback: owner_user_id (legacy / owner accounts)
      const { data, error } = await supabase
        .from("clients")
        .select("id, brand_name, owner_user_id, created_at, client_type")
        .eq("owner_user_id", session.user.id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
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

  // 4. Fetch Requests
  // eslint-disable-next-line no-unused-vars
  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["client-requests", currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .eq("client_id", currentClient.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!supabase && !!currentClient?.id,
  });

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

  const sidebarItems = [
    { type: 'section', label: 'Pilotage' },
    { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
    { id: 'requests', label: 'Requêtes', icon: ClipboardList, badge: requests.length > 0 ? requests.length : null },
    { id: 'architect', label: 'Architecte IA', icon: BrainCircuit },
    { type: 'section', label: 'Infrastructure' },
    { id: 'systems', label: 'Mes Systèmes', icon: Database },
    { id: 'activity', label: 'Activité en direct', icon: Activity },
    { id: 'intelligence', label: 'Intelligence', icon: Lightbulb },
    { id: 'reports', label: 'Rapports', icon: Download },
    { type: 'section', label: 'Croissance' },
    { id: 'upsells', label: 'Opportunités', icon: Rocket },
  ];

  const isLoading = clientLoading || metricsLoading || dailyMetricsLoading;
  const isLight = theme === "light";

  return (
    <div className={`min-h-screen flex flex-col md:flex-row font-sans transition-colors duration-300 ${isLight ? "bg-slate-50 text-slate-900" : "bg-[#030303] text-white"}`}>
      {/* Mobile Header */}
      <div className={`md:hidden h-16 flex items-center justify-between px-4 sticky top-0 z-50 ${isLight ? "bg-white border-b border-slate-200" : "bg-[#0a0a0a] border-b border-white/10"}`}>
        <div className="flex items-center gap-2">
          <Logo className={`w-6 h-6 ${isLight ? "text-blue-600" : "text-white"}`} />
          <span className={`font-bold text-lg ${isLight ? "text-slate-900" : "text-white"}`}>Actero OS</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)}>
          <Menu className={`w-6 h-6 ${isLight ? "text-slate-500" : "text-zinc-600"}`} />
        </button>
      </div>

      {/* Sidebar Desktop */}
      <div className="hidden md:block">
        <Sidebar 
          title="Actero OS"
          items={sidebarItems}
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
              className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              className={`relative w-4/5 max-w-xs h-full shadow-2xl ${isLight ? "bg-white" : "bg-[#0a0a0a]"}`}
            >
              <Sidebar 
                title="Actero OS"
                items={sidebarItems}
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
        <header className={`sticky top-0 z-40 backdrop-blur-md px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b ${isLight ? "bg-white/80 border-slate-200" : "bg-[#0a0a0a]/80 border-white/10"}`}>
          <div className="flex items-center gap-6">
            <h1 className={`text-xl font-bold tracking-tight whitespace-nowrap ${isLight ? "text-slate-900" : "text-white"}`}>
              {activeTab === "overview" && "Vue d'ensemble"}
              {activeTab === "requests" && "Mes demandes"}
              {activeTab === "architect" && "Architecte IA"}
              {activeTab === "activity" && "Activité temps réel"}
              {activeTab === "systems" && "Mes Systèmes"}
              {activeTab === "intelligence" && "Intelligence"}
              {activeTab === "reports" && "Rapports"}
              {activeTab === "upsells" && "Opportunités de croissance"}
            </h1>

            <div className="hidden lg:flex items-center gap-3">
              <HealthScoreIndicator metricsData={dailyMetrics.slice(-7)} eventsData={events} theme={theme} />
              <div className={`h-4 w-px mx-1 ${isLight ? "bg-slate-200" : "bg-white/10"}`}></div>
              <div className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg ${isLight ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"}`}>
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span className={`text-xs font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                  <AnimatedCounter value={metrics?.time_saved_minutes ? Math.round(metrics.time_saved_minutes/60) : 0} />h <span className="font-normal opacity-60">/mois</span>
                </span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg ${isLight ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"}`}>
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span className={`text-xs font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                  <AnimatedCounter value={metrics?.estimated_roi || 0} />€ <span className="font-normal opacity-60">/mois</span>
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("activity")}
            className="text-sm font-bold text-gray-400 hover:text-zinc-300 flex items-center gap-2 transition-colors"
          >
            Voir l'activité <ArrowRight className="w-4 h-4" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === "overview" && (
            <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h2 className={`text-3xl font-bold mb-2 tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
                    Bonjour{currentClient ? ` ${currentClient.brand_name}` : ""}, voici vos performances.
                  </h2>
                  <p className={`font-medium text-lg ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
                    {selectedPeriod === "this_month" ? "Synthèse du mois en cours." : selectedPeriod === "last_month" ? "Détails du mois dernier." : "Rapport des 30 derniers jours."}
                  </p>
                </div>

                <div className={`flex p-1 rounded-xl border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'}`}>
                  {[
                    { id: 'this_month', label: 'Ce mois' },
                    { id: 'last_month', label: 'Mois dernier' },
                    { id: 'last_30_days', label: '30 jours' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPeriod(p.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${selectedPeriod === p.id
                        ? (isLight ? 'bg-white text-blue-600 shadow-sm' : 'bg-white/10 text-white shadow-lg')
                        : (isLight ? 'text-slate-500 hover:text-slate-900' : 'text-zinc-500 hover:text-zinc-300')
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <MilestoneBadge hoursSaved={periodStats?.time_saved || 0} theme={theme} />

              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                   {[...Array(4)].map((_, i) => <SkeletonRow key={i} height="h-40" className="rounded-2xl" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <MetricCard
                    title="Temps économisé"
                    value={`${periodStats?.time_saved || 0}h`}
                    variation={periodStats?.time_saved_var}
                    icon={Clock}
                    color="emerald"
                    theme={theme}
                  />
                  <MetricCard
                    title="ROI Généré"
                    value={`${(periodStats?.roi || 0).toLocaleString()}€`}
                    variation={periodStats?.roi_var}
                    icon={DollarSign}
                    color="amber"
                    theme={theme}
                  />
                  {currentClient?.client_type === 'immobilier' ? (
                    <MetricCard
                      title="Leads qualifiés"
                      value={eventCounts.lead_qualified || 0}
                      icon={UserCheck}
                      color="violet"
                      theme={theme}
                    />
                  ) : (
                    <MetricCard
                      title="Tickets résolus"
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

              <HealthScoreWidget metricsData={dailyMetrics.slice(-7)} eventsData={events} theme={theme} />

              {/* Actero Copilot */}
              <CopilotPanel
                client={currentClient}
                theme={theme}
                onNavigateToUpsells={() => setActiveTab("upsells")}
              />
            </div>
          )}

          {activeTab === "upsells" && (
            <div className="max-w-5xl mx-auto animate-fade-in-up">
              <UpsellsView client={currentClient} metrics={metrics} supabase={supabase} theme={theme} />
            </div>
          )}

          {activeTab === "intelligence" && <IntelligenceView supabase={supabase} setActiveTab={setActiveTab} theme={theme} />}

          {activeTab === "activity" && <ActivityView supabase={supabase} theme={theme} />}

          {activeTab === "architect" && (
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
              <div>
                <h2 className={`text-3xl font-bold mb-2 tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
                  Architecte IA
                </h2>
                <p className={`font-medium text-lg ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
                  Concevez et planifiez de nouvelles automatisations avec l'intelligence artificielle.
                </p>
              </div>

              <div className={`p-8 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0a0a0a] border-white/10"}`}>
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isLight ? "bg-violet-50 border border-violet-200" : "bg-violet-500/10 border border-violet-500/20"}`}>
                    <BrainCircuit className={`w-6 h-6 ${isLight ? "text-violet-600" : "text-violet-400"}`} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${isLight ? "text-slate-900" : "text-white"}`}>Nouveau projet d'automatisation</h3>
                    <p className={`text-sm ${isLight ? "text-slate-500" : "text-zinc-500"}`}>Décrivez votre besoin, l'IA propose une architecture</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-bold mb-2 ${isLight ? "text-slate-700" : "text-zinc-300"}`}>
                      Quel process souhaitez-vous automatiser ?
                    </label>
                    <textarea
                      placeholder="Ex: Je voudrais automatiser la relance des paniers abandonnés avec un email personnalisé 2h après..."
                      rows={4}
                      className={`w-full px-4 py-3 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
                        isLight
                          ? "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                          : "bg-white/5 border-white/10 text-white placeholder-zinc-600"
                      }`}
                    />
                  </div>
                  <button className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all">
                    <Sparkles className="w-4 h-4" />
                    Analyser avec l'IA
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { title: "Relance paniers abandonnés", desc: "Email automatique 2h après abandon", status: "Suggestion IA" },
                  { title: "Chatbot SAV intelligent", desc: "Réponses automatiques aux questions fréquentes", status: "Suggestion IA" },
                  { title: "Reporting hebdomadaire", desc: "Rapport de performance envoyé chaque lundi", status: "Suggestion IA" },
                ].map((suggestion, i) => (
                  <div key={i} className={`p-5 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] ${
                    isLight
                      ? "bg-white border-slate-200 hover:border-violet-300 hover:shadow-md"
                      : "bg-white/[0.02] border-white/[0.06] hover:border-violet-500/30 hover:shadow-lg"
                  }`}>
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase mb-3 ${
                      isLight ? "bg-violet-50 text-violet-600" : "bg-violet-500/10 text-violet-400"
                    }`}>
                      {suggestion.status}
                    </span>
                    <h4 className={`text-sm font-bold mb-1 ${isLight ? "text-slate-900" : "text-white"}`}>{suggestion.title}</h4>
                    <p className={`text-xs ${isLight ? "text-slate-500" : "text-zinc-500"}`}>{suggestion.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "systems" && (
            <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
              <div>
                <h2 className={`text-3xl font-bold mb-2 tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
                  Mes Systèmes
                </h2>
                <p className={`font-medium text-lg ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
                  Vos automatisations actives et leur état en temps réel.
                </p>
              </div>

              <div className={`p-8 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0a0a0a] border-white/10"}`}>
                <h3 className={`text-lg font-bold mb-6 ${isLight ? "text-slate-900" : "text-white"}`}>Automatisations actives</h3>
                <div className="space-y-4">
                  {[
                    { name: "Agent SAV e-commerce", type: "Agent IA", status: "active" },
                    { name: "Qualification des leads entrants", type: "Qualification IA", status: "active" },
                    { name: "Réponse automatique emails", type: "Email IA", status: "active" },
                    { name: "Synchronisation CRM", type: "Intégration", status: "active" },
                    { name: "Alertes stock faible", type: "Monitoring", status: "active" },
                  ].map((auto, i) => (
                    <div key={i} className={`flex items-center justify-between p-4 rounded-xl border ${
                      isLight ? "bg-slate-50 border-slate-200" : "bg-white/[0.02] border-white/[0.06]"
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <div>
                          <p className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{auto.name}</p>
                          <p className={`text-xs ${isLight ? "text-slate-500" : "text-zinc-500"}`}>{auto.type}</p>
                        </div>
                      </div>
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase">
                        Actif
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "reports" && (
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
              <div>
                <h2 className={`text-3xl font-bold mb-2 tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
                  Rapports
                </h2>
                <p className={`font-medium text-lg ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
                  Rapports automatisés et historique de performance.
                </p>
              </div>

              <div className={`p-8 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0a0a0a] border-white/10"}`}>
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isLight ? "bg-blue-50 border border-blue-200" : "bg-blue-500/10 border border-blue-500/20"}`}>
                    <Download className={`w-6 h-6 ${isLight ? "text-blue-600" : "text-blue-400"}`} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${isLight ? "text-slate-900" : "text-white"}`}>Rapports mensuels</h3>
                    <p className={`text-sm ${isLight ? "text-slate-500" : "text-zinc-500"}`}>Téléchargez vos rapports de performance</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { month: "Mars 2026", status: "En cours", downloadable: false },
                    { month: "Février 2026", status: "Disponible", downloadable: true },
                    { month: "Janvier 2026", status: "Disponible", downloadable: true },
                  ].map((report, i) => (
                    <div key={i} className={`flex items-center justify-between p-4 rounded-xl border ${
                      isLight ? "bg-slate-50 border-slate-200" : "bg-white/[0.02] border-white/[0.06]"
                    }`}>
                      <div className="flex items-center gap-4">
                        <FileText className={`w-5 h-5 ${isLight ? "text-slate-400" : "text-zinc-500"}`} />
                        <div>
                          <p className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>Rapport {report.month}</p>
                          <p className={`text-xs ${isLight ? "text-slate-500" : "text-zinc-500"}`}>Performance & métriques IA</p>
                        </div>
                      </div>
                      {report.downloadable ? (
                        <button className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                          isLight
                            ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                            : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                        }`}>
                          <Download className="w-3.5 h-3.5" />
                          Télécharger
                        </button>
                      ) : (
                        <span className={`text-xs font-bold ${isLight ? "text-amber-600" : "text-amber-400"}`}>
                          {report.status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "requests" && (
            <div className="max-w-4xl mx-auto space-y-6">
               {requests.length === 0 ? (
                 <div className="text-center py-20">
                   <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                   <h3 className="text-xl font-bold">Aucune demande</h3>
                   <button onClick={() => setActiveTab("architect")} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-xl">Nouveau projet</button>
                 </div>
               ) : (
                 requests.map(req => (
                    <div key={req.id} className={`p-8 rounded-3xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0a0a0a] border-white/10"}`}>
                       <div className="flex justify-between mb-4">
                          <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase">{req.status || "En attente"}</span>
                          <span className="opacity-40 text-xs">{new Date(req.created_at).toLocaleDateString()}</span>
                       </div>
                       <h3 className="text-2xl font-bold mb-2">{req.title}</h3>
                       <p className="opacity-60 mb-6">{req.description}</p>
                       <div className="flex gap-2">
                          {req.stack && <span className="bg-white/5 border border-white/10 px-3 py-1 rounded-lg text-xs">{req.stack}</span>}
                       </div>
                    </div>
                 ))
               )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
