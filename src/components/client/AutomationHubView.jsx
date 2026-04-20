import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Rocket, Sparkles, ShoppingBag, Headphones, Loader2, CheckCircle2,
  AlertTriangle, Plug, Mail, MessageSquare, ArrowRight,
  Activity,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import { WorkflowReadinessCheck } from './WorkflowReadinessCheck'
import { buildReadinessChecks } from '../../lib/workflow-readiness'
import { AutomationHowItWorksModal } from './AutomationHowItWorksModal'

/* ═══════════ AUTOMATION CATALOG ═══════════ */

/**
 * 2 automations actives (avril 2026) : SAV e-commerce + Relance paniers.
 * Les features `capabilities` (ajoutées dans cette refonte) listent 3-4
 * actions que l'agent réalise concrètement — elles remplacent la description
 * texte unique par des bullets scannables au regard.
 */
const DB_AUTOMATIONS = {
  sav_ecommerce: {
    icon: Headphones,
    gradient: 'from-emerald-500 to-emerald-600',
    accent: 'emerald',
    tagline: 'Répond en 30 sec aux demandes SAV',
    description: 'L\'agent lit, comprend et répond à vos clients avec votre ton de marque et les données Shopify réelles.',
    modalKey: 'sav_ecommerce',
    requires: [],
    capabilities: [
      'Lit emails, chats et tickets entrants en continu',
      'Répond avec votre ton de marque et votre FAQ',
      'Accède au suivi de commande Shopify en temps réel',
      'Escalade intelligemment les cas complexes vers « À traiter »',
    ],
    channels: [
      { id: 'email', label: 'Email', desc: 'Répond aux emails entrants', icon: Mail, needsIntegration: ['gmail', 'smtp_imap'] },
      { id: 'widget', label: 'Chat sur le site', desc: 'Widget de chat sur votre boutique Shopify', icon: MessageSquare, needsIntegration: ['shopify'] },
      { id: 'gorgias', label: 'Gorgias', desc: 'Répond aux tickets Gorgias', icon: Headphones, needsIntegration: ['gorgias'] },
      { id: 'zendesk', label: 'Zendesk', desc: 'Répond aux tickets Zendesk', icon: Headphones, needsIntegration: ['zendesk'] },
    ],
  },
  abandoned_cart: {
    icon: ShoppingBag,
    gradient: 'from-amber-500 to-amber-600',
    accent: 'amber',
    tagline: 'Récupère les ventes perdues',
    description: 'Détecte les paniers abandonnés et lance une séquence email personnalisée (1h / 24h / 72h) avec CTA retour panier.',
    modalKey: 'abandoned_cart',
    requires: [{ type: 'all', providers: ['shopify'], label: 'Shopify' }],
    capabilities: [
      'Détecte les paniers abandonnés en temps réel',
      'Envoie 3 relances personnalisées (1h, 24h, 72h)',
      'Inclut le CTA retour panier + un incentive optionnel',
      'Expédié depuis votre domaine pour éviter les spams',
    ],
    channels: [
      { id: 'email', label: 'Email', desc: 'Envoie un email de relance panier depuis votre domaine', icon: Mail, needsIntegration: ['smtp_imap', 'gmail'] },
    ],
  },
}

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
      <div className="p-6">
        {/* Header row — icon 48px + title + status */}
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${automation.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-[16px] font-bold text-[#1a1a1a] leading-tight">{automation.title}</h3>
              <StatusBadge status={status} />
            </div>
            <p className="text-[13px] text-cta font-semibold leading-tight">{automation.tagline}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-[12.5px] text-[#71717a] leading-relaxed mb-4">{automation.description}</p>

        {/* Capabilities — ce que l'agent fait concrètement */}
        {automation.capabilities && automation.capabilities.length > 0 && (
          <div className="mb-4 space-y-1.5">
            {automation.capabilities.map((cap, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px] text-[#1a1a1a]">
                <CheckCircle2 className="w-3.5 h-3.5 text-cta flex-shrink-0 mt-0.5" />
                <span className="leading-snug">{cap}</span>
              </div>
            ))}
          </div>
        )}

        {/* Metric line when active */}
        {isActive && weeklyTickets > 0 && (
          <div className="mb-4 p-2.5 rounded-lg bg-cta/5 border border-cta/10 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-cta flex-shrink-0" />
            <span className="text-[12px] text-cta font-semibold">
              {weeklyTickets} demande{weeklyTickets > 1 ? 's' : ''} traitée{weeklyTickets > 1 ? 's' : ''} cette semaine
            </span>
          </div>
        )}

        {/* Missing integrations */}
        {status === 'missing' && missingReqs && missingReqs.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-amber-900 mb-1">
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

        {/* Channels — liste avec toggle switches explicites */}
        {hasChannels && status !== 'missing' && (
          <div className="mb-4 pt-4 border-t border-gray-100">
            <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider mb-2">
              Canaux {isActive ? '(activez ceux à utiliser)' : '(disponibles)'}
            </p>
            <div className="space-y-1.5">
              {automation.channels.map(ch => {
                const ChIcon = ch.icon || MessageSquare
                const channelConnected = ch.needsIntegration.length === 0
                  || ch.needsIntegration.some(p => connectedProviders.includes(p))
                const isSelected = !!selectedChannels[`${automation.key}_${ch.id}`]
                const canToggle = isActive && channelConnected

                // Channel non-connecté : affiche "Connecter" au lieu du toggle
                if (!channelConnected) {
                  return (
                    <div
                      key={ch.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#fafafa] border border-dashed border-gray-300"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChIcon className="w-3.5 h-3.5 text-[#9ca3af] flex-shrink-0" />
                        <span className="text-[12px] font-medium text-[#71717a] truncate">{ch.label}</span>
                      </div>
                      <button
                        onClick={onGoToIntegrations}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-amber-200 text-[10px] font-bold text-amber-700 hover:bg-amber-50 transition-colors flex-shrink-0 uppercase tracking-wider"
                      >
                        <Plug className="w-2.5 h-2.5" />
                        Connecter
                      </button>
                    </div>
                  )
                }

                // Channel connecté : row cliquable sur toute la largeur + toggle visuel
                // Toute la row déclenche le toggle → affordance maximale (pas besoin
                // de viser précisément le switch 42×22px).
                const handleToggleClick = () => {
                  if (!canToggle) return
                  saveChannels(automation.key, ch.id, !isSelected)
                }
                return (
                  <button
                    key={ch.id}
                    type="button"
                    role="switch"
                    aria-checked={isSelected}
                    aria-label={`${isSelected ? 'Désactiver' : 'Activer'} le canal ${ch.label}`}
                    onClick={handleToggleClick}
                    disabled={!canToggle}
                    title={canToggle ? (isSelected ? 'Désactiver ce canal' : 'Activer ce canal') : 'Activez l\'automation pour configurer'}
                    className={`group w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                      isSelected
                        ? 'bg-cta/5 border-cta/25 hover:bg-cta/10'
                        : canToggle
                          ? 'bg-white border-gray-200 hover:border-cta/30 hover:bg-[#fafafa]'
                          : 'bg-[#fafafa] border-gray-200 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ChIcon className={`w-4 h-4 flex-shrink-0 transition-colors ${isSelected ? 'text-cta' : 'text-[#9ca3af]'}`} />
                      <span className={`text-[12.5px] font-medium truncate transition-colors ${isSelected ? 'text-[#1a1a1a]' : 'text-[#71717a]'}`}>
                        {ch.label}
                      </span>
                    </div>
                    {/* Toggle switch — 42×22 avec thumb 18px qui glisse */}
                    <span
                      aria-hidden="true"
                      className={`relative w-[42px] h-[22px] rounded-full transition-colors flex-shrink-0 ${
                        isSelected
                          ? 'bg-cta shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]'
                          : 'bg-[#d4d4d8] group-hover:bg-[#a1a1aa]'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)] transition-transform duration-200 ease-out ${
                          isSelected ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Actions — primary + link */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            onClick={mainAction}
            disabled={mainActionDisabled}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isActive
                ? 'bg-white border border-gray-200 text-[#1a1a1a] hover:bg-[#fafafa]'
                : 'bg-cta hover:bg-[#003725] text-white'
            }`}
          >
            {isActive ? 'Désactiver' : mainActionLabel || 'Activer'}
            {!isActive && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onOpenModal}
            className="text-[12px] font-semibold text-[#71717a] hover:text-[#1a1a1a] underline decoration-dotted underline-offset-4"
          >
            Détails
          </button>
        </div>
      </div>
    </motion.div>
  )
}

/* ═══════════ MAIN VIEW ═══════════ */

export const AutomationHubView = ({ clientId, theme, setActiveTab }) => {
  const toast = useToast()
  const queryClient = useQueryClient()
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

  // Load saved channels from client_playbooks custom_config.
  // NOTE : on remplace complètement l'objet — avant on mergeait, ce qui
  // empêchait les toggles OFF d'être reflétés après refetch (une clé mise
  // à false restait true dans l'état local). Set full map = source of truth.
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
      setSelectedChannels(saved)
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

  /**
   * saveChannels — écrit un toggle de canal en base + optimistic update
   * local. Applique aussi les side-effects (widget install/uninstall,
   * email agent enable).
   *
   * Optimistic : setSelectedChannels immédiat avant le round-trip → le
   * toggle visuel bouge au clic, même si le refetch prend 200-500ms.
   * Si le write échoue, on rollback via le refetch (le query invalidate
   * tire la source of truth et la useEffect Set full map la reflète).
   */
  const saveChannels = async (playbookName, channelId, isSelected) => {
    const pb = playbooks.find(p => p.name === playbookName)
    if (!pb) return
    const cp = clientPlaybooks.find(c => c.playbook_id === pb.id)

    // Optimistic update — UI bouge immédiatement
    const optimisticKey = `${playbookName}_${channelId}`
    setSelectedChannels(prev => ({ ...prev, [optimisticKey]: isSelected }))

    // Recalcule la liste complète des canaux actifs pour ce playbook
    // à partir du state qu'on vient d'update (pas du state stale)
    const currentChannels = (cp?.custom_config?.channels || [])
    const newChannels = isSelected
      ? Array.from(new Set([...currentChannels, channelId]))
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

    try {
      if (cp) {
        const { error } = await supabase.from('engine_client_playbooks').update({
          custom_config: { ...(cp.custom_config || {}), channels: newChannels },
          updated_at: new Date().toISOString(),
        }).eq('id', cp.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('engine_client_playbooks').insert({
          client_id: clientId, playbook_id: pb.id, is_active: false, custom_config: { channels: newChannels },
        })
        if (error) throw error
      }
    } catch (err) {
      // Rollback optimistic update — revient à l'état précédent
      setSelectedChannels(prev => ({ ...prev, [optimisticKey]: !isSelected }))
      toast.error('Erreur — modification non sauvegardée')
      console.error('[saveChannels] DB write failed:', err)
      return
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

  /* ---- Render ---- */
  // (avec 2 automations, plus de filter tabs — la grid 2-col suffit)

  const visibleAutomations = automationList

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

      {/* ═══════ AUTOMATIONS GRID ═══════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleAutomations.map(automation => {
          const active = automation.active
          const reqsMet = automation.reqs.met
          const weeklyTickets = perPbStats?.[automation.key] || 0
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
              mainAction={() => handleTogglePlaybook(automation)}
              mainActionLabel={active ? 'Désactiver' : 'Activer'}
              mainActionDisabled={!reqsMet}
            />
          )
        })}
      </div>

      {/* ═══════ MODALS ═══════ */}

      <AutomationHowItWorksModal
        automationKey={modalKey}
        isOpen={!!modalKey}
        onClose={() => setModalKey(null)}
        isActive={activeModalAutomation?.active || false}
        reqsMet={activeModalAutomation?.reqs?.met ?? true}
        connectedProviders={connectedProviders}
        onActivate={() => {
          if (!activeModalAutomation) return
          handleTogglePlaybook(activeModalAutomation)
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

    </div>
  )
}
