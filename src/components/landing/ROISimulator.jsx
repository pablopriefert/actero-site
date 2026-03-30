import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calculator, TrendingUp, Clock, Euro, ArrowRight, Sparkles } from 'lucide-react'

export const ROISimulator = ({ onNavigate }) => {
  const [tickets, setTickets] = useState(200)
  const [avgCart, setAvgCart] = useState(85)
  const [abandonRate, setAbondonRate] = useState(70)
  const [monthlyVisitors, setMonthlyVisitors] = useState(10000)
  const [step, setStep] = useState(0) // 0 = form, 1 = results

  const results = useMemo(() => {
    const timePerTicket = 5 // minutes
    const hourlyRate = 25 // EUR
    const aiResolutionRate = 0.82
    const cartRecoveryRate = 0.12

    // SAV savings
    const ticketsResolvedByAI = Math.round(tickets * aiResolutionRate)
    const hoursSaved = Math.round((ticketsResolvedByAI * timePerTicket) / 60)
    const savSavings = hoursSaved * hourlyRate

    // Cart recovery
    const abandonedCarts = Math.round(monthlyVisitors * 0.03 * (abandonRate / 100))
    const recoveredCarts = Math.round(abandonedCarts * cartRecoveryRate)
    const cartRevenue = recoveredCarts * avgCart

    // Total
    const totalROI = savSavings + cartRevenue
    const annualROI = totalROI * 12

    return {
      ticketsResolvedByAI,
      hoursSaved,
      savSavings,
      abandonedCarts,
      recoveredCarts,
      cartRevenue,
      totalROI,
      annualROI,
    }
  }, [tickets, avgCart, abandonRate, monthlyVisitors])

  const SliderInput = ({ label, value, onChange, min, max, step: s = 1, unit, icon: Icon }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#1B7D3A]" />
          <span className="text-sm font-medium text-gray-600">{label}</span>
        </div>
        <span className="text-lg font-bold text-gray-900">{value.toLocaleString('fr-FR')}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={s}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-gray-200
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#1B7D3A]
          [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(27,125,58,0.3)]
          [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing"
      />
      <div className="flex justify-between text-[10px] text-gray-500 font-mono">
        <span>{min.toLocaleString('fr-FR')}{unit}</span>
        <span>{max.toLocaleString('fr-FR')}{unit}</span>
      </div>
    </div>
  )

  return (
    <section className="py-24 md:py-32 bg-white px-6 relative z-10" id="simulateur-roi">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-gray-600 text-xs font-bold mb-6">
            <Calculator className="w-3.5 h-3.5" />
            Simulateur interactif
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-gray-900 mb-6">
            Calculez votre ROI<br className="hidden md:block" />
            <span className="text-[#1B7D3A]">en 30 secondes.</span>
          </h2>
          <p className="text-lg text-gray-600 font-medium max-w-2xl mx-auto">
            Entrez vos chiffres. Voyez ce que l'IA peut vous rapporter chaque mois.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Input side */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-white border border-gray-200 rounded-3xl p-8 space-y-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-[#1B7D3A]/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#1B7D3A]" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Vos chiffres actuels</h3>
            </div>

            <SliderInput
              label="Tickets SAV / mois"
              value={tickets}
              onChange={setTickets}
              min={20}
              max={2000}
              step={10}
              unit=""
              icon={Clock}
            />
            <SliderInput
              label="Panier moyen"
              value={avgCart}
              onChange={setAvgCart}
              min={20}
              max={500}
              step={5}
              unit="€"
              icon={Euro}
            />
            <SliderInput
              label="Taux d'abandon panier"
              value={abandonRate}
              onChange={setAbondonRate}
              min={30}
              max={90}
              step={1}
              unit="%"
              icon={TrendingUp}
            />
            <SliderInput
              label="Visiteurs mensuels"
              value={monthlyVisitors}
              onChange={setMonthlyVisitors}
              min={1000}
              max={100000}
              step={500}
              unit=""
              icon={Calculator}
            />
          </motion.div>

          {/* Results side */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            {/* Total ROI Card */}
            <div className="bg-gray-50 border border-gray-200 rounded-3xl p-8 text-center">
              <p className="text-xs font-bold text-[#1B7D3A] uppercase tracking-[0.2em] mb-3">
                ROI mensuel estimé
              </p>
              <motion.p
                key={results.totalROI}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-6xl md:text-7xl font-black text-gray-900 tracking-tighter"
              >
                {results.totalROI.toLocaleString('fr-FR')}
                <span className="text-3xl text-[#1B7D3A]">€</span>
              </motion.p>
              <p className="text-sm text-gray-500 mt-2">
                soit <span className="text-gray-900 font-bold">{results.annualROI.toLocaleString('fr-FR')}€</span> / an
              </p>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-[#1B7D3A]" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">SAV automatisé</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{results.savSavings.toLocaleString('fr-FR')}€</p>
                <p className="text-xs text-gray-500 mt-1">
                  {results.ticketsResolvedByAI} tickets résolus par l'IA
                </p>
                <p className="text-xs text-gray-500">
                  {results.hoursSaved}h économisées
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Paniers récupérés</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{results.cartRevenue.toLocaleString('fr-FR')}€</p>
                <p className="text-xs text-gray-500 mt-1">
                  {results.recoveredCarts} paniers sur {results.abandonedCarts}
                </p>
                <p className="text-xs text-gray-500">
                  Taux de récupération : 12%
                </p>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => onNavigate?.('/audit')}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-[#1B7D3A] hover:bg-[#166B32] text-white font-bold text-sm transition-all group"
            >
              Récupérer ces revenus maintenant
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-center text-[11px] text-gray-500">
              Audit gratuit de 15 min — Sans engagement
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
