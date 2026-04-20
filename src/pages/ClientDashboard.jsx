import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  FileText,
  Sparkles,
  Menu,
  MessageSquare,
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
  ArrowUpRight,
  ArrowRight,
  ShoppingBag,
  Trophy,
  Phone,
  PhoneCall,
  BookOpen,
  Shield,
  Users,
  Code,
  Gift,
  Home,
  Rocket,
  Activity,
  FlaskConical,
  Radio,
  Target,
  Cog,
  Mail,
  MonitorSmartphone,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { canAccessTab } from '../lib/role-permissions'
import { Logo } from '../components/layout/Logo'
import { Sidebar } from '../components/layout/Sidebar'
import { ActivityChart } from '../components/dashboard/ActivityChart'
// Overview path: kept static — these render immediately on mount.
import { ActivityView } from '../components/dashboard/ActivityView'
import { LiveActivityWidget, FeedbackButtons } from '../components/dashboard/LiveActivityWidget'
import { ClientCopilotBubble } from '../components/client/ClientCopilotBubble'
import { AgentImprovementWidget } from '../components/client/AgentImprovementWidget'
import { AutomationHubView } from '../components/client/AutomationHubView'
import { WeeklySummary } from '../components/client/WeeklySummary'
import { PeakHoursChart } from '../components/client/PeakHoursChart'
import { SetupChecklist } from '../components/client/SetupChecklist'
import { SetupWizard } from '../components/client/SetupWizard'
import { OverviewHome } from '../components/client/overview/OverviewHome'
import { AchievementsToast } from '../components/client/AchievementsView'
import ProductTour from '../components/client/ProductTour'

// Lazy-loaded: only fetched when the corresponding tab is opened.
// This cuts the initial JS bundle significantly (was ~2.88 MB) because
// these views pull in heavy deps (framer-motion variants, supabase queries,
// rich form editors, chart libs, etc.) that aren't needed until the user
// navigates to the tab.
const ClientProfileView = lazy(() => import('../components/client/ClientProfileView').then(m => ({ default: m.ClientProfileView })))
const VoiceAgentSetupView = lazy(() => import('../components/client/VoiceAgentSetupView').then(m => ({ default: m.VoiceAgentSetupView })))
const VoiceCallsView = lazy(() => import('../components/client/VoiceCallsView').then(m => ({ default: m.VoiceCallsView })))
const ClientReferralView = lazy(() => import('../components/client/ClientReferralView').then(m => ({ default: m.ClientReferralView })))
const PartnerDashboardView = lazy(() => import('../components/client/PartnerDashboardView').then(m => ({ default: m.PartnerDashboardView })))
const ClientKnowledgeBaseView = lazy(() => import('../components/client/ClientKnowledgeBaseView').then(m => ({ default: m.ClientKnowledgeBaseView })))
const ClientIntegrationsView = lazy(() => import('../components/client/ClientIntegrationsView').then(m => ({ default: m.ClientIntegrationsView })))
const PortalSavView = lazy(() => import('../components/client/PortalSavView').then(m => ({ default: m.PortalSavView })))
const PortalBrandingView = lazy(() => import('../components/client/PortalBrandingView').then(m => ({ default: m.PortalBrandingView })))
const GuardrailsEditor = lazy(() => import('../components/client/GuardrailsEditor').then(m => ({ default: m.GuardrailsEditor })))
const PromptEditor = lazy(() => import('../components/client/PromptEditor').then(m => ({ default: m.PromptEditor })))
const ConversationSimulator = lazy(() => import('../components/client/ConversationSimulator').then(m => ({ default: m.ConversationSimulator })))
const TeamManager = lazy(() => import('../components/client/TeamManager').then(m => ({ default: m.TeamManager })))
const ClientEscalationsView = lazy(() => import('../components/client/ClientEscalationsView').then(m => ({ default: m.ClientEscalationsView })))
const ResponseTemplatesView = lazy(() => import('../components/client/ResponseTemplatesView').then(m => ({ default: m.ResponseTemplatesView })))
const ApiDocsView = lazy(() => import('../components/client/ApiDocsView').then(m => ({ default: m.ApiDocsView })))
const NotificationCenterView = lazy(() => import('../components/client/NotificationCenterView').then(m => ({ default: m.NotificationCenterView })))
const PlaybooksView = lazy(() => import('../components/client/PlaybooksView').then(m => ({ default: m.PlaybooksView })))
const AgentControlCenterView = lazy(() => import('../components/client/AgentControlCenterView').then(m => ({ default: m.AgentControlCenterView })))
const ChannelsHubView = lazy(() => import('../components/client/ChannelsHubView').then(m => ({ default: m.ChannelsHubView })))
const EmailAgentView = lazy(() => import('../components/client/EmailAgentView').then(m => ({ default: m.EmailAgentView })))
const OpportunitiesView = lazy(() => import('../components/client/OpportunitiesView').then(m => ({ default: m.OpportunitiesView })))
const InsightsHubView = lazy(() => import('../components/client/InsightsHubView').then(m => ({ default: m.InsightsHubView })))
const SettingsHubView = lazy(() => import('../components/client/SettingsHubView').then(m => ({ default: m.SettingsHubView })))
const ClientBillingView = lazy(() => import('../components/client/ClientBillingView').then(m => ({ default: m.ClientBillingView })))
const HelpCenterView = lazy(() => import('../components/client/HelpCenterView').then(m => ({ default: m.HelpCenterView })))
const ROISettingsView = lazy(() => import('../components/client/ROISettingsView').then(m => ({ default: m.ROISettingsView })))
// IndustryPicker — disabled (conflit avec ProductTour anime) : import retire
// import { IndustryPicker } from '../components/client/IndustryPicker'
import { CommandPalette } from '../components/CommandPalette'
import { useCommandPalette } from '../hooks/useCommandPalette'
import { usePlan } from '../hooks/usePlan'
import { PlanGate } from '../components/ui/PlanGate'
import { UpgradeBanner } from '../components/ui/UpgradeBanner'
import { TabErrorBoundary } from '../components/ErrorBoundary'
import { SkipToMain } from '../components/ui/SkipToMain'
import { trackEvent, identifyUser } from '../lib/analytics'

