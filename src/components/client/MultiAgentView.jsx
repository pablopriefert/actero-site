import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Network, Headphones, ShoppingCart, Heart, Truck,
  ArrowRight, Activity, Zap, Users, BarChart3, Clock,
  CheckCircle2, CircleDot
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const AGENTS = [
  {
    id: 'sav',
    name: 'Agent SAV',
    description: 'Retours, reclamations, problemes de commande',
    icon: Headphones,
    color: '#0F5F35',
    bgColor: '#E8F5E9',
    conversations: 1247,
    successRate: 94.2,
    defaultActive: true,
  },
  {
    id: 'prevente',
    name: 'Agent Prevente',
    description: 'Recommandations produits, disponibilite, conseils',
    icon: ShoppingCart,
    color: '#1E60A0',
    bgColor: '#E3F2FD',
    conversations: 863,
    successRate: 89.7,
    defaultActive: true,
  },
  {
    id: 'retention',
    name: 'Agent Retention',
    description: 'Prevention du churn, offres fidelite, win-back',
    icon: Heart,
    color: '#B45309',
    bgColor: '#FFF8E1',
    conversations: 412,
    successRate: 78.5,
    defaultActive: true,
  },
  {
    id: 'logistique',
    name: 'Agent Logistique',
    description: 'Suivi colis, problemes livraison, retours',
    icon: Truck,
    color: '#7C3AED',
    bgColor: '#F3E8FF',
    conversations: 695,
    successRate: 91.3,
    defaultActive: false,
  },
]

const STATS = {
  totalConversations: 3217,
  routingAccuracy: 96.4,
  avgResponseTime: '1.2s',
}

