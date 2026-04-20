import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Rocket, Sparkles, ShoppingBag, Headphones, Loader2, CheckCircle2,
  AlertTriangle, Plug, Phone, Mail, MessageSquare, TrendingUp, ArrowRight,
  Activity, Info, Zap,
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

/* ═══════════ HEADER STRIP ═══════════ */

/**
 * AutomationHubHeader — strip compact en haut de la surface.
 *
 * Remplace le hero gradient (40% de la fold) par un bandeau blanc
 * cohérent avec Overview refondu : titre + résumé status + 3 KPIs inline.
 */
const AutomationHubHeader = ({ activeCount, totalAvailable, weekTickets, monthHours, monthROI }) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 mb-5">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-lg bg-cta/10 flex items-center justify-center">
            <Rocket className="w-3.5 h-3.5 text-cta" />
          </div>
          <h1 className="text-lg font-bold text-[#1a1a1a]">Automations</h1>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-cta/10 text-cta text-[10px] font-bold rounded-full uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-cta animate-pulse" />
            {activeCount}/{totalAvailable} actives
          </span>
        </div>
        <p className="text-[13px] text-[#71717a] leading-relaxed">
          Votre agent prend en charge un pan entier de l&apos;opérationnel. Activez en 1 clic.
        </p>
      </div>
      <div className="flex items-center gap-4 md:gap-6 flex-wrap">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Cette semaine</span>
          <span className="text-lg font-bold text-[#1a1a1a] tabular-nums leading-tight">{weekTickets}</span>
          <span className="text-[10px] text-[#9ca3af]">{weekTickets === 1 ? 'demande' : 'demandes'}</span>
        </div>
        <div className="w-px h-10 bg-gray-200" />
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Ce mois</span>
          <span className="text-lg font-bold text-[#1a1a1a] tabular-nums leading-tight">{monthHours}h</span>
          <span className="text-[10px] text-[#9ca3af]">économisées</span>
        </div>
        <div className="w-px h-10 bg-gray-200" />
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">ROI mois</span>
          <span className="text-lg font-bold text-cta tabular-nums leading-tight">{monthROI.toLocaleString('fr-FR')}€</span>
          <span className="text-[10px] text-[#9ca3af]">valeur générée</span>
        </div>
      </div>
    </div>
  </div>
)

/* ═══════════ FILTER TABS ═══════════ */

/**
 * AutomationFilters — tabs filtres state-based.
 *
 * 4 filtres : Toutes / Actives / Prêtes / À configurer. Le compte
 * entre parenthèses est mis à jour en temps réel via la source automationList.
 */
