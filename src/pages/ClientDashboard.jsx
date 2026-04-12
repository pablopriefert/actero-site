import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  FileText,
  Sparkles,
  Menu,
  MessageSquare,
  MessageCircle,
  Plug,
  AlertTriangle,
  Store,
  Bot,
  TrendingUp,
  BarChart3,
  Clock,
  Settings,
  CreditCard,
  User,
  Bell,
  Inbox,
  Zap,
  ArrowRight,
  ShoppingBag,
  Trophy,
  Phone,
  PhoneCall,
  Lock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/layout/Logo'
import { Sidebar } from '../components/layout/Sidebar'
import { ActivityChart } from '../components/dashboard/ActivityChart'
import { ActivityView, useLiveActivityFeed, formatEvent, formatRelativeTime } from '../components/dashboard/ActivityView'
import { ClientProfileView } from '../components/client/ClientProfileView'
import { ClientCopilotBubble } from '../components/client/ClientCopilotBubble'
import { OnboardingConcierge } from '../components/client/OnboardingConcierge'
import { ClientReferralView } from '../components/client/ClientReferralView'
import { PartnerDashboardView } from '../components/client/PartnerDashboardView'
import { ClientKnowledgeBaseView } from '../components/client/ClientKnowledgeBaseView'
import { ClientIntegrationsView } from '../components/client/ClientIntegrationsView'
import { GuardrailsEditor } from '../components/client/GuardrailsEditor'
import { PromptEditor } from '../components/client/PromptEditor'
import { ConversationSimulator } from '../components/client/ConversationSimulator'
import { TeamManager, canAccessTab } from '../components/client/TeamManager'
import { ClientEscalationsView } from '../components/client/ClientEscalationsView'
import { ResponseTemplatesView } from '../components/client/ResponseTemplatesView'
import { VoiceCallsView } from '../components/client/VoiceCallsView'
import { VoiceAgentSetupView } from '../components/client/VoiceAgentSetupView'
import { WhatsAppAgentSetupView } from '../components/client/WhatsAppAgentSetupView'
import { NotificationCenterView } from '../components/client/NotificationCenterView'
import { AgentImprovementWidget } from '../components/client/AgentImprovementWidget'
import { PlaybooksView } from '../components/client/PlaybooksView'
import { ClientBillingView } from '../components/client/ClientBillingView'
import { HelpCenterView } from '../components/client/HelpCenterView'
import { ROISettingsView } from '../components/client/ROISettingsView'
import { WeeklySummary } from '../components/client/WeeklySummary'
import { PeakHoursChart } from '../components/client/PeakHoursChart'
import { SetupChecklist } from '../components/client/SetupChecklist'
import { MyMarketplaceTemplatesView } from '../components/client/MyMarketplaceTemplatesView'
import { AchievementsView, AchievementsBanner, AchievementsToast } from '../components/client/AchievementsView'
import ProductTour from '../components/client/ProductTour'
import { IndustryPicker } from '../components/client/IndustryPicker'
import { usePlan } from '../hooks/usePlan'
import { PlanGate } from '../components/ui/PlanGate'
import { UpgradeBanner } from '../components/ui/UpgradeBanner'

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
            <h3 className="font-bold text-[#1a1a1a] text-sm">Activite recente</h3>
          </div>
          <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-widest px-2 py-0.5 bg-[#F9F7F1] rounded-full">
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
          <div className="px-5 py-10 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-xl bg-[#fafafa] flex items-center justify-center mb-3">
              <Inbox className="w-5 h-5 text-[#9ca3af]" />
            </div>
            <p className="text-[13px] font-medium text-[#1a1a1a]">Aucune activité aujourd'hui</p>
            <p className="text-[11px] text-[#9ca3af] mt-0.5">C'est calme — votre agent veille en arrière-plan.</p>
          </div>
        ) : (
          recent.map((event, i) => {
            const formatted = formatEvent(event);
            const Icon = formatted.IconComponent;
            return (
              <div key={event.id || i} className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafafa] transition-colors">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${formatted.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${formatted.color}`} />
                </div>
                <p className="text-[13px] text-[#1a1a1a] flex-1 truncate">{formatted.message}</p>
                <FeedbackButtons eventId={event.id} currentFeedback={event.feedback} supabase={supabase} />
                <span className="text-[10px] text-[#999] flex-shrink-0 whitespace-nowrap">
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
  const [theme] = useState(() => localStorage.getItem("actero-theme") || "light");
  const [selectedPeriod, setSelectedPeriod] = useState("this_month");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const queryClient = useQueryClient();

  const getTabFromRoute = (route) => {
    if (route === "/client/activity") return "activity";
    if (route === "/client/knowledge") return "knowledge";
    if (route === "/client/support") return "support";
    if (route === "/client/referral") return "referral";
    if (route === "/client/partner") return "partner";
    if (route === "/client/integrations") return "integrations";
    if (route === "/client/team") return "team";
    if (route === "/client/agent-config") return "agent-config";
    if (route === "/client/simulator") return "simulator";
    if (route === "/client/guardrails") return "guardrails";
    if (route === "/client/escalations") return "escalations";
    if (route === "/client/response-templates") return "response-templates";
    if (route === "/client/voice-calls") return "voice-calls";
    if (route === "/client/voice-agent") return "voice-agent";
    if (route === "/client/whatsapp-agent") return "whatsapp-agent";
    if (route === "/client/notifications") return "notifications";
    if (route === "/client/billing") return "billing";
    if (route === "/client/roi") return "roi";
    if (route === "/client/playbooks") return "playbooks";
    if (route === "/client/profile") return "profile";
    if (route === "/client/marketplace") return "marketplace";
    if (route === "/client/weekly-summary") return "weekly-summary";
    if (route === "/client/peak-hours") return "peak-hours";
    if (route === "/client/achievements") return "achievements";
    if (route === "/client/account") return "profile";
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

  // Plan gating
  const { planId, planName, config: planConfig, inTrial, trialDaysLeft, ticketsUsed, ticketsLimit, ticketsPercent, isOverLimit, canAccess: can } = usePlan(currentClient?.id)

  // 1b. Fetch product tour completion flag
  const { data: tourCompleted } = useQuery({
    queryKey: ["client-product-tour", currentClient?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_settings')
        .select('product_tour_completed')
        .eq('client_id', currentClient.id)
        .maybeSingle();
      return !!data?.product_tour_completed;
    },
    enabled: !!supabase && !!currentClient?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Auto-open tour at first login (1.5s after dashboard is ready)
  useEffect(() => {
    if (!currentClient?.id) return;
    if (tourCompleted === undefined) return;
    if (tourCompleted) return;
    const t = setTimeout(() => setShowTour(true), 1500);
    return () => clearTimeout(t);
  }, [currentClient?.id, tourCompleted]);

  // Allow any child component to restart the product tour via a custom event
  useEffect(() => {
    const onRestart = () => setShowTour(true);
    window.addEventListener('actero:restart-tour', onRestart);
    return () => window.removeEventListener('actero:restart-tour', onRestart);
  }, []);

  const handleCloseTour = async () => {
    setShowTour(false);
    try {
      if (!currentClient?.id) return;
      await supabase
        .from('client_settings')
        .upsert(
          { client_id: currentClient.id, product_tour_completed: true },
          { onConflict: 'client_id' }
        );
      queryClient.setQueryData(["client-product-tour", currentClient.id], true);
    } catch (_) {
      /* noop */
    }
  };

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

  // 5b-bis. Industry preset applied (null = never chosen, 'skipped' = user passed, or preset id)
  const { data: industryPresetApplied, refetch: refetchIndustryPreset } = useQuery({
    queryKey: ['industry-preset-applied', currentClient?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_settings')
        .select('industry_preset_applied')
        .eq('client_id', currentClient.id)
        .maybeSingle();
      return data?.industry_preset_applied ?? null;
    },
    enabled: !!currentClient?.id,
    refetchOnWindowFocus: false,
  });
  const [industryPickerDismissed, setIndustryPickerDismissed] = useState(false);

  // 5c. Setup completion — shared cache with SetupChecklist (same queryKey)
  const { data: setupCompletion } = useQuery({
    queryKey: ['setup-checklist', currentClient?.id],
    queryFn: async () => {
      const clientId = currentClient.id;
      const { data: shopify } = await supabase
        .from('client_shopify_connections')
        .select('id')
        .eq('client_id', clientId)
        .maybeSingle();
      const { data: smtp } = await supabase
        .from('client_integrations')
        .select('id')
        .eq('client_id', clientId)
        .eq('provider', 'smtp_imap')
        .eq('status', 'active')
        .maybeSingle();
      const { data: settings } = await supabase
        .from('client_settings')
        .select('brand_tone, hourly_cost')
        .eq('client_id', clientId)
        .maybeSingle();
      const { count: runsCount } = await supabase
        .from('engine_runs_v2')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId);
      const { data: playbook } = await supabase
        .from('engine_client_playbooks')
        .select('id, is_active, engine_playbooks!inner(name)')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .eq('engine_playbooks.name', 'sav_ecommerce')
        .maybeSingle();
      const { count: conversationsCount } = await supabase
        .from('ai_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId);
      return {
        shopify: !!shopify,
        email: !!smtp,
        tone: !!(settings?.brand_tone && settings.brand_tone.trim().length > 0),
        roi: !!(settings?.hourly_cost && Number(settings.hourly_cost) > 0),
        tested: (runsCount || 0) > 0,
        playbook: !!playbook,
        conversation: (conversationsCount || 0) > 0,
      };
    },
    enabled: !!currentClient?.id,
    refetchOnWindowFocus: false,
  });

  const completedSetupSteps = setupCompletion
    ? Object.values(setupCompletion).filter(Boolean).length
    : 0;
  // Setup mode while fewer than 5 steps complete.
  // During first load (setupCompletion undefined) we assume setup mode for brand-new clients (<3 days old).
  const isSetupMode = setupCompletion
    ? completedSetupSteps < 5
    : !!(currentClient?.created_at && (Date.now() - new Date(currentClient.created_at).getTime()) < 3 * 24 * 60 * 60 * 1000);

  // First name for welcome hero (from auth metadata, fallback to brand_name)
  const { data: userFirstName } = useQuery({
    queryKey: ['user-first-name'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const meta = session?.user?.user_metadata || {};
      const full = meta.full_name || meta.name || '';
      const first = meta.first_name || (full ? full.split(' ')[0] : '');
      return first || '';
    },
    enabled: !!supabase,
    staleTime: 5 * 60 * 1000,
  });

  // 5b. Fetch client settings + raw events for live ROI computation (single source of truth)
  const { data: liveRoi } = useQuery({
    queryKey: ["client-live-roi", currentClient?.id, selectedPeriod],
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

      const [{ data: settings }, { data: events }] = await Promise.all([
        supabase
          .from('client_settings')
          .select('hourly_cost, actero_monthly_price')
          .eq('client_id', currentClient.id)
          .maybeSingle(),
        supabase
          .from('automation_events')
          .select('time_saved_seconds')
          .eq('client_id', currentClient.id)
          .eq('event_category', 'ticket_resolved')
          .gte('created_at', start.toISOString()),
      ]);

      const hourlyCost = parseFloat(settings?.hourly_cost) || 25;
      const monthlyPrice = parseFloat(settings?.actero_monthly_price) || 0;
      const totalTimeSavedSec = (events || []).reduce((s, e) => s + (e.time_saved_seconds || 0), 0);
      const totalTimeSavedHours = totalTimeSavedSec / 3600;
      const valueSaved = totalTimeSavedHours * hourlyCost;
      const roiNet = valueSaved - monthlyPrice;

      return {
        hours_saved: totalTimeSavedHours,
        value_saved: valueSaved,
        roi_net: roiNet,
        hourly_cost: hourlyCost,
        monthly_price: monthlyPrice,
      };
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

  // Count pending escalations for badge (total + urgent >2h)
  const { data: pendingEscalations = [] } = useQuery({
    queryKey: ['pending-escalation-count', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('id, created_at')
        .eq('client_id', currentClient.id)
        .eq('status', 'escalated')
        .is('human_response', null)
      if (error) return []
      return data || []
    },
    enabled: !!currentClient?.id,
    refetchInterval: 60 * 1000, // refresh urgency every minute
  })

  const urgentEscalationCount = useMemo(() => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000 // >2h
    return pendingEscalations.filter(e => {
      if (!e.created_at) return false
      return new Date(e.created_at).getTime() < cutoff
    }).length
  }, [pendingEscalations]);

  const sidebarItems = [
    { type: 'section', label: 'Accueil' },
    { id: 'overview', label: 'Tableau de bord', icon: LayoutDashboard, dataTour: 'overview-tab' },

    { type: 'section', label: 'Quotidien' },
    {
      id: 'escalations',
      label: 'A traiter',
      icon: Inbox,
      badge: urgentEscalationCount > 0 ? urgentEscalationCount : null,
      badgeColor: 'bg-red-100 text-red-600',
    },
    { id: 'response-templates', label: 'Modeles de reponse', icon: FileText },

    {
      type: 'expandable',
      label: 'Mon Agent',
      icon: Bot,
      dataTour: 'agent-section',
      defaultOpen: true,
      children: [
        { id: 'agent-config', label: 'Configuration', icon: Bot },
        { id: 'playbooks', label: 'Scenarios', icon: Zap },
        { id: 'whatsapp-agent', label: 'WhatsApp', icon: MessageCircle, ...(can('whatsapp_agent') ? { badge: 'Nouveau', badgeColor: 'bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/30' } : { badge: 'PRO', badgeColor: 'bg-amber-50 text-amber-700 border border-amber-200' }) },
      ],
    },

    { type: 'section', label: 'Connexions' },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'voice-agent', label: 'Agent vocal', icon: Phone, ...(can('voice_agent') ? {} : { badge: 'PRO', badgeColor: 'bg-amber-50 text-amber-700 border border-amber-200' }) },

    {
      type: 'expandable',
      label: 'Insights',
      icon: TrendingUp,
      defaultOpen: true,
      children: [
        { id: 'weekly-summary', label: 'Performance', icon: BarChart3 },
        { id: 'roi', label: 'ROI', icon: TrendingUp },
        { id: 'peak-hours', label: 'Heures de pic', icon: Clock },
        { id: 'voice-calls', label: 'Appels vocaux', icon: PhoneCall, badge: 'Bientot', badgeColor: 'bg-amber-50 text-amber-700 border border-amber-200' },
        { id: 'achievements', label: 'Recompenses', icon: Trophy },
      ],
    },

    { type: 'section', label: 'Decouvrir' },
    { id: 'marketplace', label: 'Marketplace', icon: Store },

    {
      type: 'expandable',
      label: 'Parametres',
      icon: Settings,
      children: [
        { id: 'profile', label: 'Compte', icon: User },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'billing', label: 'Facturation', icon: CreditCard },
        { id: 'support', label: 'Aide', icon: MessageSquare },
      ],
    },
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

  // Show IndustryPicker only for brand-new clients still in setup mode,
  // who have never chosen/skipped a preset, and haven't dismissed it this session.
  const shouldShowIndustryPicker =
    !!currentClient?.id &&
    industryPresetApplied === null &&
    !industryPickerDismissed &&
    isSetupMode &&
    completedSetupSteps < 3;

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans bg-[#fafafa] text-[#1a1a1a]">
      {shouldShowIndustryPicker && (
        <IndustryPicker
          clientId={currentClient.id}
          onClose={() => {
            setIndustryPickerDismissed(true);
            refetchIndustryPreset();
          }}
          onApplied={() => {
            setIndustryPickerDismissed(true);
            refetchIndustryPreset();
            queryClient.invalidateQueries({ queryKey: ['setup-checklist', currentClient.id] });
            queryClient.invalidateQueries({ queryKey: ['industry-preset-applied', currentClient.id] });
          }}
        />
      )}
      {/* Mobile Header */}
      <div className={`md:hidden h-16 flex items-center justify-between px-4 sticky top-0 z-50 ${isLight ? "bg-white border-b border-gray-200" : "bg-white border-b border-gray-100"}`}>
        <div className="flex items-center gap-2">
          <Logo className={`w-6 h-6 ${isLight ? "text-[#003725]" : "text-[#1a1a1a]"}`} />
          <span className={`font-bold text-lg ${isLight ? "text-[#1a1a1a]" : "text-[#1a1a1a]"}`}>Actero OS</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Ouvrir le menu de navigation"
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-sidebar"
        >
          <Menu className={`w-6 h-6 ${isLight ? "text-[#71717a]" : "text-[#71717a]"}`} />
        </button>
      </div>

      {/* Sidebar Desktop */}
      <div className="hidden md:block">
        <Sidebar
          title="Actero"
          items={filteredSidebarItems}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onLogout={onLogout}
          theme={theme}
          userName={currentClient?.brand_name}
          userEmail={currentClient?.contact_email}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div id="mobile-sidebar" className="md:hidden fixed inset-0 z-50 flex">
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
                title="Actero"
                items={filteredSidebarItems}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onLogout={onLogout}
                onClose={() => setIsMobileMenuOpen(false)}
                theme={theme}
                userName={currentClient?.brand_name}
                userEmail={currentClient?.contact_email}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header — clean, minimal like Instantly */}
        <header className="sticky top-0 z-40 bg-white px-5 md:px-8 h-[48px] flex items-center justify-between border-b border-[#f0f0f0]">
          <h1 className="text-[14px] font-semibold text-[#1a1a1a]">
            {activeTab === "overview" && "Tableau de bord"}
            {activeTab === "activity" && "Activite"}
            {activeTab === "knowledge" && "Base de savoir"}
            {activeTab === "support" && "Aide"}
            {activeTab === "referral" && "Parrainage"}
            {activeTab === "partner" && "Actero Partners"}
            {activeTab === "integrations" && "Integrations"}
            {activeTab === "agent-config" && "Configuration"}
            {activeTab === "simulator" && "Tester"}
            {activeTab === "team" && "Equipe"}
            {activeTab === "guardrails" && "Garde-fous"}
            {activeTab === "escalations" && "A traiter"}
            {activeTab === "response-templates" && "Modeles de reponse"}
            {activeTab === "voice-calls" && "Appels vocaux"}
            {activeTab === "voice-agent" && "Agent vocal"}
            {activeTab === "whatsapp-agent" && "Agent WhatsApp"}
            {activeTab === "notifications" && "Notifications"}
            {activeTab === "playbooks" && "Scenarios"}
            {activeTab === "marketplace" && "Marketplace"}
            {activeTab === "weekly-summary" && "Performance"}
            {activeTab === "peak-hours" && "Heures de pic"}
            {activeTab === "achievements" && "Recompenses"}
            {activeTab === "roi" && "ROI"}
            {activeTab === "profile" && "Compte"}
            {activeTab === "billing" && "Facturation"}
          </h1>
          <div className="flex items-center gap-3">
            {urgentEscalationCount > 0 && (
              <button
                onClick={() => setActiveTab('escalations')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-[11px] font-semibold hover:bg-red-100 transition-colors"
              >
                <AlertTriangle className="w-3 h-3" /> {urgentEscalationCount}
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:px-10 md:py-8 bg-[#fafafa]">
          {activeTab === "overview" && (
            <div className="max-w-6xl mx-auto">

              {isSetupMode ? (
                // ═══════════════════════ SETUP MODE ═══════════════════════
                <>
                  {/* ── Welcome hero ── */}
                  <div className="mb-6 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] overflow-hidden">
                    <div className="relative bg-gradient-to-br from-[#0F5F35] via-[#0F5F35] to-[#14764a] px-8 py-10">
                      <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 70%, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                      <div className="relative">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm mb-4">
                          <Sparkles className="w-3 h-3 text-white" />
                          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Démarrage</span>
                        </div>
                        <h2 className="text-[26px] md:text-[32px] font-bold text-white tracking-tight leading-tight">
                          Bienvenue {userFirstName || currentClient?.brand_name || ''} 👋
                        </h2>
                        <p className="text-[14px] text-white/80 mt-2 max-w-xl">
                          Votre agent IA est presque prêt. Encore quelques étapes pour qu'il commence à répondre à vos clients à votre place.
                        </p>
                        {setupCompletion && (
                          <p className="text-[11px] text-white/70 mt-3 font-medium">
                            {completedSetupSteps}/7 étapes complétées
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Primary CTA: Connect Shopify ── */}
                  {currentClient?.client_type === 'ecommerce' && !setupCompletion?.shopify && (
                    <button
                      onClick={() => setActiveTab('integrations')}
                      className="w-full mb-6 rounded-2xl bg-[#0F5F35] hover:bg-[#0d5430] transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.08)] px-6 py-5 flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                          <ShoppingBag className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-[15px] font-semibold text-white leading-tight">Connecter ma boutique Shopify</p>
                          <p className="text-[12px] text-white/75 leading-tight mt-1">Première étape pour activer votre agent — prend 2 minutes</p>
                        </div>
                      </div>
                      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                        <ArrowRight className="w-4 h-4 text-white" />
                      </div>
                    </button>
                  )}

                  {/* ── Setup checklist (non dismissible) ── */}
                  {currentClient?.id && (
                    <div data-tour="setup-checklist" className="mb-8">
                      <SetupChecklist clientId={currentClient.id} setActiveTab={setActiveTab} dismissible={false} />
                    </div>
                  )}

                  {/* ── "Voici ce qui vous attend" preview cards ── */}
                  <div className="mb-4">
                    <h3 className="text-[15px] font-semibold text-[#1a1a1a] mb-1">Voici ce qui vous attend</h3>
                    <p className="text-[12px] text-[#9ca3af]">Une fois votre agent configuré, vous pourrez accéder à ces fonctionnalités.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {[
                      {
                        icon: Bot,
                        title: 'Mon Agent',
                        desc: 'Personnalisez la personnalité, le ton et les réponses de votre agent IA.',
                        tab: 'agent-config',
                        color: 'bg-emerald-50',
                        iconColor: 'text-[#0F5F35]',
                      },
                      {
                        icon: Store,
                        title: 'Marketplace',
                        desc: 'Installez des playbooks et templates prêts à l\'emploi pour votre e-commerce.',
                        tab: 'marketplace',
                        color: 'bg-purple-50',
                        iconColor: 'text-purple-600',
                      },
                      {
                        icon: TrendingUp,
                        title: 'ROI & Analytics',
                        desc: 'Suivez le temps gagné et les économies réalisées par votre agent en temps réel.',
                        tab: 'roi',
                        color: 'bg-blue-50',
                        iconColor: 'text-blue-600',
                      },
                    ].map((f, i) => {
                      const Icon = f.icon;
                      return (
                        <button
                          key={i}
                          onClick={() => setActiveTab(f.tab)}
                          className="text-left bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-[#e5e5e5] transition-all group"
                        >
                          <div className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center mb-3`}>
                            <Icon className={`w-5 h-5 ${f.iconColor}`} />
                          </div>
                          <p className="text-[14px] font-semibold text-[#1a1a1a] mb-1">{f.title}</p>
                          <p className="text-[12px] text-[#9ca3af] leading-relaxed">{f.desc}</p>
                          <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-[#0F5F35] opacity-0 group-hover:opacity-100 transition-opacity">
                            Découvrir <ArrowRight className="w-3 h-3" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                // ═══════════════════════ OPERATION MODE ═══════════════════════
                <>
                  {/* ── Shopify connection banner (if e-commerce + not connected) ── */}
                  {showShopifyBanner && (
                    <button
                      onClick={() => setActiveTab('integrations')}
                      className="w-full mb-5 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-center justify-between gap-3 hover:bg-amber-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-4 h-4 text-amber-700" />
                        </div>
                        <p className="text-[13px] text-amber-800 font-medium truncate text-left">
                          Connectez Shopify pour activer toutes les fonctionnalités
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1 text-[12px] font-semibold text-amber-800">
                        Connecter <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  )}

                  {/* ── Ticket usage counter ── */}
                  <div className="mb-5 bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-[#1a1a1a]">
                          {ticketsUsed.toLocaleString('fr-FR')} / {ticketsLimit === Infinity ? '∞' : ticketsLimit.toLocaleString('fr-FR')} tickets ce mois
                        </p>
                        {inTrial && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider">
                            Essai gratuit — J-{trialDaysLeft}
                          </span>
                        )}
                      </div>
                      {isOverLimit && (
                        <span className="text-[11px] font-semibold text-red-600">Limite atteinte</span>
                      )}
                    </div>
                    {ticketsLimit !== Infinity && (
                      <div className="w-full h-2 rounded-full bg-[#f0f0f0] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            ticketsPercent > 90 ? 'bg-red-500' : ticketsPercent > 70 ? 'bg-amber-500' : 'bg-[#0F5F35]'
                          }`}
                          style={{ width: `${Math.min(ticketsPercent, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* ── Weekly summary (one-liner) ── */}
                  <WeeklySummary clientId={currentClient?.id} setActiveTab={setActiveTab} />

                  {/* ── Urgent escalation banner (>2h pending) ── */}
                  {urgentEscalationCount > 0 && (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/70 px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        </div>
                        <p className="text-[13px] text-red-700 font-medium truncate">
                          {urgentEscalationCount} ticket{urgentEscalationCount > 1 ? 's' : ''} urgent{urgentEscalationCount > 1 ? 's' : ''} — répondez avant la fin de journée
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab('escalations')}
                        className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-red-600 text-white text-[12px] font-semibold hover:bg-red-700 transition-colors"
                      >
                        Voir
                      </button>
                    </div>
                  )}

                  {/* ── Setup checklist (dismissible, shows only if not fully done) ── */}
                  {currentClient?.id && completedSetupSteps < 7 && (
                    <div data-tour="setup-checklist" className="mb-6">
                      <SetupChecklist clientId={currentClient.id} setActiveTab={setActiveTab} />
                    </div>
                  )}

                  {/* ── KPI Row (Instantly-style) ── */}
                  <div data-tour="kpi-row" className="grid grid-cols-2 md:grid-cols-4 gap-0 bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] overflow-hidden mb-8">
                    {[
                      {
                        label: 'Demandes traitées automatiquement',
                        sublabel: 'vs période précédente',
                        value: eventCounts.ticket_resolved || 0,
                        var: periodStats?.tasks_executed_var,
                        suffix: '',
                      },
                      {
                        label: 'À traiter manuellement',
                        sublabel: 'en attente de votre équipe',
                        value: eventCounts.ticket_escalated || 0,
                        suffix: '',
                      },
                      {
                        label: 'Temps gagné',
                        sublabel: 'heures économisées sur la période',
                        value: Math.round((liveRoi?.hours_saved || 0) * 10) / 10,
                        suffix: 'h',
                      },
                      {
                        label: 'Économies réalisées',
                        sublabel: 'sur la période sélectionnée',
                        value: `${Math.round(liveRoi?.value_saved || 0).toLocaleString('fr-FR')}`,
                        suffix: '€',
                      },
                    ].map((kpi, i) => (
                      <div key={i} className={`px-5 py-5 ${i < 3 ? 'border-r border-[#f0f0f0]' : ''}`}>
                        <p className="text-[12px] text-[#1a1a1a] font-medium leading-tight mb-2 line-clamp-1">{kpi.label}</p>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[28px] font-bold text-[#1a1a1a] tracking-tight tabular-nums leading-none">
                            {typeof kpi.value === 'number' ? kpi.value.toLocaleString('fr-FR') : kpi.value}
                          </span>
                          {kpi.suffix && <span className="text-[16px] font-semibold text-[#1a1a1a]">{kpi.suffix}</span>}
                        </div>
                        <p className="text-[11px] text-[#9ca3af] mt-1.5 leading-tight">{kpi.sublabel}</p>
                        {kpi.var !== undefined && kpi.var !== 0 && (
                          <p className={`text-[11px] font-semibold mt-0.5 ${kpi.var > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {kpi.var > 0 ? '▲' : '▼'} {kpi.var > 0 ? '+' : ''}{kpi.var}%
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* ── Period selector ── */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[18px] font-semibold text-[#1a1a1a]">Aperçu</h3>
                      <span className="text-[11px] text-[#9ca3af] font-medium bg-[#f5f5f5] px-2 py-0.5 rounded">
                        {selectedPeriod === 'this_month' ? 'Ce mois' : selectedPeriod === 'last_month' ? 'Mois dernier' : '30 jours'}
                      </span>
                    </div>
                    <div
                      role="tablist"
                      aria-label="Période d'analyse"
                      className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#f5f5f5]"
                    >
                      {[
                        { id: 'this_month', label: 'Ce mois' },
                        { id: 'last_month', label: 'Mois dernier' },
                        { id: 'last_30_days', label: '30 jours' }
                      ].map((p) => {
                        const isSelected = selectedPeriod === p.id;
                        return (
                          <button
                            key={p.id}
                            role="tab"
                            id={`period-tab-${p.id}`}
                            aria-selected={isSelected}
                            aria-controls="period-panel"
                            tabIndex={isSelected ? 0 : -1}
                            onClick={() => setSelectedPeriod(p.id)}
                            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                              isSelected
                                ? 'bg-white text-[#1a1a1a] shadow-sm'
                                : 'text-[#9ca3af] hover:text-[#1a1a1a]'
                            }`}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Cards row ── */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                    {/* Live feed card */}
                    <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] overflow-hidden">
                      <div className="px-6 pt-5 pb-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#0F5F35] animate-pulse" />
                            <p className="text-[13px] font-semibold text-[#1a1a1a]">Feed en direct</p>
                          </div>
                          <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider bg-[#f5f5f5] px-2 py-0.5 rounded">
                            Live
                          </span>
                        </div>
                        <p className="text-[11px] text-[#9ca3af] mt-1">Les derniers événements de votre agent en temps réel.</p>
                      </div>
                      <LiveActivityWidget supabase={supabase} setActiveTab={setActiveTab} isLight={true} compact={true} />
                    </div>

                    {/* Activity chart card */}
                    <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-6">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-semibold text-[#1a1a1a]">Activité récente</p>
                        <button
                          onClick={() => setActiveTab('activity')}
                          className="text-[12px] font-medium text-[#0F5F35] hover:underline"
                        >
                          Tout voir →
                        </button>
                      </div>
                      <p className="text-[11px] text-[#9ca3af] mt-1 mb-3">Volume de demandes traitées sur la période.</p>
                      <div className="h-[140px]">
                        <ActivityChart theme={theme} supabase={supabase} selectedPeriod={selectedPeriod} mini={true} />
                      </div>
                    </div>
                  </div>

                  {/* ── Peak hours ── */}
                  <div className="mb-8">
                    <div className="mb-2">
                      <p className="text-[11px] text-[#9ca3af]">Identifiez les moments de la journée où votre agent est le plus sollicité.</p>
                    </div>
                    <PeakHoursChart clientId={currentClient?.id} />
                  </div>

                  {/* ── Suggestions ── */}
                  <AgentImprovementWidget clientId={currentClient?.id} theme={theme} />

                  {/* ── Achievements banner (only if at least 1 unlocked) ── */}
                  <div className="mt-6">
                    <AchievementsBanner
                      clientId={currentClient?.id}
                      onViewAll={() => setActiveTab('achievements')}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "activity" && <ActivityView supabase={supabase} theme={theme} />}

          {activeTab === "profile" && <ClientProfileView theme={theme} />}

          {activeTab === "billing" && <ClientBillingView theme={theme} />}

          {activeTab === "roi" && <ROISettingsView clientId={currentClient?.id} theme={theme} />}

          {activeTab === "support" && (
            <HelpCenterView theme={theme} />
          )}

          {activeTab === "referral" && (
            <ClientReferralView
              clientId={currentClient?.id}
              theme={theme}
            />
          )}

          {activeTab === "partner" && (
            <PartnerDashboardView theme={theme} />
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

          {activeTab === "response-templates" && (
            <ResponseTemplatesView
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
            <PlanGate feature="simulator" planId={planId} inTrial={inTrial}>
              <ConversationSimulator
                clientId={currentClient?.id}
                clientType={currentClient?.client_type}
                theme={theme}
              />
            </PlanGate>
          )}

          {activeTab === "team" && (
            <TeamManager clientId={currentClient?.id} />
          )}

          {activeTab === "guardrails" && (
            <PlanGate feature="guardrails" planId={planId} inTrial={inTrial}>
              <GuardrailsEditor
                clientId={currentClient?.id}
                theme={theme}
              />
            </PlanGate>
          )}

          {activeTab === "voice-calls" && (
            <VoiceCallsView clientId={currentClient?.id} theme={theme} />
          )}

          {activeTab === "voice-agent" && (
            <PlanGate feature="voice_agent" planId={planId} inTrial={inTrial}>
              <VoiceAgentSetupView clientId={currentClient?.id} />
            </PlanGate>
          )}

          {activeTab === "whatsapp-agent" && (
            <PlanGate feature="whatsapp_agent" planId={planId} inTrial={inTrial}>
              <WhatsAppAgentSetupView clientId={currentClient?.id} />
            </PlanGate>
          )}

          {activeTab === "notifications" && (
            <NotificationCenterView clientId={currentClient?.id} theme={theme} />
          )}

          {activeTab === "playbooks" && (
            <PlaybooksView clientId={currentClient?.id} setActiveTab={setActiveTab} theme={theme} />
          )}

          {activeTab === "marketplace" && (
            <MyMarketplaceTemplatesView clientId={currentClient?.id} />
          )}

          {activeTab === "weekly-summary" && (
            <div className="max-w-5xl mx-auto">
              <WeeklySummary clientId={currentClient?.id} setActiveTab={setActiveTab} />
            </div>
          )}

          {activeTab === "peak-hours" && (
            <div className="max-w-5xl mx-auto">
              <PeakHoursChart clientId={currentClient?.id} />
            </div>
          )}

          {activeTab === "achievements" && (
            <AchievementsView clientId={currentClient?.id} />
          )}

        </main>
      </div>

      {/* Copilot Chat Bubble */}
      {currentClient?.id && <ClientCopilotBubble clientId={currentClient.id} clientType={currentClient.client_type} theme={theme} />}

      {/* Onboarding Concierge — auto-hides once the 7 setup steps are done */}
      {currentClient?.id && <OnboardingConcierge clientId={currentClient.id} setActiveTab={setActiveTab} />}

      {/* Achievements celebration toast */}
      {currentClient?.id && <AchievementsToast clientId={currentClient.id} />}

      {/* Interactive Product Tour (Linear-style spotlight) */}
      <ProductTour isOpen={showTour} onClose={handleCloseTour} />
    </div>
  );
};
