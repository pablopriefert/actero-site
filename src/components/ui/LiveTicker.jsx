import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const STATS = {
  ecommerce: [
    { value: '847', label: 'tickets traités cette semaine', suffix: '' },
    { value: '+12 400', label: 'euros récupérés ce mois', suffix: ' €' },
    { value: '312', label: 'paniers relancés aujourd\'hui', suffix: '' },
    { value: '94', label: 'des demandes résolues sans humain', suffix: '%' },
  ],
  immobilier: [
    { value: '89', label: 'prospects qualifiés cette semaine', suffix: '' },
    { value: '247', label: 'rendez-vous confirmés ce mois', suffix: '' },
    { value: '+58', label: 'de rendez-vous supplémentaires', suffix: '%' },
    { value: '43', label: 'documents collectés aujourd\'hui', suffix: '' },
  ],
}

export const LiveTicker = ({ vertical }) => {
  const [idx, setIdx] = useState(0)
  const stats = STATS[vertical] || STATS.ecommerce
  const isImmo = vertical === 'immobilier'

  useEffect(() => {
    setIdx(0)
    const interval = setInterval(() => {
      setIdx(i => (i + 1) % stats.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [vertical, stats.length])

  const stat = stats[idx]

  return (
    <div className={`inline-flex items-center gap-3 rounded-full px-5 py-2.5 border ${
      isImmo
        ? 'bg-violet-500/[0.05] border-violet-500/15'
        : 'bg-emerald-500/[0.05] border-emerald-500/15'
    }`}>
      {/* Live dot */}
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${isImmo ? 'bg-violet-400' : 'bg-emerald-400'}`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${isImmo ? 'bg-violet-400' : 'bg-emerald-400'}`} />
      </span>

      <span className="text-[11px] font-bold text-[#5A7A8C] uppercase tracking-widest flex-shrink-0">En direct</span>

      <div className="h-3 w-px bg-white/10 flex-shrink-0" />

      <AnimatePresence mode="wait">
        <motion.span
          key={`${vertical}-${idx}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="text-sm font-medium text-[#0A0E1A]/70 whitespace-nowrap"
        >
          <span className={`font-black text-base ${isImmo ? 'text-violet-300' : 'text-emerald-300'}`}>
            {stat.value}{stat.suffix}
          </span>{' '}
          {stat.label}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}
