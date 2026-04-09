import React, { useState, useRef } from 'react'
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
    requires: [{ type: 'any', providers: ['gmail', 'gorgias', 'zendesk'], label: 'Gmail, Gorgias ou Zendesk' }],
  },
  abandoned_cart: {
    icon: ShoppingBag, color: 'from-amber-500 to-amber-600',
    simpleDesc: 'Relance les clients qui ont abandonne leur panier avec un email personnalise.',
    requires: [{ type: 'all', providers: ['shopify'], label: 'Shopify' }],
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
  },
  agent_vocal: {
    icon: Headphones, color: 'from-violet-500 to-violet-600',
    simpleDesc: 'Un agent vocal IA qui repond aux questions de vos clients par la voix, directement sur votre site.',
    requires: [],
    hasConfig: true,
    configType: 'vocal',
  },
}

/* ═══════════ COMPONENT ═══════════ */

export const PlaybooksView = ({ clientId, setActiveTab, theme }) => {
  const toast = useToast()
  const queryClient = useQueryClient()

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
                    className={`flex items-center gap-4 px-5 py-4 rounded-xl transition-all ${
                      active
                        ? 'bg-[#0F5F35]/[0.04] border border-[#0F5F35]/20'
                        : 'bg-white border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                    }`}
                  >
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
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(meta.requires || []).map((req, ri) => {
                          const isMet = req.type === 'all'
                            ? req.providers.every(p => connectedProviders.includes(p))
                            : req.providers.some(p => connectedProviders.includes(p))
                          return (
                            <span key={ri} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              isMet ? 'bg-emerald-50 text-emerald-600' : 'bg-[#f5f5f5] text-[#9ca3af]'
                            }`}>
                              {isMet ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Plug className="w-2.5 h-2.5" />}
                              {req.label}
                            </span>
                          )
                        })}
                        {(!meta.requires || meta.requires.length === 0) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Aucune integration requise
                          </span>
                        )}
                      </div>
                    </div>

                    {reqs.met ? (
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

                    {/* Vocal agent config — shown when active */}
                    {active && meta.configType === 'vocal' && (
                      <div className="col-span-full mt-3 pt-3 border-t border-[#f0f0f0]">
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
    </div>
  )
}

/* ═══════════ VOCAL AGENT CONFIG ═══════════ */

const ELEVENLABS_AGENT_ID = 'agent_6901kns1pd7yfxz9nk6cq0f7gaq4'

const VocalAgentConfig = ({ clientId }) => {
  const [copied, setCopied] = useState(false)

  const widgetCode = `<elevenlabs-convai agent-id="${ELEVENLABS_AGENT_ID}"></elevenlabs-convai>
<script src="https://elevenlabs.io/convai-widget/index.js" async type="text/javascript"></script>`

  const handleCopy = () => {
    navigator.clipboard.writeText(widgetCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Phone className="w-4 h-4 text-violet-600" />
        <p className="text-[13px] font-semibold text-[#1a1a1a]">Configuration de l'agent vocal</p>
      </div>

      <div className="p-4 bg-violet-50 rounded-xl border border-violet-100">
        <p className="text-[12px] text-violet-800 font-medium mb-1">Votre agent vocal est pret</p>
        <p className="text-[11px] text-violet-600">
          Il repond aux questions de vos clients par la voix : suivi commande, retours, reclamations, questions produits. Il escalade vers vous si necessaire.
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">Integrez sur votre site</p>
        <p className="text-[11px] text-[#9ca3af] mb-2">Copiez ce code et collez-le dans votre site web. Un bouton d'appel apparaitra.</p>
        <div className="relative">
          <pre className="p-3 bg-[#1a1a1a] text-green-400 rounded-lg text-[11px] font-mono overflow-x-auto">
            {widgetCode}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1.5 bg-[#333] hover:bg-[#444] rounded-md transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
          </button>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">Tester maintenant</p>
        <p className="text-[11px] text-[#9ca3af] mb-3">Cliquez pour demarrer un appel test avec votre agent vocal.</p>
        <a
          href={`https://elevenlabs.io/app/conversational-ai/agents/${ELEVENLABS_AGENT_ID}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-[12px] font-semibold rounded-lg hover:bg-violet-700 transition-colors"
        >
          <Phone className="w-3.5 h-3.5" /> Tester l'agent vocal
        </a>
      </div>
    </div>
  )
}
