import React from 'react'
import { Check, Sparkles, ArrowRight } from 'lucide-react'
import { FadeInUp } from '../ui/scroll-animations'

/**
 * PricingA — 4 plans cards (variation A).
 *
 * — 4 plans : Free / Starter / Pro (popular, dark #003725, scale 1.02) /
 *   Enterprise
 * — Headers : name + tagline
 * — Price section avec border-bottom
 * — CTA pill
 * — Features list avec check icons
 *
 * Pro card : entièrement dark avec accents A8C490 (light green) et texte
 * F4F0E6/90.
 */
export const PricingA = ({ onNavigate }) => {
  const serif = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }

  const plans = [
    {
      name: 'Free',
      tagline: 'Découvrir sans engagement',
      price: '0€',
      sub: 'À vie · Sans carte bancaire',
      features: [
        '50 tickets / mois',
        '1 workflow actif',
        'Intégration Shopify',
        'Dashboard ROI basique',
        'Historique 7 jours',
      ],
      cta: 'Commencer gratuitement',
      ctaStyle: 'ghost',
      onClick: () => onNavigate && onNavigate('/signup'),
    },
    {
      name: 'Starter',
      tagline: 'Automatiser les premières tâches',
      price: '99€',
      sub: '/mois · 79€/mois en annuel',
      features: [
        '1 000 tickets / mois',
        '3 workflows · 3 intégrations',
        'Éditeur ton de marque',
        'Simulateur de conversation',
        'API REST + Webhooks',
        'Historique 90 jours',
      ],
      cta: 'Essai gratuit 7 jours',
      ctaStyle: 'ghost',
      onClick: () => onNavigate && onNavigate('/signup'),
    },
    {
      name: 'Pro',
      tagline: 'Automatisation complète',
      price: '399€',
      sub: '/mois · 319€/mois en annuel',
      popular: true,
      features: [
        '5 000 tickets / mois',
        'Workflows illimités',
        'Agents spécialisés (WISMO, retours, produit)',
        'Relance paniers abandonnés',
        'Analyse photo — Claude Vision',
        'Rapport PDF mensuel',
        'Support prioritaire 24h',
      ],
      cta: 'Essai gratuit 7 jours',
      ctaStyle: 'primary',
      onClick: () => onNavigate && onNavigate('/signup'),
    },
    {
      name: 'Enterprise',
      tagline: 'Sur mesure grands comptes',
      price: 'Sur devis',
      sub: 'Devis sous 24h',
      features: [
        'Tickets illimités',
        'Multi-boutiques',
        'White-label complet',
        'Account manager dédié',
        'SLA 99,9%',
        'Onboarding white-glove',
      ],
      cta: "Contacter l'équipe",
      ctaStyle: 'dark',
      onClick: () => {
        window.location.assign('mailto:contact@actero.fr')
      },
    },
  ]

  const ctaClasses = (style, popular) => {
    if (style === 'primary') return 'bg-[#A8C490] text-[#003725] hover:bg-white'
    if (style === 'dark') return 'bg-[#003725] text-white hover:bg-[#1a1a1a]'
    // ghost
    if (popular) return 'bg-[#F4F0E6]/10 text-white hover:bg-[#F4F0E6]/15'
    return 'bg-[#F9F7F1] text-[#1A1A1A] hover:bg-gray-100 border border-black/[0.08]'
  }

  return (
    <section id="pricing" className="py-24 md:py-32 bg-white px-6">
      <div className="max-w-[1200px] mx-auto">
        <FadeInUp className="text-center mb-14">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
            Tarifs
          </p>
          <h2
            className="font-normal leading-[1.05] text-[#1A1A1A] mb-4"
            style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
          >
            Un prix qui paie 40h<br className="hidden md:block" />
            <span className="italic text-[#716D5C]">de votre équipe.</span>
          </h2>
          <p className="text-[17px] text-[#5A5A5A] max-w-xl mx-auto leading-[1.5]">
            Commencez gratuitement, scalez quand vos tickets grimpent. Résiliation en 1 clic.
            Essai 7 jours sur Starter et Pro.
          </p>
        </FadeInUp>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {plans.map((p, i) => (
            <FadeInUp key={i}>
              <div
                className={`relative flex flex-col rounded-[20px] p-7 h-full ${
                  p.popular
                    ? 'bg-[#003725] text-white border border-cta shadow-[0_20px_50px_-15px_rgba(0,55,37,0.35)] scale-[1.02]'
                    : 'bg-white text-[#1A1A1A] border border-black/[0.08]'
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 bg-[#A8C490] text-[#003725] text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1 rounded-full">
                      <Sparkles className="w-2.5 h-2.5" />
                      Populaire
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className="mb-4.5">
                  <div className="text-[17px] font-bold mb-1">{p.name}</div>
                  <div
                    className={`text-[12.5px] ${
                      p.popular ? 'text-[#F4F0E6]/60' : 'text-[#716D5C]'
                    }`}
                  >
                    {p.tagline}
                  </div>
                </div>

                {/* Price */}
                <div
                  className={`mb-5 pb-5 border-b ${
                    p.popular ? 'border-[#F4F0E6]/15' : 'border-black/[0.08]'
                  }`}
                >
                  <div
                    className="tabular-nums font-normal leading-none"
                    style={{ ...serif, fontSize: 38, letterSpacing: '-0.02em' }}
                  >
                    {p.price}
                  </div>
                  <div
                    className={`text-[11px] mt-1.5 ${
                      p.popular ? 'text-[#F4F0E6]/60' : 'text-[#9ca3af]'
                    }`}
                  >
                    {p.sub}
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={p.onClick}
                  className={`w-full px-4 py-[11px] rounded-full text-[13px] font-semibold mb-4.5 inline-flex items-center justify-center gap-1.5 transition-colors ${ctaClasses(
                    p.ctaStyle,
                    p.popular
                  )}`}
                >
                  {p.cta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {/* Features */}
                <ul className="list-none p-0 m-0 flex-1 flex flex-col gap-2.5">
                  {p.features.map((f, idx) => (
                    <li
                      key={idx}
                      className={`flex gap-2 text-[13px] leading-[1.4] ${
                        p.popular ? 'text-[#F4F0E6]/90' : 'text-[#3A3A3A]'
                      }`}
                    >
                      <span className="flex-shrink-0 mt-0.5">
                        <Check
                          className={`w-3.5 h-3.5 ${
                            p.popular ? 'text-[#A8C490]' : 'text-cta'
                          }`}
                          strokeWidth={2.5}
                        />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeInUp>
          ))}
        </div>
      </div>
    </section>
  )
}
