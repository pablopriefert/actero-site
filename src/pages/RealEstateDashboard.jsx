import React, { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Activity,
  Lightbulb,
  Download,
  Moon,
  Sun,
  Clock,
  DollarSign,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  Menu,
  Home,
  Users,
  Phone,
  CalendarCheck,
  FileText,
  TrendingUp,
  Building2,
  MapPin,
  UserCheck,
  Timer,
  BarChart3,
  Eye,
  MessageSquare,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/layout/Logo'
import { Sidebar } from '../components/layout/Sidebar'
import { MetricCard } from '../components/dashboard/MetricCard'
import { HealthScoreIndicator, HealthScoreWidget } from '../components/dashboard/HealthScore'
import { MilestoneBadge } from '../components/dashboard/MilestoneBadge'
import { AnimatedCounter } from '../components/ui/animated-counter'
import { SkeletonRow } from '../components/ui/skeleton-row'
import { IntelligenceView } from '../components/dashboard/IntelligenceView'
import { ActivityView } from '../components/dashboard/ActivityView'
import { CopilotChat } from '../components/dashboard/CopilotChat'
import { ROICalculator } from '../components/dashboard/ROICalculator'
import { AlertsOverview } from '../components/dashboard/AlertsPanel'
import { ReportsView } from '../components/dashboard/ReportsView'
import { ActionLogsView } from '../components/dashboard/ActionLogsView'
import { ObjectivesWidget } from '../components/dashboard/ObjectivesWidget'
import { BenchmarksWidget } from '../components/dashboard/BenchmarksWidget'
import { SupportTicketsView } from '../components/dashboard/SupportTicketsView'

export const RealEstateDashboard = ({ onNavigate, onLogout, currentRoute }) => {
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState(() => localStorage.getItem("actero-theme") || "dark");
  const [selectedPeriod, setSelectedPeriod] = useState("this_month");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getTabFromRoute = (route) => {
    if (route === "/client/leads") return "leads";
    if (route === "/client/mandats") return "mandats";
    if (route === "/client/activity") return "activity";
    if (route === "/client/intelligence") return "intelligence";
    if (route === "/client/reports") return "reports";
    if (route === "/client/support") return "support";
    if (route === "/client/copilot") return "copilot";
    return "overview";
  };

  const activeTab = getTabFromRoute(currentRoute);

  const setActiveTab = (tab) => {
    const route = tab === "overview" ? "/client" : `/client/${tab}`;
    onNavigate(route);
  };

  // 1. Fetch Client Profile
  const { data: currentClient, isLoading: clientLoading } = useQuery({
    queryKey: ["client-profile"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");

      const { data: link } = await supabase
        .from("client_users")
        .select("client_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (link?.client_id) {
        const { data, error } = await supabase
          .from("clients")
          .select("id, brand_name, owner_user_id, created_at")
          .eq("id", link.client_id)
          .single();
        if (error && error.code !== "PGRST116") throw error;
        return data;
      }

      const { data, error } = await supabase
        .from("clients")
        .select("id, brand_name, owner_user_id, created_at")
        .eq("owner_user_id", session.user.id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!supabase,
  });

  // 2. Fetch Metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["client-metrics", currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("recompute_client_metrics", { p_client_id: currentClient.id });
      if (error) throw error;
      return data;
    },
    enabled: !!supabase && !!currentClient?.id,
  });

  // 3. Fetch Daily Metrics
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

  // 4. Fetch Events
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

  // 5. Fetch Client Settings (for ROI Calculator)
  const { data: clientSettings } = useQuery({
    queryKey: ["client-settings", currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_settings")
        .select("*")
        .eq("client_id", currentClient.id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data || { actero_monthly_price: 500, hourly_cost: 25 };
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
        leads_qualified: 0,
        leads_qualified_var: 0,
        tasks_executed: 0,
        tasks_executed_var: 0,
      };
    }

    const now = new Date();
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
    const getLast = (arr, field) => arr.length > 0 ? Number(arr[arr.length - 1][field]) || 0 : 0;

    const computeVar = (currentVal, prevVal) => {
      if (!prevVal || prevVal === 0) return currentVal > 0 ? 100 : 0;
      return Math.round(((currentVal - prevVal) / prevVal) * 100);
    };

    return {
      time_saved: Math.round(calcSum(currentPeriodArr, 'time_saved_minutes') / 60),
      time_saved_var: computeVar(calcSum(currentPeriodArr, 'time_saved_minutes'), calcSum(comparisonPeriodArr, 'time_saved_minutes')),
      roi: Math.round(calcSum(currentPeriodArr, 'estimated_roi')),
      roi_var: computeVar(calcSum(currentPeriodArr, 'estimated_roi'), calcSum(comparisonPeriodArr, 'estimated_roi')),
      leads_qualified: calcSum(currentPeriodArr, 'tasks_executed'),
      leads_qualified_var: computeVar(calcSum(currentPeriodArr, 'tasks_executed'), calcSum(comparisonPeriodArr, 'tasks_executed')),
      tasks_executed: calcSum(currentPeriodArr, 'tasks_executed'),
      tasks_executed_var: computeVar(calcSum(currentPeriodArr, 'tasks_executed'), calcSum(comparisonPeriodArr, 'tasks_executed')),
    };
  }, [dailyMetrics, selectedPeriod]);

  const sidebarItems = [
    { type: 'section', label: 'Pilotage Agence' },
    { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
    { id: 'leads', label: 'Leads & Prospects', icon: UserCheck },
    { id: 'mandats', label: 'Mandats', icon: Building2 },
    { type: 'section', label: 'Infrastructure' },
    { id: 'activity', label: 'Activité en direct', icon: Activity },
    { id: 'intelligence', label: 'Intelligence', icon: Lightbulb },
    { id: 'reports', label: 'Rapports', icon: Download },
    { id: 'support', label: 'Support & Demandes', icon: MessageSquare },
    { type: 'section', label: 'Intelligence' },
    { id: 'copilot', label: 'Actero Copilot', icon: Sparkles },
  ];

  const isLoading = clientLoading || metricsLoading || dailyMetricsLoading;
  const isLight = theme === "light";

  return (
    <div className={`min-h-screen flex flex-col md:flex-row font-sans transition-colors duration-300 ${isLight ? "bg-slate-50 text-slate-900" : "bg-[#030303] text-white"}`}>
      {/* Mobile Header */}
      <div className={`md:hidden h-16 flex items-center justify-between px-4 sticky top-0 z-50 ${isLight ? "bg-white border-b border-slate-200" : "bg-[#0a0a0a] border-b border-white/10"}`}>
        <div className="flex items-center gap-2">
          <Logo className={`w-6 h-6 ${isLight ? "text-blue-600" : "text-white"}`} />
          <span className={`font-bold text-lg ${isLight ? "text-slate-900" : "text-white"}`}>Actero Immo</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)}>
          <Menu className={`w-6 h-6 ${isLight ? "text-slate-500" : "text-zinc-600"}`} />
        </button>
      </div>

      {/* Sidebar Desktop */}
      <div className="hidden md:block">
        <Sidebar
          title="Actero Immo"
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
                title="Actero Immo"
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
              {activeTab === "overview" && "Vue d'ensemble — Immobilier"}
              {activeTab === "leads" && "Leads & Prospects"}
              {activeTab === "mandats" && "Gestion des Mandats"}
              {activeTab === "activity" && "Activité temps réel"}
              {activeTab === "intelligence" && "Intelligence"}
              {activeTab === "reports" && "Rapports"}
              {activeTab === "support" && "Support & Demandes"}
              {activeTab === "copilot" && "Actero Copilot"}
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
                  <div className="flex items-center gap-3 mb-3">
                    <div className="px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full text-xs font-bold uppercase tracking-widest text-violet-400">
                      🏠 Immobilier
                    </div>
                  </div>
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
                  <MetricCard
                    title="Leads qualifiés"
                    value={(periodStats?.leads_qualified || 0).toLocaleString()}
                    variation={periodStats?.leads_qualified_var}
                    icon={UserCheck}
                    color="emerald"
                    theme={theme}
                  />
                  <MetricCard
                    title="Actions IA"
                    value={(periodStats?.tasks_executed || 0).toLocaleString()}
                    icon={Activity}
                    color="zinc"
                    theme={theme}
                  />
                </div>
              )}

              {/* Real Estate Specific Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`p-6 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0a0a0a] border-white/10"}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                      <Phone className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-widest ${isLight ? "text-slate-500" : "text-gray-500"}`}>Demandes traitées</p>
                      <p className={`text-2xl font-bold font-mono tracking-tighter ${isLight ? "text-slate-900" : "text-white"}`}>
                        <AnimatedCounter value={periodStats?.tasks_executed || 0} />
                      </p>
                    </div>
                  </div>
                  <p className={`text-xs ${isLight ? "text-slate-500" : "text-gray-600"}`}>
                    Demandes de visite, infos biens, relances acquéreurs traitées par l'IA
                  </p>
                </div>

                <div className={`p-6 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0a0a0a] border-white/10"}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                      <Timer className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-widest ${isLight ? "text-slate-500" : "text-gray-500"}`}>Temps de réponse</p>
                      <p className={`text-2xl font-bold font-mono tracking-tighter ${isLight ? "text-slate-900" : "text-white"}`}>
                        {"< 2 min"}
                      </p>
                    </div>
                  </div>
                  <p className={`text-xs ${isLight ? "text-slate-500" : "text-gray-600"}`}>
                    Temps de réponse moyen aux demandes entrantes (vs 4h en moyenne secteur)
                  </p>
                </div>

                <div className={`p-6 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0a0a0a] border-white/10"}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                      <CalendarCheck className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-widest ${isLight ? "text-slate-500" : "text-gray-500"}`}>Visites planifiées</p>
                      <p className={`text-2xl font-bold font-mono tracking-tighter ${isLight ? "text-slate-900" : "text-white"}`}>
                        <AnimatedCounter value={Math.round((periodStats?.tasks_executed || 0) * 0.3)} />
                      </p>
                    </div>
                  </div>
                  <p className={`text-xs ${isLight ? "text-slate-500" : "text-gray-600"}`}>
                    Visites automatiquement programmées suite aux qualifications IA
                  </p>
                </div>
              </div>

              <HealthScoreWidget metricsData={dailyMetrics.slice(-7)} eventsData={events} theme={theme} />

              <AlertsOverview
                periodStats={periodStats}
                metrics={metrics}
                events={events}
                clientType="immobilier"
                theme={theme}
              />

              <ROICalculator
                periodStats={periodStats}
                metrics={metrics}
                clientSettings={clientSettings}
                theme={theme}
              />

              <ObjectivesWidget
                periodStats={periodStats}
                eventCounts={{}}
                clientType="immobilier"
                theme={theme}
              />

              <BenchmarksWidget
                clientType="immobilier"
                theme={theme}
              />
            </div>
          )}

          {activeTab === "copilot" && (
            <CopilotChat
              client={{ ...currentClient, client_type: 'immobilier' }}
              metrics={metrics}
              periodStats={periodStats}
              theme={theme}
            />
          )}

          {activeTab === "intelligence" && <IntelligenceView supabase={supabase} setActiveTab={setActiveTab} theme={theme} />}

          {activeTab === "activity" && <ActionLogsView supabase={supabase} clientId={currentClient?.id} theme={theme} />}

          {activeTab === "leads" && (
            <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
              <div>
                <h2 className={`text-3xl font-bold mb-2 tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
                  Leads & Prospects
                </h2>
                <p className={`font-medium ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
                  Tous les prospects qualifiés automatiquement par l'IA.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: "Leads entrants", value: periodStats?.tasks_executed || 0, icon: Users, color: "violet" },
                  { label: "Qualifiés par IA", value: Math.round((periodStats?.tasks_executed || 0) * 0.7), icon: UserCheck, color: "emerald" },
                  { label: "Taux de conversion", value: "18%", icon: TrendingUp, color: "amber" },
                ].map((stat, i) => (
                  <div key={i} className={`p-6 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0a0a0a] border-white/10"}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl bg-${stat.color}-500/10 border border-${stat.color}-500/20 flex items-center justify-center`}>
                        <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
                      </div>
                      <p className={`text-xs font-bold uppercase tracking-widest ${isLight ? "text-slate-500" : "text-gray-500"}`}>{stat.label}</p>
                    </div>
                    <p className={`text-3xl font-bold font-mono tracking-tighter ${isLight ? "text-slate-900" : "text-white"}`}>
                      {typeof stat.value === 'number' ? <AnimatedCounter value={stat.value} /> : stat.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className={`p-8 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0a0a0a] border-white/10"}`}>
                <h3 className={`text-lg font-bold mb-4 ${isLight ? "text-slate-900" : "text-white"}`}>Pipeline de qualification</h3>
                <div className="space-y-4">
                  {[
                    { stage: "Nouveau contact", count: Math.round((periodStats?.tasks_executed || 0) * 1), color: "bg-violet-500" },
                    { stage: "Qualifié par IA", count: Math.round((periodStats?.tasks_executed || 0) * 0.7), color: "bg-cyan-500" },
                    { stage: "Visite programmée", count: Math.round((periodStats?.tasks_executed || 0) * 0.3), color: "bg-amber-500" },
                    { stage: "Offre en cours", count: Math.round((periodStats?.tasks_executed || 0) * 0.15), color: "bg-emerald-500" },
                  ].map((stage, i) => {
                    const maxCount = periodStats?.tasks_executed || 1;
                    const width = Math.max(5, (stage.count / maxCount) * 100);
                    return (
                      <div key={i} className="flex items-center gap-4">
                        <span className={`text-sm font-medium w-40 shrink-0 ${isLight ? "text-slate-700" : "text-gray-300"}`}>{stage.stage}</span>
                        <div className={`flex-1 h-8 rounded-lg overflow-hidden ${isLight ? "bg-slate-100" : "bg-white/5"}`}>
                          <div className={`h-full ${stage.color} rounded-lg flex items-center justify-end pr-3 transition-all duration-700`} style={{ width: `${width}%` }}>
                            <span className="text-xs font-bold text-white">{stage.count}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "mandats" && (
            <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
              <div>
                <h2 className={`text-3xl font-bold mb-2 tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
                  Gestion des Mandats
                </h2>
                <p className={`font-medium ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
                  Suivi de vos mandats et automatisations associées.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: "Mandats actifs", value: 12, icon: Building2, color: "violet" },
                  { label: "Visites ce mois", value: Math.round((periodStats?.tasks_executed || 0) * 0.3), icon: Eye, color: "cyan" },
                  { label: "Compromis signés", value: 3, icon: FileText, color: "emerald" },
                  { label: "CA en pipeline", value: "42K€", icon: BarChart3, color: "amber" },
                ].map((stat, i) => (
                  <div key={i} className={`p-5 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0a0a0a] border-white/10"}`}>
                    <stat.icon className={`w-5 h-5 text-${stat.color}-400 mb-3`} />
                    <p className={`text-2xl font-bold font-mono tracking-tighter ${isLight ? "text-slate-900" : "text-white"}`}>
                      {typeof stat.value === 'number' ? <AnimatedCounter value={stat.value} /> : stat.value}
                    </p>
                    <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${isLight ? "text-slate-500" : "text-gray-500"}`}>{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className={`p-8 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0a0a0a] border-white/10"}`}>
                <h3 className={`text-lg font-bold mb-6 ${isLight ? "text-slate-900" : "text-white"}`}>Automatisations actives</h3>
                <div className="space-y-4">
                  {[
                    { name: "Qualification leads SeLoger/LeBonCoin", status: "active", type: "Qualification IA" },
                    { name: "Relance acquéreurs post-visite", status: "active", type: "Email IA" },
                    { name: "Réponse automatique demandes de visite", status: "active", type: "Agent IA" },
                    { name: "Suivi mandats vendeurs (reporting hebdo)", status: "active", type: "Reporting IA" },
                    { name: "Matching acquéreur ↔ bien", status: "active", type: "Matching IA" },
                  ].map((auto, i) => (
                    <div key={i} className={`flex items-center justify-between p-4 rounded-xl border ${isLight ? "bg-slate-50 border-slate-200" : "bg-white/[0.02] border-white/[0.06]"}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <div>
                          <p className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{auto.name}</p>
                          <p className={`text-xs ${isLight ? "text-slate-500" : "text-gray-500"}`}>{auto.type}</p>
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
            <ReportsView
              client={{ ...currentClient, client_type: 'immobilier' }}
              metrics={metrics}
              periodStats={periodStats}
              dailyMetrics={dailyMetrics}
              events={events}
              supabase={supabase}
              theme={theme}
            />
          )}

          {activeTab === "support" && (
            <SupportTicketsView
              supabase={supabase}
              clientId={currentClient?.id}
              theme={theme}
            />
          )}
        </main>
      </div>
    </div>
  );
};
