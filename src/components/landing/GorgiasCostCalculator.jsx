import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Calculator, Download, TrendingDown, Check } from 'lucide-react'
import { trackEvent } from '../../lib/analytics'

/**
 * GorgiasCostCalculator — embeddable calculator that compares the real annual
 * cost of running Gorgias (Helpdesk plan + AI Agent per-resolution add-on) vs
 * Actero's flat pricing. Designed to be embedded inside `/alternative-gorgias`
 * and `/gorgias-vs-actero`, and as a standalone page at `/calculateur-gorgias`.
 *
 * Pricing concurrent (public tarifs avril 2026) :
 *   - Starter 10 $/mois · 50 tickets · 0,40 $/ticket overage
 *   - Basic   60 $/mois · 300 tickets · 40 $/100 overage
 *   - Pro     360 $/mois · 2 000 tickets · 36 $/100 overage
 *   - Advanced 900 $/mois · 5 000 tickets · 36 $/100 overage
 *   - AI Agent : 0,90 → 1,00 $ par résolution automatisée
 *
 * Actero (avril 2026) :
 *   - Starter 99 €/mois (1 000 tickets · 0,15 € overage)
 *   - Pro     399 €/mois (5 000 tickets · 0,10 € overage)
 *   - Enterprise — custom
 *
 * USD→EUR conversion uses 0.93 (rolling 12-month average). Displayed in EUR
 * because the audience is FR-first.
 */

const USD_TO_EUR = 0.93

function pickGorgiasPlan(tickets) {
  if (tickets <= 50) return { name: 'Starter', monthly: 10, included: 50, overagePer: 0.4 }
  if (tickets <= 300) return { name: 'Basic', monthly: 60, included: 300, overagePer: 0.4 }
  if (tickets <= 2000) return { name: 'Pro', monthly: 360, included: 2000, overagePer: 0.36 }
  if (tickets <= 5000) return { name: 'Advanced', monthly: 900, included: 5000, overagePer: 0.36 }
  return { name: 'Enterprise', monthly: 1800, included: 10000, overagePer: 0.32 }
}

function pickActeroPlan(tickets) {
  if (tickets <= 50) return { name: 'Free', monthly: 0, included: 50, overagePer: 0.15 }
  if (tickets <= 1000) return { name: 'Starter', monthly: 99, included: 1000, overagePer: 0.15 }
  if (tickets <= 5000) return { name: 'Pro', monthly: 399, included: 5000, overagePer: 0.1 }
  return { name: 'Enterprise', monthly: 999, included: 15000, overagePer: 0.08 }
}

