import React from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Bot, Settings, BookOpen, Shield, FlaskConical, Power, ChevronRight, Activity } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * Agent Control Center — central hub for the AI agent configuration.
 *
 * Single landing that shows agent status + quick links to the deep-config pages
 * (Configuration, KB, Règles, Simulateur). Avoids overwhelming the client with
 * a full nav tree; they land here, see what matters, click into details.
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

  const agentEnabled = settings?.agent_enabled !== false
  const brandToneSet = Boolean(settings?.brand_tone && settings.brand_tone.length > 20)

  const cards = [
    {
      id: 'agent-config',
      title: 'Configuration',
      description: 'Ton de marque, persona, limites de longueur',
      icon: Settings,
      status: brandToneSet ? '✓ Configuré' : 'À paramétrer',
      statusColor: brandToneSet ? 'text-emerald-600' : 'text-amber-600',
    },
    {
      id: 'knowledge',
      title: 'Base de connaissances',
      description: `${kbCount || 0} entrée${(kbCount || 0) > 1 ? 's' : ''} active${(kbCount || 0) > 1 ? 's' : ''}`,
      icon: BookOpen,
      status: (kbCount || 0) >= 5 ? '✓ Bien fournie' : (kbCount || 0) === 0 ? 'Vide' : 'À enrichir',
      statusColor: (kbCount || 0) >= 5 ? 'text-emerald-600' : (kbCount || 0) === 0 ? 'text-red-500' : 'text-amber-600',
    },
    {
      id: 'guardrails',
      title: 'Règles métier',
      description: 'Sujets autorisés, escalades, sécurité',
      icon: Shield,
      status: 'Configurable',
      statusColor: 'text-[#71717a]',
    },
    {
      id: 'simulator',
      title: 'Tester mon agent',
      description: 'Simulez une conversation pour vérifier le comportement',
      icon: FlaskConical,
      status: 'Prêt',
      statusColor: 'text-[#71717a]',
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 pt-6 pb-16 animate-fade-in-up">
      {/* Status hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-white rounded-2xl border border-[#f0f0f0] p-6 mb-6"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              agentEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-500'
            }`}>
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[18px] font-bold text-[#1a1a1a] tracking-tight">Agent IA</h1>
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  agentEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${agentEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                  {agentEnabled ? 'Actif' : 'En pause'}
                </span>
              </div>
              <p className="text-[12px] text-[#71717a] mt-0.5">
                {agentEnabled
                  ? 'Votre agent traite automatiquement les demandes clients.'
                  : 'Votre agent est en pause. Aucun message n\'est traité.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate && onNavigate('agent-config')}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-cta hover:text-[#003725] transition-colors"
          >
            Voir la configuration <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>

      {/* Control cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon
          return (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 * idx }}
              onClick={() => onNavigate && onNavigate(card.id)}
              className="group text-left bg-white rounded-2xl border border-[#f0f0f0] p-5 hover:border-cta/25 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-cta/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-cta" />
                </div>
                <ChevronRight className="w-4 h-4 text-[#9ca3af] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h3 className="text-[14px] font-semibold text-[#1a1a1a] mb-1">{card.title}</h3>
              <p className="text-[12px] text-[#71717a] leading-relaxed mb-2">{card.description}</p>
              <span className={`text-[11px] font-semibold ${card.statusColor}`}>{card.status}</span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
