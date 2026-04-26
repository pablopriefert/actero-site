import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, Settings, BookOpen, Shield, FlaskConical, ChevronRight, Activity, Clock, CheckCircle2, Eye, Zap, Loader2, AlertCircle, GitBranch } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { LivePulseDot } from '../ui/LivePulseDot'

/**
 * Agent Control Center — refondu avril 2026.
 *
 * Avant : status hero vide + 4 cards égales. Zéro signal live.
 * Après : status strip + metrics live 24h + 2 groupes de cards (Config / Tester).
 *
 * Pattern cohérent avec Overview + Automation Hub : header strip blanc
 * compact + data-dense + secondary actions groupées.
 */
export const AgentControlCenterView = ({ clientId, onNavigate }) => {
  const queryClient = useQueryClient()
  const { data: settings } = useQuery({
    queryKey: ['client-settings', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const { data } = await supabase
        .from('client_settings')
        .select('agent_enabled, brand_tone, vision_enabled, linear_auto_issue_enabled, linear_team_name, discount_policy_enabled, discount_policy_code, discount_policy_max_pct, discount_policy_updated_at, updated_at')
        .eq('client_id', clientId)
        .maybeSingle()
      return data
    },
    enabled: !!clientId,
  })

  const [visionBusy, setVisionBusy] = useState(false)
  const visionEnabled = Boolean(settings?.vision_enabled)

  const [linearBusy, setLinearBusy] = useState(false)
  const linearAutoIssueEnabled = Boolean(settings?.linear_auto_issue_enabled)
  const { data: linearIntegration } = useQuery({
    queryKey: ['linear-integration-status', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const { data } = await supabase
        .from('client_integrations')
        .select('status')
        .eq('client_id', clientId)
        .eq('provider', 'linear')
        .maybeSingle()
      return { connected: data?.status === 'active' }
    },
    enabled: !!clientId,
  })
  const linearConnected = Boolean(linearIntegration?.connected)

  /* ───── E2B sandbox test panel (dry-run agentic action) ─────
   * Spawns a real E2B sandbox from the dashboard with mock customer/order
   * data, validates the orchestrator pipeline + guardrails behavior end-to-end
   * without touching Shopify. Backend: /api/dev/test-e2b-sandbox.js (auth-gated).
   * State is local to this panel — does NOT touch any other component state. */
  const [e2bTestState, setE2bTestState] = useState('idle') // idle | running | success | error
  const [e2bTestResult, setE2bTestResult] = useState(null)
  const [e2bAmount, setE2bAmount] = useState(42.5)
  const [e2bMaxAuto, setE2bMaxAuto] = useState(100)

  async function runE2BTest() {
    if (e2bTestState === 'running') return
    setE2bTestState('running')
    setE2bTestResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setE2bTestState('error')
        setE2bTestResult({ error: 'Session expirée — reconnectez-vous.' })
        return
      }
      const resp = await fetch('/api/dev/test-e2b-sandbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          amount: Number(e2bAmount) || 42.5,
          max_auto_refund_eur: Number(e2bMaxAuto) || 100,
        }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.ok) {
        setE2bTestState('error')
        setE2bTestResult(data)
        return
      }
      setE2bTestState('success')
      setE2bTestResult(data)
    } catch (err) {
      setE2bTestState('error')
      setE2bTestResult({ error: err.message })
    }
  }

  /* ───── Discount Policy sandbox playground (#6) ─────
   * Merchant writes a Python decide_discount(cart, customer, policy_caps)
   * function. Each test spawns an isolated E2B sandbox to evaluate it
   * against mock data. Audit trail in agent_action_logs (action_type =
   * discount_policy_test). The wrapper enforces max_pct so a buggy policy
   * can't blow margin. */
  const DEFAULT_POLICY = `def decide_discount(cart, customer, policy_caps):
    cart_value = float(cart.get('total_value', 0))
    clv = float(customer.get('clv', 0))
    orders = int(customer.get('orders_count', 0))
    if orders == 0 and cart_value < 50:
        return {'discount_pct': 0, 'reason': 'first_order_low_cart_no_discount'}
    if clv >= 500 and cart_value >= 100:
        return {'discount_pct': 15, 'reason': 'vip_high_cart'}
    if orders >= 1 and cart_value >= 80:
        return {'discount_pct': 10, 'reason': 'repeat_customer_above_80'}
    return {'discount_pct': 5, 'reason': 'standard_default'}
`
  const [policyCode, setPolicyCode] = useState('')
  const [policyMaxPct, setPolicyMaxPct] = useState(15)
  const [policyMockCart, setPolicyMockCart] = useState(89)
  const [policyMockClv, setPolicyMockClv] = useState(250)
  const [policyMockOrders, setPolicyMockOrders] = useState(1)
  const [policyTestState, setPolicyTestState] = useState('idle')
  const [policyTestResult, setPolicyTestResult] = useState(null)
  const [policyDirty, setPolicyDirty] = useState(false)
  const [policyShowCode, setPolicyShowCode] = useState(false)

  // Pre-built templates — merchant clicks one to load it into the editor.
  // Three flavours covering the most common merchant strategies.
  const POLICY_TEMPLATES = [
    {
      id: 'conservative',
      name: 'Conservatrice',
      tag: 'Marge protégée',
      description: 'Pas de remise sur petits paniers, modeste sur gros paniers, généreuse seulement pour les VIP.',
      maxPct: 10,
      code: `def decide_discount(cart, customer, policy_caps):
    cart_value = float(cart.get('total_value', 0))
    clv = float(customer.get('clv', 0))
    orders = int(customer.get('orders_count', 0))
    if cart_value < 50:
        return {'discount_pct': 0, 'reason': 'panier_trop_petit'}
    if clv >= 500:
        return {'discount_pct': 10, 'reason': 'client_vip'}
    if orders >= 2:
        return {'discount_pct': 5, 'reason': 'client_fidele'}
    return {'discount_pct': 0, 'reason': 'pas_de_remise_par_defaut'}
`,
    },
    {
      id: 'balanced',
      name: 'Équilibrée',
      tag: 'Recommandée',
      description: 'Pas de remise sur tout 1ère commande petit panier, 5/10/15% selon profil et taille du panier.',
      maxPct: 15,
      code: `def decide_discount(cart, customer, policy_caps):
    cart_value = float(cart.get('total_value', 0))
    clv = float(customer.get('clv', 0))
    orders = int(customer.get('orders_count', 0))
    if orders == 0 and cart_value < 50:
        return {'discount_pct': 0, 'reason': 'premiere_commande_petit_panier'}
    if clv >= 500 and cart_value >= 100:
        return {'discount_pct': 15, 'reason': 'vip_gros_panier'}
    if orders >= 1 and cart_value >= 80:
        return {'discount_pct': 10, 'reason': 'client_fidele_panier_80'}
    return {'discount_pct': 5, 'reason': 'remise_standard'}
`,
    },
    {
      id: 'aggressive',
      name: 'Agressive',
      tag: 'Croissance / acquisition',
      description: 'Remise systématique pour convertir les paniers abandonnés, plus forte pour les VIP.',
      maxPct: 20,
      code: `def decide_discount(cart, customer, policy_caps):
    cart_value = float(cart.get('total_value', 0))
    clv = float(customer.get('clv', 0))
    if clv >= 500 and cart_value >= 100:
        return {'discount_pct': 20, 'reason': 'vip_gros_panier'}
    if cart_value >= 100:
        return {'discount_pct': 15, 'reason': 'gros_panier'}
    if cart_value >= 50:
        return {'discount_pct': 10, 'reason': 'panier_moyen'}
    return {'discount_pct': 5, 'reason': 'remise_minimale'}
`,
    },
  ]

  // Pre-set scenarios so the merchant doesn't need to know what to type.
  const POLICY_SCENARIOS = [
    {
      id: 'new_visitor',
      name: 'Nouveau visiteur',
      description: '1ère visite, panier 35€, aucune commande passée',
      cart: 35, clv: 0, orders: 0,
    },
    {
      id: 'returning',
      name: 'Client qui revient',
      description: '1 commande passée (89€ moyen), panier actuel 89€',
      cart: 89, clv: 89, orders: 1,
    },
    {
      id: 'loyal',
      name: 'Client fidèle',
      description: '4 commandes passées, dépensé 320€ au total, panier 110€',
      cart: 110, clv: 320, orders: 4,
    },
    {
      id: 'vip',
      name: 'Client VIP',
      description: '12 commandes, dépensé 850€ au total, gros panier 180€',
      cart: 180, clv: 850, orders: 12,
    },
  ]
  const [policyScenarioId, setPolicyScenarioId] = useState('returning')

  function loadTemplate(t) {
    setPolicyCode(t.code)
    setPolicyMaxPct(t.maxPct)
    setPolicyDirty(true)
  }

  function applyScenario(s) {
    setPolicyScenarioId(s.id)
    setPolicyMockCart(s.cart)
    setPolicyMockClv(s.clv)
    setPolicyMockOrders(s.orders)
  }

  // Hydrate the editor from settings the first time settings load
  React.useEffect(() => {
    if (!settings) return
    if (!policyCode && !policyDirty) {
      setPolicyCode(settings.discount_policy_code || DEFAULT_POLICY)
    }
    if (settings.discount_policy_max_pct != null) {
      setPolicyMaxPct(settings.discount_policy_max_pct)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  async function runDiscountTest({ persist = false } = {}) {
    if (policyTestState === 'running') return
    setPolicyTestState('running')
    setPolicyTestResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setPolicyTestState('error')
        setPolicyTestResult({ error: 'Session expirée — reconnectez-vous.' })
        return
      }
      const resp = await fetch('/api/engine/test-discount-policy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          policy_code: policyCode,
          max_pct: Number(policyMaxPct) || 15,
          mock_cart: { total_value: Number(policyMockCart) || 0, currency: 'EUR' },
          mock_customer: {
            clv: Number(policyMockClv) || 0,
            orders_count: Number(policyMockOrders) || 0,
          },
          persist,
        }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.ok) {
        setPolicyTestState('error')
        setPolicyTestResult(data)
        return
      }
      setPolicyTestState('success')
      setPolicyTestResult(data)
      if (persist) {
        setPolicyDirty(false)
        queryClient.invalidateQueries({ queryKey: ['client-settings', clientId] })
      }
    } catch (err) {
      setPolicyTestState('error')
      setPolicyTestResult({ error: err.message })
    }
  }

  async function toggleDiscountPolicy() {
    if (!clientId) return
    const next = !Boolean(settings?.discount_policy_enabled)
    queryClient.setQueryData(['client-settings', clientId], (prev) => ({
      ...(prev || {}),
      discount_policy_enabled: next,
    }))
    const { error } = await supabase
      .from('client_settings')
      .upsert({ client_id: clientId, discount_policy_enabled: next }, { onConflict: 'client_id' })
    if (error) {
      queryClient.setQueryData(['client-settings', clientId], (prev) => ({
        ...(prev || {}),
        discount_policy_enabled: !next,
      }))
    } else {
      queryClient.invalidateQueries({ queryKey: ['client-settings', clientId] })
    }
  }

  async function toggleVision() {
    if (!clientId || visionBusy) return
    setVisionBusy(true)
    const next = !visionEnabled
    // Optimistic cache update
    queryClient.setQueryData(['client-settings', clientId], (prev) => ({
      ...(prev || {}),
      vision_enabled: next,
    }))
    // Use upsert: clients onboarded before client_settings was populated
    // don't have a row yet — .update() would silently no-op. upsert ensures
    // the row is created on first toggle.
    const { error } = await supabase
      .from('client_settings')
      .upsert(
        { client_id: clientId, vision_enabled: next },
        { onConflict: 'client_id' },
      )
    if (error) {
      console.error('[AgentControlCenter] toggleVision failed:', error)
      // Rollback on error
      queryClient.setQueryData(['client-settings', clientId], (prev) => ({
        ...(prev || {}),
        vision_enabled: !next,
      }))
    } else {
      queryClient.invalidateQueries({ queryKey: ['client-settings', clientId] })
    }
    setVisionBusy(false)
  }

  async function toggleLinearAutoIssue() {
    if (!clientId || linearBusy) return
    if (!linearConnected) return // disabled in UI; defensive
    setLinearBusy(true)
    const next = !linearAutoIssueEnabled
    queryClient.setQueryData(['client-settings', clientId], (prev) => ({
      ...(prev || {}),
      linear_auto_issue_enabled: next,
    }))
    const { error } = await supabase
      .from('client_settings')
      .upsert(
        { client_id: clientId, linear_auto_issue_enabled: next },
        { onConflict: 'client_id' },
      )
    if (error) {
      console.error('[AgentControlCenter] toggleLinearAutoIssue failed:', error)
      queryClient.setQueryData(['client-settings', clientId], (prev) => ({
        ...(prev || {}),
        linear_auto_issue_enabled: !next,
      }))
    } else {
      queryClient.invalidateQueries({ queryKey: ['client-settings', clientId] })
      // Keep the Integrations tab in sync if the user navigates back.
      queryClient.invalidateQueries({ queryKey: ['linear-auto-issue', clientId] })
    }
    setLinearBusy(false)
  }

  // Master agent kill-switch — toggles agent_enabled. Same upsert pattern.
  const [agentBusy, setAgentBusy] = useState(false)
  async function toggleAgent() {
    if (!clientId || agentBusy) return
    setAgentBusy(true)
    const current = settings?.agent_enabled !== false
    const next = !current
    queryClient.setQueryData(['client-settings', clientId], (prev) => ({
      ...(prev || {}),
      agent_enabled: next,
    }))
    const { error } = await supabase
      .from('client_settings')
      .upsert(
        { client_id: clientId, agent_enabled: next },
        { onConflict: 'client_id' },
      )
    if (error) {
      console.error('[AgentControlCenter] toggleAgent failed:', error)
      queryClient.setQueryData(['client-settings', clientId], (prev) => ({
        ...(prev || {}),
        agent_enabled: current,
      }))
    } else {
      queryClient.invalidateQueries({ queryKey: ['client-settings', clientId] })
    }
    setAgentBusy(false)
  }

  const { data: kbCount } = useQuery({
    queryKey: ['kb-count', clientId],
    queryFn: async () => {
      if (!clientId) return 0
      const { count } = await supabase
        .from('client_knowledge_base')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('is_active', true)
      return count || 0
    },
    enabled: !!clientId,
  })

  // Live metrics 24h — tickets résolus + latence moyenne + success rate
  const { data: liveStats } = useQuery({
    queryKey: ['agent-live-stats-24h', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      const { data } = await supabase
        .from('automation_events')
        .select('event_category, latency_ms, feedback')
        .eq('client_id', clientId)
        .gte('created_at', since)
      const events = data || []
      const resolved = events.filter(e => e.event_category === 'ticket_resolved')
      const latencies = resolved.map(e => Number(e.latency_ms) || 0).filter(n => n > 0)
      const avgLatency = latencies.length
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null
      const feedbacks = events.filter(e => e.feedback === 'positive' || e.feedback === 'negative')
      const successRate = feedbacks.length
        ? Math.round((feedbacks.filter(f => f.feedback === 'positive').length / feedbacks.length) * 100)
        : null
      return {
        resolvedCount: resolved.length,
        avgLatency,
        successRate,
      }
    },
    enabled: !!clientId,
    refetchInterval: 60000,
  })

  const agentEnabled = settings?.agent_enabled !== false
  const brandToneSet = Boolean(settings?.brand_tone && settings.brand_tone.length > 20)
  const resolved = liveStats?.resolvedCount ?? 0
  const avgLatency = liveStats?.avgLatency
  const successRate = liveStats?.successRate

  /* Format latency (ms → "2.3s" or "850ms") */
  const fmtLatency = (ms) => {
    if (!ms) return '—'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  /* Config cards — configuration de l'agent */
  const configCards = [
    {
      id: 'agent-config',
      title: 'Configuration',
      description: 'Ton de marque, persona, limites',
      icon: Settings,
      ready: brandToneSet,
      readyLabel: 'Configuré',
      missingLabel: 'À paramétrer',
    },
    {
      id: 'knowledge',
      title: 'Base de connaissances',
      description: `${kbCount || 0} entrée${(kbCount || 0) > 1 ? 's' : ''} active${(kbCount || 0) > 1 ? 's' : ''}`,
      icon: BookOpen,
      ready: (kbCount || 0) >= 5,
      readyLabel: 'Bien fournie',
      missingLabel: (kbCount || 0) === 0 ? 'Vide' : 'À enrichir',
    },
    {
      id: 'guardrails',
      title: 'Règles métier',
      description: 'Sujets autorisés, escalades, sécurité',
      icon: Shield,
      ready: null,
      readyLabel: 'Configurable',
      missingLabel: 'Configurable',
    },
  ]

  /* Tooling cards — simulateur, tests */
  const toolingCards = [
    {
      id: 'simulator',
      title: 'Tester mon agent',
      description: 'Simulez une conversation pour vérifier le comportement',
      icon: FlaskConical,
    },
  ]

  const renderCard = (card, idx) => {
    const Icon = card.icon
    const hasStatus = card.ready !== undefined
    return (
      <motion.button
        key={card.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.04 * idx }}
        onClick={() => onNavigate && onNavigate(card.id)}
        className="group text-left bg-white rounded-2xl border border-[#E5E2D7] p-5 hover:border-cta/30 hover:shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="w-9 h-9 rounded-lg bg-cta/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-cta" />
          </div>
          <ChevronRight className="w-4 h-4 text-[#9ca3af] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <h3 className="text-[14px] font-semibold text-[#1a1a1a] mb-1">{card.title}</h3>
        <p className="text-[12px] text-[#71717a] leading-relaxed mb-2">{card.description}</p>
        {hasStatus && card.ready === true && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="w-3 h-3" /> {card.readyLabel}
          </span>
        )}
        {hasStatus && card.ready === false && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> {card.missingLabel}
          </span>
        )}
        {hasStatus && card.ready === null && (
          <span className="text-[11px] font-semibold text-[#71717a]">{card.readyLabel}</span>
        )}
      </motion.button>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 pt-6 pb-16 animate-fade-in-up">
      {/* ═══════ STATUS STRIP + live metrics 24h ═══════ */}
      <div className="bg-white border border-[#E5E2D7] rounded-2xl p-5 md:p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              agentEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-500'
            }`}>
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-lg font-bold text-[#1a1a1a]">Agent IA</h1>
                <button
                  type="button"
                  onClick={toggleAgent}
                  disabled={!clientId || agentBusy}
                  aria-label={`${agentEnabled ? 'Mettre en pause' : 'Activer'} l'agent`}
                  title={`Cliquer pour ${agentEnabled ? 'mettre en pause' : 'activer'}`}
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${
                    agentEnabled
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {agentEnabled ? <LivePulseDot color="emerald" /> : <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />}
                  {agentEnabled ? 'Actif' : 'En pause'}
                </button>
              </div>
              <p className="text-[12px] text-[#71717a]">
                {agentEnabled
                  ? 'Traite automatiquement les demandes clients.'
                  : 'En pause. Aucun message n\'est traité.'}
              </p>
            </div>
          </div>
          {/* Live metrics 24h */}
          <div className="flex items-center gap-4 md:gap-6 flex-wrap">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">24h</span>
              <span className="text-lg font-bold text-[#1a1a1a] tabular-nums leading-tight">{resolved}</span>
              <span className="text-[10px] text-[#71717a]">{resolved === 1 ? 'résolue' : 'résolues'}</span>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">Latence</span>
              <span className="text-lg font-bold text-[#1a1a1a] tabular-nums leading-tight">{fmtLatency(avgLatency)}</span>
              <span className="text-[10px] text-[#71717a]">moyenne</span>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">Qualité</span>
              <span className="text-lg font-bold text-cta tabular-nums leading-tight">
                {successRate !== null && successRate !== undefined ? `${successRate}%` : '—'}
              </span>
              <span className="text-[10px] text-[#71717a]">feedback +</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ CONFIG SECTION ═══════ */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[13px] font-bold text-[#1a1a1a]">Configuration</h2>
          <span className="text-[11px] text-[#71717a]">Comment l'agent se comporte</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {configCards.map((c, i) => renderCard(c, i))}
        </div>
      </section>

      {/* ═══════ TOOLING SECTION ═══════ */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[13px] font-bold text-[#1a1a1a]">Tester & itérer</h2>
          <span className="text-[11px] text-[#71717a]">Valider avant mise en prod</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {toolingCards.map((c, i) => renderCard(c, i))}
        </div>
      </section>

      {/* ═══════ CAPACITES AVANCEES ═══════ */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[13px] font-bold text-[#1a1a1a]">Capacités avancées</h2>
          <span className="text-[11px] text-[#71717a]">Options IA optionnelles</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={visionEnabled}
          aria-label={`${visionEnabled ? 'Désactiver' : 'Activer'} l'analyse vision`}
          onClick={toggleVision}
          disabled={!clientId || visionBusy}
          className={`group w-full flex items-center justify-between gap-3 bg-white rounded-2xl border p-5 text-left transition-all ${
            visionEnabled
              ? 'border-cta/30 hover:border-cta/50'
              : 'border-[#E5E2D7] hover:border-cta/30'
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              visionEnabled ? 'bg-cta/10 text-cta' : 'bg-[#f5f5f5] text-[#9ca3af]'
            }`}>
              <Eye className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold text-[#1a1a1a] mb-1">
                Analyse des images envoyees par le client (Claude Vision)
              </h3>
              <p className="text-[12px] text-[#71717a] leading-relaxed">
                Quand activé, l'agent analyse automatiquement les photos jointes par le client (produit cassé, étiquette, reçu…) pour contextualiser sa réponse. Consommation selon votre quota mensuel.
              </p>
            </div>
          </div>
          <span
            aria-hidden="true"
            className={`relative w-[42px] h-[22px] rounded-full transition-colors flex-shrink-0 ${
              visionEnabled
                ? 'bg-cta shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]'
                : 'bg-[#d4d4d8] group-hover:bg-[#a1a1aa]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)] transition-transform duration-200 ease-out ${
                visionEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </span>
        </button>

        {/* ═══════ LINEAR AUTO-ISSUE TOGGLE ═══════
         * Mirror of the Integrations-tab panel — same column on
         * client_settings (linear_auto_issue_enabled). Disabled when
         * Linear isn't connected; the merchant has to OAuth from the
         * Integrations tab first. Team + sentiment threshold stay there. */}
        <button
          type="button"
          role="switch"
          aria-checked={linearAutoIssueEnabled}
          aria-label={`${linearAutoIssueEnabled ? 'Désactiver' : 'Activer'} l'auto-issue Linear`}
          onClick={toggleLinearAutoIssue}
          disabled={!clientId || linearBusy || !linearConnected}
          className={`group mt-3 w-full flex items-center justify-between gap-3 bg-white rounded-2xl border p-5 text-left transition-all ${
            linearAutoIssueEnabled
              ? 'border-cta/30 hover:border-cta/50'
              : 'border-[#E5E2D7] hover:border-cta/30'
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              linearAutoIssueEnabled ? 'bg-cta/10 text-cta' : 'bg-[#f5f5f5] text-[#9ca3af]'
            }`}>
              <GitBranch className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold text-[#1a1a1a] mb-1">
                Auto-issue Linear sur escalade critique
              </h3>
              <p className="text-[12px] text-[#71717a] leading-relaxed">
                {linearConnected ? (
                  <>Quand un ticket est escaladé avec un sentiment négatif, Actero crée automatiquement une issue dans <span className="font-semibold text-[#1a1a1a]">{settings?.linear_team_name || 'votre équipe Linear'}</span> pour suivi produit. Configure le seuil et l'équipe dans l'onglet Intégrations.</>
                ) : (
                  <>Connecte d'abord Linear depuis l'onglet <span className="font-semibold text-[#1a1a1a]">Intégrations</span> pour activer cette option.</>
                )}
              </p>
            </div>
          </div>
          <span
            aria-hidden="true"
            className={`relative w-[42px] h-[22px] rounded-full transition-colors flex-shrink-0 ${
              linearAutoIssueEnabled
                ? 'bg-cta shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]'
                : 'bg-[#d4d4d8] group-hover:bg-[#a1a1aa]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)] transition-transform duration-200 ease-out ${
                linearAutoIssueEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </span>
        </button>

        {/* ═══════ E2B SANDBOX TEST PANEL ═══════ */}
        <div className="mt-3 bg-white rounded-2xl border border-[#E5E2D7] p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-cta/10 text-cta flex-shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-semibold text-[#1a1a1a] mb-1">
                Tester une action agentic en sandbox isolé
              </h3>
              <p className="text-[12px] text-[#71717a] leading-relaxed">
                Spawn un sandbox E2B sécurisé et exécute la décision « refund auto » avec vos guardrails sur des données simulées. Aucun appel Shopify réel — sert à valider le pipeline et vos seuils en 5 secondes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-[#71717a] uppercase tracking-wider">
                Montant demandé (€)
              </span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={e2bAmount}
                onChange={(e) => setE2bAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#f9f7f1] border border-[#E5E2D7] text-[13px] tabular-nums focus:outline-none focus:border-cta focus:bg-white transition-colors"
                disabled={e2bTestState === 'running'}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-[#71717a] uppercase tracking-wider">
                Plafond auto-refund (€)
              </span>
              <input
                type="number"
                min="0"
                step="10"
                value={e2bMaxAuto}
                onChange={(e) => setE2bMaxAuto(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#f9f7f1] border border-[#E5E2D7] text-[13px] tabular-nums focus:outline-none focus:border-cta focus:bg-white transition-colors"
                disabled={e2bTestState === 'running'}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={runE2BTest}
            disabled={e2bTestState === 'running' || !clientId}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cta hover:bg-[#0A4F2C] text-white text-[13px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {e2bTestState === 'running' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Sandbox en cours…
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                Lancer un test sandbox
              </>
            )}
          </button>

          <AnimatePresence mode="wait">
            {e2bTestState === 'success' && e2bTestResult && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-4 p-4 rounded-xl bg-emerald-50/60 border border-emerald-100"
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-[13px] font-semibold text-emerald-800">
                    Décision agent : <span className="font-bold uppercase">{e2bTestResult.decision?.decision || '—'}</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3 text-[11px]">
                  <div>
                    <div className="text-[#71717a] uppercase tracking-wider font-semibold">Sandbox</div>
                    <div className="font-mono text-[#1a1a1a] truncate" title={e2bTestResult.sandbox_id}>
                      {(e2bTestResult.sandbox_id || '—').slice(0, 12)}…
                    </div>
                  </div>
                  <div>
                    <div className="text-[#71717a] uppercase tracking-wider font-semibold">Durée</div>
                    <div className="tabular-nums text-[#1a1a1a]">
                      {e2bTestResult.duration_ms ? `${(e2bTestResult.duration_ms / 1000).toFixed(1)}s` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#71717a] uppercase tracking-wider font-semibold">Isolation</div>
                    <div className="text-emerald-700 font-semibold">✓ Scellée</div>
                  </div>
                </div>
                <details className="text-[11px]">
                  <summary className="cursor-pointer text-[#71717a] hover:text-[#1a1a1a] transition-colors select-none">
                    Voir le payload + décision JSON brute
                  </summary>
                  <pre className="mt-2 p-3 rounded-lg bg-white border border-emerald-100 overflow-x-auto font-mono text-[10.5px] leading-relaxed text-[#1a1a1a]">
{JSON.stringify({ decision: e2bTestResult.decision, context: e2bTestResult.context }, null, 2)}
                  </pre>
                </details>
              </motion.div>
            )}
            {e2bTestState === 'error' && e2bTestResult && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-4 p-4 rounded-xl bg-red-50/60 border border-red-100"
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-[13px] font-semibold text-red-800">
                    Échec du sandbox
                  </span>
                </div>
                <div className="text-[12px] text-red-700 leading-relaxed">
                  {e2bTestResult.error || 'Erreur inconnue. Réessayez ou consultez les logs E2B.'}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ═══════ DISCOUNT POLICY (#6) — redesigned for plain-language ═══════ */}
        <div className="mt-3 bg-white rounded-2xl border border-[#E5E2D7] p-5">
          {/* Header + master toggle */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-cta/10 text-cta flex-shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[14px] font-semibold text-[#1a1a1a]">
                    Règles de remise automatiques
                  </h3>
                  {settings?.discount_policy_enabled && (
                    <span className="text-[10px] font-bold text-cta uppercase tracking-wider">Activées</span>
                  )}
                </div>
                <p className="text-[12px] text-[#71717a] leading-relaxed mt-1">
                  Quand l'agent doit proposer une remise (relance panier abandonné, geste commercial dans le chat, demande de réduction), ces règles décident automatiquement le pourcentage. Tu peux choisir un modèle ci-dessous ou personnaliser.
                </p>
                <p className="text-[11px] text-[#9ca3af] mt-1">
                  <strong className="text-[#71717a]">Garantie marge :</strong> aucune remise ne peut dépasser le plafond ({policyMaxPct}%) — même si la règle se trompe.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleDiscountPolicy}
              role="switch"
              aria-checked={Boolean(settings?.discount_policy_enabled)}
              aria-label={`${settings?.discount_policy_enabled ? 'Désactiver' : 'Activer'} les règles`}
              className={`relative w-[42px] h-[22px] rounded-full transition-colors flex-shrink-0 ${
                settings?.discount_policy_enabled
                  ? 'bg-cta shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]'
                  : 'bg-[#d4d4d8] hover:bg-[#a1a1aa]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)] transition-transform duration-200 ease-out ${
                  settings?.discount_policy_enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Templates — clic pour charger une stratégie pré-faite */}
          <div className="mb-5">
            <p className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-2">
              1. Choisis une stratégie
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {POLICY_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => loadTemplate(t)}
                  className="text-left p-3 rounded-xl border border-[#E5E2D7] bg-[#fafaf7] hover:border-cta/40 hover:bg-cta/5 transition"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-bold text-[#1a1a1a]">{t.name}</span>
                    <span className="text-[10px] text-cta font-semibold">{t.tag}</span>
                  </div>
                  <p className="text-[11px] text-[#71717a] leading-snug">{t.description}</p>
                  <p className="text-[10px] text-[#9ca3af] mt-1">Plafond : {t.maxPct}%</p>
                </button>
              ))}
            </div>
          </div>

          {/* Plafond global — un seul input, lisible */}
          <div className="mb-5 p-3 rounded-xl bg-[#fafaf7] border border-[#E5E2D7]">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-[#1a1a1a]">Plafond max de remise</p>
                <p className="text-[11px] text-[#71717a]">Aucune remise ne pourra dépasser ce pourcentage, quoi qu'il arrive.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={policyMaxPct}
                  onChange={(e) => { setPolicyMaxPct(e.target.value); setPolicyDirty(true) }}
                  className="w-20 text-[13px] rounded-lg border border-[#E5E2D7] bg-white px-3 py-1.5 text-[#1a1a1a] text-right focus:outline-none focus:ring-2 focus:ring-cta/30"
                />
                <span className="text-[13px] text-[#71717a]">%</span>
              </div>
            </div>
          </div>

          {/* Scenarios — boutons cliquables avec descriptions claires */}
          <div className="mb-4">
            <p className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-2">
              2. Simule un client pour voir la décision
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              {POLICY_SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => applyScenario(s)}
                  className={`text-left p-2 rounded-lg border transition ${
                    policyScenarioId === s.id
                      ? 'border-cta/40 bg-cta/5'
                      : 'border-[#E5E2D7] bg-white hover:border-cta/30'
                  }`}
                >
                  <p className="text-[12px] font-semibold text-[#1a1a1a]">{s.name}</p>
                  <p className="text-[10px] text-[#71717a] leading-snug">{s.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-2">
            <button
              type="button"
              onClick={() => runDiscountTest({ persist: false })}
              disabled={policyTestState === 'running' || !clientId}
              className="inline-flex items-center gap-2 rounded-xl bg-white border border-[#E5E2D7] px-4 py-2 text-[13px] font-semibold text-[#1a1a1a] hover:bg-[#fafafa] disabled:opacity-50"
            >
              {policyTestState === 'running' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Test en cours…</>
              ) : (
                <><FlaskConical className="w-4 h-4" /> Tester ce scénario</>
              )}
            </button>
            <button
              type="button"
              onClick={() => runDiscountTest({ persist: true })}
              disabled={policyTestState === 'running' || !clientId}
              className="inline-flex items-center gap-2 rounded-xl bg-cta px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#0a4a29] disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" /> Sauvegarder ces règles
            </button>
            {settings?.discount_policy_updated_at && (
              <span className="text-[11px] text-[#9ca3af] ml-auto">
                Dernière sauvegarde {new Date(settings.discount_policy_updated_at).toLocaleString('fr-FR', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            )}
          </div>

          <AnimatePresence>
            {policyTestState === 'success' && policyTestResult && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-3 p-4 rounded-xl bg-cta/5 border border-cta/20"
              >
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-cta flex-shrink-0" />
                  <span className="text-[14px] font-bold text-[#1a1a1a]">
                    L'agent proposera <span className="text-cta">{policyTestResult.decision?.discount_pct ?? 0}% de remise</span>
                  </span>
                </div>
                <p className="text-[12px] text-[#71717a] leading-relaxed pl-6">
                  Pour ce scénario (panier {policyMockCart}€, CLV {policyMockClv}€, {policyMockOrders} commande{policyMockOrders > 1 ? 's' : ''}), la règle <span className="font-mono text-[#1a1a1a]">{policyTestResult.decision?.reason || '—'}</span> s'applique.
                </p>
                {policyTestResult.decision?.capped_at != null && policyTestResult.decision.discount_pct === policyTestResult.decision.capped_at && policyTestResult.decision.discount_pct > 0 && (
                  <p className="text-[11px] text-amber-700 pl-6 mt-1">
                    ⚠️ Plafond {policyTestResult.decision.capped_at}% atteint — la règle voulait peut-être plus mais on protège ta marge.
                  </p>
                )}
                <p className="text-[10px] text-[#9ca3af] pl-6 mt-2">
                  Décision calculée en {policyTestResult.duration_ms} ms · trace dans agent_action_logs · sandbox {(policyTestResult.sandbox_id || '—').slice(0, 12)}
                </p>
              </motion.div>
            )}
            {policyTestState === 'error' && policyTestResult && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-3 p-4 rounded-xl bg-red-50/60 border border-red-100"
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span className="text-[13px] font-semibold text-red-800">La règle a échoué</span>
                </div>
                <div className="text-[12px] text-red-700 leading-relaxed pl-6">
                  {policyTestResult.decision?.detail || policyTestResult.error || 'Erreur inconnue.'}
                </div>
                {policyTestResult.decision?.trace && (
                  <div className="text-[11px] text-red-600/80 mt-2 pl-6 font-mono whitespace-pre-wrap">
                    {policyTestResult.decision.trace.join('\n')}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mode avancé — éditeur Python pliable */}
          <div className="mt-5 pt-4 border-t border-[#f3f3ed]">
            <button
              type="button"
              onClick={() => setPolicyShowCode((v) => !v)}
              className="flex items-center gap-2 text-[12px] font-semibold text-[#71717a] hover:text-[#1a1a1a]"
            >
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${policyShowCode ? 'rotate-90' : ''}`} />
              Mode avancé — édition du code Python (CTO / dev)
            </button>
            {policyShowCode && (
              <div className="mt-3">
                <p className="text-[11px] text-[#71717a] mb-2">
                  La règle est une fonction <code className="px-1 py-0.5 rounded bg-[#f5f5f5] font-mono text-[10px]">decide_discount(cart, customer, policy_caps)</code> exécutée dans un sandbox isolé E2B à chaque appel. Tu peux y mettre n'importe quelle logique conditionnelle Python. Le plafond ci-dessus s'applique <em>après</em> ton retour, donc une coquille ne peut jamais dépasser ta marge.
                </p>
                <textarea
                  value={policyCode}
                  onChange={(e) => { setPolicyCode(e.target.value); setPolicyDirty(true) }}
                  spellCheck={false}
                  rows={14}
                  className="w-full font-mono text-[12px] leading-relaxed rounded-xl border border-[#E5E2D7] bg-[#fafaf7] p-3 text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta/40"
                />
                {policyDirty && (
                  <div className="mt-1 text-[11px] text-amber-700">
                    Modifications non sauvegardées — clique sur « Sauvegarder ces règles » plus haut.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
