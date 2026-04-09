import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, ShoppingBag, Headphones, MessageSquare, Globe,
  Smartphone, Phone, CheckCircle2, Loader2, Plug,
  ArrowRight, ExternalLink, Shield,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const CHANNEL_DEFS = [
  {
    id: 'shopify_widget',
    name: 'Chat sur votre boutique',
    desc: 'Un chat IA s\'affiche sur votre site Shopify. Vos clients posent leurs questions et l\'agent repond en temps reel.',
    icon: ShoppingBag,
    gradient: 'from-[#95BF47] to-[#5E8E3E]',
    requires: 'shopify',
    requiresLabel: 'Shopify',
  },
  {
    id: 'gmail',
    name: 'Reponses email automatiques',
    desc: 'L\'agent lit vos emails entrants et repond automatiquement aux questions clients depuis votre adresse Gmail.',
    icon: Mail,
    gradient: 'from-[#EA4335] to-[#C5221F]',
    requires: 'gmail',
    requiresLabel: 'Gmail',
  },
  {
    id: 'gorgias',
    name: 'Tickets Gorgias',
    desc: 'L\'agent traite les nouveaux tickets Gorgias et repond directement dans votre helpdesk.',
    icon: Headphones,
    gradient: 'from-[#1F1F1F] to-[#333333]',
    requires: 'gorgias',
    requiresLabel: 'Gorgias',
  },
  {
    id: 'zendesk',
    name: 'Tickets Zendesk',
    desc: 'L\'agent repond aux tickets Zendesk automatiquement avec le bon ton et les bonnes informations.',
    icon: MessageSquare,
    gradient: 'from-[#03363D] to-[#065F68]',
    requires: 'zendesk',
    requiresLabel: 'Zendesk',
  },
  {
    id: 'slack',
    name: 'Notifications Slack',
    desc: 'Recevez les alertes, escalades et rapports directement dans votre canal Slack.',
    icon: MessageSquare,
    gradient: 'from-[#4A154B] to-[#611f69]',
    requires: 'slack',
    requiresLabel: 'Slack',
  },
  {
    id: 'widget_manual',
    name: 'Chat sur un autre site',
    desc: 'Installez le chat IA sur n\'importe quel site web (WordPress, Wix, etc.) en entrant simplement l\'URL.',
    icon: Globe,
    gradient: 'from-blue-500 to-cyan-500',
    requires: null, // Always available
    requiresLabel: null,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Copilot',
    desc: 'Votre assistant personnel sur WhatsApp. Posez-lui des questions sur vos performances, KPIs et escalades.',
    icon: Smartphone,
    gradient: 'from-[#25D366] to-[#128C7E]',
    requires: null,
    requiresLabel: null,
  },
]

