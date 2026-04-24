import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Zap, ShoppingBag, Headphones, Loader2,
  CheckCircle2, Plug, TrendingUp, Mail,
  MessageSquare, ArrowRight, Phone, HelpCircle,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import { trackEvent } from '../../lib/analytics'
import { VocalAgentWizard } from './VocalAgentWizard'
import { ComptabiliteWizard } from './ComptabiliteWizard'
import { WorkflowReadinessCheck } from './WorkflowReadinessCheck'
import { buildReadinessChecks } from '../../lib/workflow-readiness'
import { EmptyState } from '../ui/EmptyState'

/* ═══════════ CATEGORIES ═══════════ */

const CATEGORIES = [
  {
    id: 'support',
    label: 'Support & SAV',
    desc: 'Réponds aux demandes de tes clients automatiquement, 24h/24.',
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
    simpleDesc: 'Répond automatiquement aux questions de tes clients (commandes, retours, produits).',
    helpId: 'sav-ecommerce',
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
    helpId: 'relance-paniers',
    requires: [{ type: 'all', providers: ['shopify'], label: 'Shopify' }],
    channels: [
      { id: 'email', label: 'Email', desc: 'Envoie un email de relance panier', icon: Mail, needsIntegration: ['smtp_imap'] },
    ],
  },
  comptabilite_auto: {
    icon: TrendingUp, color: 'from-indigo-500 to-indigo-600',
    simpleDesc: 'Automatise vos relances de factures, exports comptables et alertes de tresorerie.',
    helpId: 'comptabilite-comment-ca-marche',
    requires: [{ type: 'any', providers: ['axonaut', 'pennylane', 'ipaidthat'], label: 'Axonaut, Pennylane ou iPaidThat' }],
    hasConfig: true,
    configType: 'comptabilite',
    channels: [
      { id: 'email', label: 'Email', desc: 'Relances et exports par email', icon: Mail, needsIntegration: ['gmail', 'smtp_imap'] },
      { id: 'slack', label: 'Slack', desc: 'Alertes de tresorerie dans Slack', icon: MessageSquare, needsIntegration: ['slack'] },
    ],
  },
  agent_vocal: {
    icon: Phone, color: 'from-violet-500 to-violet-600',
    simpleDesc: 'Un agent vocal IA qui répond aux questions de tes clients par la voix, 24h/24.',
    helpId: 'agent-vocal',
    requires: [],
    hasConfig: true,
    configType: 'vocal',
    channels: [
      { id: 'widget_vocal', label: 'Widget vocal sur le site', desc: 'Bouton d\'appel vocal sur votre boutique Shopify', icon: Phone, needsIntegration: ['shopify'] },
      { id: 'phone', label: 'Numéro de téléphone', desc: 'Un numéro dédié que vos clients peuvent appeler', icon: Phone, needsIntegration: [] },
    ],
  },
}

/* ═══════════ COMPONENT ═══════════ */

