import React from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3,
  Clock,
  UserCheck,
  Zap,
  TrendingUp,
  Shield,
  ArrowUpRight,
} from 'lucide-react'

// ============================================================
// BENCHMARK DATA BY VERTICAL
// ============================================================
const BENCHMARKS = {
  ecommerce: [
    {
      id: 'response_time',
      label: 'Temps de réponse SAV',
      icon: Clock,
      yourValue: '< 2 min',
      yourNumeric: 2,
      sectorAvg: '4h',
      sectorNumeric: 240,
      unit: 'min',
      improvement: '120x',
      direction: 'lower_better',
    },
    {
      id: 'resolution_rate',
      label: 'Taux de résolution auto',
      icon: Zap,
      yourValue: '85%',
      yourNumeric: 85,
      sectorAvg: '15%',
      sectorNumeric: 15,
      unit: '%',
      improvement: '+70pts',
      direction: 'higher_better',
    },
    {
      id: 'cart_recovery',
      label: 'Récupération paniers',
      icon: TrendingUp,
      yourValue: '12%',
      yourNumeric: 12,
      sectorAvg: '3%',
      sectorNumeric: 3,
      unit: '%',
      improvement: '4x',
      direction: 'higher_better',
    },
    {
      id: 'csat',
      label: 'Satisfaction client',
      icon: UserCheck,
      yourValue: '94%',
      yourNumeric: 94,
      sectorAvg: '72%',
      sectorNumeric: 72,
      unit: '%',
      improvement: '+22pts',
      direction: 'higher_better',
    },
  ],
  immobilier: [
    {
      id: 'response_time',
      label: 'Temps de réponse leads',
      icon: Clock,
      yourValue: '< 2 min',
      yourNumeric: 2,
      sectorAvg: '4h',
      sectorNumeric: 240,
      unit: 'min',
      improvement: '120x',
      direction: 'lower_better',
    },
    {
      id: 'qualification_rate',
      label: 'Taux de qualification',
      icon: UserCheck,
      yourValue: '70%',
      yourNumeric: 70,
      sectorAvg: '35%',
      sectorNumeric: 35,
      unit: '%',
      improvement: '2x',
      direction: 'higher_better',
    },
    {
      id: 'visit_conversion',
      label: 'Conversion visite',
      icon: TrendingUp,
      yourValue: '30%',
      yourNumeric: 30,
      sectorAvg: '12%',
      sectorNumeric: 12,
      unit: '%',
      improvement: '2.5x',
      direction: 'higher_better',
    },
    {
      id: 'follow_up',
      label: 'Relances automatiques',
      icon: Zap,
      yourValue: '100%',
      yourNumeric: 100,
      sectorAvg: '40%',
      sectorNumeric: 40,
      unit: '%',
      improvement: '+60pts',
      direction: 'higher_better',
    },
  ],
}

// ============================================================
// COMPARISON BAR
// ============================================================
const ComparisonBar = ({ yourPct, sectorPct, theme }) => {
  const isLight = theme === 'light'
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold w-12 ${isLight ? 'text-violet-600' : 'text-violet-400'}`}>Vous</span>
        <div className={`flex-1 h-2 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${yourPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full bg-violet-500"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold w-12 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>Secteur</span>
        <div className={`flex-1 h-2 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${sectorPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            className={`h-full rounded-full ${isLight ? 'bg-slate-300' : 'bg-zinc-700'}`}
          />
        </div>
      </div>
    </div>
  )
}

// ============================================================
// BENCHMARK CARD
// ============================================================
const BenchmarkCard = ({ benchmark, theme }) => {
  const isLight = theme === 'light'
  const Icon = benchmark.icon

  // Calculate bar percentages
  let yourPct, sectorPct
  if (benchmark.direction === 'lower_better') {
    // Inverse — lower is better
    const max = Math.max(benchmark.yourNumeric, benchmark.sectorNumeric)
    yourPct = Math.max(5, 100 - (benchmark.yourNumeric / max) * 100)
    sectorPct = Math.max(5, 100 - (benchmark.sectorNumeric / max) * 100)
  } else {
    const max = Math.max(benchmark.yourNumeric, benchmark.sectorNumeric)
    yourPct = Math.max(5, (benchmark.yourNumeric / max) * 100)
    sectorPct = Math.max(5, (benchmark.sectorNumeric / max) * 100)
  }

  return (
    <div className={`p-4 rounded-2xl border ${isLight ? 'bg-white border-slate-200' : 'bg-[#0a0a0a] border-white/10'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            isLight ? 'bg-violet-50 border border-violet-200' : 'bg-violet-500/10 border border-violet-500/20'
          }`}>
            <Icon className={`w-3.5 h-3.5 ${isLight ? 'text-violet-600' : 'text-violet-400'}`} />
          </div>
          <span className={`text-xs font-bold ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
            {benchmark.label}
          </span>
        </div>
        <span className={`flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-md ${
          isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400'
        }`}>
          <ArrowUpRight className="w-3 h-3" />
          {benchmark.improvement}
        </span>
      </div>

      <div className="flex items-baseline gap-3 mb-3">
        <div>
          <span className={`text-lg font-bold font-mono ${isLight ? 'text-violet-700' : 'text-violet-400'}`}>
            {benchmark.yourValue}
          </span>
        </div>
        <span className={`text-xs ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>vs</span>
        <div>
          <span className={`text-lg font-mono ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
            {benchmark.sectorAvg}
          </span>
        </div>
      </div>

      <ComparisonBar yourPct={yourPct} sectorPct={sectorPct} theme={theme} />
    </div>
  )
}

// ============================================================
// MAIN WIDGET
// ============================================================
export const BenchmarksWidget = ({ clientType, theme }) => {
  const isLight = theme === 'light'
  const vertical = clientType === 'immobilier' ? 'immobilier' : 'ecommerce'
  const benchmarks = BENCHMARKS[vertical]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className={`w-4 h-4 ${isLight ? 'text-violet-600' : 'text-violet-400'}`} />
          <h3 className={`text-xs font-bold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
            Benchmarks sectoriels
          </h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
          <Shield className={`w-3 h-3 ${isLight ? 'text-slate-500' : 'text-zinc-500'}`} />
          <span className={`text-[10px] font-bold ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
            Données anonymisées
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {benchmarks.map((b) => (
          <BenchmarkCard key={b.id} benchmark={b} theme={theme} />
        ))}
      </div>
    </div>
  )
}
