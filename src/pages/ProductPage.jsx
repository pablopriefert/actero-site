import React, { useEffect } from 'react'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Shield,
  ShoppingBag,
  Mail,
  MessageSquare,
  Plug,
  Zap,
  Eye,
  Clock,
  Rocket,
  Settings2,
  BarChart3,
  RefreshCw,
} from 'lucide-react'
import { SEO } from '../components/SEO'
import { Navbar } from '../components/layout/Navbar'
import { FadeInUp } from '../components/ui/scroll-animations'
import { PartnersMarquee } from '../components/ui/PartnersMarquee'
import { CapabilitiesA } from '../components/landing/CapabilitiesA'
import { trackEvent } from '../lib/analytics'
import { TalkToHumanButton } from '../components/ui/TalkToHumanButton'
import { WatchDemoButton } from '../components/ui/WatchDemoButton'

/**
 * ProductPage — page dédiée /produit.
 *
 * Design : variation A (même style que la landing — Instrument Serif
 * italic suffix sur les h2, cream bg alternatif, cards blanc rounded-[20px]).
 *
 * Copy : 100% aligné sur le produit RÉEL (plans.js + features actuelles).
 * — 2 automations : SAV Shopify, Relance paniers abandonnés
 * — Canaux : Email, Chat widget Shopify, Gorgias, Zendesk
 * — Sécurité : OAuth Shopify, AES-256, hébergé UE, RGPD, opt-out TDM
 * — Intégrations : Shopify, WooCommerce, Webflow, Gorgias, Zendesk,
 *   Tidio, Crisp, Stripe, Pennylane, Axonaut, iPaidThat, Slack, Resend
 * — Aucun témoignage fictif, pas de KPI inventé
 */