function formatEUR(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export const GorgiasCostCalculator = ({ onNavigate, source = 'inline', compact = false }) => {
  const [tickets, setTickets] = useState(2000)
  const [aiPercent, setAiPercent] = useState(60)
  const [downloaded, setDownloaded] = useState(false)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const calc = useMemo(() => {
    const aiResolved = Math.round((tickets * aiPercent) / 100)
    const gorgiasPlan = pickGorgiasPlan(tickets)
    const acteroPlan = pickActeroPlan(tickets)

    // Gorgias = monthly plan + AI per-resolution at $0.95 (mid-range)
    const gorgiasMonthlyUSD = gorgiasPlan.monthly + aiResolved * 0.95
    const gorgiasAnnualEUR = gorgiasMonthlyUSD * 12 * USD_TO_EUR

    // Actero = flat monthly (overage rare with right plan)
    const acteroOverage = Math.max(0, tickets - acteroPlan.included) * acteroPlan.overagePer
    const acteroMonthlyEUR = acteroPlan.monthly + acteroOverage
    const acteroAnnualEUR = acteroMonthlyEUR * 12

    const savings = gorgiasAnnualEUR - acteroAnnualEUR
    const savingsPct = gorgiasAnnualEUR > 0 ? Math.round((savings / gorgiasAnnualEUR) * 100) : 0

    return {
      aiResolved,
      gorgiasPlan,
      acteroPlan,
      gorgiasMonthlyEUR: gorgiasMonthlyUSD * USD_TO_EUR,
      acteroMonthlyEUR,
      gorgiasAnnualEUR,
      acteroAnnualEUR,
      savings,
      savingsPct,
    }
  }, [tickets, aiPercent])

  const handleDownload = async (e) => {
    e?.preventDefault()
    if (!email || submitting) return
    setSubmitting(true)
    trackEvent('CostCalculator_PDF_Requested', {
      source,
      tickets,
      aiPercent,
      savings: Math.round(calc.savings),
    })
    try {
      await fetch('/api/leads/gorgias-cost-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tickets, aiPercent, source }),
      }).catch(() => {})
      setDownloaded(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={`bg-white rounded-[24px] border border-black/[0.06] shadow-[0_2px_4px_rgba(0,0,0,0.02),0_24px_48px_-12px_rgba(0,55,37,0.08)] overflow-hidden ${
        compact ? 'p-6' : 'p-8 md:p-10'
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-[12px] bg-[#F0F7F2] border border-[#A8C490]/40 flex items-center justify-center flex-shrink-0">
          <Calculator className="w-5 h-5 text-cta" strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-[20px] md:text-[22px] font-bold text-[#1A1A1A] leading-[1.2] mb-1">
            Combien Gorgias va vraiment vous coûter cette année ?
          </h3>
          <p className="text-[13.5px] text-[#5A5A5A] leading-[1.5]">
            Tarifs publics avril 2026 — AI Agent facturé à la résolution, voice et SMS en add-on payant supplémentaire.
          </p>
        </div>
      </div>

      {/* Inputs */}
      <div className="space-y-5 mb-7">
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <label className="text-[13px] font-semibold text-[#1A1A1A]">Tickets / mois</label>
            <span className="text-[15px] font-bold text-[#003725] tabular-nums">{tickets.toLocaleString('fr-FR')}</span>
          </div>
          <input
            type="range"
            min="100"
            max="20000"
            step="100"
            value={tickets}
            onChange={(e) => setTickets(parseInt(e.target.value, 10))}
            className="w-full h-2 rounded-full bg-[#F4F0E6] appearance-none cursor-pointer accent-[#003725]"
          />
          <div className="flex justify-between text-[10px] text-[#9CA3AF] mt-1.5">
            <span>100</span>
            <span>5 000</span>
            <span>10 000</span>
            <span>20 000</span>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <label className="text-[13px] font-semibold text-[#1A1A1A]">% résolus par l'IA</label>
            <span className="text-[15px] font-bold text-[#003725] tabular-nums">
              {aiPercent}% — {calc.aiResolved.toLocaleString('fr-FR')} tickets
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="80"
            step="5"
            value={aiPercent}
            onChange={(e) => setAiPercent(parseInt(e.target.value, 10))}
            className="w-full h-2 rounded-full bg-[#F4F0E6] appearance-none cursor-pointer accent-[#003725]"
          />
          <div className="flex justify-between text-[10px] text-[#9CA3AF] mt-1.5">
            <span>0%</span>
            <span>40%</span>
            <span>60%</span>
            <span>80%</span>
          </div>
        </div>
      </div>

      {/* Result split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <div className="rounded-[16px] border border-black/[0.08] bg-[#FAFAF8] p-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#716D5C] mb-2">
            Gorgias — plan {calc.gorgiasPlan.name}
          </div>
          <div className="text-[26px] md:text-[30px] font-bold text-[#1A1A1A] leading-none tabular-nums" style={{ letterSpacing: '-0.02em' }}>
            {formatEUR(calc.gorgiasAnnualEUR)}
            <span className="text-[14px] font-medium text-[#716D5C] ml-1.5">/an</span>
          </div>
          <div className="text-[12px] text-[#716D5C] mt-1.5 leading-tight">
            {formatEUR(calc.gorgiasMonthlyEUR)}/mois — plan + {calc.aiResolved.toLocaleString('fr-FR')} résolutions IA × 0,95 $
          </div>
        </div>

        <div className="rounded-[16px] border-2 border-[#003725]/12 bg-gradient-to-br from-[#F0F7F2] to-white p-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-cta mb-2">
            Actero — plan {calc.acteroPlan.name}
          </div>
          <div className="text-[26px] md:text-[30px] font-bold text-[#003725] leading-none tabular-nums" style={{ letterSpacing: '-0.02em' }}>
            {formatEUR(calc.acteroAnnualEUR)}
            <span className="text-[14px] font-medium text-[#5A8B70] ml-1.5">/an</span>
          </div>
          <div className="text-[12px] text-[#5A8B70] mt-1.5 leading-tight">
            {formatEUR(calc.acteroMonthlyEUR)}/mois — forfait tout inclus, IA + voice + relance
          </div>
        </div>
      </div>

      {/* Savings banner */}
      {calc.savings > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          key={Math.round(calc.savings)}
          transition={{ duration: 0.25 }}
          className="rounded-[16px] bg-[#003725] text-white p-5 mb-6 flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-full bg-[#A8C490]/20 flex items-center justify-center flex-shrink-0">
            <TrendingDown className="w-5 h-5 text-[#A8C490]" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#A8C490] mb-0.5">
              Économies annuelles avec Actero
            </div>
            <div className="text-[28px] md:text-[34px] font-bold leading-none tabular-nums" style={{ letterSpacing: '-0.02em' }}>
              {formatEUR(calc.savings)}
              <span className="text-[16px] font-semibold text-[#A8C490] ml-2">−{calc.savingsPct}%</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* CTA row */}
      <div className="flex justify-center mb-5">
        <button
          onClick={() => {
            trackEvent('CostCalculator_Primary_CTA_Clicked', { source, tickets, aiPercent })
            onNavigate?.('/signup')
          }}
          className="inline-flex items-center justify-center gap-2 px-[26px] py-[14px] rounded-full bg-cta hover:bg-[#0A4F2C] text-white text-[14.5px] font-semibold transition-all shadow-[0_1px_2px_rgba(14,101,58,0.2),0_8px_20px_rgba(14,101,58,0.15)] hover:-translate-y-px"
        >
          Essai gratuit 7 jours <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* PDF lead-magnet */}
      <div className="pt-5 border-t border-black/[0.06]">
        <AnimatePresence mode="wait">
          {downloaded ? (
            <motion.div
              key="ok"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 text-[13.5px] text-[#003725] font-semibold"
            >
              <div className="w-7 h-7 rounded-full bg-[#A8C490]/30 flex items-center justify-center">
                <Check className="w-4 h-4 text-cta" strokeWidth={2.5} />
              </div>
              Rapport envoyé sur {email}. Vérifiez votre boîte (et les spams).
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleDownload}
              className="flex flex-col sm:flex-row items-stretch gap-2"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@boutique.fr"
                className="flex-1 min-w-0 px-4 py-2.5 rounded-full bg-[#F9F7F1] border border-[#E8DFC9] text-[13.5px] text-[#1A1A1A] placeholder:text-[#9CA3AF] focus:outline-none focus:border-cta focus:bg-white transition-colors"
              />
              <button
                type="submit"
                disabled={!email || submitting}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#1A1A1A] hover:bg-[#003725] text-white text-[13.5px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                {submitting ? 'Envoi…' : 'Recevoir le rapport PDF'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
        <p className="text-[11px] text-[#9CA3AF] mt-2.5 leading-tight">
          Rapport personnalisé avec votre projection annuelle, comparatif feature-par-feature et plan de migration. Pas de spam, désabonnement en 1 clic.
        </p>
      </div>
    </div>
  )
}

export default GorgiasCostCalculator
