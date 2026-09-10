import React, { useEffect } from 'react'
import { ArrowRight, Calculator } from 'lucide-react'
import { SEO } from '../components/SEO'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import { FadeInUp } from '../components/ui/scroll-animations'
import { GorgiasCostCalculator } from '../components/landing/GorgiasCostCalculator'
import { trackEvent } from '../lib/analytics'

/**
 * /calculateur-gorgias
 *
 * Standalone landing for the cost calculator. Doubles as a top-of-funnel
 * page for "gorgias prix" / "gorgias coût" intent and as a lead-magnet
 * destination from email/LinkedIn campaigns.
 */
export const CalculateurGorgiasPage = ({ onNavigate }) => {
  useEffect(() => {
    window.scrollTo(0, 0)
    trackEvent('CostCalculator_Page_Viewed', { source: 'standalone' })
  }, [])

  const serif = { fontFamily: 'var(--font-display, "Inter Tight", ui-sans-serif, sans-serif)' }

  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Calculateur de coût Gorgias vs Actero',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: 'https://actero.fr/calculateur-gorgias',
      description:
        "Calculateur en ligne qui compare le coût annuel réel de Gorgias (helpdesk + AI Agent par résolution) face au forfait Actero. Données live avril 2026.",
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://actero.fr/' },
        { '@type': 'ListItem', position: 2, name: 'Outils', item: 'https://actero.fr/' },
        { '@type': 'ListItem', position: 3, name: 'Calculateur Gorgias', item: 'https://actero.fr/calculateur-gorgias' },
      ],
    },
  ]

  return (
    <>
      <SEO
        title="Calculateur Gorgias — Combien votre helpdesk va vraiment vous coûter"
        description="Calculez en 30 secondes le coût annuel réel de Gorgias (plan + AI Agent à 0,95 $/résolution) face au forfait Actero. Tarifs officiels avril 2026, rapport PDF gratuit."
        keywords="calculateur gorgias, gorgias prix, gorgias coût, gorgias ai agent prix, comparateur gorgias actero"
        canonical="/calculateur-gorgias"
        ogImage="https://actero.fr/og-image.png"
        schemaData={schema}
      />

      <div className="min-h-screen bg-white text-[#262626] font-sans selection:bg-cta/10">
        <Navbar onNavigate={onNavigate} trackEvent={trackEvent} />

        <main>
          <section className="pt-28 md:pt-32 pb-12 px-6">
            <div className="max-w-[920px] mx-auto text-center">
              <FadeInUp className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-[#716D5C] bg-[#FFFFFF] border border-[#E3E6EA]">
                  <Calculator className="w-3.5 h-3.5 text-cta" />
                  <span>Outil gratuit · Tarifs avril 2026</span>
                </div>
              </FadeInUp>

              <FadeInUp delay={0.05} className="mb-6">
                <h1
                  className="leading-[1.05] text-[#1A1A1A] font-normal"
                  style={{ ...serif, fontSize: 'clamp(38px, 5.2vw, 64px)', letterSpacing: '-0.02em' }}
                >
                  Combien Gorgias va vraiment
                  <br />
                  <span className="italic text-[#716D5C]">vous coûter cette année ?</span>
                </h1>
              </FadeInUp>

              <FadeInUp delay={0.1} className="mb-2">
                <p className="text-[16px] md:text-[17px] text-[#5A5A5A] leading-[1.55] max-w-[640px] mx-auto">
                  Le pricing Gorgias empile : plan helpdesk + AI Agent à <strong className="text-[#1A1A1A]">0,95 $/résolution</strong> + voice/SMS en add-on. Sur 12 mois, l'addition surprend. Comparez en 30 secondes avec le forfait Actero.
                </p>
              </FadeInUp>
            </div>
          </section>

          <section className="px-6 pb-24">
            <div className="max-w-[820px] mx-auto">
              <GorgiasCostCalculator onNavigate={onNavigate} source="standalone" />
            </div>
          </section>

          <section className="py-20 md:py-24 bg-[#FFFFFF] px-6">
            <div className="max-w-[820px] mx-auto">
              <FadeInUp className="text-center mb-10">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3 text-cta">Méthodologie</p>
                <h2
                  className="font-normal leading-[1.05] text-[#1A1A1A] mb-3"
                  style={{ ...serif, fontSize: 'clamp(28px, 4vw, 40px)', letterSpacing: '-0.02em' }}
                >
                  Comment on calcule.
                </h2>
              </FadeInUp>
              <div className="bg-white rounded-[20px] p-7 md:p-9 border border-black/[0.06] space-y-5 text-[14.5px] text-[#3A3A3A] leading-[1.65]">
                <div>
                  <strong className="text-[#1A1A1A]">Sources :</strong> grilles tarifaires publiques au {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}.
                </div>
                <div>
                  <strong className="text-[#1A1A1A]">Plan helpdesk concurrent :</strong> sélection automatique selon volume (de 10 $ à 900 $/mois). Overage facturé en plus selon grille officielle.
                </div>
                <div>
                  <strong className="text-[#1A1A1A]">AI Agent concurrent :</strong> 0,95 $/résolution (mid-range publié 0,90 $-1,00 $). Chaque résolution IA compte aussi comme un ticket helpdesk facturé deux fois.
                </div>
                <div>
                  <strong className="text-[#1A1A1A]">Conversion EUR :</strong> taux moyen 12 mois 0,93 USD→EUR. Hors taxes locales et add-ons cachés (voice, SMS, integrations payantes).
                </div>
                <div>
                  <strong className="text-[#1A1A1A]">Plan Actero :</strong> forfait tout inclus selon volume (Starter 99 €/1 000 tickets, Pro 399 €/5 000 tickets). Overage prévisible à 0,15 € puis 0,10 €/ticket — IA, voice et relance panier inclus.
                </div>
                <div>
                  <strong className="text-[#1A1A1A]">Limitations :</strong> calcul conservateur — n'inclut pas voice ni SMS du concurrent, frais d'onboarding payants ni les coûts d'intégrateur souvent imposés. La réalité est typiquement 20-40 % au-dessus du chiffre affiché.
                </div>
              </div>

              <FadeInUp className="mt-10 text-center">
                <button
                  onClick={() => onNavigate('/signup')}
                  className="inline-flex items-center gap-2 px-[26px] py-[14px] rounded-full bg-cta hover:bg-[#0E653A] text-white text-[15px] font-semibold transition-all shadow-[0_1px_2px_rgba(14,101,58,0.2),0_8px_20px_rgba(14,101,58,0.15)] hover:-translate-y-px"
                >
                  Tester Actero gratuitement
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </FadeInUp>
            </div>
          </section>
        </main>

        <Footer onNavigate={onNavigate} />
      </div>
    </>
  )
}

export default CalculateurGorgiasPage