export function MultiAgentView({ clientId, theme }) {
  const toast = useToast()
  const [agentStates, setAgentStates] = useState(() =>
    Object.fromEntries(AGENTS.map((a) => [a.id, a.defaultActive]))
  )

  // Fetch agent configs from Supabase
  const { data: agentConfigs = [] } = useQuery({
    queryKey: ['agent-configs', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('client_id', clientId)
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  useEffect(() => {
    if (agentConfigs.length > 0) {
      const states = {}
      agentConfigs.forEach(c => { states[c.agent_type] = c.is_active })
      setAgentStates(prev => ({ ...prev, ...states }))
    }
  }, [agentConfigs])

  const toggleAgent = async (agentId) => {
    const newState = !agentStates[agentId]
    setAgentStates(prev => ({ ...prev, [agentId]: newState }))

    // Save to Supabase
    if (clientId) {
      await supabase.from('agent_configs').upsert({
        client_id: clientId,
        agent_type: agentId,
        is_active: newState,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id,agent_type' })
    }

    toast.success(newState ? 'Agent active avec succes' : 'Agent desactive')
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#003725] flex items-center justify-center">
          <Network className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#262626]">
            Orchestration Multi-Agents
          </h2>
          <p className="text-sm text-[#716D5C]">
            Routage intelligent vers des agents specialises
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Users}
          label="Total conversations routees"
          value={STATS.totalConversations.toLocaleString('fr-FR')}
        />
        <StatCard
          icon={BarChart3}
          label="Taux de routage correct"
          value={`${STATS.routingAccuracy}%`}
        />
        <StatCard
          icon={Clock}
          label="Temps moyen de reponse"
          value={STATS.avgResponseTime}
        />
      </div>

      {/* Agent cards */}
      <div>
        <p className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider mb-3">
          Agents specialises
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AGENTS.map((agent, i) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              active={agentStates[agent.id]}
              onToggle={() => toggleAgent(agent.id)}
              index={i}
            />
          ))}
        </div>
      </div>

      {/* Orchestrateur section */}
      <div>
        <p className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider mb-3">
          Orchestrateur
        </p>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#003725]/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#003725]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#262626]">
                Routeur Intelligent
              </h3>
              <p className="text-xs text-[#716D5C]">
                Detection d'intention et dispatch automatique vers l'agent le
                plus adapte
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#716D5C]">
            <div className="bg-[#F5F5F0] rounded-xl p-3">
              <p className="font-semibold text-[#262626] mb-1">
                Detection d'intention
              </p>
              <p>Analyse le message client pour identifier le besoin</p>
            </div>
            <div className="bg-[#F5F5F0] rounded-xl p-3">
              <p className="font-semibold text-[#262626] mb-1">
                Selection d'agent
              </p>
              <p>Choisit l'agent specialise selon l'intention detectee</p>
            </div>
            <div className="bg-[#F5F5F0] rounded-xl p-3">
              <p className="font-semibold text-[#262626] mb-1">
                Suivi & Escalade
              </p>
              <p>Monitore la conversation et escalade si necessaire</p>
            </div>
          </div>
        </div>
      </div>

      {/* Flow diagram */}
      <div>
        <p className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider mb-3">
          Flux de routage
        </p>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <div className="flex flex-col items-center gap-4">
            {/* Client */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-[#F5F5F0] rounded-full px-5 py-2.5"
            >
              <Users className="w-4 h-4 text-[#262626]" />
              <span className="text-sm font-semibold text-[#262626]">
                Client
              </span>
            </motion.div>

            {/* Arrow down */}
            <div className="w-px h-6 bg-gray-300" />
            <ArrowRight className="w-4 h-4 text-gray-400 rotate-90" />

            {/* Router */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-2 bg-[#003725] rounded-full px-5 py-2.5"
            >
              <Activity className="w-4 h-4 text-white" />
              <span className="text-sm font-semibold text-white">Routeur</span>
            </motion.div>

            {/* Arrow down */}
            <div className="w-px h-6 bg-gray-300" />
            <ArrowRight className="w-4 h-4 text-gray-400 rotate-90" />

            {/* Agent pills */}
            <div className="flex flex-wrap justify-center gap-3">
              {AGENTS.map((agent, i) => {
                const Icon = agent.icon
                return (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.08 }}
                    className="flex items-center gap-2 rounded-full px-4 py-2 border"
                    style={{
                      borderColor: agent.color,
                      backgroundColor: agent.bgColor,
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: agent.color }} />
                    <span
                      className="text-xs font-semibold"
                      style={{ color: agent.color }}
                    >
                      {agent.name}
                    </span>
                    <CircleDot
                      className="w-3 h-3"
                      style={{
                        color: agentStates[agent.id] ? agent.color : '#9CA3AF',
                      }}
                    />
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-[#003725]/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#003725]" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">
          {label}
        </p>
        <p className="text-lg font-bold text-[#262626]">{value}</p>
      </div>
    </div>
  )
}

function AgentCard({ agent, active, onToggle, index }) {
  const Icon = agent.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: agent.bgColor }}
          >
            <Icon className="w-5 h-5" style={{ color: agent.color }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#262626]">
              {agent.name}
            </h3>
            <p className="text-xs text-[#716D5C]">{agent.description}</p>
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={onToggle}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            active ? 'bg-[#0F5F35]' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              active ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className="flex items-center gap-4 mt-4">
        <div>
          <p className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">
            Conversations
          </p>
          <p className="text-base font-bold text-[#262626]">
            {agent.conversations.toLocaleString('fr-FR')}
          </p>
        </div>
        <div className="w-px h-8 bg-gray-100" />
        <div>
          <p className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">
            Taux de succes
          </p>
          <div className="flex items-center gap-1.5">
            <CheckCircle2
              className="w-3.5 h-3.5"
              style={{ color: agent.color }}
            />
            <p className="text-base font-bold text-[#262626]">
              {agent.successRate}%
            </p>
          </div>
        </div>
        <div className="ml-auto">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
              active
                ? 'bg-green-50 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                active ? 'bg-green-500' : 'bg-gray-400'
              }`}
            />
            {active ? 'Actif' : 'Inactif'}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
