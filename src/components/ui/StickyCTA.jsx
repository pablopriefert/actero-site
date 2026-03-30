import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export const StickyCTA = ({ onNavigate, vertical }) => {
  const [visible, setVisible] = useState(false)
  const isImmo = vertical === 'immobilier'

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 400)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-5 left-4 right-4 z-50 md:hidden"
        >
          <button
            onClick={() => onNavigate('/audit')}
            className="w-full py-4 px-6 rounded-full font-bold text-base flex items-center justify-center gap-2 shadow-xl transition-all active:scale-[0.98] bg-[#0F5F35] text-white"
          >
            {isImmo ? 'Demander une démo' : 'Réserver mon audit gratuit'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
