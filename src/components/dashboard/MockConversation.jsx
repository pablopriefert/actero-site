import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles } from 'lucide-react'

/**
 * MockConversation — small animated preview of an agent conversation.
 * Shown in the dashboard "what awaits you" section during setup mode to
 * give a concrete aha moment of what the agent will actually do.
 *
 * Messages reveal one by one (1.2s between), pause 3s after the last one,
 * then loop. Restrained motion, brand colors.
 */
const MESSAGES = [
  { from: 'customer', text: 'Bonjour, où est ma commande #1234 ?' },
  { from: 'agent', text: 'Bonjour Marie ! Votre commande est en livraison, arrivée prévue demain entre 10h et 14h. Le lien de suivi vient de partir par email 📦' },
  { from: 'customer', text: "Merci, et si elle n'arrive pas demain ?" },
  { from: 'agent', text: 'Pas de souci — je rembourse automatiquement les frais de port en cas de retard >24h. Je vous tiens au courant ce soir.' },
]

const REVEAL_MS = 1200
const PAUSE_MS = 3000

export function MockConversation() {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    let timer
    if (visibleCount < MESSAGES.length) {
      timer = setTimeout(() => setVisibleCount((c) => c + 1), REVEAL_MS)
    } else {
      // All messages shown — pause then loop back to 0
      timer = setTimeout(() => setVisibleCount(0), PAUSE_MS)
    }
    return () => clearTimeout(timer)
  }, [visibleCount])

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-4 min-h-[220px]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-[#003725]/10 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-[#003725]" />
        </div>
        <div>
          <p className="text-[12px] font-semibold text-[#1a1a1a] leading-tight">Aperçu agent</p>
          <p className="text-[10px] text-[#9ca3af] leading-tight">Exemple de conversation</p>
        </div>
      </div>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {MESSAGES.slice(0, visibleCount).map((msg, idx) => {
            const isCustomer = msg.from === 'customer'
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className={`flex items-start gap-2 ${isCustomer ? 'justify-start' : 'justify-end'}`}
              >
                {isCustomer && (
                  <div className="w-6 h-6 rounded-full bg-[#e5e5e5] flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-semibold text-[#5A5A5A]">M</span>
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-3 py-2 rounded-2xl text-[13px] leading-snug ${
                    isCustomer
                      ? 'bg-white border border-[#f0f0f0] text-[#1a1a1a] rounded-tl-sm'
                      : 'bg-[#003725]/5 text-[#1a1a1a] rounded-tr-sm'
                  }`}
                >
                  {msg.text}
                </div>
                {!isCustomer && (
                  <div className="w-6 h-6 rounded-full bg-[#003725] flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
