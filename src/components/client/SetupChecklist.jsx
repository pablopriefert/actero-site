import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Circle,
  ShoppingBag,
  Mail,
  Wand2,
  Calculator,
  PlayCircle,
  Sparkles,
  MessageCircle,
  X,
  ArrowRight,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * SetupChecklist — Onboarding guided configuration card (Instantly-style)
 * Displayed at the top of the client overview page. Auto-hidden when
 * all 7 steps are complete. Can be manually dismissed (localStorage).
 */
export const SetupChecklist = ({ clientId, setActiveTab, dismissible = true }) => {
  const [dismissed, setDismissed] = useState(
    () => dismissible && localStorage.getItem(`setup-checklist-dismissed-${clientId}`) === 'true'
  )

  const { data: completion } = useQuery({
    queryKey: ['setup-checklist', clientId],
    queryFn: async () => {
      // 1. E-commerce platform (one of: Shopify, WooCommerce, Webflow)
      const [shopifyRes, wooWebflowRes] = await Promise.all([
        supabase.from('client_shopify_connections').select('id').eq('client_id', clientId).maybeSingle(),
        supabase.from('client_integrations').select('id, provider').eq('client_id', clientId).eq('status', 'active').in('provider', ['woocommerce', 'webflow']),
      ])
      const ecommerce = !!shopifyRes.data || ((wooWebflowRes.data || []).length > 0)

      // 2. Email service (SMTP personnalisé OR Resend)
      const { data: emailList } = await supabase
        .from('client_integrations')
        .select('id, provider')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .in('provider', ['smtp_imap', 'resend'])
      const email = (emailList || []).length > 0

      // 3. Brand tone + 4. ROI hourly_cost
      const { data: settings } = await supabase
        .from('client_settings')
        .select('brand_tone, hourly_cost')
        .eq('client_id', clientId)
        .maybeSingle()

      // 5. At least one engine run (tested the agent)
      const { count: runsCount } = await supabase
        .from('engine_runs_v2')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)

      // 6. SAV e-commerce playbook active
      const { data: playbook } = await supabase
        .from('engine_client_playbooks')
        .select('id, is_active, engine_playbooks!inner(name)')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .eq('engine_playbooks.name', 'sav_ecommerce')
        .maybeSingle()

      // 7. At least one customer message received
      const { count: conversationsCount } = await supabase
        .from('ai_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)

      return {
        shopify: ecommerce, // kept key name for backward compat but now checks 3 platforms
        email: email,
        tone: !!(settings?.brand_tone && settings.brand_tone.trim().length > 0),
        roi: !!(settings?.hourly_cost && Number(settings.hourly_cost) > 0),
        tested: (runsCount || 0) > 0,
        playbook: !!playbook,
        conversation: (conversationsCount || 0) > 0,
      }
    },
    enabled: !!clientId,
    refetchOnWindowFocus: false,
  })

  if (!clientId) return null
  if (dismissible && dismissed) return null
  if (!completion) return null

  const steps = [
    {
      id: 'shopify',
      label: 'Connecter votre boutique (Shopify, WooCommerce ou Webflow)',
      icon: ShoppingBag,
      tab: 'integrations',
      done: completion.shopify,
    },
    {
      id: 'email',
      label: 'Connecter votre email (SMTP personnalisé ou Resend)',
      icon: Mail,
      tab: 'integrations',
      done: completion.email,
    },
    {
      id: 'tone',
      label: "Personnaliser le ton de l'agent",
      icon: Wand2,
      tab: 'agent-config',
      done: completion.tone,
    },
    {
      id: 'roi',
      label: 'Configurer les paramètres ROI',
      icon: Calculator,
      tab: 'roi',
      done: completion.roi,
    },
    {
      id: 'tested',
      label: 'Tester votre agent',
      icon: PlayCircle,
      tab: 'simulator',
      done: completion.tested,
    },
    {
      id: 'playbook',
      label: 'Activer le playbook SAV',
      icon: Sparkles,
      tab: 'playbooks',
      done: completion.playbook,
    },
    {
      id: 'conversation',
      label: 'Recevoir votre 1er message client',
      icon: MessageCircle,
      tab: 'escalations',
      done: completion.conversation,
    },
  ]

  const completedCount = steps.filter((s) => s.done).length
  const totalSteps = steps.length
  const progress = Math.round((completedCount / totalSteps) * 100)
  const allDone = completedCount === totalSteps

  const handleDismiss = () => {
    localStorage.setItem(`setup-checklist-dismissed-${clientId}`, 'true')
    setDismissed(true)
  }

  if (allDone) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-5 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#1a1a1a]">
              Configuration terminée 🎉
            </p>
            <p className="text-[11px] text-[#9ca3af]">
              Votre agent est prêt à traiter vos clients.
            </p>
          </div>
        </div>
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg hover:bg-[#fafafa] text-[#9ca3af] hover:text-[#1a1a1a] transition-colors"
            title="Masquer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#003725]/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-[#003725]" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#1a1a1a] leading-tight">
              Configuration : {completedCount}/{totalSteps} étapes
            </p>
            <p className="text-[11px] text-[#9ca3af] leading-tight mt-0.5">
              Finalisez votre setup pour activer votre agent IA
            </p>
          </div>
        </div>
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg hover:bg-[#fafafa] text-[#9ca3af] hover:text-[#1a1a1a] transition-colors flex-shrink-0"
            title="Masquer la checklist"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-3">
        <div className="w-full h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-cta rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Steps — horizontal scroll on mobile, grid on desktop */}
      <div className="px-3 pb-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-1">
          <AnimatePresence initial={false}>
            {steps.map((step) => {
              const Icon = step.icon
              return (
                <motion.button
                  key={step.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setActiveTab(step.tab)}
                  className={`group flex items-center gap-2 lg:flex-col lg:items-start lg:gap-1.5 p-2.5 rounded-xl text-left transition-colors ${
                    step.done
                      ? 'bg-emerald-50/40 hover:bg-emerald-50'
                      : 'hover:bg-[#fafafa]'
                  }`}
                  title={step.label}
                >
                  <div className="flex items-center gap-2 w-full">
                    {step.done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-[#d4d4d4] flex-shrink-0" />
                    )}
                    <Icon
                      className={`w-3.5 h-3.5 flex-shrink-0 ${
                        step.done ? 'text-emerald-600' : 'text-[#9ca3af]'
                      }`}
                    />
                    <span
                      className={`text-[11px] font-medium leading-tight line-clamp-2 flex-1 ${
                        step.done
                          ? 'text-[#9ca3af] line-through'
                          : 'text-[#1a1a1a]'
                      }`}
                    >
                      {step.label}
                    </span>
                    {!step.done && (
                      <ArrowRight className="w-3 h-3 text-[#d4d4d4] group-hover:text-cta flex-shrink-0 lg:hidden" />
                    )}
                  </div>
                </motion.button>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
