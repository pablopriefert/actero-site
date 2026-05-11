import React, { useState } from 'react'
import { X, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export const AnnouncementBar = ({ onNavigate, vertical: _vertical }) => {
  const [dismissed, setDismissed] = useState(false)
  const isImmo = false

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={`relative z-50 border-b ${
            isImmo
              ? 'bg-violet-950/80 border-violet-500/20'
              : 'bg-[#003725]/80 border-[#003725]/20'
          } backdrop-blur-sm overflow-hidden`}
        >
          <div className="flex items-center justify-center gap-2.5 px-10 py-2.5 text-sm font-medium text-white/90">
            <Zap className={`w-3.5 h-3.5 flex-shrink-0 ${isImmo ? 'text-violet-400' : 'text-emerald-400'}`} />
            <span>
              Seulement{' '}
              <strong className="text-white">3 places d'audit</strong>{' '}
              disponibles ce mois-ci —{' '}
              <button
                onClick={() => onNavigate?.('/audit')}
                className={`font-bold underline underline-offset-2 hover:no-underline transition-all ${
                  isImmo ? 'text-violet-300 hover:text-violet-200' : 'text-emerald-300 hover:text-emerald-200'
                }`}
              >
                Réserver maintenant →
              </button>
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors p-1"
            aria-label="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
