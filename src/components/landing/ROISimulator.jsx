import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Calculator, TrendingUp, Clock, Euro, ArrowRight, Sparkles, Check } from 'lucide-react'

const PLAN_RECO = [
  { max: 50, plan: 'Free', price: '0', color: '#71717a', cta: 'Commencer gratuitement', href: '/signup' },
  { max: 1000, plan: 'Starter', price: '99', color: '#3b82f6', cta: 'Essai gratuit 7 jours', href: '/signup' },
  { max: 5000, plan: 'Pro', price: '399', color: '#0E653A', cta: 'Essai gratuit 7 jours', href: '/signup' },
  { max: Infinity, plan: 'Enterprise', price: 'Sur devis', color: '#f59e0b', cta: 'Contacter l\'equipe', href: 'mailto:contact@actero.fr' },
]

function getRecommendedPlan(tickets) {
  return PLAN_RECO.find(p => tickets <= p.max) || PLAN_RECO[3]
}

export const ROISimulator = ({ onNavigate }) => {
  const [tickets, setTickets] = useState(440)
  const [avgCart, setAvgCart] = useState(160)
  const [abandonRate, setAbandonRate] = useState(54)
  const [monthlyVisitors, setMonthlyVisitors] = useState(10000)

  const results = useMemo(() => {
    const timePerTicket = 5
    const hourlyRate = 25
    const aiResolutionRate = 0.82
    const cartRecoveryRate = 0.12

    const ticketsResolvedByAI = Math.round(tickets * aiResolutionRate)
    const hoursSaved = Math.round((ticketsResolvedByAI * timePerTicket) / 60)
    const savSavings = hoursSaved * hourlyRate

    const abandonedCarts = Math.round(monthlyVisitors * 0.03 * (abandonRate / 100))
    const recoveredCarts = Math.round(abandonedCarts * cartRecoveryRate)
    const cartRevenue = recoveredCarts * avgCart

    const totalROI = savSavings + cartRevenue
    const annualROI = totalROI * 12

    return { ticketsResolvedByAI, hoursSaved, savSavings, abandonedCarts, recoveredCarts, cartRevenue, totalROI, annualROI }
  }, [tickets, avgCart, abandonRate, monthlyVisitors])

  const reco = getRecommendedPlan(tickets)

  const SliderInput = ({ label, value, onChange, min, max, step: s = 1, unit, icon: Icon }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-cta" />
          <span className="text-[13px] font-medium text-[#71717a]">{label}</span>
        </div>
        <span className="text-[15px] font-bold text-[#1a1a1a] tabular-nums">{value.toLocaleString('fr-FR')}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={s}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#f0f0f0]
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cta
          [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(15,95,53,0.3)]
          [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing"
      />
      <div className="flex justify-between text-[10px] text-[#9ca3af] font-mono">
        <span>{min.toLocaleString('fr-FR')}{unit}</span>
        <span>{max.toLocaleString('fr-FR')}{unit}</span>
      </div>
    </div>
  )

  return (
    <section className="py-20 md:py-28 bg-white px-6 relative z-10" id="simulateur-roi">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#fafafa] border border-[#f0f0f0] text-[#71717a] text-xs font-bold mb-5">
            <Calculator className="w-3.5 h-3.5" />
            Simulateur interactif
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-[#1a1a1a] mb-4">
            Calculez votre ROI<br className="hidden md:block" />
            <span className="text-cta">en 30 secondes.</span>
          </h2>
          <p className="text-[15px] text-[#71717a] max-w-xl mx-auto">
            Entrez vos chiffres. Voyez ce que l'IA peut vous rapporter chaque mois.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 items-start">
          {/* Input side */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-white border border-[#f0f0f0] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6 space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cta/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-cta" />
              </div>
              <h3 className="text-[15px] font-bold text-[#1a1a1a]">Vos chiffres actuels</h3>
            </div>

            <SliderInput label="Tickets SAV / mois" value={tickets} onChange={setTickets} min={20} max={5000} step={10} unit="" icon={Clock} />
            <SliderInput label="Panier moyen" value={avgCart} onChange={setAvgCart} min={20} max={500} step={5} unit="€" icon={Euro} />
            <SliderInput label="Taux d'abandon panier" value={abandonRate} onChange={setAbandonRate} min={30} max={90} step={1} unit="%" icon={TrendingUp} />
            <SliderInput label="Visiteurs mensuels" value={monthlyVisitors} onChange={setMonthlyVisitors} min={1000} max={100000} step={500} unit="" icon={Calculator} />
          </motion.div>

          {/* Results side */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            {/* Total ROI Card */}
            <div className="bg-[#fafafa] border border-[#f0f0f0] rounded-2xl p-6 text-center">
              <p className="text-[10px] font-bold text-cta uppercase tracking-[0.15em] mb-2">
                ROI mensuel estime
              </p>
              <motion.p
                key={results.totalROI}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl md:text-6xl font-black text-[#1a1a1a] tracking-tight tabular-nums"
              >
                {results.totalROI.toLocaleString('fr-FR')}
                <span className="text-2xl text-cta">€</span>
              </motion.p>
              <p className="text-[12px] text-[#71717a] mt-1">
                soit <span className="text-[#1a1a1a] font-bold">{results.annualROI.toLocaleString('fr-FR')}€</span> / an
              </p>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-[#f0f0f0] rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cta" />
                  <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">SAV automatise</span>
                </div>
                <p className="text-xl font-bold text-[#1a1a1a]">{results.savSavings.toLocaleString('fr-FR')}€</p>
                <p className="text-[11px] text-[#9ca3af] mt-1">{results.ticketsResolvedByAI} tickets resolus · {results.hoursSaved}h gagnees</p>
              </div>
              <div className="bg-white border border-[#f0f0f0] rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#9ca3af]" />
                  <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">Paniers recuperes</span>
                </div>
                <p className="text-xl font-bold text-[#1a1a1a]">{results.cartRevenue.toLocaleString('fr-FR')}€</p>
                <p className="text-[11px] text-[#9ca3af] mt-1">{results.recoveredCarts} paniers sur {results.abandonedCarts} · 12%</p>
              </div>
            </div>

            {/* Plan recommendation */}
            <div className="bg-white border border-[#f0f0f0] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">Plan recommande pour {tickets.toLocaleString('fr-FR')} tickets/mois</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-[#1a1a1a]">{reco.plan}</span>
                  {reco.price !== 'Sur devis' && (
                    <span className="text-[13px] text-[#71717a]">{reco.price}€/mois</span>
                  )}
                  {reco.price === 'Sur devis' && (
                    <span className="text-[13px] text-[#71717a]">Sur devis</span>
                  )}
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: reco.color + '15', color: reco.color }}>
                  {reco.plan === 'Free' ? 'Gratuit' : reco.plan === 'Enterprise' ? 'Sur mesure' : 'Recommande'}
                </span>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => onNavigate?.(reco.href)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-cta hover:bg-[#003725] text-white font-semibold text-[13px] transition-all group"
            >
              {reco.cta}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-center text-[11px] text-[#9ca3af]">
              {reco.plan === 'Free' ? 'Sans carte bancaire' : 'Essai gratuit 7 jours — Sans engagement'}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
