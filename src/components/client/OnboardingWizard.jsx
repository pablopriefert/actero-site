import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingBag, Mail, Wand2, Calculator, PlayCircle, Sparkles,
  MessageCircle, CheckCircle2, ArrowRight, Loader2, Zap, Rocket,
  X
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Logo } from '../layout/Logo'

/**
 * OnboardingWizard — full-screen immersive onboarding for brand-new clients.
 *
 * Shown as a blocking overlay when:
 *  - client account is < 3 days old
 *  - AND < 2 setup steps are complete
 *  - AND wizard was not dismissed explicitly
 *
 * The user can skip to go to the dashboard, but the default experience
 * is to walk them through each step.
 */

const STEPS = [
  {
    id: 'shopify',
    icon: ShoppingBag,
    title: 'Connecter votre boutique',
    description: 'Shopify, WooCommerce ou Webflow — on synchronise commandes et clients automatiquement.',
    actionLabel: 'Connecter maintenant',
    actionTab: 'integrations',
    color: 'bg-[#0F5F35]',
    bgLight: 'bg-emerald-50',
    textLight: 'text-emerald-600',
  },
  {
    id: 'email',
    icon: Mail,
    title: 'Connecter votre email',
    description: 'SMTP personnalisé ou Resend — pour que l\'IA puisse répondre à vos clients.',
    actionLabel: 'Configurer l\'email',
    actionTab: 'integrations',
    color: 'bg-blue-500',
    bgLight: 'bg-blue-50',
    textLight: 'text-blue-600',
  },
  {
    id: 'tone',
    icon: Wand2,
    title: 'Définir le ton de marque',
    description: 'L\'IA apprend à parler comme vous : chaleureux, professionnel, décontracté…',
    actionLabel: 'Configurer le ton',
    actionTab: 'agent-config',
    color: 'bg-violet-500',
    bgLight: 'bg-violet-50',
    textLight: 'text-violet-600',
  },
  {
    id: 'playbook',
    icon: Zap,
    title: 'Activer votre premier playbook',
    description: 'Le SAV e-commerce : tri des tickets, suivi des commandes, retours — tout automatisé.',
    actionLabel: 'Activer le SAV',
    actionTab: 'playbooks',
    color: 'bg-amber-500',
    bgLight: 'bg-amber-50',
    textLight: 'text-amber-600',
  },
  {
    id: 'tested',
    icon: PlayCircle,
    title: 'Tester votre agent',
    description: 'Simulez une conversation pour voir votre agent IA en action avant la mise en production.',
    actionLabel: 'Tester maintenant',
    actionTab: 'simulator',
    color: 'bg-pink-500',
    bgLight: 'bg-pink-50',
    textLight: 'text-pink-600',
  },
]

const DISMISS_KEY = (cid) => `onboarding-wizard-dismissed-${cid}`

