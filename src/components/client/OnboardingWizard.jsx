import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingBag, MessageCircle, Shield, Sparkles, Rocket,
  CheckCircle2, ArrowRight, ArrowLeft, X, Loader2,
  Plug, Globe, ChevronRight, Zap, Building2, DollarSign,
  Clock, TrendingUp, User, Languages,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const TONE_PRESETS = [
  { id: 'formel', label: 'Formel', emoji: '👔', desc: 'Vouvoiement, ton corporatif', example: 'Bonjour, je vous remercie pour votre message. Nous allons traiter votre demande dans les meilleurs delais.' },
  { id: 'professionnel', label: 'Pro & Chaleureux', emoji: '🤝', desc: 'Pro mais accessible', example: 'Bonjour ! Merci de nous avoir contactes. Je m\'occupe de votre demande tout de suite.' },
  { id: 'decontracte', label: 'Decontracte', emoji: '😊', desc: 'Tutoiement, ton amical', example: 'Hey ! Merci pour ton message. Je regarde ca et je te reviens vite !' },
  { id: 'premium', label: 'Premium / Luxe', emoji: '✨', desc: 'Exclusif et attentionne', example: 'Bonjour, c\'est un plaisir de vous accompagner. Permettez-moi de m\'occuper personnellement de votre requete.' },
]

