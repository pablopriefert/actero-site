import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Rocket, Sparkles, Zap, ShoppingBag, Headphones, Loader2, CheckCircle2,
  AlertTriangle, Plug, Phone, Mail, MessageSquare, TrendingUp, ArrowRight,
  HelpCircle, Clock, DollarSign, Activity, ChevronRight, Bot, Info,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import { VocalAgentWizard } from './VocalAgentWizard'
import { ComptabiliteWizard } from './ComptabiliteWizard'
import { WorkflowReadinessCheck } from './WorkflowReadinessCheck'
import { buildReadinessChecks } from '../../lib/workflow-readiness'
import { AutomationHowItWorksModal } from './AutomationHowItWorksModal'

/* ═══════════ AUTOMATION CATALOG ═══════════ */

// Keys for automations that live in engine_playbooks (DB-driven)
const DB_AUTOMATIONS = {
  sav_ecommerce: {
    icon: Headphones,
    gradient: 'from-emerald-500 to-emerald-600',
    accent: 'emerald',
    category: 'support',
    tagline: 'Repond en 30 sec aux demandes SAV',
    description: 'Email, chat, Gorgias, Zendesk. L\'agent lit, comprend et repond avec votre ton de marque et les donnees Shopify reelles.',
    modalKey: 'sav_ecommerce',
    requires: [],
    channels: [
      { id: 'email', label: 'Email', desc: 'Repond aux emails entrants', icon: Mail, needsIntegration: ['gmail', 'smtp_imap'] },
      { id: 'widget', label: 'Chat sur le site', desc: 'Widget de chat sur votre boutique Shopify', icon: MessageSquare, needsIntegration: ['shopify'] },
      { id: 'gorgias', label: 'Gorgias', desc: 'Repond aux tickets Gorgias', icon: Headphones, needsIntegration: ['gorgias'] },
      { id: 'zendesk', label: 'Zendesk', desc: 'Repond aux tickets Zendesk', icon: Headphones, needsIntegration: ['zendesk'] },
    ],
  },
  agent_vocal: {
    icon: Phone,
    gradient: 'from-violet-500 to-violet-600',
    accent: 'violet',
    category: 'support',
    tagline: 'Un numero francais qui repond 24/7',
    description: 'Agent vocal IA avec voix naturelle. Gere le suivi de commande, les questions produit, transferts humains possibles.',
    modalKey: 'agent_vocal',
    requires: [],
    hasWizard: 'vocal',
    channels: [
      { id: 'widget_vocal', label: 'Widget vocal sur le site', desc: 'Bouton d\'appel vocal sur votre boutique Shopify', icon: Phone, needsIntegration: ['shopify'] },
      { id: 'phone', label: 'Numero de telephone dedie', desc: 'Un numero francais que vos clients peuvent appeler', icon: Phone, needsIntegration: [] },
    ],
  },
  abandoned_cart: {
    icon: ShoppingBag,
    gradient: 'from-amber-500 to-amber-600',
    accent: 'amber',
    category: 'sales',
    tagline: 'Recupere les ventes perdues',
    description: 'Detecte les paniers abandonnes et lance une sequence email personnalisee (1h / 24h / 72h) avec CTA retour panier.',
    modalKey: 'abandoned_cart',
    requires: [{ type: 'all', providers: ['shopify'], label: 'Shopify' }],
    channels: [
      { id: 'email', label: 'Email', desc: 'Envoie un email de relance panier depuis votre domaine', icon: Mail, needsIntegration: ['smtp_imap', 'gmail'] },
    ],
  },
  comptabilite_auto: {
    icon: TrendingUp,
    gradient: 'from-indigo-500 to-indigo-600',
    accent: 'indigo',
    category: 'ops',
    tagline: 'Votre comptable IA',
    description: 'Connecte Axonaut / Pennylane / iPaidThat, relance auto les factures, alertes tresorerie Slack/Email, exports mensuels.',
    modalKey: 'comptabilite_auto',
    requires: [{ type: 'any', providers: ['axonaut', 'pennylane', 'ipaidthat'], label: 'Axonaut, Pennylane ou iPaidThat' }],
    hasWizard: 'compta',
    channels: [
      { id: 'email', label: 'Email', desc: 'Relances et exports par email', icon: Mail, needsIntegration: ['gmail', 'smtp_imap'] },
      { id: 'slack', label: 'Slack', desc: 'Alertes tresorerie dans Slack', icon: MessageSquare, needsIntegration: ['slack'] },
    ],
  },
}

