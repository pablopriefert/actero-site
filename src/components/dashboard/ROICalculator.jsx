import React from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  DollarSign,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  Zap,
} from 'lucide-react'
import { AnimatedCounter } from '../ui/animated-counter'

const StatBox = ({ label, value, suffix, icon: Icon, color, theme }) => {
  const isLight = theme === 'light'
  const colors = {
    emerald: { bg: isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/20', text: isLight ? 'text-emerald-600' : 'text-emerald-400' },
    amber: { bg: isLight ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/10 border-amber-500/20', text: isLight ? 'text-amber-600' : 'text-amber-400' },
    violet: { bg: isLight ? 'bg-violet-50 border-violet-200' : 'bg-violet-500/10 border-violet-500/20', text: isLight ? 'text-violet-600' : 'text-violet-400' },
    blue: { bg: isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-500/10 border-blue-500/20', text: isLight ? 'text-blue-600' : 'text-blue-400' },
  }
  const c = colors[color] || colors.emerald
  return (
    <div className={`p-4 rounded-2xl border ${c.bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${c.text}`} />
        <span className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>{label}</span>
      </div>
      <p className={`text-2xl font-bold font-mono tracking-tighter ${isLight ? 'text-slate-900' : 'text-white'}`}>
        {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}{suffix}
      </p>
    </div>
  )
}

export const ROICalculator = ({ periodStats, metrics, clientSettings, theme }) => {
  const isLight = theme === 'light'

  // Calculate ROI metrics
  const acteroPrice = clientSettings?.actero_monthly_price || 500
  const roiGenerated = periodStats?.roi || 0
  const timeSavedHours = periodStats?.time_saved || 0
  const hourlyCost = clientSettings?.hourly_cost || 25
  const timeSavedValue = timeSavedHours * hourlyCost
  const totalValue = roiGenerated + timeSavedValue
  const roiMultiplier = acteroPrice > 0 ? Math.round((totalValue / acteroPrice) * 10) / 10 : 0
  const netROI = totalValue - acteroPrice
  const isPositive = netROI > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`rounded-3xl border overflow-hidden ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0a0a0a] border-white/10'}`}
    >
      {/* Header */}
      <div className={`px-6 py-5 border-b ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isLight ? 'bg-emerald-50 border border-emerald-200' : 'bg-emerald-500/10 border border-emerald-500/20'
            }`}>
              <TrendingUp className={`w-5 h-5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
            </div>
            <div>
              <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Retour sur investissement</h3>
              <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>Calculé en temps réel ce mois-ci</p>
            </div>
          </div>

          {/* ROI Multiplier Badge */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl ${
            isPositive
              ? (isLight ? 'bg-emerald-50 border border-emerald-200' : 'bg-emerald-500/10 border border-emerald-500/20')
              : (isLight ? 'bg-red-50 border border-red-200' : 'bg-red-500/10 border border-red-500/20')
          }`}>
            <ArrowUpRight className={`w-4 h-4 ${isPositive ? (isLight ? 'text-emerald-600' : 'text-emerald-400') : (isLight ? 'text-red-600' : 'text-red-400')}`} />
            <span className={`text-lg font-bold font-mono ${isPositive ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : (isLight ? 'text-red-700' : 'text-red-400')}`}>
              x{roiMultiplier}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-5">
        {/* Main comparison */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-5 rounded-2xl text-center ${isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
              Investissement Actero
            </p>
            <p className={`text-3xl font-bold font-mono tracking-tighter ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <AnimatedCounter value={acteroPrice} />€
            </p>
            <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>/mois</p>
          </div>

          <div className={`p-5 rounded-2xl text-center flex flex-col items-center justify-center ${isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}`}>
            <Zap className={`w-6 h-6 mb-1 ${isLight ? 'text-amber-500' : 'text-amber-400'}`} />
            <p className={`text-xs font-bold ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>a généré</p>
          </div>

          <div className={`p-5 rounded-2xl text-center ${
            isPositive
              ? (isLight ? 'bg-emerald-50 border border-emerald-200' : 'bg-emerald-500/5 border border-emerald-500/10')
              : (isLight ? 'bg-slate-50' : 'bg-white/[0.02]')
          }`}>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
              Valeur totale créée
            </p>
            <p className={`text-3xl font-bold font-mono tracking-tighter ${isPositive ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : (isLight ? 'text-slate-900' : 'text-white')}`}>
              <AnimatedCounter value={totalValue} />€
            </p>
            <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>ce mois</p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="ROI direct" value={roiGenerated} suffix="€" icon={DollarSign} color="amber" theme={theme} />
          <StatBox label="Temps économisé" value={timeSavedHours} suffix="h" icon={Clock} color="blue" theme={theme} />
          <StatBox label="Valeur du temps" value={timeSavedValue} suffix="€" icon={DollarSign} color="violet" theme={theme} />
          <StatBox label="ROI net" value={netROI} suffix="€" icon={isPositive ? CheckCircle2 : TrendingUp} color="emerald" theme={theme} />
        </div>

        {/* Bottom message */}
        {isPositive && (
          <div className={`p-4 rounded-2xl text-center ${
            isLight ? 'bg-emerald-50 border border-emerald-100' : 'bg-emerald-500/5 border border-emerald-500/10'
          }`}>
            <p className={`text-sm font-medium ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
              Actero vous rapporte <span className="font-bold">{Math.round((totalValue / acteroPrice - 1) * 100)}% de plus</span> que votre investissement ce mois-ci.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
