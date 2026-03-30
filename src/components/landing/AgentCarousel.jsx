import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Target } from 'lucide-react'

export const AgentCarousel = ({ agents, vertical }) => {
  const [activeIdx, setActiveIdx] = useState(0)
  const active = agents[activeIdx]
  const isImmo = vertical === 'immobilier'
  const accent = isImmo ? 'violet' : 'emerald'

  const accentClasses = {
    pill: isImmo
      ? 'text-violet-400 bg-violet-500/10 border-violet-500/20'
      : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    dot: isImmo ? 'bg-violet-400' : 'bg-emerald-400',
    result: isImmo ? 'text-violet-400' : 'text-emerald-400',
    avatarActive: isImmo
      ? 'border-violet-400 bg-violet-500/10 text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.3)]'
      : 'border-emerald-400 bg-emerald-500/10 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]',
    labelActive: isImmo ? 'text-violet-400' : 'text-emerald-400',
    cardBorder: isImmo ? 'border-violet-500/20' : 'border-emerald-500/20',
    resultIcon: isImmo ? 'text-violet-400' : 'text-emerald-400',
  }

  return (
    <div>
      {/* Avatar row */}
      <div className="flex items-center justify-center gap-6 md:gap-10 mb-12 flex-wrap">
        {agents.map((agent, i) => (
          <button
            key={agent.agentName}
            onClick={() => setActiveIdx(i)}
            className="group flex flex-col items-center gap-2 transition-all duration-300 focus:outline-none"
          >
            <motion.div
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.96 }}
              className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-lg font-black transition-all duration-300 ${
                activeIdx === i
                  ? accentClasses.avatarActive
                  : 'border-[#2E4068]/12 bg-white/60 text-[#0A0E1A]/40 hover:border-white/25 hover:text-[#0A0E1A]/70'
              }`}
            >
              {agent.agentName.slice(0, 2)}
            </motion.div>
            <span className={`text-[10px] font-black tracking-[0.2em] uppercase transition-colors ${
              activeIdx === i ? accentClasses.labelActive : 'text-[#5A7A8C] group-hover:text-[#5A7A8C]'
            }`}>
              {agent.agentName}
            </span>
            {activeIdx === i && (
              <motion.div
                layoutId="agent-underline"
                className={`h-0.5 w-8 rounded-full ${isImmo ? 'bg-violet-400' : 'bg-emerald-400'}`}
              />
            )}
          </button>
        ))}
      </div>

      {/* Active agent card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIdx}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className={`bg-white/80 rounded-[28px] p-8 md:p-10 border ${accentClasses.cardBorder} max-w-2xl mx-auto relative overflow-hidden`}
        >
          {/* Subtle glow */}
          <div className={`absolute -top-16 -right-16 w-48 h-48 rounded-full blur-[80px] pointer-events-none ${
            isImmo ? 'bg-violet-500/10' : 'bg-emerald-500/10'
          }`} />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <span className={`text-[10px] font-black tracking-[0.2em] uppercase px-3 py-1.5 rounded-lg border ${accentClasses.pill}`}>
                Agent {active.agentName}
              </span>
              <span className={`w-2 h-2 rounded-full animate-pulse ${accentClasses.dot}`} />
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${active.iconBg} ${active.iconColor} flex-shrink-0`}>
                {active.icon}
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-[#0A0E1A] leading-snug">{active.title}</h3>
            </div>

            <div className="bg-white/[0.07] border border-[#2E4068]/18 rounded-xl px-4 py-3 mb-6">
              <p className={`text-sm font-bold flex items-center gap-2 ${accentClasses.result}`}>
                <Target className="w-4 h-4 flex-shrink-0" />
                {active.result}
              </p>
            </div>

            <p className="text-[#5A7A8C] font-medium leading-relaxed">
              {active.desc}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
