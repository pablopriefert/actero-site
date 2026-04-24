import React, { useEffect, useMemo, useState } from 'react'
import { Command } from 'cmdk'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  Compass,
  Inbox,
  BookOpen,
  Plug,
  Zap,
  Users,
  ArrowRight,
  LayoutDashboard,
  FileText,
  Sparkles,
  MessageSquare,
  AlertTriangle,
  Bot,
  TrendingUp,
  BarChart3,
  Clock,
  Phone,
  PhoneCall,
  Bell,
  Shield,
  Code,
  Store,
  ShoppingBag,
  CreditCard,
  User,
  Settings,
  Gift,
  Receipt,
  Handshake,
  Terminal,
  Activity,
  DollarSign,
  Coins,
  Trophy,
  Eye,
  Bug,
  UserPlus,
  ScrollText,
  BellRing,
  History,
  Lightbulb,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

/**
 * CommandPalette — palette Cmd+K / Ctrl+K style Notion/Linear/Vercel.
 *
 * Props :
 *  - open            : bool      — etat ouvert/ferme
 *  - onClose         : () => void
 *  - mode            : 'client' | 'admin' (detecte le dashboard courant)
 *  - clientId        : string    — id du client courant (client mode)
 *  - setActiveTab    : fn        — navigation interne (tabs dashboard)
 *  - onNavigate      : fn        — navigation route libre (optionnel)
 *  - isMac           : bool      — affichage Cmd vs Ctrl dans les hints
 */
