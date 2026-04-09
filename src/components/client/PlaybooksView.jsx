import React, { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, ShoppingBag, Headphones, Loader2, Play,
  CheckCircle2, AlertTriangle, Plug, Star, Shield,
  Heart, Search, TrendingUp, Package, Gift, Mail,
  MessageSquare, ArrowRight, Copy, Check, Phone,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import { VocalAgentWizard } from './VocalAgentWizard'

/* ═══════════ CATEGORIES ═══════════ */

const CATEGORIES = [
  {
    id: 'support',
    label: 'Support & SAV',
    desc: 'Repondez aux demandes de vos clients automatiquement, 24h/24.',
    playbooks: ['sav_ecommerce'],
  },
  {
    id: 'sales',
    label: 'Ventes & Conversion',
    desc: 'Recuperez les ventes perdues et augmentez votre chiffre d\'affaires.',
    playbooks: ['abandoned_cart'],
  },
  {
    id: 'finance',
    label: 'Comptabilite & Finance',
    desc: 'Automatisez vos taches comptables et suivez votre tresorerie.',
    playbooks: ['comptabilite_auto'],
  },
  {
    id: 'vocal',
    label: 'Agents Vocaux',
    desc: 'Un agent telephonique IA qui repond a vos appels.',
    playbooks: ['agent_vocal'],
  },
]

const PLAYBOOK_META = {
  sav_ecommerce: {
    icon: Headphones, color: 'from-emerald-500 to-emerald-600',
    simpleDesc: 'Repond automatiquement aux questions de vos clients (commandes, retours, produits).',
    requires: [],
    channels: [
      { id: 'email', label: 'Email', desc: 'Repond aux emails entrants', icon: Mail, needsIntegration: ['gmail', 'smtp_imap'] },
      { id: 'widget', label: 'Chat sur le site', desc: 'Widget de chat sur votre boutique', icon: MessageSquare, needsIntegration: ['shopify'] },
      { id: 'gorgias', label: 'Gorgias', desc: 'Repond aux tickets Gorgias', icon: Headphones, needsIntegration: ['gorgias'] },
      { id: 'zendesk', label: 'Zendesk', desc: 'Repond aux tickets Zendesk', icon: Headphones, needsIntegration: ['zendesk'] },
    ],
  },
  abandoned_cart: {
    icon: ShoppingBag, color: 'from-amber-500 to-amber-600',
    simpleDesc: 'Relance les clients qui ont abandonne leur panier avec un email personnalise.',
    requires: [{ type: 'all', providers: ['shopify'], label: 'Shopify' }],
    channels: [
      { id: 'email', label: 'Email', desc: 'Envoie un email de relance', icon: Mail, needsIntegration: ['gmail', 'smtp_imap'] },
      { id: 'sms', label: 'SMS', desc: 'Envoie un SMS de relance', icon: MessageSquare, needsIntegration: ['klaviyo'] },
    ],
  },
  shipping_tracker: {
    icon: Package, color: 'from-blue-500 to-blue-600',
    simpleDesc: 'Repond aux questions "ou est mon colis ?" avec le vrai statut de la commande.',
    requires: [
      { type: 'all', providers: ['shopify'], label: 'Shopify' },
      { type: 'any', providers: ['gmail', 'gorgias', 'zendesk'], label: 'Gmail, Gorgias ou Zendesk' },
    ],
  },
  order_issue_handler: {
    icon: AlertTriangle, color: 'from-red-500 to-red-600',
    simpleDesc: 'Gere les problemes de commande : retard, colis abime, article manquant.',
    requires: [{ type: 'any', providers: ['gmail', 'gorgias', 'zendesk'], label: 'Gmail, Gorgias ou Zendesk' }],
  },
  promo_code_handler: {
    icon: Gift, color: 'from-pink-500 to-pink-600',
    simpleDesc: 'Aide les clients dont le code promo ne fonctionne pas.',
    requires: [{ type: 'any', providers: ['gmail'], label: 'Gmail' }],
  },
  vip_customer_care: {
    icon: Star, color: 'from-violet-500 to-violet-600',
    simpleDesc: 'Detecte vos meilleurs clients et leur repond en priorite.',
    requires: [
      { type: 'any', providers: ['gmail', 'gorgias', 'zendesk'], label: 'Gmail, Gorgias ou Zendesk' },
      { type: 'all', providers: ['slack'], label: 'Slack' },
    ],
  },
  anti_churn: {
    icon: Shield, color: 'from-rose-500 to-rose-600',
    simpleDesc: 'Detecte les clients mecontents et lance une action de retention.',
    requires: [{ type: 'any', providers: ['gmail', 'gorgias', 'zendesk'], label: 'Gmail, Gorgias ou Zendesk' }],
  },
  post_purchase_followup: {
    icon: Mail, color: 'from-cyan-500 to-cyan-600',
    simpleDesc: 'Envoie un email de remerciement et conseils 3 jours apres la commande.',
    requires: [{ type: 'all', providers: ['shopify'], label: 'Shopify' }],
  },
  winback_inactive: {
    icon: TrendingUp, color: 'from-indigo-500 to-indigo-600',
    simpleDesc: 'Relance les clients qui n\'ont pas commande depuis 60 jours.',
    requires: [{ type: 'all', providers: ['shopify'], label: 'Shopify' }],
  },
  review_collector: {
    icon: MessageSquare, color: 'from-teal-500 to-teal-600',
    simpleDesc: 'Demande un avis client 7 jours apres la livraison.',
    requires: [{ type: 'all', providers: ['shopify'], label: 'Shopify' }],
  },
  support_technique: {
    icon: Headphones, color: 'from-gray-500 to-gray-600',
    simpleDesc: 'Repond aux questions techniques et cree des tickets si besoin.',
    requires: [{ type: 'any', providers: ['gmail', 'gorgias', 'zendesk'], label: 'Gmail, Gorgias ou Zendesk' }],
  },
  comptabilite_auto: {
    icon: TrendingUp, color: 'from-indigo-500 to-indigo-600',
    simpleDesc: 'Automatise vos relances de factures, exports comptables et alertes de tresorerie.',
    requires: [{ type: 'all', providers: ['shopify'], label: 'Shopify' }],
    channels: [
      { id: 'email', label: 'Email', desc: 'Relances et exports par email', icon: Mail, needsIntegration: ['gmail', 'smtp_imap'] },
      { id: 'slack', label: 'Slack', desc: 'Alertes de tresorerie dans Slack', icon: MessageSquare, needsIntegration: ['slack'] },
    ],
  },
  agent_vocal: {
    icon: Headphones, color: 'from-violet-500 to-violet-600',
    simpleDesc: 'Un agent vocal IA qui repond aux questions de vos clients par la voix. Bientot disponible.',
    requires: [],
    comingSoon: true,
    channels: [],
  },
}

/* ═══════════ COMPONENT ═══════════ */

export const PlaybooksView = ({ clientId, setActiveTab, theme }) => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [showVocalWizard, setShowVocalWizard] = useState(false)
  const [selectedChannels, setSelectedChannels] = useState({})

  const { data: playbooks = [], isLoading } = useQuery({
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

  // Save selected channels to DB
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

    // Auto-setup email polling when email channel is activated
    if (channelId === 'email' && isSelected) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/engine/setup-email-polling', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ client_id: clientId }),
        })
      } catch {} // Non-blocking
    }

    // Auto-install chat widget on Shopify when widget channel is activated
    if (channelId === 'widget' && isSelected) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const widgetRes = await fetch('/api/engine/shopify-widget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ action: 'install', client_id: clientId }),
        })
        if (widgetRes.ok) {
          toast.success('Widget chat installe sur votre boutique Shopify !')
        }
      } catch {} // Non-blocking
    }

    // Auto-uninstall chat widget when widget channel is deactivated
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

  const isActive = (playbookName) => {
    const pb = playbooks.find(p => p.name === playbookName)
    return pb ? clientPlaybooks.some(cp => cp.playbook_id === pb.id && cp.is_active) : false
  }

  const checkReqs = (playbookName) => {
    const meta = PLAYBOOK_META[playbookName]
    if (!meta?.requires) return { met: true, missing: [] }
    const missing = []
    for (const req of meta.requires) {
      if (req.type === 'all' && !req.providers.every(p => connectedProviders.includes(p))) missing.push(req.label)
      if (req.type === 'any' && !req.providers.some(p => connectedProviders.includes(p))) missing.push(req.label)
    }
    return { met: missing.length === 0, missing }
  }

  const handleToggle = async (playbookName) => {
    const pb = playbooks.find(p => p.name === playbookName)
    if (!pb) return
    const reqs = checkReqs(playbookName)
    if (!reqs.met) {
      toast.error(`Connectez d'abord : ${reqs.missing.join(', ')}`)
      return
    }

    // Check at least one channel is selected with its integration connected
    const meta = PLAYBOOK_META[playbookName]
    if (meta?.channels && !isActive(playbookName)) {
      const activeChannels = meta.channels.filter(ch => {
        const isSelected = selectedChannels[`${playbookName}_${ch.id}`]
        const isConnected = ch.needsIntegration.length === 0 || ch.needsIntegration.some(p => connectedProviders.includes(p))
        return isSelected && isConnected
      })
      if (activeChannels.length === 0) {
        toast.error('Selectionnez au moins un canal (Email, Chat, etc.) et connectez l\'integration correspondante')
        return
      }
    }

    // Open wizard for vocal agent
    if (playbookName === 'agent_vocal' && !isActive(playbookName)) {
      setShowVocalWizard(true)
      return
    }
    const existing = clientPlaybooks.find(cp => cp.playbook_id === pb.id)
    const currentlyActive = existing?.is_active || false
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

    // Auto-uninstall widget when playbook is deactivated
    if (currentlyActive) {
      const channels = selectedChannels
      const hasWidget = Object.entries(channels).some(([key, val]) => key.startsWith(`${playbookName}_widget`) && val)
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

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" /></div>

  const activeCount = playbooks.filter(p => isActive(p.name)).length

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-[22px] font-semibold text-[#1a1a1a]">Automatisations</h2>
        <p className="text-[13px] text-[#9ca3af] mt-1">
          {activeCount > 0
            ? `${activeCount} automatisation${activeCount > 1 ? 's' : ''} active${activeCount > 1 ? 's' : ''}. Votre agent traite les demandes en continu.`
            : 'Activez vos premieres automatisations pour que votre agent commence a travailler.'}
        </p>
      </div>

      {/* Categories */}
      {CATEGORIES.map(cat => {
        const catPlaybooks = cat.playbooks
          .map(name => {
            const pb = playbooks.find(p => p.name === name)
            return pb ? { ...pb, meta: PLAYBOOK_META[name] || {} } : null
          })
          .filter(Boolean)

        if (catPlaybooks.length === 0) return null

        return (
          <div key={cat.id}>
            <div className="mb-3">
              <h3 className="text-[15px] font-semibold text-[#1a1a1a]">{cat.label}</h3>
              <p className="text-[12px] text-[#9ca3af] mt-0.5">{cat.desc}</p>
            </div>

            <div className="space-y-2.5">
              {catPlaybooks.map(pb => {
                const meta = pb.meta
                const Icon = meta.icon || Zap
                const active = isActive(pb.name)
                const reqs = checkReqs(pb.name)

                return (
                  <div
                    key={pb.id}
                    className={`rounded-xl transition-all ${
                      active
                        ? 'bg-[#0F5F35]/[0.04] border border-[#0F5F35]/20'
                        : 'bg-white border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                    }`}
                  >
                    <div className="flex items-center gap-4 px-5 py-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${meta.color || 'from-gray-400 to-gray-500'} flex-shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-[#1a1a1a]">{pb.display_name}</p>
                        {active && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-[#0F5F35]/10 text-[#0F5F35] text-[9px] font-bold rounded-full">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Actif
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#9ca3af] mt-0.5 leading-relaxed">{meta.simpleDesc || pb.description}</p>
                      {/* Channel selector */}
                      {meta.channels && meta.channels.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          <span className="text-[9px] text-[#c4c4c4] font-semibold uppercase tracking-wider self-center mr-1">Canaux :</span>
                          {meta.channels.map(ch => {
                            const ChIcon = ch.icon || MessageSquare
                            const channelConnected = ch.needsIntegration.length === 0 || ch.needsIntegration.some(p => connectedProviders.includes(p))
                            const isSelected = selectedChannels[`${pb.name}_${ch.id}`]
                            return (
                              <button
                                key={ch.id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const newVal = !selectedChannels[`${pb.name}_${ch.id}`]
                                  setSelectedChannels(prev => ({ ...prev, [`${pb.name}_${ch.id}`]: newVal }))
                                  saveChannels(pb.name, ch.id, newVal)
                                }}
                                disabled={!channelConnected}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
                                  isSelected
                                    ? 'bg-[#0F5F35] text-white'
                                    : channelConnected
                                      ? 'bg-white text-[#71717a] border border-[#e5e5e5] hover:border-[#0F5F35] hover:text-[#0F5F35]'
                                      : 'bg-[#f5f5f5] text-[#d4d4d4] cursor-not-allowed border border-transparent'
                                }`}
                                title={channelConnected ? ch.desc : `Connectez ${ch.needsIntegration.join(' ou ')} d'abord`}
                              >
                                <ChIcon className="w-3 h-3" />
                                {ch.label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {meta.comingSoon ? (
                      <span className="px-3 py-1.5 text-[11px] font-semibold text-[#9ca3af] bg-[#f5f5f5] rounded-full flex-shrink-0">
                        Bientot disponible
                      </span>
                    ) : reqs.met ? (
                      <button
                        onClick={() => handleToggle(pb.name)}
                        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${active ? 'bg-[#0F5F35]' : 'bg-[#e5e5e5]'}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    ) : (
                      <button
                        onClick={() => setActiveTab('integrations')}
                        className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-full hover:bg-amber-100 transition-colors flex-shrink-0"
                      >
                        <Plug className="w-3 h-3" /> Connecter
                      </button>
                    )}
                    </div>

                    {/* Vocal agent config — shown when active */}
                    {active && meta.configType === 'vocal' && (
                      <div className="px-5 pb-4 pt-3 border-t border-[#f0f0f0]">
                        <VocalAgentConfig clientId={clientId} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      {/* Vocal Agent Wizard Modal */}
      {showVocalWizard && (
        <VocalAgentWizard
          clientId={clientId}
          onComplete={() => {
            setShowVocalWizard(false)
            // Activate the playbook
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

/* ═══════════ VOCAL AGENT CONFIG ═══════════ */

const ELEVENLABS_AGENT_ID = 'agent_6901kns1pd7yfxz9nk6cq0f7gaq4'

const VocalAgentConfig = ({ clientId }) => {
  const toast = useToast()
  const [installing, setInstalling] = useState(false)
  const [installed, setInstalled] = useState(false)

  const handleInstallOnShopify = async () => {
    setInstalling(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/engine/shopify-vocal-widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'install', client_id: clientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setInstalled(true)
      toast.success('Agent vocal installe sur votre boutique !')
    } catch (err) {
      toast.error(err.message)
    }
    setInstalling(false)
  }

  const handleUninstall = async () => {
    setInstalling(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/engine/shopify-vocal-widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'uninstall', client_id: clientId }),
      })
      setInstalled(false)
      toast.success('Agent vocal retire de votre boutique')
    } catch {}
    setInstalling(false)
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-violet-50 rounded-xl border border-violet-100">
        <p className="text-[12px] text-violet-800 font-medium mb-1">Agent vocal IA actif</p>
        <p className="text-[11px] text-violet-600">
          Vos clients peuvent parler a votre agent directement sur votre site. Il repond aux questions, suit les commandes et escalade si besoin.
        </p>
      </div>

      {!installed ? (
        <button
          onClick={handleInstallOnShopify}
          disabled={installing}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 text-white text-[13px] font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
          {installing ? 'Installation en cours...' : 'Installer sur ma boutique Shopify'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <p className="text-[12px] text-emerald-700 font-medium">Installe sur votre boutique Shopify</p>
          </div>
          <button
            onClick={handleUninstall}
            disabled={installing}
            className="text-[11px] text-[#9ca3af] hover:text-red-500 transition-colors"
          >
            Retirer de ma boutique
          </button>
        </div>
      )}
    </div>
  )
}
