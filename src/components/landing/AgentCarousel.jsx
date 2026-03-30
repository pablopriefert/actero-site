import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Target } from 'lucide-react'

export const AgentCarousel = ({ agents, vertical }) => {
  const [activeIdx, setActiveIdx] = useState(0)
  const active = agents[activeIdx]
  const isImmo = vertical === 'immobilier'

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
                  ? 'border-[#003725] bg-[#0F5F35]/5 text-[#003725]'
                  : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-[#716D5C]'
              }`}
            >
              {agent.agentName.slice(0, 2)}
            </motion.div>
            <span className={`text-[10px] font-black tracking-[0.2em] uppercase transition-colors ${
              activeIdx === i ? 'text-[#003725]' : 'text-[#716D5C] group-hover:text-[#262626]'
            }`}>
              {agent.agentName}
            </span>
            {activeIdx === i && (
              <motion.div
                layoutId="agent-underline"
                className="h-0.5 w-8 rounded-full bg-[#0F5F35]"
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
          className="bg-white rounded-3xl p-8 md:p-10 border border-gray-200 max-w-2xl mx-auto relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] font-black tracking-[0.2em] uppercase px-3 py-1.5 rounded-lg border text-[#716D5C] bg-[#F9F7F1] border-gray-200">
                Agent {active.agentName}
              </span>
              <span className="w-2 h-2 rounded-full animate-pulse bg-[#0F5F35]" />
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${active.iconBg} ${active.iconColor} flex-shrink-0`}>
                {active.icon}
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-[#262626] leading-snug">{active.title}</h3>
            </div>

            <div className="bg-[#F9F7F1] border border-gray-200 rounded-xl px-4 py-3 mb-6">
              <p className="text-sm font-bold flex items-center gap-2 text-[#003725]">
                <Target className="w-4 h-4 flex-shrink-0" />
                {active.result}
              </p>
            </div>

            <p className="text-[#716D5C] font-medium leading-relaxed">
              {active.desc}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
