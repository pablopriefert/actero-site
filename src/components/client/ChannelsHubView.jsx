import React from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Mail, Phone, MessageCircle, MessagesSquare, ChevronRight, Check, Plus, Radio } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * Channels Hub — refondu avril 2026.
 *
 * Avant : 4 cards same design + zéro metric par canal.
 * Après : header strip avec count global + metrics 7j par canal connecté
 * + hiérarchie visuelle (connected > available > coming-soon).
 *
 * Pattern cohérent avec Overview + Automation Hub + Agent Control.
 */
export const ChannelsHubView = ({ clientId, onNavigate }) => {
  const { data: integrations } = useQuery({
    queryKey: ['channels-status', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data } = await supabase
        .from('client_integrations')
        .select('provider, status, config')
        .eq('client_id', clientId)
      return data || []
    },
    enabled: !!clientId,
  })

  const { data: voiceAgent } = useQuery({
    queryKey: ['voice-agent-status', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const { data } = await supabase
        .from('client_settings')
        .select('voice_agent_enabled, elevenlabs_agent_id, voice_agent_phone')
        .eq('client_id', clientId)
        .maybeSingle()
      return data
        ? {
            status: (data.voice_agent_enabled && data.elevenlabs_agent_id) ? 'active' : null,
            phone: data.voice_agent_phone,
          }
        : null
    },
    enabled: !!clientId,
  })

  // Per-channel metrics 7j — compte par source_channel
  const { data: channelStats } = useQuery({
    queryKey: ['channels-metrics-7d', clientId],
    queryFn: async () => {
      if (!clientId) return {}
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
      const { data } = await supabase
        .from('automation_events')
        .select('source_channel, event_category')
        .eq('client_id', clientId)
        .eq('event_category', 'ticket_resolved')
        .gte('created_at', since)
      const counts = {}
      ;(data || []).forEach(e => {
        if (!e.source_channel) return
        counts[e.source_channel] = (counts[e.source_channel] || 0) + 1
      })
      return counts
    },
    enabled: !!clientId,
    refetchInterval: 60000,
  })

  const emailConnected = (integrations || []).some(i =>
    ['gmail', 'outlook', 'resend', 'smtp_imap'].includes(i.provider) && i.status === 'active',
  )
  const helpdeskConnected = (integrations || []).some(i =>
    ['gorgias', 'zendesk', 'intercom'].includes(i.provider) && i.status === 'active',
  )
  const voiceConnected = !!voiceAgent && voiceAgent.status === 'active'

  // Email address (if connected, try to extract from config)
  const emailProvider = (integrations || []).find(i =>
    ['gmail', 'outlook', 'smtp_imap'].includes(i.provider) && i.status === 'active',
  )
  const emailAddress = emailProvider?.config?.email || emailProvider?.config?.from_email || null

  const helpdeskProvider = (integrations || []).find(i =>
    ['gorgias', 'zendesk', 'intercom'].includes(i.provider) && i.status === 'active',
  )
  const helpdeskName = helpdeskProvider?.provider
    ? helpdeskProvider.provider.charAt(0).toUpperCase() + helpdeskProvider.provider.slice(1)
    : null

  const channels = [
    {
      id: 'email',
      name: 'Email',
      description: 'Répondre aux emails SAV entrants automatiquement',
      icon: Mail,
      color: '#4285F4',
      status: emailConnected ? 'connected' : 'available',
      targetTab: emailConnected ? 'email-agent' : 'integrations',
      detail: emailAddress,
      metric: channelStats?.email || channelStats?.gmail || channelStats?.imap || 0,
    },
    {
      id: 'chat',
      name: 'Chat / Helpdesk',
      description: 'Gorgias, Zendesk, Intercom — l\'agent répond dans votre helpdesk',
      icon: MessagesSquare,
      color: '#FF6B6B',
      status: helpdeskConnected ? 'connected' : 'available',
      targetTab: 'integrations',
      detail: helpdeskName,
      metric: (channelStats?.gorgias || 0) + (channelStats?.zendesk || 0) + (channelStats?.intercom || 0),
    },
    {
      id: 'voice',
      name: 'Agent vocal',
      description: 'Un numéro qui répond aux appels clients 24/7',
      icon: Phone,
      color: '#8B5CF6',
      status: voiceConnected ? 'connected' : 'available',
      targetTab: 'voice-agent',
      detail: voiceAgent?.phone || null,
      metric: channelStats?.voice || 0,
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      description: 'Messaging WhatsApp natif avec l\'agent IA',
      icon: MessageCircle,
      color: '#25D366',
      status: 'coming-soon',
      targetTab: null,
      detail: null,
      metric: 0,
    },
  ]

  const connectedCount = channels.filter(ch => ch.status === 'connected').length
  const availableCount = channels.filter(ch => ch.status !== 'coming-soon').length
  const totalWeek = Object.values(channelStats || {}).reduce((a, b) => a + b, 0)

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 pt-6 pb-16 animate-fade-in-up">
      {/* ═══════ HEADER STRIP ═══════ */}
      <div className="bg-white border border-[#E5E2D7] rounded-2xl p-5 md:p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-cta/10 flex items-center justify-center">
                <Radio className="w-3.5 h-3.5 text-cta" />
              </div>
              <h1 className="text-lg font-bold text-[#1a1a1a]">Canaux</h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-cta/10 text-cta text-[10px] font-bold rounded-full uppercase tracking-wider">
                {connectedCount}/{availableCount} connectés
              </span>
            </div>
            <p className="text-[12px] text-[#71717a]">
              Tous les canaux où votre agent répond aux clients.
            </p>
          </div>
          <div className="flex items-center gap-4 md:gap-6 flex-wrap">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">7 derniers jours</span>
              <span className="text-lg font-bold text-[#1a1a1a] tabular-nums leading-tight">{totalWeek}</span>
              <span className="text-[10px] text-[#9ca3af]">
                {totalWeek === 1 ? 'demande traitée' : 'demandes traitées'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ CHANNELS GRID ═══════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                isConnected
                  ? 'border-cta/30 hover:shadow-[0_1px_3px_rgba(0,0,0,0.04)] cursor-pointer'
                  : isAvailable
                    ? 'border-[#E5E2D7] hover:border-gray-300 hover:shadow-[0_1px_3px_rgba(0,0,0,0.04)] cursor-pointer'
                    : 'border-[#E5E2D7] opacity-50 cursor-not-allowed'
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
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cta/10 text-cta uppercase tracking-wider">
                    <Check className="w-2.5 h-2.5" />
                    Connecté
                  </span>
                )}
                {ch.status === 'coming-soon' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 uppercase tracking-wider">
                    Bientôt
                  </span>
                )}
                {ch.status === 'available' && (
                  <ChevronRight className="w-4 h-4 text-[#9ca3af] opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
              <h3 className="text-[14px] font-semibold text-[#1a1a1a] mb-1">{ch.name}</h3>
              <p className="text-[12px] text-[#71717a] leading-relaxed mb-3">{ch.description}</p>

              {/* Connected state : detail + metric 7d */}
              {isConnected && (
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#E5E2D7]">
                  {ch.detail && (
                    <span className="text-[11px] font-mono text-[#71717a] truncate" title={ch.detail}>
                      {ch.detail}
                    </span>
                  )}
                  <span className="text-[11px] font-semibold text-cta tabular-nums flex-shrink-0 ml-auto">
                    {ch.metric} demande{ch.metric !== 1 ? 's' : ''} / 7j
                  </span>
                </div>
              )}
              {/* Available state : activation CTA */}
              {ch.status === 'available' && (
                <div className="inline-flex items-center gap-1 text-[12px] font-semibold text-cta mt-1">
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