export const CommandPalette = ({
  open,
  onClose,
  mode = 'client',
  clientId,
  setActiveTab,
  onNavigate,
  isMac = true,
}) => {
  const [search, setSearch] = useState('')
  const [recentTabIds, setRecentTabIds] = useState([])

  // Reset search on close + refresh recents on open (from localStorage).
  useEffect(() => {
    if (!open) {
      setSearch('')
      return
    }
    try {
      const raw = localStorage.getItem('actero-cmdk-recents')
      const arr = raw ? JSON.parse(raw) : []
      // Drop the currently-open tab from recents (no point offering "go back here").
      setRecentTabIds(Array.isArray(arr) ? arr.slice(0, 5) : [])
    } catch {
      setRecentTabIds([])
    }
  }, [open])

  // ---------------------------------------------------------------------------
  // Sources de donnees (async via Supabase, staleTime 30s)
  // ---------------------------------------------------------------------------

  // Tickets (client mode uniquement)
  const { data: tickets = [] } = useQuery({
    queryKey: ['cmdk-tickets', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('automation_events')
        .select('id, subject, ticket_type, event_category, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(50)
      return data || []
    },
    enabled: open && mode === 'client' && !!clientId,
    staleTime: 30_000,
  })

  // Base de connaissances
  const { data: kbItems = [] } = useQuery({
    queryKey: ['cmdk-kb', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_knowledge_base')
        .select('id, title, content')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false })
        .limit(100)
      return data || []
    },
    enabled: open && mode === 'client' && !!clientId,
    staleTime: 30_000,
  })

  // Integrations (status)
  const { data: integrations = [] } = useQuery({
    queryKey: ['cmdk-integrations', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_integrations')
        .select('id, provider, status')
        .eq('client_id', clientId)
      return data || []
    },
    enabled: open && mode === 'client' && !!clientId,
    staleTime: 30_000,
  })

  // Clients (admin mode uniquement)
  const { data: allClients = [] } = useQuery({
    queryKey: ['cmdk-admin-clients'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, brand_name, plan_id, client_type')
        .order('created_at', { ascending: false })
      return data || []
    },
    enabled: open && mode === 'admin',
    staleTime: 30_000,
  })

  // ---------------------------------------------------------------------------
  // Catalogues navigation (definis statiquement)
  // ---------------------------------------------------------------------------

  const clientNavItems = useMemo(() => ([
    { id: 'overview',           label: 'Vue d\'ensemble',         icon: LayoutDashboard },
    { id: 'automation',         label: 'Automatisation',          icon: Sparkles },
    // Gerer
    { id: 'escalations',        label: 'A traiter',              icon: AlertTriangle },
    { id: 'activity',           label: 'Activite de l\'agent',    icon: Activity },
    // Agent IA
    { id: 'agent-control',      label: 'Centre de controle',     icon: Bot },
    { id: 'agent-config',       label: 'Configuration',          icon: Bot },
    { id: 'knowledge',          label: 'Base de connaissances',  icon: BookOpen },
    { id: 'guardrails',         label: 'Regles metier',          icon: Shield },
    { id: 'simulator',          label: 'Tester mon agent',       icon: MessageSquare },
    // Connexions
    { id: 'integrations',       label: 'Integrations',           icon: Plug },
    { id: 'channels',           label: 'Canaux',                 icon: Phone },
    { id: 'email-agent',        label: 'Agent Email',            icon: FileText },
    // Croissance
    { id: 'opportunities',      label: 'Opportunites',           icon: TrendingUp },
    { id: 'insights',           label: 'Insights',               icon: BarChart3 },
    // Systeme
    { id: 'settings',           label: 'Parametres',             icon: CreditCard },
    // Sous-pages accessibles directement
    { id: 'response-templates', label: 'Modeles de reponse',     icon: FileText },
    { id: 'api-docs',           label: 'API',                    icon: Code },
    { id: 'voice-agent',        label: 'Agent vocal',            icon: Phone },
    { id: 'weekly-summary',     label: 'Performance',            icon: BarChart3 },
    { id: 'roi',                label: 'ROI',                    icon: TrendingUp },
    { id: 'peak-hours',         label: 'Heures de pic',          icon: Clock },
    { id: 'voice-calls',        label: 'Appels vocaux',          icon: PhoneCall },
    { id: 'referral',           label: 'Parrainage',             icon: Gift },
    { id: 'profile',            label: 'Compte',                 icon: User },
    { id: 'team',               label: 'Equipe',                 icon: Users },
    { id: 'billing',            label: 'Facturation',            icon: CreditCard },
    { id: 'support',            label: 'Aide',                   icon: BookOpen },
  ]), [])

  const adminNavItems = useMemo(() => ([
    { id: 'overview',             label: 'Vue globale',       icon: LayoutDashboard },
    { id: 'pipeline',             label: 'Pipeline',          icon: Activity },
    { id: 'funnel',               label: 'Funnel',            icon: TrendingUp },
    { id: 'clients',              label: 'Clients',           icon: Users },
    { id: 'engine-runs',          label: 'Engine Runs',       icon: ScrollText },
    { id: 'manual-review',        label: 'Manual Review',     icon: Eye },
    { id: 'playbooks',            label: 'Playbooks',         icon: Sparkles },
    { id: 'mrr',                  label: 'MRR',               icon: DollarSign },
    { id: 'billing',              label: 'Billing',           icon: Receipt },
    { id: 'churn-cohort',         label: 'Churn Cohort',      icon: BarChart3 },
    { id: 'cost-tracker',         label: 'Cost Tracker',      icon: Coins },
    { id: 'roi-leaderboard',      label: 'ROI Leaderboard',   icon: Trophy },
    { id: 'live-runs',            label: 'Live Runs',         icon: Zap },
    { id: 'agent-heatmap',        label: 'Agent Heatmap',     icon: Activity },
    { id: 'top-errors',           label: 'Top Errors',        icon: AlertTriangle },
    { id: 'connector-health',     label: 'Connector Health',  icon: Plug },
    { id: 'ai-terminal',          label: 'AI Terminal',       icon: Terminal },
    { id: 'alert-builder',        label: 'Alert Builder',     icon: BellRing },
    { id: 'error-reports',        label: 'Error Reports',     icon: Bug },
    { id: 'stripe-setup',         label: 'Stripe Setup',      icon: CreditCard },
    { id: 'partners',             label: 'Partners',          icon: Handshake },
    { id: 'partner-tokens',       label: 'Ambassadors',       icon: Handshake },
    { id: 'referrals',            label: 'Referrals',         icon: Gift },
  ]), [])

  // ---------------------------------------------------------------------------
  // Quick actions
  // ---------------------------------------------------------------------------

  const clientQuickActions = useMemo(() => ([
    {
      id: 'qa-test-agent',
      label: "Tester l'agent",
      icon: MessageSquare,
      action: () => setActiveTab?.('simulator'),
    },
    {
      id: 'qa-add-kb',
      label: 'Ajouter a la base de connaissances',
      icon: BookOpen,
      action: () => setActiveTab?.('knowledge'),
    },
    {
      id: 'qa-copy-api',
      label: 'Copier mon API key',
      icon: Code,
      action: async () => {
        try {
          const { data } = await supabase
            .from('client_api_keys')
            .select('api_key')
            .eq('client_id', clientId)
            .maybeSingle()
          if (data?.api_key && navigator?.clipboard) {
            await navigator.clipboard.writeText(data.api_key)
          } else {
            setActiveTab?.('api-docs')
          }
        } catch {
          setActiveTab?.('api-docs')
        }
      },
    },
    {
      id: 'qa-activity',
      label: "Voir l'activite du jour",
      icon: Activity,
      action: () => setActiveTab?.('activity'),
    },
    {
      id: 'qa-resolve',
      label: 'Marquer un ticket resolu',
      icon: AlertTriangle,
      action: () => setActiveTab?.('escalations'),
    },
  ]), [clientId, setActiveTab])

  const adminQuickActions = useMemo(() => ([
    {
      id: 'qa-impersonate',
      label: 'Impersonate client',
      icon: UserPlus,
      action: () => setActiveTab?.('clients'),
    },
    {
      id: 'qa-mrr',
      label: 'Voir MRR',
      icon: DollarSign,
      action: () => setActiveTab?.('mrr'),
    },
    {
      id: 'qa-terminal',
      label: 'Ouvrir AI Terminal',
      icon: Terminal,
      action: () => setActiveTab?.('ai-terminal'),
    },
    {
      id: 'qa-live-runs',
      label: 'Live Runs',
      icon: Zap,
      action: () => setActiveTab?.('live-runs'),
    },
  ]), [setActiveTab])

  // ---------------------------------------------------------------------------
  // Suggestions contextuelles (client mode) — shortcuts les plus actionables
  // pour un nouveau client. En mode admin, on reprend les admin quick actions.
  // ---------------------------------------------------------------------------

  const clientSuggestions = useMemo(() => ([
    {
      id: 'sg-add-kb',
      label: 'Ajouter une entrée KB',
      subLabel: 'Apprenez à votre agent une nouvelle réponse',
      icon: BookOpen,
      action: () => setActiveTab?.('knowledge'),
    },
    {
      id: 'sg-connect-shopify',
      label: 'Connecter Shopify',
      subLabel: 'Importez vos commandes pour des réponses contextuelles',
      icon: ShoppingBag,
      action: () => setActiveTab?.('integrations'),
    },
    {
      id: 'sg-escalations',
      label: 'Voir les escalades',
      subLabel: 'Tickets en attente de votre intervention',
      icon: AlertTriangle,
      action: () => setActiveTab?.('escalations'),
    },
  ]), [setActiveTab])

  // Map id → nav-item metadata pour reconstruire les "Récents".
  const navItemsById = useMemo(() => {
    const src = mode === 'admin' ? adminNavItems : clientNavItems
    const map = {}
    src.forEach((it) => { map[it.id] = it })
    return map
  }, [mode, adminNavItems, clientNavItems])

  const recentNavItems = useMemo(() => {
    return recentTabIds
      .map((id) => navItemsById[id])
      .filter(Boolean)
      .slice(0, 5)
  }, [recentTabIds, navItemsById])

  // ---------------------------------------------------------------------------
  // Handlers selection
  // ---------------------------------------------------------------------------

  const runAndClose = (fn) => {
    try { fn?.() } finally { onClose?.() }
  }

  const goToTab = (tab) => runAndClose(() => setActiveTab?.(tab))

  const goToTicket = (ticketId) => runAndClose(() => {
    // On stocke l'id du ticket cible pour que la vue escalations puisse le lire
    try { sessionStorage.setItem('actero:focus-ticket', ticketId) } catch {}
    if (setActiveTab) setActiveTab('escalations')
    else if (onNavigate) onNavigate(`/client/escalations?ticket=${encodeURIComponent(ticketId)}`)
  })

  const goToKbEntry = (kbId) => runAndClose(() => {
    try { sessionStorage.setItem('actero:focus-kb', kbId) } catch {}
    setActiveTab?.('knowledge')
  })

  const goToClient = (cid) => runAndClose(() => {
    try { sessionStorage.setItem('actero:focus-client', cid) } catch {}
    setActiveTab?.('clients')
  })

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const modKey = isMac ? 'Cmd' : 'Ctrl'

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[18vh] px-4" role="dialog" aria-modal="true" aria-label="Palette de commandes">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[600px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
          >
            <Command
              label="Palette de commandes"
              shouldFilter={true}
              loop
              className="flex flex-col max-h-[500px]"
            >
              {/* Search input */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                <Search className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                <Command.Input
                  value={search}
                  onValueChange={setSearch}
                  autoFocus
                  placeholder="Rechercher ou taper une commande..."
                  className="flex-1 bg-transparent border-none outline-none text-[14px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                />
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono text-zinc-500">
                  ESC
                </kbd>
              </div>

              {/* List */}
              <Command.List className="flex-1 overflow-y-auto p-2">
                <Command.Empty className="py-10 text-center text-[13px] text-zinc-500">
                  Aucun resultat.
                </Command.Empty>

                {/* ------------------------- RECENTS ---------------------------- */}
                {recentNavItems.length > 0 && (
                  <Command.Group heading={<GroupHeading icon={History} label="Récents" />}>
                    {recentNavItems.map((item) => (
                      <PaletteItem
                        key={`rc-${item.id}`}
                        value={`recent ${item.label} ${item.id}`}
                        onSelect={() => goToTab(item.id)}
                        icon={item.icon}
                        label={item.label}
                      />
                    ))}
                  </Command.Group>
                )}

                {/* ------------------------- SUGGESTIONS ------------------------ */}
                {mode === 'client' && (
                  <Command.Group heading={<GroupHeading icon={Lightbulb} label="Suggestions" />}>
                    {clientSuggestions.map((s) => (
                      <PaletteItem
                        key={s.id}
                        value={`suggestion ${s.label}`}
                        onSelect={() => runAndClose(s.action)}
                        icon={s.icon}
                        label={s.label}
                        subLabel={s.subLabel}
                      />
                    ))}
                  </Command.Group>
                )}

                {/* ------------------------- NAVIGATION ------------------------- */}
                <Command.Group
                  heading={
                    <GroupHeading icon={Compass} label="Toutes les destinations" />
                  }
                >
                  {(mode === 'admin' ? adminNavItems : clientNavItems).map((item) => (
                    <PaletteItem
                      key={`nav-${item.id}`}
                      value={`nav ${item.label} ${item.id}`}
                      onSelect={() => goToTab(item.id)}
                      icon={item.icon}
                      label={item.label}
                    />
                  ))}
                </Command.Group>

                {/* ------------------------- QUICK ACTIONS ---------------------- */}
                <Command.Group
                  heading={<GroupHeading icon={Zap} label="Actions rapides" />}
                >
                  {(mode === 'admin' ? adminQuickActions : clientQuickActions).map((qa) => (
                    <PaletteItem
                      key={qa.id}
                      value={`action ${qa.label}`}
                      onSelect={() => runAndClose(qa.action)}
                      icon={qa.icon}
                      label={qa.label}
                    />
                  ))}
                </Command.Group>

                {/* ------------------------- CLIENT-ONLY ------------------------ */}
                {mode === 'client' && tickets.length > 0 && (
                  <Command.Group heading={<GroupHeading icon={Inbox} label="Tickets" />}>
                    {tickets.map((t) => {
                      const title = t.subject || t.ticket_type || t.event_category || `Ticket ${String(t.id).slice(0, 8)}`
                      return (
                        <PaletteItem
                          key={`tk-${t.id}`}
                          value={`ticket ${title} ${t.id}`}
                          onSelect={() => goToTicket(t.id)}
                          icon={AlertTriangle}
                          label={title}
                          subLabel={t.event_category || t.ticket_type}
                        />
                      )
                    })}
                  </Command.Group>
                )}

                {mode === 'client' && kbItems.length > 0 && (
                  <Command.Group heading={<GroupHeading icon={BookOpen} label="Base de connaissances" />}>
                    {kbItems.map((k) => {
                      const snippet = typeof k.content === 'string'
                        ? k.content.slice(0, 80)
                        : ''
                      return (
                        <PaletteItem
                          key={`kb-${k.id}`}
                          value={`kb ${k.title} ${snippet}`}
                          onSelect={() => goToKbEntry(k.id)}
                          icon={BookOpen}
                          label={k.title || 'Sans titre'}
                          subLabel={snippet}
                        />
                      )
                    })}
                  </Command.Group>
                )}

                {mode === 'client' && integrations.length > 0 && (
                  <Command.Group heading={<GroupHeading icon={Plug} label="Integrations" />}>
                    {integrations.map((i) => (
                      <PaletteItem
                        key={`int-${i.id}`}
                        value={`integration ${i.provider}`}
                        onSelect={() => goToTab('integrations')}
                        icon={Plug}
                        label={i.provider}
                        subLabel={i.status}
                        badge={i.status}
                        badgeTone={i.status === 'active' ? 'green' : 'zinc'}
                      />
                    ))}
                  </Command.Group>
                )}

                {/* ------------------------- ADMIN-ONLY ------------------------- */}
                {mode === 'admin' && allClients.length > 0 && (
                  <Command.Group heading={<GroupHeading icon={Users} label="Clients" />}>
                    {allClients.map((c) => (
                      <PaletteItem
                        key={`cl-${c.id}`}
                        value={`client ${c.brand_name} ${c.plan_id || ''}`}
                        onSelect={() => goToClient(c.id)}
                        icon={Users}
                        label={c.brand_name || 'Sans nom'}
                        subLabel={[c.plan_id, c.client_type].filter(Boolean).join(' • ')}
                      />
                    ))}
                  </Command.Group>
                )}
              </Command.List>

              {/* Footer hints */}
              <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 bg-zinc-50/50 dark:bg-zinc-950/40">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> naviguer</span>
                  <span className="flex items-center gap-1"><Kbd>Enter</Kbd> ouvrir</span>
                  <span className="hidden sm:flex items-center gap-1"><Kbd>Esc</Kbd> fermer</span>
                </div>
                <span className="hidden sm:flex items-center gap-1">
                  <Kbd>{modKey}</Kbd><Kbd>K</Kbd>
                </span>
              </div>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// -----------------------------------------------------------------------------
// Sous-composants
// -----------------------------------------------------------------------------

const GroupHeading = ({ icon: Icon, label }) => (
  <div className="flex items-center gap-1.5 px-2 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
    {Icon && <Icon className="w-3 h-3" />}
    <span>{label}</span>
  </div>
)

const PaletteItem = ({ value, onSelect, icon: Icon, label, subLabel, badge, badgeTone = 'zinc' }) => (
  <Command.Item
    value={value}
    onSelect={onSelect}
    className="flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer text-[13px] text-zinc-700 dark:text-zinc-200 aria-selected:bg-blue-50 aria-selected:ring-1 aria-selected:ring-blue-200 aria-selected:text-zinc-900 dark:aria-selected:bg-blue-500/10 dark:aria-selected:ring-blue-500/30 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
  >
    {Icon && <Icon className="w-4 h-4 text-zinc-400 flex-shrink-0" />}
    <div className="flex-1 min-w-0">
      <div className="truncate font-medium">{label}</div>
      {subLabel && (
        <div className="truncate text-[11px] text-zinc-400 mt-0.5">{subLabel}</div>
      )}
    </div>
    {badge && (
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
        badgeTone === 'green'
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
      }`}>
        {badge}
      </span>
    )}
    <ArrowRight className="w-3.5 h-3.5 text-zinc-300 flex-shrink-0" />
  </Command.Item>
)

const Kbd = ({ children }) => (
  <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-mono text-zinc-500">
    {children}
  </kbd>
)

export default CommandPalette
