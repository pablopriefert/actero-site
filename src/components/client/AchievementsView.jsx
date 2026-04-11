import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Trophy } from 'lucide-react'
import { useAchievements } from '../../hooks/useAchievements'
import { TIER_COLORS } from '../../lib/achievements-catalog'

const formatDate = (iso) => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

export const AchievementsView = ({ clientId }) => {
  const { allBadges, progress, loading } = useAchievements(clientId)

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-6 mb-6">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0F5F35]/10 mb-2">
              <Trophy className="w-3 h-3 text-[#0F5F35]" />
              <span className="text-[10px] font-semibold text-[#0F5F35] uppercase tracking-wider">
                Récompenses
              </span>
            </div>
            <h2 className="text-[22px] font-bold text-[#1a1a1a] tracking-tight">
              Vos badges
            </h2>
            <p className="text-[13px] text-[#71717a] mt-1">
              Débloquez des récompenses au fil de votre progression avec Actero.
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold text-[#71717a] uppercase tracking-wider">
              Débloqués
            </p>
            <p className="text-[28px] font-bold text-[#1a1a1a] leading-none mt-1">
              {progress.unlocked}{' '}
              <span className="text-[16px] font-semibold text-[#71717a]">
                / {progress.total}
              </span>
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress.pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-[#0F5F35] to-[#14764a] rounded-full"
          />
        </div>
        <p className="text-[11px] text-[#71717a] mt-2">
          {progress.pct}% de badges débloqués
        </p>
      </div>

      {/* Grid */}
      {loading && allBadges.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#f0f0f0] p-10 text-center text-[13px] text-[#71717a]">
          Chargement des badges...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allBadges.map((badge, i) => {
            const Icon = badge.icon
            const tierColor = TIER_COLORS[badge.tier] || '#c0c0c0'
            return (
              <motion.div
                key={badge.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35, ease: 'easeOut' }}
                className={`relative bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-5 ${
                  badge.unlocked ? '' : 'opacity-70'
                }`}
              >
                {/* Tier ribbon */}
                <div
                  className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: badge.unlocked ? `${tierColor}22` : '#f0f0f0',
                    color: badge.unlocked ? tierColor : '#9ca3af',
                  }}
                >
                  {badge.tier}
                </div>

                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                  style={{
                    backgroundColor: badge.unlocked ? `${badge.color}15` : '#fafafa',
                    border: badge.unlocked ? `1px solid ${badge.color}33` : '1px solid #f0f0f0',
                  }}
                >
                  {badge.unlocked ? (
                    <Icon className="w-6 h-6" style={{ color: badge.color }} />
                  ) : (
                    <Lock className="w-5 h-5 text-[#9ca3af]" strokeWidth={1.6} />
                  )}
                </div>

                <h3
                  className={`text-[14px] font-bold tracking-tight ${
                    badge.unlocked ? 'text-[#1a1a1a]' : 'text-[#71717a]'
                  }`}
                >
                  {badge.name}
                </h3>
                <p className="text-[12px] text-[#71717a] mt-1 leading-snug">
                  {badge.description}
                </p>

                <div className="mt-4 pt-3 border-t border-[#f0f0f0]">
                  {badge.unlocked ? (
                    <p className="text-[11px] font-semibold" style={{ color: badge.color }}>
                      Débloqué le {formatDate(badge.unlocked_at)}
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#9ca3af] font-medium">Verrouillé</p>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Banner for the overview tab — shows the 3 latest unlocked badges. */
export const AchievementsBanner = ({ clientId, onViewAll }) => {
  const { unlockedBadges, progress } = useAchievements(clientId)
  if (!unlockedBadges || unlockedBadges.length === 0) return null
  const latest = [...unlockedBadges]
    .sort((a, b) => new Date(b.unlocked_at) - new Date(a.unlocked_at))
    .slice(0, 3)

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#0F5F35]/10 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-[#0F5F35]" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#1a1a1a]">Vos récompenses</p>
            <p className="text-[11px] text-[#71717a]">
              {progress.unlocked} / {progress.total} badges débloqués
            </p>
          </div>
        </div>
        <button
          onClick={onViewAll}
          className="text-[12px] font-semibold text-[#0F5F35] hover:underline"
        >
          Voir tous →
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {latest.map((badge) => {
          const Icon = badge.icon
          return (
            <div
              key={badge.key}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
              style={{
                backgroundColor: `${badge.color}10`,
                borderColor: `${badge.color}33`,
              }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: badge.color }} />
              <span className="text-[11px] font-semibold text-[#1a1a1a]">
                {badge.name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Celebration toast — fixed bottom-right, auto dismiss. */
export const AchievementsToast = ({ clientId }) => {
  const { newlyUnlocked, dismissNewlyUnlocked } = useAchievements(clientId)
  const [visible, setVisible] = useState([])

  useEffect(() => {
    if (newlyUnlocked && newlyUnlocked.length > 0) {
      setVisible(newlyUnlocked)
      const t = setTimeout(() => {
        setVisible([])
        dismissNewlyUnlocked && dismissNewlyUnlocked()
      }, 5000)
      return () => clearTimeout(t)
    }
  }, [newlyUnlocked, dismissNewlyUnlocked])

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {visible.map((badge) => {
          const Icon = badge.icon
          return (
            <motion.div
              key={badge.key}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="pointer-events-auto bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-[#f0f0f0] p-4 flex items-center gap-3 min-w-[280px]"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: `${badge.color}15`,
                  border: `1px solid ${badge.color}33`,
                }}
              >
                <Icon className="w-5 h-5" style={{ color: badge.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-[#0F5F35] uppercase tracking-wider">
                  Badge débloqué !
                </p>
                <p className="text-[14px] font-bold text-[#1a1a1a] truncate">
                  {badge.name}
                </p>
                <p className="text-[11px] text-[#71717a] truncate">
                  {badge.description}
                </p>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