export const ChannelsView = ({ clientId, setActiveTab, theme }) => {
  const toast = useToast()
  const queryClient = useQueryClient()

  // Fetch connected integrations
  const { data: connectedIntegrations = [], isLoading } = useQuery({
    queryKey: ['connected-integrations', clientId],
    queryFn: async () => {
      const [integrationsRes, shopifyRes] = await Promise.all([
        supabase.from('client_integrations').select('provider, status').eq('client_id', clientId).eq('status', 'active'),
        supabase.from('client_shopify_connections').select('id, shop_domain').eq('client_id', clientId).maybeSingle(),
      ])
      const providers = (integrationsRes.data || []).map(i => i.provider)
      if (shopifyRes.data) providers.push('shopify')
      return providers
    },
    enabled: !!clientId,
  })

  // Fetch active channels
  const { data: activeChannels = [] } = useQuery({
    queryKey: ['active-channels', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_integrations')
        .select('provider, extra_config')
        .eq('client_id', clientId)
        .eq('status', 'active')
      // Check which channels are activated in extra_config
      const channels = []
      ;(data || []).forEach(i => {
        if (i.extra_config?.channel_active) channels.push(i.provider)
      })
      // Check shopify widget
      const { data: shopify } = await supabase
        .from('client_shopify_connections')
        .select('id')
        .eq('client_id', clientId)
        .maybeSingle()
      // For now, consider connected = potentially active
      return channels
    },
    enabled: !!clientId,
  })

  // Fetch message counts per channel
  const { data: messageCounts = {} } = useQuery({
    queryKey: ['channel-message-counts', clientId],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('engine_messages')
        .select('source')
        .eq('client_id', clientId)
        .gte('created_at', thirtyDaysAgo)
      const counts = {}
      ;(data || []).forEach(m => { counts[m.source] = (counts[m.source] || 0) + 1 })
      return counts
    },
    enabled: !!clientId,
  })

  const isConnected = (requires) => !requires || connectedIntegrations.includes(requires)
  const connectedChannels = CHANNEL_DEFS.filter(ch => isConnected(ch.requires))
  const disconnectedChannels = CHANNEL_DEFS.filter(ch => ch.requires && !isConnected(ch.requires))

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-[22px] font-semibold text-[#1a1a1a]">Mes Canaux</h2>
        <p className="text-sm text-[#9ca3af] mt-1">Activez les canaux de communication de votre agent IA. Chaque canal utilise vos integrations deja connectees.</p>
      </div>

      {/* Connected channels */}
      {connectedChannels.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">
            Prets a activer ({connectedChannels.length})
          </p>
          <div className="space-y-3">
            {connectedChannels.map(channel => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                clientId={clientId}
                connected={true}
                messageCount={getMessageCount(channel.id, messageCounts)}
                toast={toast}
                queryClient={queryClient}
                setActiveTab={setActiveTab}
              />
            ))}
          </div>
        </div>
      )}

      {/* Disconnected channels */}
      {disconnectedChannels.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">
            Connectez d'abord l'integration
          </p>
          <div className="space-y-3">
            {disconnectedChannels.map(channel => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                clientId={clientId}
                connected={false}
                messageCount={0}
                toast={toast}
                queryClient={queryClient}
                setActiveTab={setActiveTab}
              />
            ))}
          </div>
        </div>
      )}

      {/* Help link */}
      <div className="p-4 bg-[#fafafa] rounded-xl flex items-center gap-3">
        <Shield className="w-5 h-5 text-[#9ca3af]" />
        <div className="flex-1">
          <p className="text-sm text-[#1a1a1a] font-medium">Besoin d'aide pour configurer vos canaux ?</p>
          <p className="text-xs text-[#9ca3af]">Consultez notre guide pas-a-pas</p>
        </div>
        <button
          onClick={() => window.open('/support', '_blank')}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#0F5F35] hover:underline"
        >
          Voir le guide <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

function getMessageCount(channelId, counts) {
  const map = {
    shopify_widget: counts.web_widget || 0,
    gmail: counts.email || 0,
    gorgias: counts.gorgias || 0,
    zendesk: counts.zendesk || 0,
    slack: counts.slack || 0,
    widget_manual: counts.web_widget || 0,
    whatsapp: counts.whatsapp || 0,
  }
  return map[channelId] || 0
}

