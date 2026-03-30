import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Check, Clock, Euro, Zap, ArrowRight, Minus } from 'lucide-react'

const beforeItems = [
  { icon: Clock, label: "5-15 min par ticket SAV", sub: "Copier-coller, chercher la commande, rédiger..." },
  { icon: X, label: "70% des paniers perdus", sub: "Aucun suivi automatisé, zéro relance" },
  { icon: Minus, label: "Réponses en 2-24h", sub: "Le client part chez le concurrent" },
  { icon: Euro, label: "0€ récupéré sur les abandons", sub: "Perte sèche chaque mois" },
]

const afterItems = [
  { icon: Zap, label: "Réponse IA en < 30 secondes", sub: "Contexte commande inclus automatiquement" },
  { icon: Check, label: "12% des paniers récupérés", sub: "Séquences de relance IA personnalisées" },
  { icon: Check, label: "82% des tickets résolus par l'IA", sub: "Escalade intelligente si nécessaire" },
  { icon: Euro, label: "+3 000€/mois en moyenne", sub: "ROI visible dès le premier mois" },
]

export const BeforeAfterSlider = () => {
  const [position, setPosition] = useState(50)

  return (
    <section className="py-24 md:py-32 bg-transparent px-6 relative z-10 border-t border-white/[0.04]">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-bold text-[#5A7A8C] uppercase tracking-[0.2em] mb-6">
            Transformation
          </p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-[#0A0E1A] mb-6">
            Avant vs Après<br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-emerald-400">Actero.</span>
          </h2>
          <p className="text-lg text-[#5A7A8C] font-medium max-w-2xl mx-auto">
            Glissez le curseur pour voir la différence.
          </p>
        </motion.div>

        {/* Slider container */}
        <div className="relative rounded-3xl overflow-hidden border border-[#2E4068]/10">
          <div className="grid md:grid-cols-2">
            {/* BEFORE */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="p-8 md:p-10 bg-gradient-to-br from-red-500/[0.03] to-transparent border-r border-[#2E4068]/10"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <X className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0A0E1A]">Sans Actero</h3>
                  <p className="text-xs text-[#5A7A8C]">Processus manuels</p>
                </div>
              </div>
              <div className="space-y-5">
                {beforeItems.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-3"
                  >
                    <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon className="w-4 h-4 text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0A0E1A]">{item.label}</p>
                      <p className="text-xs text-[#5A7A8C] mt-0.5">{item.sub}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-8 p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Perte mensuelle</span>
                  <span className="text-2xl font-black text-red-400">-5 000€</span>
                </div>
              </div>
            </motion.div>

            {/* AFTER */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="p-8 md:p-10 bg-gradient-to-br from-emerald-500/[0.03] to-transparent"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0A0E1A]">Avec Actero</h3>
                  <p className="text-xs text-[#5A7A8C]">IA autonome 24/7</p>
                </div>
              </div>
              <div className="space-y-5">
                {afterItems.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-3"
                  >
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0A0E1A]">{item.label}</p>
                      <p className="text-xs text-[#5A7A8C] mt-0.5">{item.sub}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-8 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Gain mensuel</span>
                  <span className="text-2xl font-black text-emerald-400">+3 400€</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