export const ClientDashboard = ({ onNavigate, onLogout, currentRoute }) => {
  const [theme] = useState(() => localStorage.getItem("actero-theme") || "light");
  const [selectedPeriod, setSelectedPeriod] = useState("this_month");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const queryClient = useQueryClient();
  const { open: cmdkOpen, close: closeCmdk, isMac } = useCommandPalette();

  const getTabFromRoute = (route) => {
    // New unified routes (Notion-style nav — octobre 2026 refonte)
    if (route === "/client/automation") return "automation";
    if (route === "/client/agent-control") return "agent-control";
    // if (route === "/client/alerts") return "alerts"; // retiré — sera remis plus tard
    if (route === "/client/channels") return "channels";
    if (route === "/client/email-agent") return "email-agent";
    if (route === "/client/opportunities") return "opportunities";
    if (route === "/client/insights") return "insights";
    if (route === "/client/settings") return "settings";
    // Existing routes
    if (route === "/client/activity") return "activity";
    if (route === "/client/knowledge") return "knowledge";
    if (route === "/client/support") return "support";
    if (route === "/client/referral") return "referral";
    if (route === "/client/partner") return "partner";
    if (route === "/client/integrations") return "integrations";
    if (route === "/client/portal-sav") return "portal-sav";
    if (route === "/client/portal-branding") return "portal-branding";
    if (route === "/client/api-docs") return "api-docs";
    if (route === "/client/team") return "team";
    if (route === "/client/agent-config") return "agent-config";
    if (route === "/client/simulator") return "simulator";
    if (route === "/client/guardrails") return "guardrails";
    if (route === "/client/escalations") return "escalations";
    if (route === "/client/response-templates") return "response-templates";
    if (route === "/client/voice-calls") return "voice-calls";
    if (route === "/client/voice-agent") return "voice-agent";
    if (route === "/client/notifications") return "notifications";
    if (route === "/client/billing") return "billing";
    if (route === "/client/roi") return "roi";
    if (route === "/client/playbooks") return "playbooks";
    if (route === "/client/profile") return "profile";
    if (route === "/client/marketplace") return "marketplace";
    if (route === "/client/weekly-summary") return "weekly-summary";
    if (route === "/client/peak-hours") return "peak-hours";
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
          .maybeSingle();
        if (error) throw error;
        return data ? { ...data, _userRole: link.role || 'owner' } : null;
      }

      // Fallback: owner_user_id (legacy / owner accounts)
      const { data, error } = await supabase
        .from("clients")
        .select("id, brand_name, owner_user_id, created_at, client_type")
        .eq("owner_user_id", session.user.id)
        .maybeSingle();
      if (error) throw error;
      return data ? { ...data, _userRole: 'owner' } : null;
    },
    enabled: !!supabase,
  });

  // Plan gating
  const { planId, planName, config: planConfig, inTrial, trialDaysLeft, ticketsUsed, ticketsLimit, ticketsPercent, isOverLimit, canAccess: can } = usePlan(currentClient?.id)

  // Analytics — identifyUser once per session, as soon as we have the client profile
  // AND the plan is resolved. Identify is idempotent on Amplitude's side, but we
  // gate with a ref so Amplitude doesn't get 20+ identify calls per render loop.
  const identifiedRef = React.useRef(false)
  useEffect(() => {
    if (identifiedRef.current) return
    if (!currentClient?.id || !planId) return
    identifiedRef.current = true
    identifyUser(currentClient.id, {
      client_id: currentClient.id,
      plan: planId,
      shopify_domain: currentClient.shopify_shop_domain || '',
      playbooks_active: 0, // populated by a later identify once playbooks query resolves if needed
      tickets_this_month: ticketsUsed || 0,
      signed_up_at: currentClient.created_at || '',
    })
  }, [currentClient, planId, ticketsUsed])

  // Analytics — fire "Dashboard Visited" on every tab change (including first mount).
  // The `activeTab` value is derived from the URL, so refresh + deep-link also fire.
  useEffect(() => {
    if (!activeTab) return
    // Analytics
    trackEvent('Dashboard Visited', { section: activeTab, plan: planId || 'unknown' })
  }, [activeTab, planId])

  // Analytics — fire "Trial Limit Hit" when a free-plan user crosses 80% or 100%.
  // Fired once per threshold-per-session via a ref so we don't spam Amplitude on
  // every render. `trackedThresholdsRef` stores crossed thresholds like Set { 80, 100 }.
  const trackedThresholdsRef = React.useRef(new Set())
  useEffect(() => {
    if (planId !== 'free' || ticketsLimit === Infinity) return
    const crossed = ticketsPercent >= 100 ? 100 : ticketsPercent >= 80 ? 80 : null
    if (crossed && !trackedThresholdsRef.current.has(crossed)) {
      trackedThresholdsRef.current.add(crossed)
      // Analytics
      trackEvent('Trial Limit Hit', { resource: 'tickets', current_usage: ticketsUsed, limit: ticketsLimit, percentage: Math.round((ticketsUsed / ticketsLimit) * 100) })
    }
  }, [planId, ticketsPercent, ticketsUsed, ticketsLimit])

  // Analytics — "ROI Viewed" fired once per session when the user lands on a tab
  // that displays ROI data (overview tab + dailyMetrics resolved). Gated by ref
  // so tab-switching in and out doesn't re-fire.
  const roiViewedRef = React.useRef(false)
  // effect is declared further down (after `periodStats` + `activeTab`) — see block there

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
      const startOfYear = new Date(new Date().getFullYear(), 0, 1);
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

  // 5c. Setup completion — shared cache with SetupChecklist. Must use the SAME
  // queryFn as SetupChecklist so the TanStack cache entry is identical (two
  // different queryFns with the same key would race / overwrite each other).
  const { data: setupCompletion } = useQuery({
    queryKey: ['setup-checklist', currentClient?.id],
    queryFn: async () => {
      const clientId = currentClient.id;
      const [shopifyRes, wooWebflowRes] = await Promise.all([
        supabase.from('client_shopify_connections').select('id').eq('client_id', clientId).maybeSingle(),
        supabase.from('client_integrations').select('id, provider').eq('client_id', clientId).eq('status', 'active').in('provider', ['woocommerce', 'webflow']),
      ]);
      const ecommerce = !!shopifyRes.data || ((wooWebflowRes.data || []).length > 0);
      const { data: emailList } = await supabase
        .from('client_integrations')
        .select('id, provider')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .in('provider', ['smtp_imap', 'resend']);
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
        shopify: ecommerce,
        email: (emailList || []).length > 0,
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

  // SetupWizard visibility — show the full-screen wizard on 1st mount if :
  //  (a) essentials not all done (4 keys on setupCompletion: shopify, email, tone, tested)
  //  (b) user hasn't dismissed the wizard (localStorage key per client)
  // State is a simple boolean, re-checked when wizard dismisses.
  const [showSetupWizard, setShowSetupWizard] = useState(() => false) // init false; flipped by effect below
  useEffect(() => {
    if (!currentClient?.id || !setupCompletion) return
    const dismissed = localStorage.getItem(`setup-wizard-dismissed-${currentClient.id}`) === 'true'
    const essentialsDone = !!(setupCompletion.shopify && setupCompletion.email && setupCompletion.tone && setupCompletion.tested)
    setShowSetupWizard(!dismissed && !essentialsDone)
  }, [currentClient?.id, setupCompletion])

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

  const totalEvents = useMemo(
    () => Object.values(eventCounts).reduce((sum, n) => sum + (n || 0), 0),
    [eventCounts]
  );

  // KPI Calculations
  const periodStats = useMemo(() => {
    if (!dailyMetrics || !dailyMetrics.length) {
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
    if (!dailyMetrics || !dailyMetrics.length) return 0;
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
    if (!pendingEscalations || !Array.isArray(pendingEscalations)) return 0
    const cutoff = Date.now() - 2 * 60 * 60 * 1000 // >2h
    return pendingEscalations.filter(e => {
      if (!e.created_at) return false
      return new Date(e.created_at).getTime() < cutoff
    }).length
  }, [pendingEscalations]);

  // Analytics — fire "ROI Viewed" when the overview tab is open AND ROI data
  // has loaded with non-zero value. One-shot per session via ref.
  useEffect(() => {
    if (activeTab !== 'overview' || roiViewedRef.current) return
    const roi = periodStats?.roi || 0
    const tickets = periodStats?.tickets_executed ?? periodStats?.tasks_executed ?? 0
    if (roi <= 0 && tickets <= 0) return
    roiViewedRef.current = true
    // Analytics
    trackEvent('ROI Viewed', { roi_euros: roi, tickets_count: tickets, time_saved_hours: periodStats?.time_saved || 0, plan: planId })
  }, [activeTab, periodStats, planId])

  // Sidebar structure — refonte avril 2026 (POV nouveau client).
  // Narrative : Vue d'ensemble → Mon Agent (star) → Mes tickets → Canaux clients → Outils → Performance → Système.
  // Memoized: rebuild only when plan-gating (`can`), role, or urgent count changes — avoids recreating
  // the full tree (~30 nodes with icon refs) on every render/rerender of unrelated state.
  const sidebarItems = useMemo(() => [
    // Lien standalone hors section
    { id: 'overview', label: 'Vue d\'ensemble', icon: Home, dataTour: 'overview-tab' },

    // MON AGENT — star expandable (cœur du produit, traitement visuel premium)
    {
      type: 'expandable',
      primary: true,
      label: 'Mon Agent',
      icon: Bot,
      dataTour: 'agent-section',
      defaultOpen: true,
      children: [
        { id: 'automation', label: 'Vue d\'ensemble', icon: Rocket, dataTour: 'automation-tab' },
        { id: 'agent-control', label: 'Centre de contrôle', icon: Sparkles },
        { id: 'agent-config', label: 'Configuration', icon: Settings },
        { id: 'knowledge', label: 'Base de connaissances', icon: BookOpen },
        { id: 'guardrails', label: 'Règles métier', icon: Shield },
        { id: 'simulator', label: 'Tester mon agent', icon: FlaskConical, ...(can('simulator') ? {} : { badge: 'STARTER', badgeColor: 'bg-blue-50 text-blue-600 border border-blue-200' }) },
      ],
    },

    // MES TICKETS — le quotidien opérationnel
    { type: 'section', label: 'Mes tickets' },
    {
      id: 'escalations',
      label: 'À traiter',
      icon: Inbox,
      badge: urgentEscalationCount > 0 ? urgentEscalationCount : null,
      badgeColor: 'bg-red-100 text-red-600',
    },
    { id: 'activity', label: 'Activité', icon: Activity },

    // CANAUX CLIENTS — où les clients entrent en contact
    {
      type: 'expandable',
      label: 'Canaux clients',
      icon: MonitorSmartphone,
      defaultOpen: false,
      children: [
        { id: 'portal-sav', label: 'Portail SAV', icon: MonitorSmartphone, ...(can('portal_enabled') ? {} : { badge: 'STARTER', badgeColor: 'bg-blue-50 text-blue-600 border border-blue-200' }) },
        { id: 'email-agent', label: 'Agent Email', icon: Mail, ...(can('email_agent') ? {} : { badge: 'PRO', badgeColor: 'bg-amber-50 text-amber-700 border border-amber-200' }) },
        { id: 'channels', label: 'Canaux', icon: Radio },
      ],
    },

    // OUTILS CONNECTÉS — Shopify, CRM, etc.
    {
      type: 'expandable',
      label: 'Outils connectés',
      icon: Plug,
      defaultOpen: false,
      children: [
        { id: 'integrations', label: 'Intégrations', icon: Plug },
      ],
    },

    // PERFORMANCE — mesurer et grandir
    {
      type: 'expandable',
      label: 'Performance',
      icon: TrendingUp,
      defaultOpen: false,
      children: [
        { id: 'opportunities', label: 'Opportunités', icon: Target },
        { id: 'insights', label: 'Insights', icon: BarChart3 },
      ],
    },

    // SYSTÈME
    { type: 'section', label: 'Système' },
    { id: 'settings', label: 'Paramètres', icon: Cog },
  ], [can, urgentEscalationCount]);

  const userRole = currentClient?._userRole || 'owner';

  // Filter sidebar items based on user role.
  // Memoized on sidebarItems + userRole — avoids re-walking the tree on every render of downstream state.
  const filteredSidebarItems = useMemo(() => sidebarItems.map(item => {
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
  }), [sidebarItems, userRole]);

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

  // Upgrade CTA for sidebar — only shown for Free and Starter plans
  const sidebarUpgradeCta = (planId === 'free' || planId === 'starter') ? (
    <button
      onClick={() => {
        // Analytics
        trackEvent('Upgrade Clicked', { from_plan: planId, to_plan: planId === 'free' ? 'starter' : 'pro', trigger: 'sidebar_cta', location: 'sidebar' })
        setActiveTab('billing')
      }}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-bold transition-all bg-cta text-white hover:bg-[#003725] shadow-sm"
    >
      <ArrowUpRight className="w-3.5 h-3.5" />
      {planId === 'free' ? 'Passer au Starter — 99€/mois' : 'Passer au Pro — 399€/mois'}
    </button>
  ) : null

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans bg-[#fafafa] text-[#1a1a1a]">
      <SkipToMain />
      {/* IndustryPicker disabled — was conflicting with the animated guide tour */}
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
          upgradeCta={sidebarUpgradeCta}
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
                upgradeCta={sidebarUpgradeCta}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header — clean, minimal like Instantly */}
        <header className="sticky top-0 z-40 bg-white px-5 md:px-8 h-[48px] flex items-center justify-between border-b border-[#f0f0f0]">
          <h1 className="text-[14px] font-semibold text-[#1a1a1a]">
            {activeTab === "overview" && "Vue d'ensemble"}
            {activeTab === "automation" && "Automatisation"}
            {activeTab === "activity" && "Activité de l'agent"}
            {/* {activeTab === "alerts" && "Alertes"} — retiré temporairement */}
            {activeTab === "agent-control" && "Centre de contrôle"}
            {activeTab === "knowledge" && "Base de connaissances"}
            {activeTab === "support" && "Centre d'aide"}
            {activeTab === "referral" && "Parrainage"}
            {activeTab === "partner" && "Actero Partners"}
            {activeTab === "integrations" && "Intégrations"}
            {activeTab === "portal-sav" && "Portail SAV"}
            {activeTab === "portal-branding" && "Personnaliser mon portail"}
            {activeTab === "channels" && "Canaux"}
            {activeTab === "email-agent" && "Agent Email"}
            {activeTab === "agent-config" && "Configuration"}
            {activeTab === "simulator" && "Tester mon agent"}
            {activeTab === "team" && "Équipe"}
            {activeTab === "guardrails" && "Règles métier"}
            {activeTab === "escalations" && "À traiter"}
            {activeTab === "response-templates" && "Modèles de réponse"}
            {activeTab === "voice-calls" && "Appels vocaux"}
            {activeTab === "voice-agent" && "Agent vocal"}
            {activeTab === "notifications" && "Notifications"}
            {activeTab === "playbooks" && "Scenarios"}
            {activeTab === "marketplace" && "Marketplace"}
            {activeTab === "weekly-summary" && "Performance"}
            {activeTab === "peak-hours" && "Heures de pic"}
            {activeTab === "roi" && "ROI"}
            {activeTab === "opportunities" && "Opportunités"}
            {activeTab === "insights" && "Insights"}
            {activeTab === "settings" && "Paramètres"}
            {activeTab === "profile" && "Mon compte"}
            {activeTab === "api-docs" && "API & Webhooks"}
            {activeTab === "billing" && "Facturation"}
            {planName && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                planId === 'free' ? 'bg-[#fafafa] text-[#71717a] border border-[#f0f0f0]' :
                planId === 'starter' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                planId === 'pro' ? 'bg-cta/10 text-cta border border-cta/20' :
                'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {planName}
              </span>
            )}
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

        {inTrial && (
          <div className="bg-cta text-white px-4 py-2 flex items-center justify-between text-[12px]">
            <span>
              Essai gratuit — <b>{trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''} restant{trialDaysLeft > 1 ? 's' : ''}</b>
            </span>
            <button onClick={() => {
              // Analytics
              trackEvent('Upgrade Clicked', { from_plan: planId, to_plan: 'any_paid', trigger: 'trial_bar', location: 'top_bar' })
              setActiveTab('billing')
            }} className="bg-white text-cta px-3 py-1 rounded-full text-[11px] font-bold hover:bg-white/90 transition">
              Choisir un plan
            </button>
          </div>
        )}

        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:px-10 md:py-8 bg-[#fafafa]">
          <TabErrorBoundary tabId={activeTab} resetKey={activeTab} tabLabel={activeTab}>
          <Suspense fallback={
            <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
              <div className="w-8 h-8 border-2 border-cta/20 border-t-cta rounded-full animate-spin" aria-label="Chargement…" />
              <span className="sr-only">Chargement…</span>
            </div>
          }>
          {activeTab === "overview" && (
            <div className="max-w-6xl mx-auto">

              {isSetupMode ? (
                // ═══════════════════════ SETUP MODE ═══════════════════════
                <>
                  {/* ── Welcome hero ── */}
                  <div className="mb-6 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] overflow-hidden">
                    <div className="relative bg-gradient-to-br from-cta via-cta to-[#14764a] px-8 py-10">
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
                      className="w-full mb-6 rounded-2xl bg-cta hover:bg-[#0d5430] transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.08)] px-6 py-5 flex items-center justify-between group"
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
                        iconColor: 'text-cta',
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
                          <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-cta opacity-0 group-hover:opacity-100 transition-opacity">
                            Découvrir <ArrowRight className="w-3 h-3" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                // ═══════════════════════ OPERATION MODE ═══════════════════════
                // Refonte avril 2026 : 10 blocs empilés → 3 zones hiérarchisées
                // (SystemAlerts → TodayHero → KPIs → Signals). Voir
                // src/components/client/overview/OverviewHome.jsx
                <OverviewHome
                  clientId={currentClient?.id}
                  currentClient={currentClient}
                  planId={planId}
                  planName={planName}
                  inTrial={inTrial}
                  trialDaysLeft={trialDaysLeft}
                  ticketsUsed={ticketsUsed}
                  ticketsLimit={ticketsLimit}
                  ticketsPercent={ticketsPercent}
                  isOverLimit={isOverLimit}
                  periodStats={periodStats}
                  selectedPeriod={selectedPeriod}
                  setSelectedPeriod={setSelectedPeriod}
                  dailyMetrics={dailyMetrics}
                  eventCounts={eventCounts}
                  liveRoi={liveRoi}
                  totalEvents={totalEvents}
                  urgentEscalationCount={urgentEscalationCount}
                  completedSetupSteps={completedSetupSteps}
                  showShopifyBanner={showShopifyBanner}
                  setupCompletion={setupCompletion}
                  setActiveTab={setActiveTab}
                  theme={theme}
                />
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

          {activeTab === "portal-sav" && (
            <PortalSavView
              client={{ ...currentClient, plan: planId }}
              clientId={currentClient?.id}
              supabase={supabase}
              onUpgrade={() => setActiveTab('billing')}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === "portal-branding" && (
            <PortalBrandingView
              client={currentClient}
              clientId={currentClient?.id}
              supabase={supabase}
              planId={planId}
              onBack={() => setActiveTab('portal-sav')}
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
            <PlanGate feature="simulator" planId={planId} inTrial={inTrial} onUpgrade={() => setActiveTab('billing')}>
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
            <PlanGate feature="guardrails" planId={planId} inTrial={inTrial} onUpgrade={() => setActiveTab('billing')}>
              <GuardrailsEditor
                clientId={currentClient?.id}
                theme={theme}
              />
            </PlanGate>
          )}

          {activeTab === "voice-calls" && (
            <PlanGate feature="voice_agent" planId={planId} inTrial={inTrial} onUpgrade={() => setActiveTab('billing')}>
              <VoiceCallsView clientId={currentClient?.id} theme={theme} />
            </PlanGate>
          )}

          {activeTab === "voice-agent" && (
            <PlanGate feature="voice_agent" planId={planId} inTrial={inTrial} onUpgrade={() => setActiveTab('billing')}>
              <VoiceAgentSetupView clientId={currentClient?.id} />
            </PlanGate>
          )}

          {activeTab === "api-docs" && (
            <PlanGate feature="api_webhooks" planId={planId} inTrial={inTrial} onUpgrade={() => setActiveTab('billing')}>
              <ApiDocsView clientId={currentClient?.id} />
            </PlanGate>
          )}

          {activeTab === "notifications" && (
            <NotificationCenterView clientId={currentClient?.id} theme={theme} />
          )}

          {activeTab === "playbooks" && (
            <PlaybooksView clientId={currentClient?.id} setActiveTab={setActiveTab} theme={theme} />
          )}

          {activeTab === "marketplace" && (
            <div className="max-w-2xl mx-auto text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <Store className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-xl font-bold text-[#1a1a1a] mb-2">Marketplace</h3>
              <p className="text-sm text-[#71717a] mb-1">Bientôt disponible</p>
              <p className="text-xs text-[#9ca3af] max-w-md mx-auto">
                Découvrez et installez des templates de workflows, des playbooks communautaires et des intégrations créées par la communauté Actero.
              </p>
            </div>
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

          {/* ===== Refonte nav — nouvelles pages hub ===== */}

          {activeTab === "automation" && (
            <AutomationHubView clientId={currentClient?.id} theme={theme} setActiveTab={setActiveTab} />
          )}

          {activeTab === "agent-control" && (
            <AgentControlCenterView clientId={currentClient?.id} onNavigate={setActiveTab} />
          )}

          {/* Alerts view — temporairement retiré */}

          {activeTab === "channels" && (
            <ChannelsHubView clientId={currentClient?.id} onNavigate={setActiveTab} />
          )}

          {activeTab === "email-agent" && (
            <PlanGate feature="email_agent" planId={planId} inTrial={inTrial} onUpgrade={() => setActiveTab('billing')}>
              <EmailAgentView clientId={currentClient?.id} />
            </PlanGate>
          )}

          {activeTab === "opportunities" && (
            <OpportunitiesView clientId={currentClient?.id} onNavigate={setActiveTab} />
          )}

          {activeTab === "insights" && (
            <InsightsHubView clientId={currentClient?.id} onNavigate={setActiveTab} canAccessVoice={can('voice_agent')} />
          )}

          {activeTab === "settings" && (
            <SettingsHubView clientId={currentClient?.id} onNavigate={setActiveTab} />
          )}
          </Suspense>
          </TabErrorBoundary>

        </main>
      </div>

      {/* Copilot Chat Bubble */}
      {currentClient?.id && <ClientCopilotBubble clientId={currentClient.id} theme={theme} />}

      {/* Achievements celebration toast */}
      {currentClient?.id && <AchievementsToast clientId={currentClient.id} />}

      {/* Interactive Product Tour (Linear-style spotlight) */}
      <ProductTour isOpen={showTour} onClose={handleCloseTour} />

      {/* 5-minute Setup Wizard — shown on first mount when essentials incomplete.
          Dismiss reveals the normal dashboard + minimized SetupChecklist. */}
      {showSetupWizard && currentClient?.id && (
        <SetupWizard
          clientId={currentClient.id}
          onComplete={() => setShowSetupWizard(false)}
          onDismiss={() => setShowSetupWizard(false)}
        />
      )}

      {/* Cmd+K command palette */}
      <CommandPalette
        open={cmdkOpen}
        onClose={closeCmdk}
        mode="client"
        clientId={currentClient?.id}
        setActiveTab={setActiveTab}
        onNavigate={onNavigate}
        isMac={isMac}
      />
    </div>
  );
};
