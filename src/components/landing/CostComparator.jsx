import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Calculator, TrendingDown, ArrowRight, Info } from 'lucide-react'
import { trackEvent } from '../../lib/analytics'
import {
  COMPETITORS,
  COMPETITOR_OPTIONS,
  calculateCompetitorMonthlyCost,
  calculateActeroMonthlyCost,
} from '../../lib/competitor-pricing'

/**
 * CostComparator — calculateur multi-concurrents.
 *
 * Comparaison live : choisis un concurrent (Gorgias / Intercom / Zendesk /
 * Tidio / Crisp Hugo / Siena / eesel / Alhena), bouge les sliders volume +
 * % résolution IA, et tu vois le coût réel mensuel + annuel + économies
 * vs Actero.
 *
 * Conçu pour être embeddé sur /tarifs (sous le pricing grid) et sur les
 * pages comparison /alternative-X (en remplacement du GorgiasCostCalculator
 * mono-concurrent à terme).
 *
 * Données : src/lib/competitor-pricing.js (mise à jour à chaque cycle de
 * veille concurrentielle Theona).
 */

const PRESET_VOLUMES = [200, 500, 1000, 2000, 5000, 10000]

export const CostComparator = ({ defaultCompetitor = 'gorgias', onCtaClick }) => {
  const [competitor, setCompetitor] = useState(defaultCompetitor)
  const [volume, setVolume] = useState(1000)
  const [aiRate, setAiRate] = useState(60) // %

  const competitorCost = useMemo(
    () => calculateCompetitorMonthlyCost(competitor, volume, aiRate / 100),
    [competitor, volume, aiRate],
  )
  const acteroCost = useMemo(() => calculateActeroMonthlyCost(volume), [volume])

  const monthlySavings = Math.max(0, competitorCost.monthlyEur - acteroCost.monthlyEur)
  const annualSavings = monthlySavings * 12
  const ratio =
    acteroCost.monthlyEur > 0
      ? (competitorCost.monthlyEur / acteroCost.monthlyEur).toFixed(1)
      : null

  const competitorMeta = COMPETITORS[competitor]
  const eur = (n) => `${Math.round(n).toLocaleString('fr-FR')} €`

  const handleCompetitorChange = (newKey) => {
    setCompetitor(newKey)
    trackEvent('cost_comparator_competitor_changed', { competitor: newKey })
  }

  const handleCtaClick = () => {
    trackEvent('cost_comparator_cta_clicked', {
      competitor,
      volume,
      aiRate,
      monthlySavings: Math.round(monthlySavings),
    })
    onCtaClick?.()
  }

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 my-20" aria-labelledby="cost-comparator-heading">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cta/5 text-cta text-[12px] font-semibold mb-4">
          <Calculator className="w-3.5 h-3.5" />
          Calculateur live
        </div>
        <h2
          id="cost-comparator-heading"
          className="text-[28px] md:text-[36px] font-bold tracking-tight text-[#262626]"
        >
          Combien tu paies vraiment chez {competitorMeta?.name || 'la concurrence'} ?
        </h2>
        <p className="mt-3 text-[15px] text-[#71717a] max-w-2xl mx-auto">
          Tarifs publics {competitorMeta ? 'mai 2026' : ''}. Bouge les curseurs, tu verras la facture
          réelle face au forfait fixe Actero.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sliders */}
        <div className="rounded-2xl border border-[#f0f0f0] bg-white p-6 md:p-8">
          {/* Competitor select */}
          <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#71717a] mb-2">
            Concurrent
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            {COMPETITOR_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => handleCompetitorChange(opt.key)}
                className={`px-3 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                  competitor === opt.key
                    ? 'bg-[#262626] text-white'
                    : 'bg-zinc-50 text-[#71717a] hover:bg-zinc-100'
                }`}
              >
                {opt.name}
              </button>
            ))}
          </div>

          {/* Volume slider */}
          <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#71717a] mb-2">
            Volume tickets / mois
          </label>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-[36px] font-bold tracking-tight text-[#262626] tabular-nums">
              {volume.toLocaleString('fr-FR')}
            </span>
            <span className="text-[14px] text-[#71717a]">tickets/mois</span>
          </div>
          <input
            type="range"
            min={50}
            max={10000}
            step={50}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full accent-cta"
            aria-label="Volume mensuel de tickets"
          />
          <div className="flex flex-wrap gap-1 mt-3">
            {PRESET_VOLUMES.map((v) => (
              <button
                key={v}
                onClick={() => setVolume(v)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  volume === v ? 'bg-cta text-white' : 'bg-zinc-50 text-[#71717a] hover:bg-zinc-100'
                }`}
              >
                {v.toLocaleString('fr-FR')}
              </button>
            ))}
          </div>

          {/* AI rate slider */}
          <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#71717a] mt-6 mb-2">
            % résolutions automatisées par l'IA
          </label>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-[36px] font-bold tracking-tight text-[#262626] tabular-nums">
              {aiRate}
            </span>
            <span className="text-[14px] text-[#71717a]">% résolutions IA</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={aiRate}
            onChange={(e) => setAiRate(Number(e.target.value))}
            className="w-full accent-cta"
            aria-label="Pourcentage de résolutions automatisées"
          />
          <p className="mt-2 text-[11px] text-[#a1a1aa] flex items-start gap-1">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>
              Les concurrents qui facturent à la résolution comptent ces tickets. Plus l'IA résout,
              plus leur facture monte.
            </span>
          </p>
        </div>

        {/* Result panel — dark side-by-side */}
        <div className="rounded-2xl bg-[#0F1014] text-white p-6 md:p-8">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <ResultCard
              label={competitorMeta?.name || 'Concurrent'}
              tone="muted"
              amount={eur(competitorCost.monthlyEur)}
              breakdown={competitorCost.breakdown}
            />
            <ResultCard
              label="Actero"
              tone="brand"
              amount={eur(acteroCost.monthlyEur)}
              breakdown={acteroCost.breakdown}
            />
          </div>

          {monthlySavings > 0 ? (
            <motion.div
              key={`${competitor}-${volume}-${aiRate}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-xl bg-[#A8C490]/10 border border-[#A8C490]/30 p-5"
            >
              <div className="flex items-center gap-2 text-[#A8C490] text-[12px] font-semibold uppercase tracking-wider mb-2">
                <TrendingDown className="w-4 h-4" />
                Économies en passant à Actero
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[28px] md:text-[32px] font-bold tracking-tight tabular-nums">
                    {eur(monthlySavings)}
                    <span className="text-[14px] font-normal text-zinc-400 ml-1">/ mois</span>
                  </div>
                  {ratio && (
                    <div className="text-[12px] text-zinc-400 mt-1">
                      {competitorMeta?.name} = <span className="font-mono text-[#A8C490]">×{ratio}</span> plus cher
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[28px] md:text-[32px] font-bold tracking-tight tabular-nums">
                    {eur(annualSavings)}
                    <span className="text-[14px] font-normal text-zinc-400 ml-1">/ an</span>
                  </div>
                  <div className="text-[12px] text-zinc-400 mt-1">
                    Sur 12 mois en pricing stable
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/50 p-5">
              <div className="text-[13px] text-zinc-300">
                À ce volume, {competitorMeta?.name} est gratuit ou moins cher qu'Actero — c'est rare,
                bouge les curseurs pour voir la cassure (généralement vers 500-1 000 tickets/mois).
              </div>
            </div>
          )}

          <button
            onClick={handleCtaClick}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-lg bg-[#A8C490] text-[#0F1014] font-semibold text-[14px] hover:bg-[#B8D2A0] transition-colors group"
          >
            Démarrer Actero gratuitement
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <p className="mt-3 text-[11px] text-zinc-400 text-center">
            Plan Free à vie · Pas de carte bancaire · OAuth Shopify en 15 min
          </p>
        </div>
      </div>

      {competitorMeta?.notes && (
        <p className="mt-4 text-[11px] text-[#a1a1aa] text-center max-w-3xl mx-auto">
          ℹ️ {competitorMeta.notes}
        </p>
      )}
    </section>
  )
}

function ResultCard({ label, amount, breakdown, tone }) {
  const labelColor = tone === 'brand' ? 'text-[#A8C490]' : 'text-zinc-400'
  return (
    <div>
      <div className={`text-[11px] font-semibold uppercase tracking-wider ${labelColor}`}>{label}</div>
      <div className="mt-1 text-[24px] md:text-[28px] font-bold tracking-tight tabular-nums">
        {amount}
        <span className="text-[12px] font-normal text-zinc-400 ml-1">/ mois</span>
      </div>
      <div className="mt-1 text-[11px] text-zinc-400 leading-snug">{breakdown}</div>
    </div>
  )
}

export default CostComparator
