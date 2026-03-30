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
    <section className="py-24 md:py-32 bg-white px-6 relative z-10 border-t border-gray-200">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-bold text-[#716D5C] uppercase tracking-[0.2em] mb-6">
            Transformation
          </p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-[#262626] mb-6">
            Avant vs Après<br className="hidden md:block" />
            <span className="text-[#003725]">Actero.</span>
          </h2>
          <p className="text-lg text-[#716D5C] font-medium max-w-2xl mx-auto">
            Glissez le curseur pour voir la différence.
          </p>
        </motion.div>

        {/* Slider container */}
        <div className="relative rounded-3xl overflow-hidden border border-gray-200">
          <div className="grid md:grid-cols-2">
            {/* BEFORE */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="p-8 md:p-10 bg-red-50/30 border-r border-gray-200"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
                  <X className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#262626]">Sans Actero</h3>
                  <p className="text-xs text-[#716D5C]">Processus manuels</p>
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
                    <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#262626]">{item.label}</p>
                      <p className="text-xs text-[#716D5C] mt-0.5">{item.sub}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-8 p-4 rounded-2xl bg-red-50 border border-red-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Perte mensuelle</span>
                  <span className="text-2xl font-black text-red-500">-5 000€</span>
                </div>
              </div>
            </motion.div>

            {/* AFTER */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="p-8 md:p-10 bg-[#F9F7F1]/30"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-2xl bg-[#F9F7F1] border border-[#003725]/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-[#003725]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#262626]">Avec Actero</h3>
                  <p className="text-xs text-[#716D5C]">IA autonome 24/7</p>
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
                    <div className="w-8 h-8 rounded-xl bg-[#F9F7F1] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon className="w-4 h-4 text-[#003725]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#262626]">{item.label}</p>
                      <p className="text-xs text-[#716D5C] mt-0.5">{item.sub}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-8 p-4 rounded-2xl bg-[#F9F7F1] border border-[#003725]/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#003725] uppercase tracking-wider">Gain mensuel</span>
                  <span className="text-2xl font-black text-[#003725]">+3 400€</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