const AutomationFilters = ({ activeFilter, setActiveFilter, counts }) => {
  const filters = [
    { id: 'all', label: 'Toutes', count: counts.all },
    { id: 'active', label: 'Actives', count: counts.active },
    { id: 'ready', label: 'Prêtes', count: counts.ready },
    { id: 'missing', label: 'À configurer', count: counts.missing },
  ]
  return (
    <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
      {filters.map(f => {
        const isActive = activeFilter === f.id
        return (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-[#1a1a1a] text-white'
                : 'bg-white border border-gray-200 text-[#71717a] hover:bg-[#fafafa]'
            }`}
          >
            {f.label}
            <span className={`tabular-nums text-[11px] ${isActive ? 'text-white/70' : 'text-[#9ca3af]'}`}>
              {f.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ═══════════ STATUS BADGE (shared) ═══════════ */

/**
 * StatusBadge — badge semantic avec icon (pas de color-only, WCAG).
 */
const StatusBadge = ({ status }) => {
  if (status === 'active') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cta/10 text-cta text-[10px] font-bold rounded-full uppercase tracking-wider">
      <CheckCircle2 className="w-2.5 h-2.5" /> Active
    </span>
  )
  if (status === 'ready') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full uppercase tracking-wider border border-blue-100">
      <Sparkles className="w-2.5 h-2.5" /> Prête
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-wider border border-amber-100">
      <AlertTriangle className="w-2.5 h-2.5" /> À configurer
    </span>
  )
}

/* ═══════════ AUTOMATION CARD (refondu) ═══════════ */

/**
 * AutomationCard — carte dense, channels preview toujours visible.
 *
 * Changements vs ancienne version :
 * — Gradient icon container → icon flat avec accent subtil (cohérence)
 * — Status badges renforcés (icon + bordure, pas de color-only)
 * — Channels preview : pills visibles dès le state "ready" (pas que "active")
 * — "Détails" link simple vs "Comment ça marche ?" modal redondant
 * — Densité : 1 seul CTA primary, 1 link secondary
 */
const AutomationCard = ({
  automation,
  isActive,
  reqsMet,
  missingReqs,
  mainAction,
  mainActionLabel,
  mainActionDisabled,
  onOpenModal,
  connectedProviders,
  selectedChannels,
  saveChannels,
  onGoToIntegrations,
  weeklyTickets,
}) => {
  const Icon = automation.icon
  const status = isActive ? 'active' : reqsMet ? 'ready' : 'missing'
  const hasChannels = automation.channels && automation.channels.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`rounded-2xl bg-white border transition-colors ${
        isActive ? 'border-cta/30 shadow-[0_1px_3px_rgba(0,55,37,0.04)]' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="p-5">
        {/* Header row — icon + title + status */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${automation.gradient} flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-[14px] font-bold text-[#1a1a1a] leading-tight">{automation.title}</h3>
                <p className="text-[12px] text-[#71717a] mt-0.5 leading-tight">{automation.tagline}</p>
              </div>
              <StatusBadge status={status} />
            </div>
          </div>
        </div>

        {/* Metric line when active */}
        {isActive && weeklyTickets > 0 && (
          <div className="mb-3 flex items-center gap-1.5 text-[11px] text-cta font-semibold">
            <Activity className="w-3 h-3" />
            {weeklyTickets} demande{weeklyTickets > 1 ? 's' : ''} traitée{weeklyTickets > 1 ? 's' : ''} cette semaine
          </div>
        )}

        {/* Missing integrations */}
        {status === 'missing' && missingReqs && missingReqs.length > 0 && (
          <div className="mb-3 p-2.5 rounded-lg bg-amber-50 border border-amber-100">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-amber-900 mb-1">
                  Intégrations requises : {missingReqs.join(', ')}
                </p>
                <button
                  onClick={onGoToIntegrations}
                  className="text-[11px] font-semibold text-amber-800 hover:text-amber-900 underline"
                >
                  Connecter →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Channels preview — toujours visible pour les cards ready+active */}
        {hasChannels && status !== 'missing' && (
          <div className="mb-3">
            <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1.5">
              {isActive ? 'Canaux actifs' : 'Canaux disponibles'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {automation.channels.map(ch => {
                const ChIcon = ch.icon || MessageSquare
                const channelConnected = ch.needsIntegration.length === 0
                  || ch.needsIntegration.some(p => connectedProviders.includes(p))
                const isSelected = !!selectedChannels[`${automation.key}_${ch.id}`]
                const canToggle = isActive && channelConnected

                if (!channelConnected) {
                  return (
                    <button
                      key={ch.id}
                      onClick={onGoToIntegrations}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#fafafa] border border-dashed border-gray-300 text-[11px] font-medium text-[#71717a] hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 transition-colors"
                      title={`Connecter ${ch.label}`}
                    >
                      <Plug className="w-3 h-3" />
                      {ch.label}
                    </button>
                  )
                }

                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      if (!canToggle) return
                      const newVal = !isSelected
                      saveChannels(automation.key, ch.id, newVal)
                    }}
                    disabled={!canToggle}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      isSelected
                        ? 'bg-cta text-white border border-cta'
                        : canToggle
                          ? 'bg-white border border-gray-200 text-[#71717a] hover:border-cta hover:text-cta'
                          : 'bg-[#fafafa] border border-gray-200 text-[#9ca3af] cursor-not-allowed'
                    }`}
                    title={canToggle ? (isSelected ? 'Désactiver ce canal' : 'Activer ce canal') : 'Activez l\'automation pour configurer'}
                  >
                    <ChIcon className="w-3 h-3" />
                    {ch.label}
                    {isSelected && <CheckCircle2 className="w-2.5 h-2.5" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Actions — primary + link */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <button
            onClick={mainAction}
            disabled={mainActionDisabled}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isActive
                ? 'bg-white border border-gray-200 text-[#1a1a1a] hover:bg-[#fafafa]'
                : 'bg-cta hover:bg-[#003725] text-white'
            }`}
          >
            {isActive ? 'Désactiver' : mainActionLabel || 'Activer'}
            {!isActive && <ArrowRight className="w-3 h-3" />}
          </button>
          <button
            onClick={onOpenModal}
            className="text-[11px] font-semibold text-[#71717a] hover:text-[#1a1a1a] underline decoration-dotted underline-offset-4"
          >
            Détails
          </button>
        </div>
      </div>
    </motion.div>
  )
}

/* ═══════════ COMING SOON (moved to modal) ═══════════ */

/**
 * ComingSoonModal — les 6 automations en dev, accessibles depuis un pill
 * footer discret. Avant : 9 cartes empilées sur la page (noise).
 */
const ComingSoonModal = ({ isOpen, onClose, items }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full md:max-w-xl md:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
        >
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-bold text-[#1a1a1a]">Automations en développement</h3>
              <p className="text-[12px] text-[#9ca3af] mt-0.5">{items.length} automations arrivent prochainement.</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-[#fafafa] flex items-center justify-center"
              aria-label="Fermer"
            >
              <span className="text-xl text-[#9ca3af]">×</span>
            </button>
          </div>
          <div className="p-5 overflow-y-auto space-y-2">
            {items.map(item => {
              const Icon = item.icon
              return (
                <div key={item.name} className="flex items-start gap-3 p-3 rounded-xl bg-[#fafafa] border border-gray-200">
                  <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[#9ca3af]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#1a1a1a]">{item.label}</p>
                    <p className="text-[11px] text-[#71717a] mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
)

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

  /* ---- Filter state + derived counts ---- */

  const [activeFilter, setActiveFilter] = useState('all')
  const [showComingSoonModal, setShowComingSoonModal] = useState(false)

  const filterCounts = useMemo(() => ({
    all: automationList.length,
    active: automationList.filter(a => a.active).length,
    ready: automationList.filter(a => !a.active && a.reqs.met).length,
    missing: automationList.filter(a => !a.active && !a.reqs.met).length,
  }), [automationList])

  const visibleAutomations = useMemo(() => {
    if (activeFilter === 'all') return automationList
    if (activeFilter === 'active') return automationList.filter(a => a.active)
    if (activeFilter === 'ready') return automationList.filter(a => !a.active && a.reqs.met)
    if (activeFilter === 'missing') return automationList.filter(a => !a.active && !a.reqs.met)
    return automationList
  }, [automationList, activeFilter])

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
      {/* ═══════ HEADER STRIP ═══════ */}
      <AutomationHubHeader
        activeCount={activeCount}
        totalAvailable={totalAvailable}
        weekTickets={weekTickets}
        monthHours={monthHours}
        monthROI={monthROI}
      />

      {/* ═══════ FILTERS ═══════ */}
      <AutomationFilters
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        counts={filterCounts}
      />

      {/* ═══════ AUTOMATIONS GRID ═══════ */}
      {visibleAutomations.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#fafafa] mx-auto mb-3 flex items-center justify-center">
            <Info className="w-5 h-5 text-[#9ca3af]" />
          </div>
          <p className="text-[14px] font-semibold text-[#1a1a1a] mb-1">Aucune automation dans ce filtre</p>
          <p className="text-[12px] text-[#71717a]">
            Changez de filtre ou activez une nouvelle automation.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleAutomations.map(automation => {
            const active = automation.active
            const reqsMet = automation.reqs.met
            const weeklyTickets = perPbStats?.[automation.key] || 0
            const isFeature = automation.type === 'feature'
            return (
              <AutomationCard
                key={automation.key}
                automation={automation}
                isActive={active}
                reqsMet={reqsMet}
                missingReqs={automation.reqs.missing}
                connectedProviders={connectedProviders}
                selectedChannels={selectedChannels}
                saveChannels={saveChannels}
                onOpenModal={() => setModalKey(automation.modalKey)}
                onGoToIntegrations={goToIntegrations}
                weeklyTickets={weeklyTickets}
                mainAction={() => isFeature ? handleFeatureAction(automation) : handleTogglePlaybook(automation)}
                mainActionLabel={isFeature ? 'Configurer' : (active ? 'Désactiver' : 'Activer')}
                mainActionDisabled={!reqsMet && !isFeature}
              />
            )
          })}
        </div>
      )}

      {/* ═══════ COMING SOON FOOTER LINK ═══════ */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={() => setShowComingSoonModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 hover:border-gray-300 text-[12px] font-semibold text-[#71717a] hover:text-[#1a1a1a] transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {COMING_SOON.length} automations en développement
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* ═══════ MODALS / WIZARDS ═══════ */}

      <ComingSoonModal
        isOpen={showComingSoonModal}
        onClose={() => setShowComingSoonModal(false)}
        items={COMING_SOON}
      />

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
