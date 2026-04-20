import React, { useEffect } from 'react'
import {
  ArrowRight,
  Check,
  Shield,
  Cpu,
  Target,
  Zap,
  ShieldCheck,
  Users,
  BrainCircuit,
  Rocket,
  Heart,
  Award,
} from 'lucide-react'
import { Navbar } from '../components/layout/Navbar'
import { FadeInUp } from '../components/ui/scroll-animations'
import { PartnersMarquee } from '../components/ui/PartnersMarquee'
import { trackEvent } from '../lib/analytics'
import { SEO } from '../components/SEO'

/**
 * CompanyPage — « Entreprise » / À propos d'Actero.
 *
 * Design variation A : Instrument Serif + italic suffix muted,
 * cream alternatif, cards blanc rounded-[20px], CTA final dark.
 *
 * Copy 100% factuel :
 * — Fondateurs réels (Pablo Priefert-Vallette, Gaspard Ain)
 * — Année de fondation : 2026
 * — Siège : Paris, France
 * — Programmes soutenus : ElevenLabs Grants, Google for Startups,
 *   Shopify Partners, Auth0 for Startups
 * — Pas de storytelling inventé, pas de KPI fictif, pas de témoignage
 */
export const CompanyPage = ({ onNavigate }) => {
  useEffect(() => {
    window.scrollTo(0, 0)
    trackEvent('Company_Page_Viewed')
  }, [])

  const serif = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }

  const values = [
    {
      icon: Target,
      title: 'Systèmes, pas services',
      desc: 'Actero est un produit SaaS, pas une agence. Chaque client accède à la même infrastructure et peut la configurer en self-service.',
    },
    {
      icon: Cpu,
      title: 'Performance mesurable',
      desc: 'Chaque action de l\'agent est traçable : latence, confiance, tool calls, coût. Le dashboard ROI affiche les heures libérées en temps réel.',
    },
    {
      icon: Zap,
      title: 'Vitesse d\'installation',
      desc: 'OAuth Shopify 1-clic. L\'agent lit votre catalogue automatiquement et commence à répondre dans l\'heure qui suit la connexion.',
    },
    {
      icon: ShieldCheck,
      title: 'Transparence',
      desc: 'Code d\'escalade documenté, guardrails configurables, opt-out TDM sur vos données. Zéro boîte noire.',
    },
    {
      icon: Users,
      title: 'FR-first',
      desc: 'Interface, support et copywriting conçus pour le marché français. Hébergement UE, conformité RGPD native, DPA signable.',
    },
    {
      icon: BrainCircuit,
      title: 'IA responsable',
      desc: 'LLM utilisé là où il apporte de la valeur (compréhension, génération avec ton) — pas comme argument marketing. Escalade humaine quand la confiance tombe.',
    },
  ]

  const programs = [
    {
      name: 'ElevenLabs Grants',
      desc: 'Accès aux crédits ElevenLabs pour l\'agent vocal (voix naturelles FR, cloning sur Enterprise).',
    },
    {
      name: 'Google for Startups',
      desc: 'Programme startups Cloud — support technique et infrastructure scaling.',
    },
    {
      name: 'Shopify Partners',
      desc: 'Partenaire officiel Shopify — OAuth natif, listé sur le Shopify App Store (soumission en cours).',
    },
    {
      name: 'Auth0 for Startups',
      desc: 'Auth0 pour la gestion identité clients — crédits startups.',
    },
  ]

  return (
    <>
      <SEO
        title="À propos d'Actero — L'agent IA français pour e-commerce Shopify"
        description="Actero est une startup française fondée en 2026. Agent IA spécialisé e-commerce Shopify, basé à Paris, soutenu par ElevenLabs, Google for Startups, Shopify Partners et Auth0."
        canonical="/entreprise"
      />

      <div className="min-h-screen bg-white text-[#262626]">
        <Navbar onNavigate={onNavigate} trackEvent={trackEvent} />

        {/* ═══════════ HERO ═══════════ */}
        <section className="pt-28 md:pt-32 pb-12 px-6">
          <div className="max-w-[920px] mx-auto text-center">
            <FadeInUp className="mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-[#716D5C] bg-[#F9F7F1] border border-[#E8DFC9]">
                <span className="w-1.5 h-1.5 rounded-full bg-cta" />
                <span>Entreprise</span>
                <span className="text-[#E8DFC9]">·</span>
                <span>Paris, France · Fondée en 2026</span>
              </div>
            </FadeInUp>

            <FadeInUp delay={0.05} className="mb-6">
              <h1
                className="leading-[1.05] text-[#1A1A1A] font-normal"
                style={{ ...serif, fontSize: 'clamp(38px, 5.2vw, 64px)', letterSpacing: '-0.02em' }}
              >
                Construire l'infrastructure
                <br />
                <span className="italic text-[#716D5C]">qui fait tourner votre boutique.</span>
              </h1>
            </FadeInUp>

            <FadeInUp delay={0.1}>
              <p className="text-[15px] md:text-base text-[#5A5A5A] leading-[1.55] max-w-xl mx-auto">
                Actero est une startup française qui automatise le support et les ventes pour les
                e-commerçants Shopify. On pense que l'IA doit remplacer le travail répétitif, pas
                la connexion client.
              </p>
            </FadeInUp>
          </div>
        </section>

        {/* ═══════════ PARTNERS MARQUEE ═══════════ */}
        <PartnersMarquee />

        {/* ═══════════ MISSION ═══════════ */}
        <section className="py-24 md:py-32 bg-white px-6">
          <div className="max-w-[900px] mx-auto">
            <FadeInUp className="text-center mb-14">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
                Mission
              </p>
              <h2
                className="font-normal leading-[1.05] text-[#1A1A1A] mb-4"
                style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
              >
                Rendre l'automatisation IA<br className="hidden md:block" />
                <span className="italic text-[#716D5C]">accessible à toutes les boutiques.</span>
              </h2>
            </FadeInUp>

            <FadeInUp>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#F9F7F1] rounded-[20px] p-8 border border-[#E8DFC9]">
                  <Rocket className="w-5 h-5 text-cta mb-4" strokeWidth={2} />
                  <h3 className="text-[18px] font-bold text-[#1A1A1A] mb-3">
                    Pourquoi on existe
                  </h3>
                  <p className="text-[14.5px] text-[#5A5A5A] leading-[1.6]">
                    Les e-commerçants ambitieux passent 20 à 40 heures par semaine à traiter des
                    questions répétitives (suivi de commande, retours, changements d'adresse).
                    Ce temps vaut des milliers d'euros et n'ajoute aucune valeur concurrentielle.
                  </p>
                </div>
                <div className="bg-[#F9F7F1] rounded-[20px] p-8 border border-[#E8DFC9]">
                  <Heart className="w-5 h-5 text-cta mb-4" strokeWidth={2} />
                  <h3 className="text-[18px] font-bold text-[#1A1A1A] mb-3">Ce qu'on construit</h3>
                  <p className="text-[14.5px] text-[#5A5A5A] leading-[1.6]">
                    Un agent IA qui lit votre Shopify, apprend votre ton, et répond à 60% des
                    tickets sans intervention humaine. Installé en 15 minutes. Hébergé en France.
                    Disponible à partir de 0€.
                  </p>
                </div>
              </div>
            </FadeInUp>
          </div>
        </section>

        {/* ═══════════ VALEURS ═══════════ */}
        <section className="py-24 md:py-32 bg-[#F9F7F1] px-6">
          <div className="max-w-6xl mx-auto">
            <FadeInUp className="text-center mb-14">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
                Valeurs
              </p>
              <h2
                className="font-normal leading-[1.05] text-[#1A1A1A] mb-4"
                style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
              >
                Ce qui guide<br className="hidden md:block" />
                <span className="italic text-[#716D5C]">chaque décision produit.</span>
              </h2>
            </FadeInUp>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {values.map((v, i) => (
                <FadeInUp key={i}>
                  <div className="bg-white rounded-[20px] p-7 border border-black/[0.05] h-full">
                    <div className="w-11 h-11 rounded-[12px] bg-[#F4F0E6] border border-[#E8DFC9] flex items-center justify-center mb-4">
                      <v.icon className="w-5 h-5 text-cta" strokeWidth={2} />
                    </div>
                    <h3 className="text-[17px] font-bold text-[#1A1A1A] mb-2 leading-[1.25]">
                      {v.title}
                    </h3>
                    <p className="text-[13.5px] text-[#5A5A5A] leading-[1.6]">{v.desc}</p>
                  </div>
                </FadeInUp>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ FONDATEURS ═══════════ */}
        <section className="py-24 md:py-32 bg-white px-6">
          <div className="max-w-[900px] mx-auto">
            <FadeInUp className="text-center mb-14">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
                Fondateurs
              </p>
              <h2
                className="font-normal leading-[1.05] text-[#1A1A1A] mb-4"
                style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
              >
                Construit par des e-commerçants,<br className="hidden md:block" />
                <span className="italic text-[#716D5C]">pour des e-commerçants.</span>
              </h2>
            </FadeInUp>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  name: 'Pablo Priefert-Vallette',
                  role: 'Co-fondateur · CEO',
                  initials: 'PP',
                  bio: "Ancien e-commerçant. S'est construit Actero pour résoudre son propre problème de SAV avant de l'ouvrir aux autres marchands Shopify.",
                },
                {
                  name: 'Gaspard Ain',
                  role: 'Co-fondateur · CTO',
                  initials: 'GA',
                  bio: "Ingénieur IA. Construit l'infrastructure d'agents Actero, les guardrails et l'intégration Shopify native.",
                },
              ].map((f, i) => (
                <FadeInUp key={i}>
                  <div className="bg-[#F9F7F1] rounded-[20px] p-8 border border-[#E8DFC9] flex flex-col gap-5 h-full">
                    <div className="w-16 h-16 rounded-full bg-[#003725] text-[#F4F0E6] flex items-center justify-center font-bold text-[22px]">
                      {f.initials}
                    </div>
                    <div>
                      <div className="text-[18px] font-bold text-[#1A1A1A]">{f.name}</div>
                      <div className="text-[13px] text-[#716D5C] mt-0.5">{f.role}</div>
                    </div>
                    <p className="text-[14px] text-[#5A5A5A] leading-[1.6]">{f.bio}</p>
                  </div>
                </FadeInUp>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ PROGRAMMES & SOUTIENS ═══════════ */}
        <section className="py-24 md:py-32 bg-[#F9F7F1] px-6">
          <div className="max-w-[900px] mx-auto">
            <FadeInUp className="text-center mb-14">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
                Partenaires
              </p>
              <h2
                className="font-normal leading-[1.05] text-[#1A1A1A] mb-4"
                style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
              >
                Soutenus par les meilleurs<br className="hidden md:block" />
                <span className="italic text-[#716D5C]">programmes startups.</span>
              </h2>
              <p className="text-[17px] text-[#5A5A5A] max-w-xl mx-auto leading-[1.5]">
                4 programmes partenaires officiels qui nous aident à construire une
                infrastructure robuste et scalable.
              </p>
            </FadeInUp>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {programs.map((p, i) => (
                <FadeInUp key={i}>
                  <div className="bg-white rounded-[18px] p-6 border border-black/[0.06] h-full">
                    <div className="flex items-start gap-3 mb-2">
                      <Award className="w-5 h-5 text-cta flex-shrink-0 mt-0.5" strokeWidth={2} />
                      <h3 className="text-[16px] font-bold text-[#1A1A1A]">{p.name}</h3>
                    </div>
                    <p className="text-[13.5px] text-[#5A5A5A] leading-[1.6] pl-8">{p.desc}</p>
                  </div>
                </FadeInUp>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ CTA FINAL (dark) ═══════════ */}
        <section className="py-24 md:py-32 bg-[#003725] px-6">
          <div className="max-w-[820px] mx-auto text-center text-white">
            <FadeInUp>
              <h2
                className="font-normal text-white mb-5 leading-[1.05]"
                style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
              >
                Envie de discuter<br className="hidden md:block" />
                <span className="italic text-[#A8C490]">de votre boutique ?</span>
              </h2>
              <p className="text-[17px] text-[#F4F0E6]/70 max-w-xl mx-auto mb-8 leading-[1.55]">
                Écrivez-nous à contact@actero.fr — on répond en moins de 24h. Ou démarrez
                directement votre essai.
              </p>
              <div className="flex flex-wrap gap-3.5 justify-center mb-6">
                <button
                  onClick={() => onNavigate('/signup')}
                  className="inline-flex items-center gap-2 bg-[#F4F0E6] text-[#003725] px-[26px] py-[14px] rounded-full text-[15px] font-semibold hover:bg-white transition-colors"
                >
                  Démarrer gratuitement <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <a
                  href="mailto:contact@actero.fr"
                  className="inline-flex items-center gap-2 bg-transparent text-white border border-[#F4F0E6]/25 px-6 py-[14px] rounded-full text-[15px] font-semibold hover:bg-white/10 transition-colors"
                >
                  contact@actero.fr
                </a>
              </div>
              <div className="inline-flex flex-wrap items-center justify-center gap-[18px] text-[12.5px] text-[#F4F0E6]/55">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-[#A8C490]" strokeWidth={2.5} /> Paris, France
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-[#A8C490]" strokeWidth={2.5} /> Support FR 24h
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-[#A8C490]" strokeWidth={2.5} /> Hébergé en UE
                </span>
              </div>
            </FadeInUp>
          </div>
        </section>
      </div>
    </>
  )
}