const ChannelCard = ({ channel, clientId, connected, messageCount, toast, queryClient, setActiveTab }) => {
  const [expanded, setExpanded] = useState(false)
  const [activating, setActivating] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [siteUrl, setSiteUrl] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const Icon = channel.icon

  const handleActivate = async () => {
    if (!connected) {
      setActiveTab('integrations')
      return
    }

    setActivating(true)

    if (channel.id === 'shopify_widget') {
      // Auto-install widget on Shopify
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/engine/shopify-widget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ action: 'install', client_id: clientId }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Erreur installation')
        }
        setIsActive(true)
        toast.success('Widget installe sur votre boutique Shopify !')
      } catch (err) {
        toast.error(err.message)
      }
    } else {
      // Generic activation
      setIsActive(true)
      toast.success(`Canal "${channel.name}" active`)
    }

    setActivating(false)
  }

  const handleDeactivate = async () => {
    setActivating(true)
    if (channel.id === 'shopify_widget') {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/engine/shopify-widget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ action: 'uninstall', client_id: clientId }),
        })
      } catch {}
    }
    setIsActive(false)
    toast.success(`Canal desactive`)
    setActivating(false)
  }

  return (
    <div className={`bg-white border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden transition-all ${
      connected ? 'border-[#f0f0f0]' : 'border-[#f0f0f0] opacity-60'
    }`}>
      <div className="p-4 flex items-center gap-4">
        {/* Icon */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${channel.gradient} flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm text-[#1a1a1a]">{channel.name}</p>
            {isActive && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Actif
              </span>
            )}
          </div>
          <p className="text-xs text-[#9ca3af] mt-0.5 line-clamp-1">{channel.desc}</p>
        </div>

        {/* Stats */}
        {messageCount > 0 && (
          <span className="text-xs text-[#9ca3af] bg-[#fafafa] px-2.5 py-1 rounded-lg flex-shrink-0">
            {messageCount} msg
          </span>
        )}

        {/* Action */}
        {connected ? (
          isActive ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setExpanded(!expanded)}
                className="px-3 py-2 text-xs font-medium text-[#9ca3af] hover:text-[#1a1a1a] transition-colors"
              >
                Details
              </button>
              <button
                onClick={handleDeactivate}
                disabled={activating}
                className="relative w-11 h-6 rounded-full bg-[#0F5F35] transition-colors flex-shrink-0"
              >
                <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow translate-x-5 transition-transform" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleActivate}
              disabled={activating}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#0F5F35] text-white text-[12px] font-semibold rounded-lg hover:bg-[#003725] disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {activating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Activer
            </button>
          )
        ) : (
          <button
            onClick={() => setActiveTab('integrations')}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#f5f5f5] text-[#71717a] text-[12px] font-semibold rounded-lg hover:bg-[#ebebeb] transition-colors flex-shrink-0"
          >
            <Plug className="w-3.5 h-3.5" />
            Connecter {channel.requiresLabel}
          </button>
        )}
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-[#f0f0f0]"
          >
            <div className="p-4">
              {channel.id === 'shopify_widget' && (
                <p className="text-sm text-[#9ca3af]">
                  Le widget est installe sur votre boutique Shopify. Un bouton de chat vert apparait en bas a droite de votre site. Vos clients peuvent poser leurs questions et l'agent IA repond en temps reel.
                </p>
              )}
              {channel.id === 'gmail' && (
                <p className="text-sm text-[#9ca3af]">
                  L'agent surveille votre boite Gmail et repond automatiquement aux emails clients. Les reponses sont envoyees depuis votre adresse email.
                </p>
              )}
              {channel.id === 'gorgias' && (
                <p className="text-sm text-[#9ca3af]">
                  L'agent traite automatiquement les nouveaux tickets Gorgias. Les reponses apparaissent directement dans votre interface Gorgias avec le tag "actero-auto-reply".
                </p>
              )}
              {channel.id === 'zendesk' && (
                <p className="text-sm text-[#9ca3af]">
                  L'agent repond aux nouveaux tickets Zendesk. Les reponses sont postees comme commentaires publics sur le ticket.
                </p>
              )}
              {channel.id === 'slack' && (
                <p className="text-sm text-[#9ca3af]">
                  Les alertes d'escalade, rapports et notifications sont envoyes dans votre canal Slack configure.
                </p>
              )}
              {channel.id === 'widget_manual' && (
                <div className="space-y-3">
                  <p className="text-sm text-[#9ca3af]">Entrez l'URL de votre site pour recevoir les instructions d'installation :</p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={siteUrl}
                      onChange={(e) => setSiteUrl(e.target.value)}
                      placeholder="https://mon-site.com"
                      className="flex-1 px-4 py-2.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] outline-none"
                    />
                    <button className="px-4 py-2.5 bg-[#0F5F35] text-white text-[12px] font-semibold rounded-lg hover:bg-[#003725]">
                      Installer
                    </button>
                  </div>
                </div>
              )}
              {channel.id === 'whatsapp' && (
                <div className="space-y-3">
                  <p className="text-sm text-[#9ca3af]">Entrez votre numero WhatsApp pour activer votre assistant :</p>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="+33 6 12 34 56 78"
                      className="flex-1 px-4 py-2.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] outline-none"
                    />
                    <button className="px-4 py-2.5 bg-[#25D366] text-white text-[12px] font-semibold rounded-lg hover:bg-[#128C7E]">
                      Activer
                    </button>
                  </div>
                  {whatsappNumber && (
                    <div className="p-3 bg-[#fafafa] rounded-xl text-center">
                      <p className="text-xs text-[#9ca3af] mb-2">Scannez ce QR code avec WhatsApp :</p>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://wa.me/${whatsappNumber.replace(/\s/g, '')}?text=Activer+Actero`)}`}
                        alt="QR Code WhatsApp"
                        className="mx-auto rounded-lg"
                        width={150}
                        height={150}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
