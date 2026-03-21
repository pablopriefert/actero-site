import React from 'react'
import { motion } from 'framer-motion'
import { CreditCard, Download, Cpu, Rocket, Check, Clock, ArrowRight } from 'lucide-react'

const steps = [
  {
    icon: CreditCard,
    title: 'Paiement',
    subtitle: 'Stripe Checkout',
    time: '2 min',
    color: 'from-violet-500 to-violet-600',
    borderColor: 'border-violet-500/30',
    detail: 'Paiement securise par carte ou PayPal',
  },
  {
    icon: Download,
    title: 'App Shopify',
    subtitle: 'Installation OAuth',
    time: '1 min',
    color: 'from-blue-500 to-blue-600',
    borderColor: 'border-blue-500/30',
    detail: 'Un clic pour connecter votre boutique',
  },
  {
    icon: Cpu,
    title: 'Deploiement IA',
    subtitle: 'Workflows n8n',
    time: '24-48h',
    color: 'from-emerald-500 to-emerald-600',
    borderColor: 'border-emerald-500/30',
    detail: 'Configuration et activation de vos agents IA',
  },
  {
    icon: Rocket,
    title: 'En production',
    subtitle: 'Dashboard live',
    time: 'Done',
    color: 'from-amber-500 to-orange-500',
    borderColor: 'border-amber-500/30',
    detail: 'Vos automatisations tournent 24/7',
  },
]

export const OnboardingTimer = ({ variant = 'full' }) => {
  if (variant === 'compact') {
    return (
      <div className="flex items-center justify-center gap-3 py-6">
        <Clock className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-medium text-gray-400">Temps de mise en production :</span>
        <span className="text-lg font-black text-white">48h</span>
        <div className="flex items-center gap-1.5 ml-4">
          {steps.map((step, i) => (
            <React.Fragment key={i}>
              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${step.color} flex items-center justify-center`}>
                <step.icon className="w-3.5 h-3.5 text-white" />
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="w-3 h-3 text-gray-600" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    )
  }

  return (
    <section className="py-20 bg-transparent px-6 relative z-10">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold mb-6">
            <Clock className="w-3.5 h-3.5" />
            Mise en production
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-white mb-4">
            Operationnel en <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-emerald-400">48 heures.</span>
          </h2>
          <p className="text-gray-400 font-medium max-w-xl mx-auto">
            Du paiement au dashboard live. Zero setup de votre cote.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Connection line */}
          <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent hidden md:block" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                <div className={`bg-[#0a0a0a] border ${step.borderColor} rounded-2xl p-5 text-center hover:scale-[1.02] transition-transform`}>
                  {/* Step number */}
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#0a0a0a] border border-white/10 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-gray-500">{i + 1}</span>
                  </div>

                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                    <step.icon className="w-6 h-6 text-white" />
                  </div>

                  {/* Content */}
                  <h4 className="text-sm font-bold text-white mb-0.5">{step.title}</h4>
                  <p className="text-[10px] text-gray-500 font-medium mb-3">{step.subtitle}</p>

                  {/* Time badge */}
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    step.time === 'Done'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-white/5 text-gray-400 border border-white/10'
                  }`}>
                    {step.time === 'Done' ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {step.time}
                  </div>

                  <p className="text-[11px] text-gray-600 mt-3">{step.detail}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