// Keys for automations that are NOT in engine_playbooks (standalone features)
const FEATURE_AUTOMATIONS = {
  email_agent: {
    icon: Mail,
    gradient: 'from-blue-500 to-blue-600',
    accent: 'blue',
    category: 'support',
    tagline: 'Votre boite pro gere par un expert IA',
    description: 'Lit Gmail ou IMAP en continu, repond aux questions courantes, threading parfait, escalade intelligente vers "A traiter".',
    modalKey: 'email_agent',
    route: 'email-agent',
    requires: [{ type: 'any', providers: ['gmail', 'smtp_imap'], label: 'Gmail ou IMAP' }],
  },
  slack_copilot: {
    icon: MessageSquare,
    gradient: 'from-fuchsia-500 to-fuchsia-600',
    accent: 'fuchsia',
    category: 'ops',
    tagline: 'Posez vos questions a Actero depuis Slack',
    description: 'Mentions @Actero ou /actero pour obtenir KPIs live, recommandations et alertes directement dans votre workspace.',
    modalKey: 'slack_copilot',
    route: 'integrations',
    requires: [{ type: 'any', providers: ['slack'], label: 'Slack' }],
  },
}

const CATEGORIES = [
  { id: 'support', label: 'Support client', desc: 'Votre SAV tourne 24/7 sans vous.', icon: Headphones },
  { id: 'sales', label: 'Ventes', desc: 'Recuperez les ventes perdues, augmentez votre CA.', icon: ShoppingBag },
  { id: 'ops', label: 'Operations', desc: 'Automatisez les taches repetitives de gestion.', icon: TrendingUp },
]

// 9 playbooks désactivés à afficher en teaser "Bientôt"
const COMING_SOON = [
  { name: 'anti_churn', label: 'Anti-churn', desc: 'Detecte les clients mecontents et lance une retention.', icon: Zap },
  { name: 'review_collector', label: 'Collecteur d\'avis', desc: 'Demande automatiquement un avis 7 jours apres livraison.', icon: Sparkles },
  { name: 'promo_code_handler', label: 'Code promo invalide', desc: 'Aide les clients dont le code promo ne fonctionne pas.', icon: Zap },
  { name: 'vip_customer_care', label: 'VIP Care', desc: 'Detecte vos meilleurs clients et les prioritise.', icon: Sparkles },
  { name: 'post_purchase_followup', label: 'Suivi post-achat', desc: 'Remerciement + conseils 3 jours apres commande.', icon: Mail },
  { name: 'winback_inactive', label: 'Winback', desc: 'Relance les clients inactifs depuis 60 jours.', icon: TrendingUp },
]

/* ═══════════ KPI HERO ═══════════ */

const KpiTile = ({ icon: Icon, label, value, sub }) => (
  <div className="relative bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/15">
    <div className="flex items-center gap-2 mb-2">
      <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <span className="text-[11px] font-semibold text-white/75 uppercase tracking-wider">{label}</span>
    </div>
    <div className="text-[24px] md:text-[28px] font-bold text-white leading-none tabular-nums">{value}</div>
    {sub && <div className="text-[11px] text-white/65 mt-1.5">{sub}</div>}
  </div>
)

/* ═══════════ AUTOMATION CARD ═══════════ */