export const OnboardingWizard = ({ clientId, setActiveTab, client }) => {
  const [dismissed, setDismissed] = useState(
    () => !!localStorage.getItem(DISMISS_KEY(clientId))
  )

  const { data: progress, isLoading } = useQuery({
    queryKey: ['onboarding-wizard-progress', clientId],
    queryFn: async () => {
      const [shopify, smtp, resend, settings, playbook] = await Promise.all([
        supabase.from('client_shopify_connections').select('id').eq('client_id', clientId).maybeSingle(),
        supabase.from('client_integrations').select('id').eq('client_id', clientId).eq('provider', 'smtp_imap').eq('status', 'active').maybeSingle(),
        supabase.from('client_integrations').select('id').eq('client_id', clientId).eq('provider', 'resend').eq('status', 'active').maybeSingle(),
        supabase.from('client_settings').select('brand_tone').eq('client_id', clientId).maybeSingle(),
        supabase.from('engine_client_playbooks').select('id, is_active, engine_playbooks!inner(name)').eq('client_id', clientId).eq('is_active', true).eq('engine_playbooks.name', 'sav_ecommerce').maybeSingle(),
      ])
      const runsCountRes = await supabase.from('engine_runs_v2').select('id', { count: 'exact', head: true }).eq('client_id', clientId)

      return {
        shopify: !!shopify.data,
        email: !!smtp.data || !!resend.data,
        tone: !!(settings.data?.brand_tone && settings.data.brand_tone.trim().length > 0),
        playbook: !!playbook.data,
        tested: (runsCountRes.count || 0) > 0,
      }
    },
    enabled: !!clientId,
    refetchInterval: 5000, // check progress every 5s while wizard is open
  })

  // Check if client is "new" (< 3 days old) and has few steps completed
  const isNewClient = client?.created_at
    ? (Date.now() - new Date(client.created_at).getTime()) < 3 * 86400000
    : false

  const completedCount = progress ? Object.values(progress).filter(Boolean).length : 0
  const shouldShow = isNewClient && completedCount < 2 && !dismissed

  if (!shouldShow || isLoading || !progress) return null

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY(clientId), 'true')
    setDismissed(true)
  }

  const handleAction = (step) => {
    setActiveTab?.(step.actionTab)
    // Don't dismiss — let progress update auto-hide the wizard
  }

  const firstName = client?.brand_name?.split(/\s/)[0] || 'bienvenue'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-gradient-to-br from-[#F9F7F1] via-white to-emerald-50/30 overflow-y-auto"
      >
        {/* Top bar */}
        <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-gray-100 z-10">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#F9F7F1] border border-gray-200 flex items-center justify-center">
                <Logo className="w-4 h-4 text-[#262626]" />
              </div>
              <span className="font-bold text-sm text-[#262626]">Actero</span>
            </div>
            <button
              onClick={handleDismiss}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#71717a] hover:text-[#1a1a1a] transition-colors"
            >
              Passer pour l'instant
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold uppercase tracking-widest mb-5">
              <Rocket className="w-3 h-3" />
              Configuration guidée
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#1a1a1a] tracking-tight mb-3">
              Bienvenue {firstName} ! 👋
            </h1>
            <p className="text-[#71717a] text-base md:text-lg max-w-lg mx-auto leading-relaxed">
              Configurons votre compte Actero en 5 étapes. Tout est automatisé et prêt en 10 minutes.
            </p>
          </motion.div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#71717a]">Progression</span>
              <span className="text-xs font-bold text-[#0F5F35]">{completedCount} / {STEPS.length}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(completedCount / STEPS.length) * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-emerald-500 to-[#0F5F35] rounded-full"
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {STEPS.map((step, i) => {
              const done = progress[step.id]
              const isNext = !done && STEPS.slice(0, i).every((s) => progress[s.id])

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`relative flex items-center gap-4 p-5 rounded-2xl border transition-all ${
                    done
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : isNext
                      ? 'border-[#0F5F35]/30 bg-white shadow-md ring-2 ring-[#0F5F35]/10'
                      : 'border-gray-200 bg-white opacity-60'
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    done ? 'bg-emerald-500' : step.color
                  }`}>
                    {done ? (
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    ) : (
                      <step.icon className="w-6 h-6 text-white" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#9ca3af]">ÉTAPE {i + 1}</span>
                      {done && <span className="text-[10px] font-bold text-emerald-600 px-1.5 py-0.5 rounded bg-emerald-100">Fait</span>}
                      {isNext && <span className="text-[10px] font-bold text-[#0F5F35] px-1.5 py-0.5 rounded bg-[#0F5F35]/10">Suivant</span>}
                    </div>
                    <h3 className={`text-sm font-bold ${done ? 'text-emerald-700' : 'text-[#1a1a1a]'}`}>
                      {step.title}
                    </h3>
                    <p className="text-xs text-[#71717a] mt-0.5 leading-relaxed">{step.description}</p>
                  </div>

                  {/* Action */}
                  {!done && (
                    <button
                      onClick={() => handleAction(step)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isNext
                          ? 'bg-[#0F5F35] text-white hover:bg-[#003725]'
                          : 'border border-gray-200 text-[#71717a] hover:bg-gray-50'
                      }`}
                    >
                      {step.actionLabel}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </motion.div>
              )
            })}
          </div>

          {/* Skip CTA */}
          <div className="text-center mt-10">
            <button
              onClick={handleDismiss}
              className="text-xs text-[#9ca3af] hover:text-[#71717a] transition-colors"
            >
              Je préfère explorer le dashboard par moi-même
            </button>
          </div>

          {/* Completion state */}
          {completedCount === STEPS.length && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10 p-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-[#0F5F35] text-center text-white"
            >
              <Sparkles className="w-8 h-8 mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-1">Configuration terminée 🎉</h3>
              <p className="text-sm opacity-90 mb-4">Votre agent IA est prêt à traiter les demandes de vos clients.</p>
              <button
                onClick={handleDismiss}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#0F5F35] text-sm font-bold hover:bg-white/90 transition-all"
              >
                Aller au dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