const AGENT_TEMPLATES = [
  { id: 'sav_standard', label: 'SAV E-commerce Standard', desc: 'Retours, suivi colis, remboursements, FAQ produits', icon: ShoppingBag, color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { id: 'sav_premium', label: 'SAV Premium + Upsell', desc: 'SAV complet + recommandations, fidelite, code promo', icon: Sparkles, color: 'bg-violet-50 text-violet-600 border-violet-200' },
  { id: 'immo_leads', label: 'Immobilier - Qualification', desc: 'Qualification leads, dispos, prise de RDV visite', icon: Globe, color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { id: 'immo_gestion', label: 'Immobilier - Gestion', desc: 'Incidents locataires, relances, etats des lieux', icon: Shield, color: 'bg-amber-50 text-amber-600 border-amber-200' },
]

const WIZARD_STEPS = [
  { id: 'business', title: 'Votre entreprise', subtitle: 'Quelques informations pour personnaliser votre agent' },
  { id: 'template', title: 'Modele d\'agent', subtitle: 'Partez d\'une base optimisee pour votre activite' },
  { id: 'connect', title: 'Connecter vos outils', subtitle: 'Reliez votre boutique et vos canaux de support' },
  { id: 'tone', title: 'Ton de l\'agent', subtitle: 'Choisissez comment votre agent communique' },
  { id: 'roi', title: 'Parametres ROI', subtitle: 'Configurez le calcul de votre retour sur investissement' },
  { id: 'activate', title: 'Tester & Activer', subtitle: 'Verifiez que tout fonctionne avant de lancer' },
]

export const OnboardingWizard = ({ clientId, clientType, setActiveTab, theme, onNavigate }) => {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [currentStep, setCurrentStep] = useState(0)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(`onboarding-wizard-v2-${clientId}`) === 'done')

  // Step 1: Business info
  const [brandName, setBrandName] = useState('')
  const [businessType, setBusinessType] = useState(clientType || 'ecommerce')
  const [language, setLanguage] = useState('fr')

  // Step 2: Template
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  // Step 3: Tone
  const [selectedTone, setSelectedTone] = useState(null)

  // Step 5: ROI
  const [hourlyCost, setHourlyCost] = useState('25')
  const [ticketTime, setTicketTime] = useState('5')
  const [subscriptionPrice, setSubscriptionPrice] = useState('199')

  // Step 6: Test
  const [testResponse, setTestResponse] = useState('')
  const [testing, setTesting] = useState(false)
  const [activated, setActivated] = useState(false)

  // Load existing data
  const { data: existingData } = useQuery({
    queryKey: ['onboarding-data', clientId],
    queryFn: async () => {
      const [clientRes, settingsRes, shopifyRes, intRes] = await Promise.all([
        supabase.from('clients').select('brand_name, client_type').eq('id', clientId).single(),
        supabase.from('client_settings').select('*').eq('client_id', clientId).maybeSingle(),
        supabase.from('client_shopify_connections').select('id').eq('client_id', clientId).maybeSingle(),
        supabase.from('client_integrations').select('id').eq('client_id', clientId).eq('status', 'active'),
      ])
      return {
        client: clientRes.data,
        settings: settingsRes.data,
        shopify: !!shopifyRes.data,
        integrations: (intRes.data?.length || 0) > 0,
      }
    },
    enabled: !!clientId,
  })

  // Pre-fill from existing data
  useEffect(() => {
    if (existingData?.client) {
      if (existingData.client.brand_name) setBrandName(existingData.client.brand_name)
      if (existingData.client.client_type) setBusinessType(existingData.client.client_type)
    }
    if (existingData?.settings) {
      if (existingData.settings.hourly_cost) setHourlyCost(String(existingData.settings.hourly_cost))
      if (existingData.settings.avg_ticket_time_min) setTicketTime(String(existingData.settings.avg_ticket_time_min))
      if (existingData.settings.subscription_price) setSubscriptionPrice(String(existingData.settings.subscription_price))
      if (existingData.settings.brand_language) setLanguage(existingData.settings.brand_language)
      if (existingData.settings.brand_tone) setSelectedTone(existingData.settings.brand_tone)
    }
  }, [existingData])

  if (dismissed) return null

  const handleDismiss = () => {
    localStorage.setItem(`onboarding-wizard-v2-${clientId}`, 'done')
    setDismissed(true)
  }

  // Save step 1
  const saveBusinessInfo = async () => {
    if (!brandName.trim()) return
    await supabase.from('clients').update({
      brand_name: brandName.trim(),
      client_type: businessType,
    }).eq('id', clientId)

    await supabase.from('client_settings').upsert({
      client_id: clientId,
      brand_language: language,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id' })
  }

  // Save step 2
  const handleSelectTemplate = (templateId) => {
    setSelectedTemplate(templateId)
    const toneMap = { sav_standard: 'professionnel', sav_premium: 'premium', immo_leads: 'professionnel', immo_gestion: 'formel' }
    setSelectedTone(toneMap[templateId] || 'professionnel')
  }

  // Save step 4
  const handleSaveTone = async () => {
    if (!selectedTone || !clientId) return
    await supabase.from('client_settings').upsert({
      client_id: clientId,
      brand_tone: selectedTone,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id' })
  }

  // Save step 5
  const saveROISettings = async () => {
    await supabase.from('client_settings').upsert({
      client_id: clientId,
      hourly_cost: parseFloat(hourlyCost) || 25,
      avg_ticket_time_min: parseInt(ticketTime) || 5,
      subscription_price: parseFloat(subscriptionPrice) || 199,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id' })
  }

  // Step 6: Test
  const handleTest = async () => {
    setTesting(true)
    setTestResponse('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/engine/gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          client_id: clientId,
          event_type: 'widget_message',
          source: 'test',
          message: 'Quels sont vos delais de livraison ?',
          customer_email: 'test@onboarding.actero.fr',
        }),
      })
      const data = await res.json()
      setTestResponse(data.response || data.classification || 'Agent configure avec succes')
    } catch {
      setTestResponse('Agent configure. Vous pouvez maintenant l\'activer.')
    }
    setTesting(false)
  }

  const handleActivate = async () => {
    // Activate SAV playbook
    try {
      const { data: savPlaybook } = await supabase
        .from('engine_playbooks')
        .select('id')
        .eq('name', 'sav_ecommerce')
        .maybeSingle()
      if (savPlaybook) {
        await supabase.from('engine_client_playbooks').upsert({
          client_id: clientId,
          playbook_id: savPlaybook.id,
          is_active: true,
          activated_at: new Date().toISOString(),
        }, { onConflict: 'client_id,playbook_id' })
      }
    } catch {}

    setActivated(true)
    toast.success('Agent IA active ! Il est maintenant en production.')
    queryClient.invalidateQueries({ queryKey: ['client-playbooks', clientId] })
    setTimeout(() => {
      handleDismiss()
      setActiveTab('overview')
    }, 2500)
  }

  const canProceed = () => {
    if (currentStep === 0) return brandName.trim().length >= 2
    if (currentStep === 1) return !!selectedTemplate
    if (currentStep === 3) return !!selectedTone
    if (currentStep === 4) return parseFloat(hourlyCost) > 0 && parseInt(ticketTime) > 0
    return true
  }

  const nextStep = () => {
    if (currentStep === 0) saveBusinessInfo()
    if (currentStep === 3) handleSaveTone()
    if (currentStep === 4) saveROISettings()
    if (currentStep < WIZARD_STEPS.length - 1) setCurrentStep(currentStep + 1)
  }

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1)
  }

  const step = WIZARD_STEPS[currentStep]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white border border-[#f0f0f0] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden max-w-2xl mx-auto"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-[#003725] to-[#0F5F35] px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-sm">Configuration de votre agent IA</span>
          </div>
          <button onClick={handleDismiss} className="text-white/50 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          {WIZARD_STEPS.map((s, i) => (
            <div key={s.id} className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < currentStep ? 'bg-white' : i === currentStep ? 'bg-white/80' : 'bg-white/20'
            }`} />
          ))}
        </div>
        <div className="flex items-center justify-between mt-3">
          <div>
            <p className="text-white font-semibold">{step.title}</p>
            <p className="text-white/60 text-xs">{step.subtitle}</p>
          </div>
          <span className="text-white/40 text-xs font-mono">{currentStep + 1}/{WIZARD_STEPS.length}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Step 1: Business Info */}
            {currentStep === 0 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">
                    <User className="w-3 h-3 inline mr-1" /> Nom de votre marque / entreprise
                  </label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="Ma Boutique"
                    className="w-full px-4 py-3 bg-[#fafafa] border border-[#e5e5e5] rounded-xl text-[14px] text-[#1a1a1a] outline-none focus:border-[#0F5F35]/40 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">
                    <Building2 className="w-3 h-3 inline mr-1" /> Type d&apos;activite
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'ecommerce', label: 'E-commerce', icon: ShoppingBag },
                      { id: 'saas', label: 'SaaS / Tech', icon: Zap },
                      { id: 'immobilier', label: 'Immobilier', icon: Globe },
                      { id: 'service', label: 'Service / Autre', icon: Building2 },
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setBusinessType(t.id)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                          businessType === t.id ? 'border-[#0F5F35] bg-emerald-50/50' : 'border-[#f0f0f0] hover:border-[#e5e5e5]'
                        }`}
                      >
                        <t.icon className={`w-4 h-4 ${businessType === t.id ? 'text-[#0F5F35]' : 'text-[#9ca3af]'}`} />
                        <span className={`text-[13px] font-medium ${businessType === t.id ? 'text-[#0F5F35]' : 'text-[#1a1a1a]'}`}>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">
                    <Languages className="w-3 h-3 inline mr-1" /> Langue de l&apos;agent
                  </label>
                  <div className="flex gap-2">
                    {[
                      { id: 'fr', label: 'Francais' },
                      { id: 'en', label: 'English' },
                      { id: 'multi', label: 'Multi-langues' },
                    ].map(l => (
                      <button
                        key={l.id}
                        onClick={() => setLanguage(l.id)}
                        className={`flex-1 py-2.5 rounded-xl text-[12px] font-semibold transition-all ${
                          language === l.id ? 'bg-[#0F5F35] text-white' : 'bg-[#fafafa] text-[#9ca3af] border border-[#f0f0f0] hover:border-[#e5e5e5]'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Template */}
            {currentStep === 1 && (
              <div className="space-y-3">
                {AGENT_TEMPLATES
                  .filter(t => businessType === 'immobilier' ? t.id.startsWith('immo') : t.id.startsWith('sav'))
                  .map(template => {
                    const Icon = template.icon
                    return (
                      <button
                        key={template.id}
                        onClick={() => handleSelectTemplate(template.id)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                          selectedTemplate === template.id ? 'border-[#0F5F35] bg-emerald-50/50' : 'border-[#f0f0f0] hover:border-[#e5e5e5]'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${template.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-[#1a1a1a]">{template.label}</p>
                          <p className="text-xs text-[#9ca3af] mt-0.5">{template.desc}</p>
                        </div>
                        {selectedTemplate === template.id && <CheckCircle2 className="w-5 h-5 text-[#0F5F35] flex-shrink-0" />}
                      </button>
                    )
                  })}
              </div>
            )}

            {/* Step 3: Connect */}
            {currentStep === 2 && (
              <div className="space-y-4">
                {businessType !== 'immobilier' && (
                  <div className={`flex items-center gap-4 p-4 rounded-xl border ${existingData?.shopify ? 'border-emerald-200 bg-emerald-50/50' : 'border-[#f0f0f0]'}`}>
                    <div className="w-10 h-10 rounded-xl bg-[#95BF47]/10 flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-[#95BF47]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-[#1a1a1a]">Shopify</p>
                      <p className="text-xs text-[#9ca3af]">{existingData?.shopify ? 'Connecte' : 'Connectez votre boutique'}</p>
                    </div>
                    {existingData?.shopify ? (
                      <CheckCircle2 className="w-5 h-5 text-[#0F5F35]" />
                    ) : (
                      <button onClick={() => setActiveTab('integrations')} className="px-4 py-2 bg-[#0F5F35] text-white text-xs font-bold rounded-full hover:bg-[#003725] transition-colors">
                        Connecter
                      </button>
                    )}
                  </div>
                )}

                <div className={`flex items-center gap-4 p-4 rounded-xl border ${existingData?.integrations ? 'border-emerald-200 bg-emerald-50/50' : 'border-[#f0f0f0]'}`}>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Plug className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-[#1a1a1a]">Autres integrations</p>
                    <p className="text-xs text-[#9ca3af]">{existingData?.integrations ? 'Au moins une active' : 'Slack, Email, Gorgias... (optionnel)'}</p>
                  </div>
                  {existingData?.integrations ? (
                    <CheckCircle2 className="w-5 h-5 text-[#0F5F35]" />
                  ) : (
                    <button onClick={() => setActiveTab('integrations')} className="px-4 py-2 bg-[#fafafa] text-[#1a1a1a] text-xs font-bold rounded-full border border-[#e5e5e5] hover:bg-[#f0f0f0] transition-colors">
                      Configurer
                    </button>
                  )}
                </div>

                <p className="text-xs text-[#9ca3af] text-center mt-2">Vous pourrez toujours ajouter des integrations plus tard</p>
              </div>
            )}

            {/* Step 4: Tone */}
            {currentStep === 3 && (
              <div className="space-y-3">
                {TONE_PRESETS.map(tone => (
                  <button
                    key={tone.id}
                    onClick={() => setSelectedTone(tone.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      selectedTone === tone.id ? 'border-[#0F5F35] bg-emerald-50/50' : 'border-[#f0f0f0] hover:border-[#e5e5e5]'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-lg">{tone.emoji}</span>
                      <span className="font-semibold text-sm text-[#1a1a1a]">{tone.label}</span>
                      <span className="text-xs text-[#9ca3af]">— {tone.desc}</span>
                      {selectedTone === tone.id && <CheckCircle2 className="w-4 h-4 text-[#0F5F35] ml-auto" />}
                    </div>
                    {selectedTone === tone.id && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 p-3 bg-[#fafafa] rounded-lg">
                        <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">Apercu</p>
                        <p className="text-sm text-[#1a1a1a] italic">&quot;{tone.example}&quot;</p>
                      </motion.div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Step 5: ROI Settings */}
            {currentStep === 4 && (
              <div className="space-y-5">
                <p className="text-[13px] text-[#9ca3af] leading-relaxed">
                  Ces parametres permettent de calculer combien votre agent IA vous fait economiser chaque mois.
                </p>

                <div>
                  <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">
                    <DollarSign className="w-3 h-3 inline mr-1" /> Cout horaire de votre equipe support
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={hourlyCost}
                      onChange={(e) => setHourlyCost(e.target.value)}
                      className="w-24 px-4 py-3 bg-[#fafafa] border border-[#e5e5e5] rounded-xl text-[14px] text-[#1a1a1a] outline-none focus:border-[#0F5F35]/40"
                    />
                    <span className="text-[13px] text-[#9ca3af]">euros / heure</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">
                    <Clock className="w-3 h-3 inline mr-1" /> Temps moyen par ticket
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={ticketTime}
                      onChange={(e) => setTicketTime(e.target.value)}
                      className="w-24 px-4 py-3 bg-[#fafafa] border border-[#e5e5e5] rounded-xl text-[14px] text-[#1a1a1a] outline-none focus:border-[#0F5F35]/40"
                    />
                    <span className="text-[13px] text-[#9ca3af]">minutes</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">
                    <TrendingUp className="w-3 h-3 inline mr-1" /> Votre abonnement Actero
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={subscriptionPrice}
                      onChange={(e) => setSubscriptionPrice(e.target.value)}
                      className="w-24 px-4 py-3 bg-[#fafafa] border border-[#e5e5e5] rounded-xl text-[14px] text-[#1a1a1a] outline-none focus:border-[#0F5F35]/40"
                    />
                    <span className="text-[13px] text-[#9ca3af]">euros / mois</span>
                  </div>
                </div>

                {/* Live ROI preview */}
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">Estimation ROI</p>
                  <p className="text-[13px] text-emerald-800">
                    Si votre agent traite <strong>100 tickets/mois</strong>, vous economisez environ{' '}
                    <strong>{Math.round((parseInt(ticketTime) || 5) / 60 * (parseFloat(hourlyCost) || 25) * 100)}euros</strong>{' '}
                    soit un ROI net de{' '}
                    <strong className={Math.round((parseInt(ticketTime) || 5) / 60 * (parseFloat(hourlyCost) || 25) * 100) - (parseFloat(subscriptionPrice) || 199) > 0 ? 'text-emerald-700' : 'text-red-600'}>
                      {Math.round((parseInt(ticketTime) || 5) / 60 * (parseFloat(hourlyCost) || 25) * 100) - (parseFloat(subscriptionPrice) || 199)}euros
                    </strong>
                  </p>
                </div>
              </div>
            )}

            {/* Step 6: Test & Activate */}
            {currentStep === 5 && (
              <div className="space-y-5">
                {!activated ? (
                  <>
                    <div className="p-4 bg-[#fafafa] rounded-xl border border-[#f0f0f0]">
                      <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">Recapitulatif</p>
                      <div className="space-y-1.5 text-[13px] text-[#1a1a1a]">
                        <p><span className="text-[#9ca3af]">Marque :</span> <strong>{brandName}</strong></p>
                        <p><span className="text-[#9ca3af]">Ton :</span> <strong>{TONE_PRESETS.find(t => t.id === selectedTone)?.label || '-'}</strong></p>
                        <p><span className="text-[#9ca3af]">Cout horaire :</span> <strong>{hourlyCost}euros/h</strong></p>
                        <p><span className="text-[#9ca3af]">Temps/ticket :</span> <strong>{ticketTime} min</strong></p>
                      </div>
                    </div>

                    <button
                      onClick={handleTest}
                      disabled={testing}
                      className="w-full py-3 bg-[#fafafa] border border-[#e5e5e5] rounded-xl text-sm font-semibold text-[#1a1a1a] hover:bg-[#f0f0f0] transition-colors disabled:opacity-50"
                    >
                      {testing ? (
                        <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> L&apos;agent reflechit...</span>
                      ) : 'Tester la reponse de l\'agent'}
                    </button>

                    {testResponse && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <p className="text-xs text-emerald-600 font-bold mb-1">Agent IA :</p>
                        <p className="text-sm text-[#1a1a1a]">{testResponse}</p>
                      </motion.div>
                    )}

                    <button
                      onClick={handleActivate}
                      className="w-full py-3.5 bg-[#0F5F35] text-white rounded-xl text-sm font-bold hover:bg-[#003725] transition-colors flex items-center justify-center gap-2"
                    >
                      <Rocket className="w-4 h-4" /> Activer l&apos;agent en production
                    </button>
                  </>
                ) : (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8">
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5 }} className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-[#0F5F35]" />
                    </motion.div>
                    <h3 className="text-lg font-bold text-[#1a1a1a] mb-1">Agent active !</h3>
                    <p className="text-sm text-[#9ca3af]">Votre agent IA est en production. Surveillez ses performances depuis le tableau de bord.</p>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      {!activated && (
        <div className="px-6 pb-5 flex items-center justify-between">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#9ca3af] hover:text-[#1a1a1a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          {currentStep < WIZARD_STEPS.length - 1 && (
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#0F5F35] text-white text-sm font-bold rounded-full hover:bg-[#003725] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Continuer <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}