const AutomationCard = ({
  automation,
  isActive,
  reqsMet,
  missingReqs,
  mainAction,
  mainActionLabel,
  mainActionDisabled,
  onOpenModal,
  channels,
  connectedProviders,
  onToggleChannel,
  onGoToIntegrations,
  metricLine,
  children,
}) => {
  const Icon = automation.icon
  const status = isActive ? 'active' : reqsMet ? 'ready' : 'missing'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`group rounded-2xl bg-white border shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] ${
        isActive ? 'border-cta/25' : 'border-[#f0f0f0]'
      }`}
    >
      <div className="p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${automation.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <Icon className="w-6 h-6 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[15px] font-bold text-[#1a1a1a] leading-tight">{automation.title}</h3>
                  {status === 'active' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cta/10 text-cta text-[10px] font-bold rounded-full uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-cta animate-pulse" /> Actif
                    </span>
                  )}
                  {status === 'missing' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                      A configurer
                    </span>
                  )}
                  {status === 'ready' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#fafafa] text-[#71717a] text-[10px] font-bold rounded-full uppercase tracking-wider">
                      Pret a activer
                    </span>
                  )}
                </div>
                <p className="text-[12px] font-semibold text-cta mt-0.5">{automation.tagline}</p>
              </div>
            </div>

            <p className="text-[13px] text-[#71717a] leading-relaxed mt-1">{automation.description}</p>

            {/* Missing integrations checklist */}
            {!reqsMet && missingReqs && missingReqs.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-[11px] font-semibold text-amber-900 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" /> Integrations requises
                </p>
                <ul className="space-y-1.5">
                  {missingReqs.map((m, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="text-[12px] text-amber-900 flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded border border-amber-400 inline-block" /> {m}
                      </span>
                      <button
                        onClick={onGoToIntegrations}
                        className="text-[11px] font-semibold text-amber-800 hover:text-amber-900 underline"
                      >
                        Connecter
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Metric line when active */}
            {isActive && metricLine && (
              <div className="mt-3 flex items-center gap-2 text-[11px] text-cta font-medium">
                <Activity className="w-3 h-3" /> {metricLine}
              </div>
            )}

            {/* Actions row */}
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <button
                onClick={mainAction}
                disabled={mainActionDisabled}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isActive
                    ? 'bg-white border border-[#f0f0f0] text-[#1a1a1a] hover:bg-[#fafafa]'
                    : 'bg-cta hover:bg-[#003725] text-white'
                }`}
              >
                {isActive ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> {mainActionLabel || 'Configurer'}</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" /> {mainActionLabel || 'Activer'}</>
                )}
              </button>
              <button
                onClick={onOpenModal}
                className="inline-flex items-center gap-1 px-3 py-2 text-[12px] font-semibold text-[#71717a] hover:text-[#1a1a1a] rounded-xl transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Comment ca marche ?
              </button>
            </div>
          </div>
        </div>

        {/* Channels section (rendered by parent) */}
        {children}
      </div>
    </motion.div>
  )
}

/* ═══════════ COMING SOON TEASER ═══════════ */

const ComingSoonCard = ({ item }) => {
  const Icon = item.icon
  return (
    <div className="rounded-2xl bg-[#fafafa] border border-dashed border-[#e5e5e5] p-4 opacity-80 hover:opacity-100 transition">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white border border-[#f0f0f0] flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-[#9ca3af]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[13px] font-semibold text-[#1a1a1a]">{item.label}</p>
            <span className="px-1.5 py-0.5 bg-white border border-[#e5e5e5] text-[9px] font-bold text-[#71717a] uppercase tracking-wider rounded-full">
              Bientot
            </span>
          </div>
          <p className="text-[11px] text-[#9ca3af] leading-relaxed">{item.desc}</p>
        </div>
      </div>
    </div>
  )
}

/* ═══════════ MAIN VIEW ═══════════ */

export const AutomationHubView = ({ clientId, theme, setActiveTab }) => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [showVocalWizard, setShowVocalWizard] = useState(false)
  const [showComptaWizard, setShowComptaWizard] = useState(false)
  const [readinessState, setReadinessState] = useState({ open: false, checks: [], playbookName: null, playbookLabel: null, activating: false })
  const [selectedChannels, setSelectedChannels] = useState({})
  const [modalKey, setModalKey] = useState(null)

  /* ---- Queries ---- */

  const { data: playbooks = [], isLoading: loadingPb } = useQuery({
    queryKey: ['playbooks-list'],
    queryFn: async () => {
      const { data } = await supabase.from('engine_playbooks').select('*').eq('is_active', true).order('display_name')
      return data || []
    },
  })

  const { data: clientPlaybooks = [] } = useQuery({
    queryKey: ['client-playbooks', clientId],
    queryFn: async () => {
      const { data } = await supabase.from('engine_client_playbooks').select('*').eq('client_id', clientId)
      return data || []
    },
    enabled: !!clientId,
  })

  const { data: connectedProviders = [] } = useQuery({
    queryKey: ['connected-providers', clientId],
    queryFn: async () => {
      const [intRes, shopRes] = await Promise.all([
        supabase.from('client_integrations').select('provider').eq('client_id', clientId).eq('status', 'active'),
        supabase.from('client_shopify_connections').select('id').eq('client_id', clientId).maybeSingle(),
      ])
      const providers = (intRes.data || []).map(i => i.provider)
      if (shopRes.data) providers.push('shopify')
      return providers
    },
    enabled: !!clientId,
  })

  // Client settings — email_agent_enabled flag
  const { data: clientSettings } = useQuery({
    queryKey: ['client-settings-automation', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_settings')
        .select('email_agent_enabled, hourly_cost')
        .eq('client_id', clientId)
        .maybeSingle()
      return data
    },
    enabled: !!clientId,
  })

  // Hero KPIs — weekly automation_events + monthly time saved
  const { data: heroStats } = useQuery({
    queryKey: ['automation-hero-stats', clientId],
    queryFn: async () => {
      const now = new Date()
      const startOfWeek = new Date(now)
      const day = now.getDay()
      const diffToMonday = day === 0 ? -6 : 1 - day
      startOfWeek.setDate(now.getDate() + diffToMonday)
      startOfWeek.setHours(0, 0, 0, 0)
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      const [weekEvents, monthEvents] = await Promise.all([
        supabase
          .from('automation_events')
          .select('event_category, time_saved_seconds')
          .eq('client_id', clientId)
          .eq('event_category', 'ticket_resolved')
          .gte('created_at', startOfWeek.toISOString()),
        supabase
          .from('automation_events')
          .select('time_saved_seconds')
          .eq('client_id', clientId)
          .eq('event_category', 'ticket_resolved')
          .gte('created_at', startOfMonth.toISOString()),
      ])
      const weekTickets = (weekEvents.data || []).length
      const monthSec = (monthEvents.data || []).reduce((s, e) => s + (Number(e.time_saved_seconds) || 0), 0)
      return {
        weekTickets,
        monthHours: Math.round((monthSec / 3600) * 10) / 10,
      }
    },
    enabled: !!clientId,
    refetchInterval: 60000, // refresh every minute
  })

  // Per-playbook weekly resolved count (for metric lines)
  const { data: perPbStats } = useQuery({
    queryKey: ['automation-per-pb-stats', clientId],
    queryFn: async () => {
      const now = new Date()
      const startOfWeek = new Date(now)
      const day = now.getDay()
      const diffToMonday = day === 0 ? -6 : 1 - day
      startOfWeek.setDate(now.getDate() + diffToMonday)
      startOfWeek.setHours(0, 0, 0, 0)
      const { data } = await supabase
        .from('automation_events')
        .select('playbook_name, event_category')
        .eq('client_id', clientId)
        .eq('event_category', 'ticket_resolved')
        .gte('created_at', startOfWeek.toISOString())
      const counts = {}
      ;(data || []).forEach(e => {
        if (!e.playbook_name) return
        counts[e.playbook_name] = (counts[e.playbook_name] || 0) + 1
      })
      return counts
    },
    enabled: !!clientId,
    refetchInterval: 60000,
  })

  /* ---- Derived state ---- */

  // Load saved channels from client_playbooks custom_config
  useEffect(() => {
    if (clientPlaybooks.length > 0 && playbooks.length > 0) {
      const saved = {}
      clientPlaybooks.forEach(cp => {
        const pb = playbooks.find(p => p.id === cp.playbook_id)
        if (pb && cp.custom_config?.channels) {
          cp.custom_config.channels.forEach(ch => {
            saved[`${pb.name}_${ch}`] = true
          })
        }
      })
      setSelectedChannels(prev => ({ ...prev, ...saved }))
    }
  }, [clientPlaybooks, playbooks])

  const isActivePlaybook = (name) => {
    const pb = playbooks.find(p => p.name === name)
    return pb ? clientPlaybooks.some(cp => cp.playbook_id === pb.id && cp.is_active) : false
  }

  const checkReqs = (meta) => {
    if (!meta?.requires || meta.requires.length === 0) return { met: true, missing: [] }
    const missing = []
    for (const req of meta.requires) {
      if (req.type === 'all' && !req.providers.every(p => connectedProviders.includes(p))) missing.push(req.label)
      if (req.type === 'any' && !req.providers.some(p => connectedProviders.includes(p))) missing.push(req.label)
    }
    return { met: missing.length === 0, missing }
  }

  // Build the full list of automations with status
  const automationList = useMemo(() => {
    const list = []
    // DB-driven
    for (const key of Object.keys(DB_AUTOMATIONS)) {
      const meta = DB_AUTOMATIONS[key]
      const pb = playbooks.find(p => p.name === key)
      if (!pb) continue // playbook not active in DB -> skip
      list.push({
        ...meta,
        key,
        title: pb.display_name || key,
        type: 'db',
        pb,
        active: isActivePlaybook(key),
        reqs: checkReqs(meta),
      })
    }
    // Feature-based
    for (const key of Object.keys(FEATURE_AUTOMATIONS)) {
      const meta = FEATURE_AUTOMATIONS[key]
      let active = false
      if (key === 'email_agent') active = !!clientSettings?.email_agent_enabled
      if (key === 'slack_copilot') active = connectedProviders.includes('slack')
      list.push({
        ...meta,
        key,
        title: key === 'email_agent' ? 'Email Agent' : 'Slack Copilot',
        type: 'feature',
        active,
        reqs: checkReqs(meta),
      })
    }
    return list
  }, [playbooks, clientPlaybooks, connectedProviders, clientSettings])

  const totalAvailable = automationList.length
  const activeCount = automationList.filter(a => a.active).length
  const weekTickets = heroStats?.weekTickets || 0
  const monthHours = heroStats?.monthHours || 0
  const hourlyCost = parseFloat(clientSettings?.hourly_cost) || 25
  const monthROI = Math.round(monthHours * hourlyCost)

  /* ---- Actions ---- */

  const goToIntegrations = () => setActiveTab && setActiveTab('integrations')

  const saveChannels = async (playbookName, channelId, isSelected) => {
    const pb = playbooks.find(p => p.name === playbookName)
    if (!pb) return
    const cp = clientPlaybooks.find(c => c.playbook_id === pb.id)
    const currentChannels = Object.entries(selectedChannels)
      .filter(([key, val]) => key.startsWith(`${playbookName}_`) && val)
      .map(([key]) => key.replace(`${playbookName}_`, ''))
    const newChannels = isSelected
      ? [...currentChannels, channelId]
      : currentChannels.filter(c => c !== channelId)

    // Side-effects (email agent enable, widget install) — matches PlaybooksView
    if (channelId === 'email' && isSelected) {
      try {
        // Enable the native email agent (cron-based IMAP/Gmail polling).
        // Remplace l'ancien setup-email-polling n8n.
        await supabase.from('client_settings')
          .update({ email_agent_enabled: true, updated_at: new Date().toISOString() })
          .eq('client_id', clientId)
      } catch {}
    }
    if (channelId === 'widget' && isSelected) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const widgetRes = await fetch('/api/engine/shopify-widget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ action: 'install', client_id: clientId }),
        })
        if (widgetRes.ok) toast.success('Widget chat installe sur votre boutique Shopify !')
      } catch {}
    }
    if (channelId === 'widget' && !isSelected) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/engine/shopify-widget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ action: 'uninstall', client_id: clientId }),
        })
      } catch {}
    }

    if (cp) {
      await supabase.from('engine_client_playbooks').update({
        custom_config: { ...(cp.custom_config || {}), channels: newChannels },
        updated_at: new Date().toISOString(),
      }).eq('id', cp.id)
    } else {
      await supabase.from('engine_client_playbooks').insert({
        client_id: clientId, playbook_id: pb.id, is_active: false, custom_config: { channels: newChannels },
      })
    }
    queryClient.invalidateQueries({ queryKey: ['client-playbooks', clientId] })
  }

  const handleTogglePlaybook = async (automation) => {
    const { key: playbookName, pb } = automation
    const meta = DB_AUTOMATIONS[playbookName]
    if (!pb || !meta) return
    const reqs = checkReqs(meta)
    if (!reqs.met) {
      toast.error(`Connectez d'abord : ${reqs.missing.join(', ')}`)
      return
    }

    // Plan limit check
    const currentlyActivePlaybook = clientPlaybooks.find(cp => cp.playbook_id === pb.id)
    if (!currentlyActivePlaybook?.is_active) {
      try {
        const { getPlanConfig, getLimit } = await import('../../lib/plans.js')
        const { data: clientRow } = await supabase.from('clients').select('plan').eq('id', clientId).maybeSingle()
        const plan = clientRow?.plan || 'free'
        const workflowLimit = getLimit(plan, 'workflows_active')
        const activeCountNow = clientPlaybooks.filter(cp => cp.is_active).length
        if (workflowLimit !== Infinity && activeCountNow >= workflowLimit) {
          const planName = getPlanConfig(plan).name
          toast.error(`Limite atteinte : ${workflowLimit} workflow${workflowLimit > 1 ? 's' : ''} actif${workflowLimit > 1 ? 's' : ''} sur le plan ${planName}. Passez au plan superieur.`)
          return
        }
      } catch { /* skip */ }
    }

    // Open wizards
    if (meta.hasWizard === 'compta' && !isActivePlaybook(playbookName)) {
      setShowComptaWizard(true)
      return
    }
    if (meta.hasWizard === 'vocal' && !isActivePlaybook(playbookName)) {
      setShowVocalWizard(true)
      return
    }

    const existing = clientPlaybooks.find(cp => cp.playbook_id === pb.id)
    const currentlyActive = existing?.is_active || false

    if (!currentlyActive) {
      try {
        const checks = await buildReadinessChecks({
          clientId,
          playbookName,
          custom_config: existing?.custom_config || {},
        })
        setReadinessState({
          open: true,
          checks,
          playbookName,
          playbookLabel: automation.tagline,
          playbookId: pb.id,
          existing,
          activating: false,
        })
        return
      } catch (err) {
        console.error('[readiness] check failed:', err)
      }
    }

    // Deactivation path
    if (existing) {
      await supabase.from('engine_client_playbooks').update({
        is_active: !currentlyActive,
        [!currentlyActive ? 'activated_at' : 'deactivated_at']: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await supabase.from('engine_client_playbooks').insert({
        client_id: clientId, playbook_id: pb.id, is_active: true, activated_at: new Date().toISOString(),
      })
    }
    queryClient.invalidateQueries({ queryKey: ['client-playbooks', clientId] })

    if (currentlyActive) {
      const hasWidget = Object.entries(selectedChannels).some(([key, val]) => key.startsWith(`${playbookName}_widget`) && val)
      if (hasWidget) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          await fetch('/api/engine/shopify-widget', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
            body: JSON.stringify({ action: 'uninstall', client_id: clientId }),
          })
        } catch {}
      }
    }

    toast.success(!currentlyActive ? `"${pb.display_name}" active` : `"${pb.display_name}" desactive`)
  }

  const handleFeatureAction = (automation) => {
    if (automation.key === 'email_agent') {
      setActiveTab && setActiveTab('email-agent')
      return
    }
    if (automation.key === 'slack_copilot') {
      setActiveTab && setActiveTab('integrations')
      return
    }
  }

  /* ---- Rendering helpers ---- */

  const renderCategorySection = (catId) => {
    const catMeta = CATEGORIES.find(c => c.id === catId)
    const items = automationList.filter(a => a.category === catId)
    if (items.length === 0) return null
    const CatIcon = catMeta.icon

    return (
      <section key={catId} className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white border border-[#f0f0f0] flex items-center justify-center">
            <CatIcon className="w-4 h-4 text-[#1a1a1a]" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-[#1a1a1a]">{catMeta.label}</h2>
            <p className="text-[11px] text-[#9ca3af]">{catMeta.desc}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {items.map(automation => {
            const active = automation.active
            const reqsMet = automation.reqs.met
            const weeklyTickets = perPbStats?.[automation.key] || 0
            const metricLine = active && weeklyTickets > 0
              ? `${weeklyTickets} demande${weeklyTickets > 1 ? 's' : ''} traitee${weeklyTickets > 1 ? 's' : ''} cette semaine`
              : null

            const cardCommon = {
              automation,
              isActive: active,
              reqsMet,
              missingReqs: automation.reqs.missing,
              connectedProviders,
              onOpenModal: () => setModalKey(automation.modalKey),
              onGoToIntegrations: goToIntegrations,
              metricLine,
            }

            if (automation.type === 'feature') {
              return (
                <AutomationCard
                  key={automation.key}
                  {...cardCommon}
                  mainAction={() => handleFeatureAction(automation)}
                  mainActionLabel={active ? 'Configurer' : 'Configurer'}
                  mainActionDisabled={!reqsMet}
                />
              )
            }

            // DB playbook -> render toggle + channels
            return (
              <AutomationCard
                key={automation.key}
                {...cardCommon}
                mainAction={() => handleTogglePlaybook(automation)}
                mainActionLabel={active ? 'Desactiver' : 'Activer'}
                mainActionDisabled={!reqsMet}
              >
                {active && automation.channels && automation.channels.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#f0f0f0]">
                    <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider mb-2.5">Canaux actifs</p>
                    <div className="space-y-2">
                      {automation.channels.map(ch => {
                        const ChIcon = ch.icon || MessageSquare
                        const channelConnected = ch.needsIntegration.length === 0 || ch.needsIntegration.some(p => connectedProviders.includes(p))
                        const isSelected = !!selectedChannels[`${automation.key}_${ch.id}`]
                        return (
                          <div
                            key={ch.id}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                              isSelected ? 'bg-cta/5 border-cta/20' : 'bg-white border-[#f0f0f0]'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'bg-cta text-white' : 'bg-[#fafafa] text-[#9ca3af]'
                            }`}>
                              <ChIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold text-[#1a1a1a]">{ch.label}</p>
                              <p className="text-[10px] text-[#9ca3af] mt-0.5">{ch.desc}</p>
                            </div>
                            {!channelConnected ? (
                              <button
                                onClick={goToIntegrations}
                                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-amber-700 bg-amber-50 rounded-full hover:bg-amber-100 transition-colors flex-shrink-0"
                              >
                                <Plug className="w-2.5 h-2.5" /> Connecter
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  const newVal = !isSelected
                                  setSelectedChannels(prev => ({ ...prev, [`${automation.key}_${ch.id}`]: newVal }))
                                  saveChannels(automation.key, ch.id, newVal)
                                }}
                                className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${isSelected ? 'bg-cta' : 'bg-[#e5e5e5]'}`}
                              >
                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isSelected ? 'translate-x-4' : 'translate-x-0.5'}`} />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Email recommendation for sav_ecommerce with widget but no email */}
                    {automation.key === 'sav_ecommerce' && selectedChannels[`${automation.key}_widget`] && !connectedProviders.includes('smtp_imap') && !connectedProviders.includes('gmail') && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                        <div className="flex items-start gap-2.5">
                          <Mail className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-[12px] font-semibold text-blue-900">Recommandation : connectez votre email</p>
                            <p className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
                              Quand un client agressif demande un suivi, l&apos;IA lui demande son email. En connectant votre SMTP/IMAP, les reponses dans &quot;A traiter&quot; seront envoyees <strong>depuis votre adresse pro</strong>.
                            </p>
                            <button
                              onClick={goToIntegrations}
                              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                            >
                              <Plug className="w-3 h-3" /> Connecter mon email
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </AutomationCard>
            )
          })}
        </div>
      </section>
    )
  }

  /* ---- Render ---- */

  if (loadingPb) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" />
      </div>
    )
  }

  const activeModalAutomation = modalKey
    ? automationList.find(a => a.modalKey === modalKey)
    : null

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 pt-6 pb-16 animate-fade-in-up">
      {/* ═══════ HERO ═══════ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cta via-cta to-[#003725] text-white p-6 md:p-10 mb-8"
      >
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-300/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Rocket className="w-4 h-4 text-white" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/80">Automatisations</span>
            <span className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur rounded-full text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" /> Votre agent travaille 24/7
            </span>
          </div>

          <h1 className="text-[28px] md:text-[38px] font-bold tracking-tight mb-3 leading-[1.1]">
            Votre boutique tourne sans vous. 24h/24.
          </h1>
          <p className="text-[14px] md:text-[15px] text-white/80 max-w-2xl leading-relaxed mb-6 md:mb-8">
            Chaque automation ci-dessous prend en charge un pan entier de votre operationnel. Activez en 1 clic, configurez au besoin.
          </p>

          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiTile
              icon={Bot}
              label="Actives"
              value={`${activeCount}/${totalAvailable}`}
              sub={activeCount === 0 ? 'Activez votre premiere' : 'Automatisations actives'}
            />
            <KpiTile
              icon={Activity}
              label="Cette semaine"
              value={weekTickets}
              sub={`${weekTickets === 1 ? 'demande traitee' : 'demandes traitees'}`}
            />
            <KpiTile
              icon={Clock}
              label="Ce mois"
              value={`${monthHours}h`}
              sub="Heures economisees"
            />
            <KpiTile
              icon={DollarSign}
              label="ROI"
              value={`${monthROI.toLocaleString('fr-FR')}€`}
              sub="Valeur generee ce mois"
            />
          </div>
        </div>
      </motion.div>

      {/* ═══════ CATEGORIES ═══════ */}
      <div className="space-y-10">
        {CATEGORIES.map(c => renderCategorySection(c.id))}

        {/* Coming soon teaser */}
        <section className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white border border-[#f0f0f0] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#9ca3af]" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#1a1a1a]">Plus d&apos;automations</h2>
              <p className="text-[11px] text-[#9ca3af]">En developpement, disponibles bientot sur votre workspace.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {COMING_SOON.map(item => <ComingSoonCard key={item.name} item={item} />)}
          </div>
        </section>
      </div>

      {/* ═══════ MODALS / WIZARDS ═══════ */}

      <AutomationHowItWorksModal
        automationKey={modalKey}
        isOpen={!!modalKey}
        onClose={() => setModalKey(null)}
        isActive={activeModalAutomation?.active || false}
        reqsMet={activeModalAutomation?.reqs?.met ?? true}
        connectedProviders={connectedProviders}
        onActivate={() => {
          if (!activeModalAutomation) return
          if (activeModalAutomation.type === 'feature') handleFeatureAction(activeModalAutomation)
          else handleTogglePlaybook(activeModalAutomation)
        }}
        onViewStats={() => setActiveTab && setActiveTab('insights')}
        onGoToIntegrations={goToIntegrations}
      />

      <WorkflowReadinessCheck
        isOpen={readinessState.open}
        onClose={() => setReadinessState((s) => ({ ...s, open: false }))}
        onConfirm={async () => {
          const { existing, playbookId } = readinessState
          setReadinessState((s) => ({ ...s, activating: true }))
          try {
            if (existing) {
              await supabase.from('engine_client_playbooks').update({
                is_active: true,
                activated_at: new Date().toISOString(),
              }).eq('id', existing.id)
            } else {
              await supabase.from('engine_client_playbooks').insert({
                client_id: clientId, playbook_id: playbookId, is_active: true, activated_at: new Date().toISOString(),
              })
            }
            queryClient.invalidateQueries({ queryKey: ['client-playbooks', clientId] })
            toast.success('Workflow active !')
          } catch (err) {
            toast.error('Erreur: ' + err.message)
          }
          setReadinessState({ open: false, checks: [], playbookName: null, playbookLabel: null, activating: false })
        }}
        setActiveTab={setActiveTab}
        checks={readinessState.checks}
        playbookLabel={readinessState.playbookLabel}
        loading={readinessState.activating}
      />

      {showComptaWizard && (
        <ComptabiliteWizard
          clientId={clientId}
          connectedProviders={connectedProviders}
          onComplete={() => {
            setShowComptaWizard(false)
            const pb = playbooks.find(p => p.name === 'comptabilite_auto')
            if (pb) {
              supabase.from('engine_client_playbooks').upsert({
                client_id: clientId, playbook_id: pb.id, is_active: true, activated_at: new Date().toISOString(),
              }, { onConflict: 'client_id,playbook_id' }).then(() => {
                queryClient.invalidateQueries({ queryKey: ['client-playbooks', clientId] })
              })
            }
            toast.success('Comptabilite automatisee configuree et activee !')
          }}
          onCancel={() => setShowComptaWizard(false)}
        />
      )}

      {showVocalWizard && (
        <VocalAgentWizard
          clientId={clientId}
          onComplete={() => {
            setShowVocalWizard(false)
            const pb = playbooks.find(p => p.name === 'agent_vocal')
            if (pb) {
              supabase.from('engine_client_playbooks').upsert({
                client_id: clientId,
                playbook_id: pb.id,
                is_active: true,
                activated_at: new Date().toISOString(),
              }, { onConflict: 'client_id,playbook_id' }).then(() => {
                queryClient.invalidateQueries({ queryKey: ['client-playbooks', clientId] })
              })
            }
            toast.success('Agent vocal configure et installe !')
          }}
          onCancel={() => setShowVocalWizard(false)}
        />
      )}
    </div>
  )
}
