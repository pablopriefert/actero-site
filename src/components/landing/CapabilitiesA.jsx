import React from 'react'
import { CheckCircle2, MessageSquare, ShoppingCart } from 'lucide-react'
import { FadeInUp } from '../ui/scroll-animations'

/**
 * CapabilitiesA — 2 cards (variation A, trimmed).
 *
 * Demande user : garder seulement les 2 automations principales
 * (SAV Email & Chat + Relance paniers), retirer Agent vocal ElevenLabs
 * et Éditeur ton & règles métier. Les 2 cards restantes remplissent la
 * largeur en grid 2-col avec un padding plus généreux.
 *
 * Design key points :
 * — Background cream #F9F7F1
 * — Cards blanc rounded-[20px], padding 40px (plus d'air car 2 au lieu
 *   de 4), border subtile
 * — Icon container cream square #F4F0E6 avec emoji 28px
 * — Badge « Dès Free » en pill cta/10
 * — Highlight footer avec check icon + border-t
 * — Hover : translate-y-[-2px] + shadow dark soft
 */
export const CapabilitiesA = () => {
  const serif = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }

  const caps = [
    {
      badge: 'Dès Free',
      Icon: MessageSquare,
      title: 'Agent SAV Email & Chat',
      desc:
        "Répond aux WISMO, retours, changements d'adresse, questions produit sur email, chat et helpdesk (Gorgias, Zendesk). Escalade vers humain si confiance < 60% ou ton agressif détecté. Applique votre ton de marque et consulte votre base de connaissances.",
      highlight: '60% de résolutions automatiques, sans humain',
      highlightMarker: '*',
    },
    {
      badge: 'Dès Free',
      Icon: ShoppingCart,
      title: 'Relance paniers abandonnés',
      desc:
        '3 relances email personnalisées (15 min, 24h, 72h) avec produit exact, réduction conditionnelle et lien checkout direct. Chaque email est écrit par l\'IA selon le profil client et le parcours d\'achat.',
      highlight: '+15% de récupération moyenne',
      highlightMarker: '*',
    },
  ]

  return (
    <section className="py-24 md:py-32 bg-[#F9F7F1] px-6">
      <div className="max-w-6xl mx-auto">
        <FadeInUp className="text-center mb-16">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
            Vos automatisations
          </p>
          <h2
            className="font-normal leading-[1.05] text-[#1A1A1A] mb-4"
            style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
          >
            Tout ce qui consomme votre équipe<br className="hidden md:block" />
            <span className="italic text-[#716D5C]">tourne maintenant tout seul.</span>
          </h2>
          <p className="text-[17px] text-[#5A5A5A] max-w-xl mx-auto leading-[1.5]">
            Les 2 automations principales Actero, incluses dès le plan Free. Chacune mesurée en
            temps réel dans votre dashboard.
          </p>
        </FadeInUp>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {caps.map((c, i) => {
            const Icon = c.Icon
            return (
              <FadeInUp key={i}>
                <div className="bg-white rounded-[20px] p-10 border border-black/[0.05] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_40px_-10px_rgba(0,55,37,0.12)] h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-lg bg-[#F4F0E6] flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#003725]" strokeWidth={1.8} />
                    </div>
                    <span className="text-[10px] font-bold text-cta bg-[#E8F5EC] px-2 py-0.5 rounded-full uppercase tracking-[0.1em]">
                      {c.badge}
                    </span>
                  </div>
                  <h3
                    className="text-[26px] font-bold text-[#1A1A1A] mb-3 leading-[1.15]"
                    style={{ letterSpacing: '-0.01em' }}
                  >
                    {c.title}
                  </h3>
                  <p className="text-[15px] text-[#5A5A5A] leading-[1.6] mb-6 flex-1">{c.desc}</p>
                  <div className="flex items-center gap-2 pt-5 border-t border-black/[0.06]">
                    <CheckCircle2 className="w-4 h-4 text-cta flex-shrink-0" />
                    <span className="text-[14px] font-semibold text-[#003725]">
                      {c.highlight}
                      {c.highlightMarker && (
                        <sup className="ml-0.5 text-[#716D5C] font-medium">{c.highlightMarker}</sup>
                      )}
                    </span>
                  </div>
                </div>
              </FadeInUp>
            )
          })}
        </div>
        <p className="mt-5 text-[11px] italic text-[#716D5C] text-center leading-[1.4]">
          * Objectifs produit, benchmark pilote
        </p>
      </div>
    </section>
  )
}
