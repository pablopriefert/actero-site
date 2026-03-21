import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Search, ShoppingBag, Brain, Send, CheckCircle2, Clock, Zap, RotateCcw } from 'lucide-react'

const STEPS = [
  {
    id: 0,
    icon: MessageSquare,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    title: 'Ticket recu',
    subtitle: 'Webhook Shopify',
    detail: '"Bonjour, ma commande #4821 est arrivee cassee. Je voudrais un remboursement ou un renvoi."',
    time: '0s',
  },
  {
    id: 1,
    icon: Search,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    title: 'Extraction des donnees',
    subtitle: 'Analyse IA du message',
    detail: 'Intent : reclamation produit endommage | Commande : #4821 | Client : Marie D. | Priorite : haute',
    time: '0.3s',
  },
  {
    id: 2,
    icon: ShoppingBag,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
    title: 'Recuperation commande Shopify',
    subtitle: 'API Shopify',
    detail: 'Commande #4821 | Livree le 18/03 | Montant : 89.90EUR | Produit : Lampe Artisanale XL | Transporteur : Colissimo',
    time: '0.8s',
  },
  {
    id: 3,
    icon: Brain,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    title: 'Generation reponse IA',
    subtitle: 'Gemini + contexte client',
    detail: 'Reponse personnalisee generee avec excuses, proposition de renvoi gratuit, et code promo -15% pour le prochain achat.',
    time: '1.2s',
  },
  {
    id: 4,
    icon: Send,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
    title: 'Envoi de la reponse',
    subtitle: 'Email automatique',
    detail: 'Email envoye a marie.d@email.com avec la proposition de resolution. Ticket marque comme "resolu".',
    time: '1.5s',
  },
  {
    id: 5,
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    title: 'Ticket resolu',
    subtitle: 'Automatiquement',
    detail: 'Temps total : 1.5 secondes | Temps economise : 8 minutes | Satisfaction client preservee',
    time: '1.5s',
  },
]

export const TicketReplay = () => {
  const [activeStep, setActiveStep] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasPlayed, setHasPlayed] = useState(false)

  const startReplay = () => {
    setActiveStep(-1)
    setIsPlaying(true)
    setHasPlayed(true)
  }

  useEffect(() => {
    if (!isPlaying) return
    if (activeStep >= STEPS.length - 1) {
      setIsPlaying(false)
      return
    }

    const timer = setTimeout(() => {
      setActiveStep(prev => prev + 1)
    }, activeStep === -1 ? 500 : 1200)

    return () => clearTimeout(timer)
  }, [activeStep, isPlaying])

  // Auto-start on viewport
  const [ref, setRef] = useState(null)
  useEffect(() => {
    if (!ref || hasPlayed) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasPlayed) {
          startReplay()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(ref)
    return () => observer.disconnect()
  }, [ref, hasPlayed])

  return (
    <section className="py-24 md:py-32 bg-transparent px-6 relative z-10 border-t border-white/[0.04]" ref={setRef}>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-6">
            <Zap className="w-3.5 h-3.5" />
            Demo en direct
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-white mb-6">
            Voyez l'IA en action.
          </h2>
          <p className="text-lg text-gray-400 font-medium max-w-2xl mx-auto">
            Un ticket SAV traite en 1.5 seconde. De A a Z. Sans intervention humaine.
          </p>
        </motion.div>

        {/* Replay container */}
        <div className="bg-[#0a0a0a] border border-white/[0.06] rounded-3xl p-6 md:p-8 relative overflow-hidden">
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-500 to-emerald-500"
              animate={{ width: `${((activeStep + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-8 mt-2">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {isPlaying ? 'Traitement en cours...' : activeStep >= STEPS.length - 1 ? 'Traitement termine' : 'Workflow SAV IA'}
              </span>
            </div>
            <button
              onClick={startReplay}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-medium transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Rejouer
            </button>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {STEPS.map((step, i) => {
              const isActive = i <= activeStep
              const isCurrent = i === activeStep
              const Icon = step.icon

              return (
                <AnimatePresence key={step.id}>
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, y: 20, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      className={`flex gap-4 p-4 rounded-2xl border transition-all duration-300 ${
                        isCurrent
                          ? `${step.bg} shadow-lg`
                          : 'bg-white/[0.02] border-white/5'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isCurrent ? step.bg : 'bg-white/5'
                      }`}>
                        <Icon className={`w-5 h-5 ${isCurrent ? step.color : 'text-gray-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <h4 className={`text-sm font-bold ${isCurrent ? 'text-white' : 'text-gray-400'}`}>
                              {step.title}
                            </h4>
                            <span className="text-[10px] text-gray-600 font-mono">
                              {step.subtitle}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-600" />
                            <span className="text-[10px] text-gray-600 font-mono">{step.time}</span>
                          </div>
                        </div>
                        <p className={`text-xs leading-relaxed ${isCurrent ? 'text-gray-300' : 'text-gray-600'}`}>
                          {step.detail}
                        </p>
                      </div>
                      {!isCurrent && isActive && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500/50 flex-shrink-0 mt-2" />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              )
            })}
          </div>

          {/* Completed state */}
          <AnimatePresence>
            {activeStep >= STEPS.length - 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-violet-500/10 border border-emerald-500/20 text-center"
              >
                <div className="flex items-center justify-center gap-6 text-sm">
                  <div>
                    <span className="text-gray-500">Temps total</span>
                    <p className="text-xl font-black text-emerald-400">1.5s</p>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div>
                    <span className="text-gray-500">Temps economise</span>
                    <p className="text-xl font-black text-violet-400">8 min</p>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div>
                    <span className="text-gray-500">Satisfaction</span>
                    <p className="text-xl font-black text-amber-400">98%</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
