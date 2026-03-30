import React from 'react'
import { motion } from 'framer-motion'
import { CreditCard, Download, Cpu, Rocket, Check, Clock, ArrowRight } from 'lucide-react'

const steps = [
  {
    num: '01',
    icon: CreditCard,
    title: 'Paiement sécurisé',
    detail: 'Stripe Checkout. Paiement par carte ou PayPal en 2 minutes.',
  },
  {
    num: '02',
    icon: Download,
    title: 'Connexion outils',
    detail: 'Un clic pour connecter Shopify et vos outils. Installation OAuth automatique.',
  },
  {
    num: '03',
    icon: Cpu,
    title: 'Déploiement IA',
    detail: 'Configuration et activation de vos agents IA en 24-48h.',
  },
]

export const OnboardingTimer = ({ variant = 'full' }) => {
  if (variant === 'compact') {
    return (
      <div className="flex items-center justify-center gap-3 py-6">
        <Clock className="w-4 h-4 text-[#716D5C]" />
        <span className="text-sm font-medium text-[#716D5C]">Temps de mise en production :</span>
        <span className="text-lg font-black text-[#262626]">48h</span>
        <div className="flex items-center gap-1.5 ml-4">
          {steps.map((step, i) => (
            <React.Fragment key={i}>
              <div className="w-7 h-7 rounded-lg bg-[#003725] flex items-center justify-center">
                <step.icon className="w-3.5 h-3.5 text-white" />
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="w-3 h-3 text-gray-400" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    )
  }

  return (
    <section className="py-16 md:py-20 px-6 relative z-10">
      <div className="max-w-5xl mx-auto">
        <div className="bg-[#FFF389] rounded-3xl p-10 md:p-16 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-[#003725] mb-4" style={{ fontFamily: 'Georgia, serif' }}>
              Opérationnel en 48 heures.
            </h2>
            <p className="text-[#003725]/70 font-medium text-lg max-w-xl mx-auto">
              Du paiement au dashboard live. Zéro setup de votre côté.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center md:text-left"
              >
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mx-auto md:mx-0 mb-4">
                  <span className="text-sm font-bold text-[#003725]">{step.num}</span>
                </div>
                <h4 className="text-xl font-bold text-[#003725] mb-2" style={{ fontFamily: 'Georgia, serif' }}>{step.title}</h4>
                <p className="text-[#003725]/70 font-medium text-sm leading-relaxed">{step.detail}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
