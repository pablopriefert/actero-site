import React from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Bot, Settings, BookOpen, Shield, FlaskConical, ChevronRight, Activity, Clock, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

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
  const { data: settings } = useQuery({
    queryKey: ['client-settings', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const { data } = await supabase
        .from('client_settings')
        .select('agent_enabled, brand_tone, updated_at')
        .eq('client_id', clientId)
        .maybeSingle()
      return data
    },
    enabled: !!clientId,
  })

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
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  agentEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${agentEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                  {agentEnabled ? 'Actif' : 'En pause'}
                </span>
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
              <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">24h</span>
              <span className="text-lg font-bold text-[#1a1a1a] tabular-nums leading-tight">{resolved}</span>
              <span className="text-[10px] text-[#9ca3af]">{resolved === 1 ? 'résolue' : 'résolues'}</span>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Latence</span>
              <span className="text-lg font-bold text-[#1a1a1a] tabular-nums leading-tight">{fmtLatency(avgLatency)}</span>
              <span className="text-[10px] text-[#9ca3af]">moyenne</span>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Qualité</span>
              <span className="text-lg font-bold text-cta tabular-nums leading-tight">
                {successRate !== null && successRate !== undefined ? `${successRate}%` : '—'}
              </span>
              <span className="text-[10px] text-[#9ca3af]">feedback +</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ CONFIG SECTION ═══════ */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[13px] font-bold text-[#1a1a1a]">Configuration</h2>
          <span className="text-[11px] text-[#9ca3af]">Comment l'agent se comporte</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {configCards.map((c, i) => renderCard(c, i))}
        </div>
      </section>

      {/* ═══════ TOOLING SECTION ═══════ */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[13px] font-bold text-[#1a1a1a]">Tester & itérer</h2>
          <span className="text-[11px] text-[#9ca3af]">Valider avant mise en prod</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {toolingCards.map((c, i) => renderCard(c, i))}
        </div>
      </section>
    </div>
  )
}
