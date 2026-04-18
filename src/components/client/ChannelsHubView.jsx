import React from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Mail, Phone, MessageCircle, MessagesSquare, ChevronRight, Check, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * Channels Hub — consolidates all customer-facing channels in one view.
 *
 * Shows Email, Voice, Chat, WhatsApp as cards with current status + quick
 * access to configure/connect.
 */
export const ChannelsHubView = ({ clientId, onNavigate }) => {
  const { data: integrations } = useQuery({
    queryKey: ['channels-status', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data } = await supabase
        .from('client_integrations')
        .select('provider, status')
        .eq('client_id', clientId)
      return data || []
    },
    enabled: !!clientId,
  })

  const { data: voiceAgent } = useQuery({
    queryKey: ['voice-agent-status', clientId],
    queryFn: async () => {
      if (!clientId) return null
      // Use the client_settings.voice_agent_enabled flag which is the source of truth
      const { data } = await supabase
        .from('client_settings')
        .select('voice_agent_enabled, elevenlabs_agent_id')
        .eq('client_id', clientId)
        .maybeSingle()
      return data ? { status: (data.voice_agent_enabled && data.elevenlabs_agent_id) ? 'active' : null } : null
    },
    enabled: !!clientId,
  })

  const emailConnected = (integrations || []).some(i =>
    ['gmail', 'outlook', 'resend'].includes(i.provider) && i.status === 'active',
  )
  const helpdeskConnected = (integrations || []).some(i =>
    ['gorgias', 'zendesk', 'intercom'].includes(i.provider) && i.status === 'active',
  )
  const voiceConnected = !!voiceAgent && voiceAgent.status === 'active'

  const channels = [
    {
      id: 'email',
      name: 'Email',
      description: 'Répondre aux emails SAV entrants automatiquement',
      icon: Mail,
      color: '#4285F4',
      status: emailConnected ? 'connected' : 'available',
      targetTab: emailConnected ? 'email-agent' : 'integrations',
    },
    {
      id: 'chat',
      name: 'Chat / Helpdesk',
      description: 'Gorgias, Zendesk, Intercom — l\'agent répond dans votre helpdesk',
      icon: MessagesSquare,
      color: '#FF6B6B',
      status: helpdeskConnected ? 'connected' : 'available',
      targetTab: 'integrations',
    },
    {
      id: 'voice',
      name: 'Agent vocal',
      description: 'Un numéro qui répond aux appels clients 24/7',
      icon: Phone,
      color: '#8B5CF6',
      status: voiceConnected ? 'connected' : 'available',
      targetTab: 'voice-agent',
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      description: 'Messaging WhatsApp natif avec l\'agent IA',
      icon: MessageCircle,
      color: '#25D366',
      status: 'coming-soon',
      targetTab: null,
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 pt-6 pb-16 animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-[22px] font-bold text-[#1a1a1a] tracking-tight mb-1">Canaux</h1>
        <p className="text-[13px] text-[#71717a]">
          Tous les canaux où votre agent répond aux clients.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {channels.map((ch, idx) => {
          const Icon = ch.icon
          const isAvailable = ch.status !== 'coming-soon'
          const isConnected = ch.status === 'connected'
          return (
            <motion.button
              key={ch.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.04 * idx }}
              disabled={!isAvailable}
              onClick={() => isAvailable && ch.targetTab && onNavigate && onNavigate(ch.targetTab)}
              className={`group text-left bg-white rounded-2xl border p-5 transition-all ${
                isAvailable
                  ? 'border-[#f0f0f0] hover:border-cta/25 hover:shadow-sm cursor-pointer'
                  : 'border-[#f0f0f0] opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${ch.color}15` }}
                >
                  <Icon className="w-5 h-5" style={{ color: ch.color }} />
                </div>
                {isConnected && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                    <Check className="w-2.5 h-2.5" />
                    Connecté
                  </span>
                )}
                {ch.status === 'coming-soon' && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    Bientôt
                  </span>
                )}
                {ch.status === 'available' && (
                  <ChevronRight className="w-4 h-4 text-[#9ca3af] opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
              <h3 className="text-[14px] font-semibold text-[#1a1a1a] mb-1">{ch.name}</h3>
              <p className="text-[12px] text-[#71717a] leading-relaxed">{ch.description}</p>
              {ch.status === 'available' && (
                <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-cta">
                  <Plus className="w-3.5 h-3.5" />
                  Activer ce canal
                </div>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
