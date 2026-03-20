import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  RefreshCw,
  ArrowUpRight,
  AlertTriangle,
  TrendingUp,
  Zap,
  Clock,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
} from 'lucide-react'

// ============================================================
// IMPACT BADGE
// ============================================================
const ImpactBadge = ({ level, theme }) => {
  const isLight = theme === 'light'
  const config = {
    high: {
      label: 'Impact fort',
      className: isLight
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    medium: {
      label: 'Impact moyen',
      className: isLight
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    low: {
      label: 'Impact faible',
      className: isLight
        ? 'bg-zinc-100 text-zinc-600 border-zinc-200'
        : 'bg-white/5 text-zinc-400 border-white/10',
    },
  }
  const c = config[level] || config.medium
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${c.className}`}>
      {c.label}
    </span>
  )
}

// ============================================================
// PRIORITY BAR
// ============================================================
const PriorityBar = ({ score, theme }) => {
  const isLight = theme === 'light'
  const color = score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-zinc-500'
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className={`text-[10px] font-bold tabular-nums ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
        {score}/100
      </span>
    </div>
  )
}

// ============================================================
// RECOMMENDATION CARD
// ============================================================
const RecommendationCard = ({ rec, index, theme, onUpsellClick }) => {
  const isLight = theme === 'light'
  const [expanded, setExpanded] = useState(index === 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      className={`rounded-2xl border overflow-hidden transition-all ${
        isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-[#0a0a0a] border-white/10'
      } ${rec.impactLevel === 'high' && !isLight ? 'border-emerald-500/20' : ''}`}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-4 p-5 text-left"
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
          rec.impactLevel === 'high'
            ? (isLight ? 'bg-emerald-50 border border-emerald-200' : 'bg-emerald-500/10 border border-emerald-500/20')
            : rec.impactLevel === 'medium'
            ? (isLight ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/10 border border-amber-500/20')
            : (isLight ? 'bg-slate-50 border border-slate-200' : 'bg-white/5 border border-white/10')
        }`}>
          <span className="text-sm font-bold">
            {rec.impactLevel === 'high' ? <TrendingUp className={`w-4 h-4 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
              : rec.impactLevel === 'medium' ? <Zap className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
              : <Clock className={`w-4 h-4 ${isLight ? 'text-slate-500' : 'text-zinc-400'}`} />}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {rec.title}
            </h4>
            <ImpactBadge level={rec.impactLevel} theme={theme} />
          </div>
          <p className={`text-xs line-clamp-1 ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
            {rec.problem}
          </p>
        </div>
        <div className={`shrink-0 mt-1 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className={`px-5 pb-5 pt-0 space-y-4 border-t ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
              <div className="pt-4 space-y-3">
                {/* Recommendation */}
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
                    Recommandation
                  </p>
                  <p className={`text-sm leading-relaxed ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                    {rec.recommendation}
                  </p>
                </div>

                {/* Impact */}
                <div className={`p-3 rounded-xl ${isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
                    Impact estimé
                  </p>
                  <p className={`text-sm font-medium ${
                    rec.impactLevel === 'high'
                      ? (isLight ? 'text-emerald-700' : 'text-emerald-400')
                      : (isLight ? 'text-slate-700' : 'text-zinc-300')
                  }`}>
                    {rec.impact}
                  </p>
                </div>

                {/* Priority bar */}
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
                    Priorité
                  </p>
                  <PriorityBar score={rec.priorityScore} theme={theme} />
                </div>

                {/* CTA */}
                {rec.upsellType && rec.ctaLabel && (
                  <button
                    onClick={() => onUpsellClick(rec.upsellType)}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg active:scale-[0.98] ${
                      rec.impactLevel === 'high'
                        ? 'bg-emerald-600 hover:bg-emerald-500'
                        : 'bg-violet-600 hover:bg-violet-500'
                    }`}
                  >
                    {rec.ctaLabel}
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ============================================================
// LOADING STATE
// ============================================================
const CopilotLoading = ({ theme }) => {
  const isLight = theme === 'light'
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BrainCircuit className={`w-5 h-5 animate-pulse ${isLight ? 'text-violet-600' : 'text-violet-400'}`} />
        <p className={`text-sm font-medium ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
          Actero Copilot analyse vos données...
        </p>
      </div>
      {[1, 2].map(i => (
        <div key={i} className={`h-24 rounded-2xl animate-pulse ${isLight ? 'bg-slate-100' : 'bg-zinc-900'}`} />
      ))}
    </div>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export const CopilotPanel = ({ client, theme, onNavigateToUpsells }) => {
  const isLight = theme === 'light'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const fetchCopilot = async (forceRefresh = false) => {
    if (!client?.id) return
    try {
      if (forceRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const response = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.id,
          force_refresh: forceRefresh,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Erreur Copilot')

      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchCopilot(false)
  }, [client?.id])

  const handleUpsellClick = (upsellType) => {
    if (onNavigateToUpsells) onNavigateToUpsells()
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const visibleRecs = data?.recommendations || []
  const displayedRecs = showAll ? visibleRecs : visibleRecs.slice(0, 3)
  const hasMore = visibleRecs.length > 3

  return (
    <div className={`rounded-3xl border overflow-hidden ${
      isLight
        ? 'bg-white border-slate-200 shadow-sm'
        : 'bg-gradient-to-b from-[#0c0c0c] to-[#080808] border-white/10'
    }`}>
      {/* Header */}
      <div className={`px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${
        isLight ? 'border-slate-100' : 'border-white/5'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isLight
              ? 'bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200'
              : 'bg-gradient-to-br from-violet-500/15 to-indigo-500/10 border border-violet-500/20'
          }`}>
            <Sparkles className={`w-5 h-5 ${isLight ? 'text-violet-600' : 'text-violet-400'}`} />
          </div>
          <div>
            <h3 className={`text-base font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Actero Copilot
            </h3>
            <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
              {data?.generated_at ? `Analyse du ${formatDate(data.generated_at)}` : 'Conseiller de croissance IA'}
              {data?.cached ? ' • en cache' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchCopilot(true)}
          disabled={refreshing || loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            isLight
              ? 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/10 hover:text-zinc-300'
          } ${(refreshing || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Analyse...' : 'Actualiser'}
        </button>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-5">
        {/* Loading */}
        {loading && !data && <CopilotLoading theme={theme} />}

        {/* Error */}
        {error && !loading && (
          <div className={`flex items-start gap-3 p-4 rounded-xl ${
            isLight ? 'bg-red-50 border border-red-200' : 'bg-red-500/10 border border-red-500/20'
          }`}>
            <AlertTriangle className={`w-5 h-5 shrink-0 ${isLight ? 'text-red-500' : 'text-red-400'}`} />
            <div>
              <p className={`text-sm font-bold ${isLight ? 'text-red-700' : 'text-red-400'}`}>
                Erreur d'analyse
              </p>
              <p className={`text-xs mt-1 ${isLight ? 'text-red-600' : 'text-red-400/70'}`}>
                {error}
              </p>
              <button
                onClick={() => fetchCopilot(true)}
                className={`mt-2 text-xs font-bold underline ${isLight ? 'text-red-600' : 'text-red-400'}`}
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {data && !loading && (
          <>
            {/* Summary */}
            <div className={`p-4 rounded-2xl ${
              isLight
                ? 'bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100'
                : 'bg-gradient-to-r from-violet-500/[0.06] to-indigo-500/[0.04] border border-violet-500/10'
            }`}>
              <p className={`text-sm leading-relaxed font-medium ${
                isLight ? 'text-slate-700' : 'text-zinc-300'
              }`}>
                {data.summary}
              </p>
            </div>

            {/* Recommendations */}
            {displayedRecs.length > 0 ? (
              <div className="space-y-3">
                <p className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
                  Opportunités détectées ({visibleRecs.length})
                </p>
                {displayedRecs.map((rec, i) => (
                  <RecommendationCard
                    key={i}
                    rec={rec}
                    index={i}
                    theme={theme}
                    onUpsellClick={handleUpsellClick}
                  />
                ))}
                {hasMore && (
                  <button
                    onClick={() => setShowAll(!showAll)}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-colors ${
                      isLight
                        ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                    }`}
                  >
                    {showAll ? 'Voir moins' : `Voir ${visibleRecs.length - 3} opportunité${visibleRecs.length - 3 > 1 ? 's' : ''} de plus`}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                  Aucune recommandation pour le moment.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