export const PlaybooksView = ({ clientId, setActiveTab, theme }) => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [showVocalWizard, setShowVocalWizard] = useState(false)
  const [showComptaWizard, setShowComptaWizard] = useState(false)
  const [readinessState, setReadinessState] = useState({ open: false, checks: [], playbookName: null, playbookLabel: null, activating: false })
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

    // Activate the native email agent (cron-based, replaces old n8n setup).
    // Non-blocking for the channel toggle, but user-visible if the side-effect fails —
    // otherwise they wonder why email isn't processing.
    if (channelId === 'email' && isSelected) {
      try {
        const { error } = await supabase.from('client_settings')
          .update({ email_agent_enabled: true, updated_at: new Date().toISOString() })
          .eq('client_id', clientId)
        if (error) throw error
      } catch (err) {
        console.error('[PlaybooksView] email agent enable failed:', err)
        toast.error('Activation de l\'agent email échouée — le canal est activé mais l\'agent doit être activé manuellement dans Paramètres.')
      }
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
        } else {
          toast.error('Installation du widget Shopify échouée. Vérifiez votre connexion Shopify.')
        }
      } catch (err) {
        console.error('[PlaybooksView] widget install failed:', err)
        toast.error('Installation du widget Shopify impossible. Réessayez.')
      }
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
      } catch (err) {
        // Background cleanup — if it fails the widget stays on the shop and we log it.
        console.error('[PlaybooksView] widget uninstall failed:', err)
      }
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

    // Check workflow limit before activating
    const currentlyActivePlaybook = clientPlaybooks.find(cp => cp.playbook_id === pb.id)
    if (!currentlyActivePlaybook?.is_active) {
      // Trying to activate — check limit
      try {
        const { getPlanConfig, getLimit } = await import('../../lib/plans.js')
        const { data: clientRow } = await supabase.from('clients').select('plan').eq('id', clientId).maybeSingle()
        const plan = clientRow?.plan || 'free'
        const workflowLimit = getLimit(plan, 'workflows_active')
        const activeCount = clientPlaybooks.filter(cp => cp.is_active).length
        if (workflowLimit !== Infinity && activeCount >= workflowLimit) {
          const planName = getPlanConfig(plan).name
          toast.error(`Limite atteinte : ${workflowLimit} workflow${workflowLimit > 1 ? 's' : ''} actif${workflowLimit > 1 ? 's' : ''} sur le plan ${planName}. Passez au plan superieur.`)
          return
        }
      } catch { /* skip limit check if plans.js not available */ }
    }

    // Channels are now selected AFTER activation via toggles inside the card
    const meta = PLAYBOOK_META[playbookName]

    // Open wizard for comptabilite
    if (playbookName === 'comptabilite_auto' && !isActive(playbookName)) {
      setShowComptaWizard(true)
      return
    }

    // Open wizard for vocal agent
    if (playbookName === 'agent_vocal' && !isActive(playbookName)) {
      setShowVocalWizard(true)
      return
    }

    const existing = clientPlaybooks.find(cp => cp.playbook_id === pb.id)
    const currentlyActive = existing?.is_active || false

    // Only run readiness checks when ACTIVATING (not when deactivating)
    if (!currentlyActive) {
      try {
        const checks = await buildReadinessChecks({
          clientId,
          playbookName,
          custom_config: existing?.custom_config || {},
        })
        setReadinessState({
          open: true,
          checks,
          playbookName,
          playbookLabel: meta?.simpleDesc || pb.display_name || playbookName,
          playbookId: pb.id,
          existing,
          activating: false,
        })
        return
      } catch (err) {
        console.error('[readiness] check failed:', err)
        // Fall through to direct activation if readiness system fails
      }
    }

    // Deactivation path — no readiness check
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
    // Analytics — fire only on the ON transition (deactivation is out of scope for "Enabled")
    if (!currentlyActive) {
      // Analytics
      trackEvent('Playbook Enabled', { playbook_name: pb.name || pb.display_name, plan: 'unknown' })
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
        } catch (err) {
          // Background cleanup — playbook is already deactivated, widget cleanup failure is not user-blocking.
          console.error('[PlaybooksView] widget cleanup failed:', err)
        }
      }
    }

    toast.success(!currentlyActive ? `"${pb.display_name}" active` : `"${pb.display_name}" desactive`)
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" /></div>

  const activeCount = playbooks.filter(p => isActive(p.name)).length

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2
          className="text-2xl italic tracking-tight text-[#1a1a1a]"
          style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 }}
        >
          Automatisations
        </h2>
        <p className="text-[15px] text-[#5A5A5A] mt-1">
          {activeCount > 0
            ? `${activeCount} automatisation${activeCount > 1 ? 's' : ''} active${activeCount > 1 ? 's' : ''}. Ton agent traite les demandes en continu.`
            : 'Active tes premières automatisations pour que ton agent commence à travailler.'}
        </p>
      </div>

      {playbooks.length === 0 && (
        <div className="rounded-2xl border border-[#E5E2D7] bg-white">
          <EmptyState
            icon={Zap}
            tone="cta"
            title="Aucune automatisation active"
            description="Les automatisations apparaîtront ici dès que tu en activeras une. Commence par l'automatisation SAV e-commerce pour que ton agent réponde aux clients."
            action={{
              label: 'Découvrir les automatisations',
              onClick: () => setActiveTab?.('support'),
            }}
          />
        </div>
      )}

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
                    className={`rounded-xl transition-all duration-200 hover:shadow-elev-3 ${
                      active
                        ? 'bg-cta/[0.04] border border-cta/20'
                        : 'bg-white border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:-translate-y-0.5'
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
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-cta/10 text-cta text-[9px] font-bold rounded-full">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Actif
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#9ca3af] mt-0.5 leading-relaxed">
                        {meta.simpleDesc || pb.description}
                        {meta.helpId && (
                          <button onClick={(e) => { e.stopPropagation(); setActiveTab('support') }} className="inline-flex items-center gap-0.5 ml-1 text-cta hover:underline">
                            <HelpCircle className="w-3 h-3" /> Comment ca marche ?
                          </button>
                        )}
                      </p>
                    </div>

                    {meta.comingSoon ? (
                      <span className="px-3 py-1.5 text-[11px] font-semibold text-[#9ca3af] bg-[#f5f5f5] rounded-full flex-shrink-0">
                        Bientot disponible
                      </span>
                    ) : reqs.met ? (
                      <button
                        onClick={() => handleToggle(pb.name)}
                        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${active ? 'bg-cta' : 'bg-[#e5e5e5]'}`}
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

                    {/* Channels — toggles per channel, shown when playbook is active */}
                    {active && meta.channels && meta.channels.length > 0 && (
                      <div className="px-5 pb-4 pt-3 border-t border-[#f0f0f0]">
                        <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">Canaux actifs</p>
                        <div className="space-y-2">
                          {meta.channels.map(ch => {
                            const ChIcon = ch.icon || MessageSquare
                            const channelConnected = ch.needsIntegration.length === 0 || ch.needsIntegration.some(p => connectedProviders.includes(p))
                            const isSelected = !!selectedChannels[`${pb.name}_${ch.id}`]
                            return (
                              <div
                                key={ch.id}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                  isSelected ? 'bg-cta/5 border-cta/20' : 'bg-white border-[#f0f0f0]'
                                }`}
                              >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? 'bg-cta text-white' : 'bg-[#fafafa] text-[#9ca3af]'
                                }`}>
                                  <ChIcon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] font-semibold text-[#1a1a1a]">{ch.label}</p>
                                  <p className="text-[10px] text-[#9ca3af] mt-0.5">{ch.desc}</p>
                                </div>
                                {!channelConnected ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setActiveTab('integrations') }}
                                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-amber-700 bg-amber-50 rounded-full hover:bg-amber-100 transition-colors flex-shrink-0"
                                  >
                                    <Plug className="w-2.5 h-2.5" /> Connecter
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const newVal = !isSelected
                                      setSelectedChannels(prev => ({ ...prev, [`${pb.name}_${ch.id}`]: newVal }))
                                      saveChannels(pb.name, ch.id, newVal)
                                    }}
                                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${isSelected ? 'bg-cta' : 'bg-[#e5e5e5]'}`}
                                  >
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isSelected ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Email integration recommendation — when widget is active but no email integration */}
                    {active && pb.name === 'sav_ecommerce' && selectedChannels[`${pb.name}_widget`] && !connectedProviders.includes('smtp_imap') && !connectedProviders.includes('gmail') && (
                      <div className="mx-5 mb-4 mt-1 p-3.5 bg-blue-50 rounded-xl border border-blue-100">
                        <div className="flex items-start gap-2.5">
                          <Mail className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-[12px] font-semibold text-blue-900">Recommandation : connecte ton email professionnel</p>
                            <p className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
                              Quand un client est agressif ou a besoin d&apos;un suivi, l&apos;IA lui demande son email dans le widget.
                              En connectant ton adresse email (SMTP/IMAP), tes réponses dans &quot;À traiter&quot; seront envoyées automatiquement <strong>depuis ta propre adresse</strong> (ex: contact@taboutique.com).
                            </p>
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveTab('integrations') }}
                              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                            >
                              <Plug className="w-3 h-3" /> Connecter mon email
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

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
      {/* Readiness check modal — shown before activating a playbook */}
      <WorkflowReadinessCheck
        isOpen={readinessState.open}
        onClose={() => setReadinessState((s) => ({ ...s, open: false }))}
        onConfirm={async () => {
          const { existing, playbookId } = readinessState
          setReadinessState((s) => ({ ...s, activating: true }))
          try {
            if (existing) {
              await supabase.from('engine_client_playbooks').update({
                is_active: true,
                activated_at: new Date().toISOString(),
              }).eq('id', existing.id)
            } else {
              await supabase.from('engine_client_playbooks').insert({
                client_id: clientId, playbook_id: playbookId, is_active: true, activated_at: new Date().toISOString(),
              })
            }
            queryClient.invalidateQueries({ queryKey: ['client-playbooks', clientId] })
            toast.success('Workflow activé !')
          } catch (err) {
            toast.error('Erreur: ' + err.message)
          }
          setReadinessState({ open: false, checks: [], playbookName: null, playbookLabel: null, activating: false })
        }}
        setActiveTab={setActiveTab}
        checks={readinessState.checks}
        playbookLabel={readinessState.playbookLabel}
        loading={readinessState.activating}
      />

      {/* Comptabilite Wizard Modal */}
      {showComptaWizard && (
        <ComptabiliteWizard
          clientId={clientId}
          connectedProviders={connectedProviders}
          onComplete={() => {
            setShowComptaWizard(false)
            const pb = playbooks.find(p => p.name === 'comptabilite_auto')
            if (pb) {
              supabase.from('engine_client_playbooks').upsert({
                client_id: clientId, playbook_id: pb.id, is_active: true, activated_at: new Date().toISOString(),
              }, { onConflict: 'client_id,playbook_id' }).then(() => {
                queryClient.invalidateQueries({ queryKey: ['client-playbooks', clientId] })
              })
            }
            toast.success('Comptabilite automatisee configuree et activee !')
          }}
          onCancel={() => setShowComptaWizard(false)}
        />
      )}

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
    } catch (err) {
      console.error('[PlaybooksView] vocal widget uninstall failed:', err)
      toast.error('Échec du retrait de l\'agent vocal. Réessayez.')
    }
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