export const ProductPage = ({ onNavigate }) => {
  useEffect(() => {
    window.scrollTo(0, 0)
    trackEvent('Product_Page_Viewed')
  }, [])

  const serif = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }

  /* Canaux gérés actuellement */
  const channels = [
    { icon: Mail, label: 'Email', desc: 'Répond aux emails entrants via SMTP/IMAP ou Gmail.' },
    { icon: MessageSquare, label: 'Chat Shopify', desc: 'Widget de chat natif installé en OAuth 1-clic.' },
    { icon: Zap, label: 'Gorgias', desc: 'Se branche à vos tickets Gorgias existants.' },
    { icon: Zap, label: 'Zendesk', desc: 'Se branche à vos tickets Zendesk existants.' },
  ]

  /* Cycle d'amélioration continue — 4 phases en boucle, pas un setup linéaire */
  const cycle = [
    {
      step: '01',
      phase: 'Onboard',
      icon: Rocket,
      title: 'Connecter Shopify en 15 min',
      desc: "OAuth 1-clic. L'agent lit votre catalogue, vos commandes et vos politiques automatiquement — aucune API key à manipuler.",
    },
    {
      step: '02',
      phase: 'Déployer',
      icon: Settings2,
      title: 'Configurer ton & workflows',
      desc: "Tutoiement/vouvoiement, signature, KB indexée en continu. SAV email/chat et relance paniers activables en 1 clic sur chaque canal.",
    },
    {
      step: '03',
      phase: 'Mesurer',
      icon: BarChart3,
      title: 'Piloter en temps réel',
      desc: "Dashboard live : heures économisées, résolutions, CA récupéré, CSAT par intent. Les cas complexes remontent dans « À traiter ».",
    },
    {
      step: '04',
      phase: 'Optimiser',
      icon: RefreshCw,
      title: "Améliorer à chaque cycle",
      desc: "Chaque escalade enrichit la base. Nouvelles règles, prompts ajustés, seuils d'escalade recalibrés — puis on repart sur un nouveau cycle.",
    },
  ]

  /* Sécurité & conformité — claims réels */
  const security = [
    { icon: Shield, title: 'OAuth officiel Shopify', desc: 'Aucune donnée sensible manipulée. Scopes minimaux.' },
    { icon: Shield, title: 'Chiffrement AES-256', desc: 'Au repos + TLS 1.3 en transit.' },
    { icon: Shield, title: 'Hébergé en UE', desc: 'Infrastructure Supabase Europe, conforme RGPD.' },
    { icon: Shield, title: 'Opt-out TDM', desc: 'Art. 4, Directive EU 2019/790 — vos données n\'entraînent jamais nos modèles.' },
  ]

  /* Stack intégrations — logos réels supportés */
  const integrations = {
    'E-commerce': ['Shopify', 'WooCommerce', 'Webflow'],
    'Helpdesk': ['Gorgias', 'Zendesk', 'Tidio', 'Crisp'],
    'Compta FR': ['Pennylane', 'Axonaut', 'iPaidThat', 'Stripe'],
    'Notifications': ['Slack', 'Resend', 'Gmail', 'SMTP/IMAP'],
  }

  return (
    <>
      <SEO
        title="Produit Actero — Agent IA e-commerce : SAV, relance paniers, automatisations"
        description="Comment fonctionne Actero : agent IA qui gère le SAV Shopify (email, chat, Gorgias, Zendesk, WhatsApp), relance les paniers abandonnés et automatise vos workflows e-commerce. Installation OAuth 15 min. RGPD, hébergé UE."
        canonical="/produit"
      />

      <div className="min-h-screen bg-white text-[#262626]">
        <Navbar onNavigate={onNavigate} trackEvent={trackEvent} />

        {/* ═══════════ HERO ═══════════ */}
        <section className="pt-28 md:pt-32 pb-12 px-6">
          <div className="max-w-[920px] mx-auto text-center">
            <FadeInUp className="mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-[#716D5C] bg-[#F9F7F1] border border-[#E8DFC9]">
                <span className="w-1.5 h-1.5 rounded-full bg-cta" />
                <span>Produit</span>
                <span className="text-[#E8DFC9]">·</span>
                <span>Natif Shopify · RGPD · Hébergé UE</span>
              </div>
            </FadeInUp>

            <FadeInUp delay={0.05} className="mb-6">
              <h1
                className="leading-[1.05] text-[#1A1A1A] font-normal"
                style={{ ...serif, fontSize: 'clamp(38px, 5.2vw, 64px)', letterSpacing: '-0.02em' }}
              >
                Un agent IA pour tout votre{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#003725] to-[#14A85C]">
                  e-commerce
                </span>
                ,
                <br />
                <span className="italic text-[#716D5C]">pas un chatbot de plus.</span>
              </h1>
            </FadeInUp>

            <FadeInUp delay={0.1} className="mb-2">
              <p className="text-[15px] md:text-base text-[#5A5A5A] leading-[1.55] max-w-xl mx-auto">
                Actero connecte votre Shopify, apprend votre ton et vos politiques, puis gère
                3 choses en parallèle : répondre au SAV 24/7, relancer les paniers abandonnés,
                et exécuter vos workflows e-commerce — sourcés par vos vraies données.
              </p>
            </FadeInUp>

            <FadeInUp delay={0.15} className="mt-8">
              <div className="flex flex-wrap items-center justify-center gap-3.5">
                <button
                  onClick={() => onNavigate('/signup')}
                  className="inline-flex items-center gap-2 px-[26px] py-[14px] rounded-full bg-cta hover:bg-[#0A4F2C] text-white text-[15px] font-semibold shadow-[0_1px_2px_rgba(14,101,58,0.2),0_8px_20px_rgba(14,101,58,0.15)] hover:-translate-y-px transition-all"
                >
                  Démarrer gratuitement
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <WatchDemoButton source="product_hero" variant="light" />
              </div>
            </FadeInUp>
          </div>
        </section>

        {/* ═══════════ PARTNERS MARQUEE ═══════════ */}
        <PartnersMarquee />

        {/* ═══════════ CAPABILITIES (2 automations) ═══════════ */}
        <CapabilitiesA />

        {/* ═══════════ CANAUX SUPPORTÉS ═══════════ */}
        <section className="py-24 md:py-32 bg-white px-6">
          <div className="max-w-6xl mx-auto">
            <FadeInUp className="text-center mb-14">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
                Canaux
              </p>
              <h2
                className="font-normal leading-[1.05] text-[#1A1A1A] mb-4"
                style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
              >
                Partout où vos clients<br className="hidden md:block" />
                <span className="italic text-[#716D5C]">vous sollicitent.</span>
              </h2>
              <p className="text-[17px] text-[#5A5A5A] max-w-xl mx-auto leading-[1.5]">
                L'agent répond sur les 4 canaux sur lesquels vos clients interagissent. Activez
                ceux qui vous concernent depuis le dashboard.
              </p>
            </FadeInUp>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {channels.map((ch, i) => (
                <FadeInUp key={i}>
                  <div className="bg-white rounded-[18px] p-6 border border-black/[0.06] hover:border-cta/25 hover:shadow-[0_10px_30px_-15px_rgba(0,55,37,0.1)] transition-all h-full">
                    <div className="w-11 h-11 rounded-[12px] bg-[#F4F0E6] border border-[#E8DFC9] flex items-center justify-center mb-4">
                      <ch.icon className="w-5 h-5 text-cta" strokeWidth={2} />
                    </div>
                    <h3 className="text-[17px] font-bold text-[#1A1A1A] mb-1.5">{ch.label}</h3>
                    <p className="text-[13px] text-[#716D5C] leading-[1.55]">{ch.desc}</p>
                  </div>
                </FadeInUp>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ CYCLE D'AMÉLIORATION CONTINUE ═══════════ */}
        <section id="comment-ca-marche" className="py-24 md:py-32 bg-[#F9F7F1] px-6">
          <div className="max-w-6xl mx-auto">
            <FadeInUp className="text-center mb-14">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
                Cycle d'amélioration continue
              </p>
              <h2
                className="font-normal leading-[1.05] text-[#1A1A1A] mb-4"
                style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
              >
                Pas une installation,<br className="hidden md:block" />
                <span className="italic text-[#716D5C]">un moteur qui tourne.</span>
              </h2>
              <p className="text-[17px] text-[#5A5A5A] max-w-xl mx-auto leading-[1.5]">
                4 phases en boucle. Installation en 15 min, puis l'agent s'améliore à chaque
                cycle — nouveaux tickets, nouveaux retours, nouvelles règles.
              </p>
            </FadeInUp>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              {cycle.map((s, i) => {
                const Icon = s.icon
                return (
                  <FadeInUp key={i} delay={i * 0.05}>
                    <div className="relative h-full bg-white rounded-[20px] p-6 md:p-7 border border-black/[0.06] hover:border-cta/25 hover:shadow-[0_10px_30px_-15px_rgba(0,55,37,0.1)] transition-all">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 rounded-[14px] bg-[#F4F0E6] border border-[#E8DFC9] flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-cta" strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-[11px] font-semibold text-[#9ca3af]">
                              {s.step}
                            </span>
                            <span className="text-[10px] font-bold text-cta bg-[#E8F5EC] px-2 py-0.5 rounded-full uppercase tracking-[0.12em]">
                              {s.phase}
                            </span>
                          </div>
                          <h3 className="text-[18px] font-bold text-[#1A1A1A] leading-[1.25]">
                            {s.title}
                          </h3>
                        </div>
                      </div>
                      <p className="text-[14.5px] text-[#5A5A5A] leading-[1.6]">{s.desc}</p>
                    </div>
                  </FadeInUp>
                )
              })}
            </div>

            {/* Loop indicator — "04 → 01" */}
            <FadeInUp delay={0.25} className="mt-10">
              <div className="flex items-center justify-center gap-3">
                <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white border border-[#E8DFC9]">
                  <RefreshCw className="w-3.5 h-3.5 text-cta" strokeWidth={2.5} />
                  <span className="text-[13px] font-semibold text-[#1A1A1A]">
                    Chaque cycle enrichit le suivant
                  </span>
                  <span className="text-[11px] text-[#716D5C] font-mono">04 → 01</span>
                </div>
              </div>
            </FadeInUp>
          </div>
        </section>

        {/* ═══════════ INTÉGRATIONS ═══════════ */}
        <section className="py-24 md:py-32 bg-white px-6">
          <div className="max-w-6xl mx-auto">
            <FadeInUp className="text-center mb-14">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
                Intégrations
              </p>
              <h2
                className="font-normal leading-[1.05] text-[#1A1A1A] mb-4"
                style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
              >
                Connecté à vos outils<br className="hidden md:block" />
                <span className="italic text-[#716D5C]">en 1 clic OAuth.</span>
              </h2>
              <p className="text-[17px] text-[#5A5A5A] max-w-xl mx-auto leading-[1.5]">
                API REST + webhooks disponibles dès le plan Starter pour connecter vos outils
                custom.
              </p>
            </FadeInUp>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {Object.entries(integrations).map(([category, items]) => (
                <FadeInUp key={category}>
                  <div className="bg-[#F9F7F1] rounded-[18px] p-6 border border-[#E8DFC9] h-full">
                    <div className="flex items-center gap-2 mb-4">
                      <Plug className="w-4 h-4 text-cta" strokeWidth={2.5} />
                      <h3 className="text-[14px] font-bold text-[#1A1A1A]">{category}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {items.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-black/[0.06] text-[13px] font-medium text-[#262626]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </FadeInUp>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ SÉCURITÉ & CONFORMITÉ ═══════════ */}
        <section className="py-24 md:py-32 bg-[#F9F7F1] px-6">
          <div className="max-w-6xl mx-auto">
            <FadeInUp className="text-center mb-14">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
                Sécurité
              </p>
              <h2
                className="font-normal leading-[1.05] text-[#1A1A1A] mb-4"
                style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
              >
                Vos données,<br className="hidden md:block" />
                <span className="italic text-[#716D5C]">traitées avec rigueur.</span>
              </h2>
            </FadeInUp>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {security.map((s, i) => (
                <FadeInUp key={i}>
                  <div className="bg-white rounded-[18px] p-6 border border-black/[0.05] h-full">
                    <div className="w-10 h-10 rounded-[10px] bg-cta/10 flex items-center justify-center mb-4">
                      <s.icon className="w-4.5 h-4.5 text-cta" strokeWidth={2} />
                    </div>
                    <h3 className="text-[15px] font-bold text-[#1A1A1A] mb-1.5">{s.title}</h3>
                    <p className="text-[13px] text-[#716D5C] leading-[1.55]">{s.desc}</p>
                  </div>
                </FadeInUp>
              ))}
            </div>

            <FadeInUp className="mt-10 text-center">
              <div className="inline-flex items-center gap-2 text-[13px] text-[#716D5C]">
                <Eye className="w-3.5 h-3.5" />
                DPA signable sur demande · Sous-traitants listés dans la politique de confidentialité
              </div>
            </FadeInUp>
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
                Prêt à tester l'agent<br className="hidden md:block" />
                <span className="italic text-[#A8C490]">sur votre Shopify ?</span>
              </h2>
              <p className="text-[17px] text-[#F4F0E6]/70 max-w-xl mx-auto mb-8 leading-[1.55]">
                Plan Free à vie · Installation OAuth Shopify en 15 minutes · Premiers tickets
                résolus dans l'heure.
              </p>
              <div className="flex flex-wrap gap-3.5 justify-center mb-6">
                <button
                  onClick={() => onNavigate('/signup')}
                  className="inline-flex items-center gap-2 bg-[#F4F0E6] text-[#003725] px-[26px] py-[14px] rounded-full text-[15px] font-semibold hover:bg-white transition-colors"
                >
                  Démarrer gratuitement <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <TalkToHumanButton source="product_final_cta" variant="dark" />
              </div>
              <div className="inline-flex flex-wrap items-center justify-center gap-[18px] text-[12.5px] text-[#F4F0E6]/55">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-[#A8C490]" strokeWidth={2.5} /> Sans engagement
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-[#A8C490]" strokeWidth={2.5} /> Setup 15 min
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[#A8C490]" strokeWidth={2.5} /> Plan Free
                  à vie
                </span>
              </div>
            </FadeInUp>
          </div>
        </section>
      </div>
    </>
  )
}
