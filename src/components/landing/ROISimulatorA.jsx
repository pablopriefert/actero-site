import React, { useState } from 'react'
import { FadeInUp } from '../ui/scroll-animations'

/**
 * ROISimulatorA — simulateur ROI variation A (Refined Notion).
 *
 * Layout split (lg) :
 * — Gauche : 2 sliders (tickets / mois + coût horaire SAV) avec gros
 *   chiffres tabular-nums 44px, accent cta
 * — Droite : panel dark #003725 avec résumé — gros chiffre économies
 *   mensuelles en Inter Tight 72px + détail lignes + ROI multiplier
 *   panneau green A8C490
 */
export const ROISimulatorA = () => {
  const [tickets, setTickets] = useState(1200)
  const [hourly, setHourly] = useState(22)

  const handledPct = 0.6
  const timePerTicket = 6 // minutes par ticket
  const hoursSaved = Math.round((tickets * handledPct * timePerTicket) / 60)
  const euroSaved = hoursSaved * hourly
  const cartRecovery = Math.round(tickets * 0.8 * 0.15 * 65)
  const total = euroSaved + cartRecovery
  const plan = 399
  const multiplier = Math.max(1, Math.round(total / plan))

  const serif = { fontFamily: 'var(--font-display, "Inter Tight", ui-sans-serif, sans-serif)' }
  const labelCls =
    'text-[12px] font-semibold text-[#716D5C] uppercase tracking-[0.1em]'
  const valueCls =
    'tabular-nums text-[44px] font-bold text-[#1A1A1A] my-1 mb-2.5'

  return (
    <section className="py-24 md:py-32 bg-white px-6">
      <div className="max-w-6xl mx-auto">
        <FadeInUp className="text-center mb-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
            Simulateur ROI
          </p>
          <h2
            className="font-normal leading-[1.05] text-[#1A1A1A] mb-4"
            style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
          >
            Calculez votre retour<br className="hidden md:block" />
            <span className="italic text-[#716D5C]">en 15 secondes.</span>
          </h2>
        </FadeInUp>

        <FadeInUp>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8 bg-[#FFFFFF] rounded-3xl p-10 border border-[#E3E6EA]">
            {/* LEFT — Sliders */}
            <div>
              <div className="mb-7">
                <label className={labelCls}>Tickets SAV par mois</label>
                <div className={valueCls} style={{ letterSpacing: '-0.02em' }}>
                  {tickets.toLocaleString('fr-FR')}
                </div>
                <input
                  type="range"
                  min="100"
                  max="10000"
                  step="100"
                  value={tickets}
                  onChange={(e) => setTickets(+e.target.value)}
                  className="w-full"
                  style={{ accentColor: '#13804A' }}
                />
                <div className="flex justify-between text-[11px] text-[#9ca3af] mt-1">
                  <span>100</span>
                  <span>10 000</span>
                </div>
              </div>

              <div>
                <label className={labelCls}>Coût horaire employé SAV</label>
                <div className={valueCls} style={{ letterSpacing: '-0.02em' }}>
                  {hourly}€
                  <span className="text-base text-[#9ca3af] font-medium">/h</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="50"
                  value={hourly}
                  onChange={(e) => setHourly(+e.target.value)}
                  className="w-full"
                  style={{ accentColor: '#13804A' }}
                />
                <div className="flex justify-between text-[11px] text-[#9ca3af] mt-1">
                  <span>12€</span>
                  <span>50€</span>
                </div>
              </div>
            </div>

            {/* RIGHT — Dark result panel */}
            <div className="bg-cta rounded-[18px] p-8 text-white relative overflow-hidden">
              <div className="text-[12px] text-[#F4F5F7]/60 uppercase tracking-[0.15em] font-semibold mb-1">
                Économies estimées · mensuelles
              </div>
              <div
                className="tabular-nums leading-none my-2 mb-1 font-normal"
                style={{ ...serif, fontSize: 72, letterSpacing: '-0.03em' }}
              >
                {total.toLocaleString('fr-FR')}
                <span className="text-[36px] text-[#A8C490] align-baseline">€</span>
              </div>
              <div className="text-[13px] text-[#F4F5F7]/70 mb-7">
                pour {Math.round(tickets * handledPct).toLocaleString('fr-FR')} résolutions
                livrées sans humain
              </div>

              <div className="flex flex-col gap-2.5 pt-5 border-t border-[#F4F5F7]/10">
                {[
                  { label: 'Heures équipe libérées', value: `${hoursSaved}h` },
                  {
                    label: 'Valeur du temps récupéré',
                    value: `${euroSaved.toLocaleString('fr-FR')}€`,
                  },
                  {
                    label: 'CA récupéré paniers abandonnés',
                    value: `${cartRecovery.toLocaleString('fr-FR')}€`,
                  },
                  { label: 'Coût plan Pro Actero', value: `−${plan}€` },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between text-[13px]">
                    <span className="text-[#F4F5F7]/70">{r.label}</span>
                    <span className="tabular-nums font-semibold">{r.value}</span>
                  </div>
                ))}
              </div>

              <div
                className="mt-5 px-4 py-3 rounded-[10px] flex justify-between items-center border"
                style={{
                  background: 'rgba(168,196,144,0.15)',
                  borderColor: 'rgba(168,196,144,0.3)',
                }}
              >
                <span className="text-[13px] text-[#A8C490] font-semibold">ROI mensuel</span>
                <span className="tabular-nums text-[22px] font-bold text-[#A8C490]">
                  ×{multiplier}
                </span>
              </div>
            </div>
          </div>
        </FadeInUp>
      </div>
    </section>
  )
}
