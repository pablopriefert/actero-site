import React from 'react'
import { CheckCircle2, MessageSquare, ShoppingCart, Workflow } from 'lucide-react'
import { FadeInUp } from '../ui/scroll-animations'

/**
 * CapabilitiesA — 3 piliers (variation A).
 *
 * Actero ne fait PAS que du SAV. Le produit adresse 3 piliers à parts
 * égales :
 *   1. Agent SAV (tickets, retours, questions produit)
 *   2. Relance paniers abandonnés (agent proactif)
 *   3. Automatisations & workflows e-commerce
 *
 * Design :
 * — Background cream #F9F7F1
 * — 3 cards blanc rounded-[20px], grid 3 cols desktop
 * — Icon container cream square #F4F0E6 avec Lucide icon
 * — Badge « Dès Free » en pill cta/10
 * — Highlight footer avec check icon + border-t (1 metric par pilier)
 * — Hover : translate-y-[-2px] + shadow dark soft
 */
export const CapabilitiesA = () => {
  const serif = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }

  const caps = [
    {
      badge: 'Dès Free',
      Icon: MessageSquare,
      title: 'Agent SAV',
      desc:
        "Répond automatiquement aux tickets, retours, changements d'adresse et questions produit sur email, chat, Gorgias, Zendesk et WhatsApp — avec le ton de votre marque.",
      highlight: '60% de tickets résolus sans humain',
      highlightMarker: '*',
    },
    {
      badge: 'Dès Free',
      Icon: ShoppingCart,
      title: 'Relance paniers abandonnés',
      desc:
        "Un agent proactif qui relance chaque client avec un message personnalisé (produit, remise conditionnelle, lien checkout) — pas une séquence email générique.",
      highlight: '+15% de CA récupéré en moyenne',
      highlightMarker: '*',
    },
    {
      badge: 'Dès Starter',
      Icon: Workflow,
      title: 'Automatisations & workflows',
      desc:
        "Routage intelligent, escalades conditionnelles, suivis post-achat, recommandations produits. 10+ playbooks e-commerce prêts à l'emploi, personnalisables sans code.",
      highlight: '10+ playbooks e-commerce prêts à brancher',
      highlightMarker: '',
    },
  ]

  return (
    <section className="py-24 md:py-32 bg-[#F9F7F1] px-6">
      <div className="max-w-6xl mx-auto">
        <FadeInUp className="text-center mb-16">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
            3 piliers · 1 agent
          </p>
          <h2
            className="font-normal leading-[1.05] text-[#1A1A1A] mb-4"
            style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
          >
            Tout ce qui consomme votre équipe<br className="hidden md:block" />
            <span className="italic text-[#716D5C]">tourne maintenant tout seul.</span>
          </h2>
          <p className="text-[17px] text-[#5A5A5A] max-w-xl mx-auto leading-[1.5]">
            SAV, relance paniers, automatisations : les 3 moteurs Actero, mesurés en temps réel
            dans votre dashboard.
          </p>
        </FadeInUp>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {caps.map((c, i) => {
            const Icon = c.Icon
            return (
              <FadeInUp key={i} delay={i * 0.06}>
                <div className="bg-white rounded-[20px] p-8 border border-black/[0.05] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_40px_-10px_rgba(0,55,37,0.12)] h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-lg bg-[#F4F0E6] flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#003725]" strokeWidth={1.8} />
                    </div>
                    <span className="text-[10px] font-bold text-cta bg-[#E8F5EC] px-2 py-0.5 rounded-full uppercase tracking-[0.1em]">
                      {c.badge}
                    </span>
                  </div>
                  <h3
                    className="text-[22px] font-bold text-[#1A1A1A] mb-3 leading-[1.15]"
                    style={{ letterSpacing: '-0.01em' }}
                  >
                    {c.title}
                  </h3>
                  <p className="text-[14.5px] text-[#5A5A5A] leading-[1.6] mb-6 flex-1">{c.desc}</p>
                  <div className="flex items-center gap-2 pt-5 border-t border-black/[0.06]">
                    <CheckCircle2 className="w-4 h-4 text-cta flex-shrink-0" />
                    <span className="text-[13.5px] font-semibold text-[#003725]">
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
