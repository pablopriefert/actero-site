import React from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Clock, PhoneCall, ChevronRight } from 'lucide-react'

/**
 * Insights Hub — single landing with cards leading to each analytics view.
 *
 * Keeps the sidebar clean (one "Insights" entry) while offering fast access
 * to the 4 sub-analytics (Performance, ROI, Peak hours, Voice calls).
 */
export const InsightsHubView = ({ onNavigate, canAccessVoice = false }) => {
  const cards = [
    {
      id: 'weekly-summary',
      title: 'Performance',
      description: 'Résumé hebdomadaire : volume, taux auto, temps moyen',
      icon: BarChart3,
      color: '#0E653A',
    },
    {
      id: 'roi',
      title: 'ROI',
      description: 'Économies générées vs coût support humain',
      icon: TrendingUp,
      color: '#2563eb',
    },
    {
      id: 'peak-hours',
      title: 'Heures de pic',
      description: 'Quand vos clients sollicitent le plus l\'agent',
      icon: Clock,
      color: '#d97706',
    },
    {
      id: 'voice-calls',
      title: 'Appels vocaux',
      description: 'Analytics détaillées de l\'agent téléphonique',
      icon: PhoneCall,
      color: '#7c3aed',
      locked: !canAccessVoice,
      lockedLabel: 'PRO',
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 pt-6 pb-16 animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-[22px] font-bold text-[#1a1a1a] tracking-tight mb-1">Insights</h1>
        <p className="text-[13px] text-[#71717a]">
          Les métriques pour comprendre la performance de votre agent.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon
          return (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.04 * idx }}
              onClick={() => !card.locked && onNavigate && onNavigate(card.id)}
              disabled={card.locked}
              className={`group text-left bg-white rounded-2xl border border-[#f0f0f0] p-5 transition-all ${
                card.locked
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:border-cta/25 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${card.color}15` }}
                >
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
                {card.locked ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {card.lockedLabel}
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#9ca3af] opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
              <h3 className="text-[14px] font-semibold text-[#1a1a1a] mb-1">{card.title}</h3>
              <p className="text-[12px] text-[#71717a] leading-relaxed">{card.description}</p>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
