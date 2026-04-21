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
} from 'lucide-react'
import { SEO } from '../components/SEO'
import { Navbar } from '../components/layout/Navbar'
import { FadeInUp } from '../components/ui/scroll-animations'
import { PartnersMarquee } from '../components/ui/PartnersMarquee'
import { CapabilitiesA } from '../components/landing/CapabilitiesA'
import { trackEvent } from '../lib/analytics'
import { TalkToHumanButton } from '../components/ui/TalkToHumanButton'

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

  /* Comment ça marche — 4 étapes réelles du setup */
  const howItWorks = [
    {
      step: '01',
      title: 'Connexion Shopify OAuth',
      desc: "Authentification en 1 clic. L'agent lit votre catalogue, vos commandes et vos politiques automatiquement — aucune API key à manipuler.",
    },
    {
      step: '02',
      title: 'Configuration du ton',
      desc: "Vous définissez comment l'agent doit parler (tutoiement/vouvoiement, signature, mots interdits). Base de connaissances indexée en continu.",
    },
    {
      step: '03',
      title: 'Activation des workflows',
      desc: 'SAV email/chat et relance panier abandonné activables en 1 clic. Chaque canal (Email, Gorgias, Zendesk) se configure indépendamment.',
    },
    {
      step: '04',
      title: 'Pilotage temps réel',
      desc: "Dashboard live : heures économisées, résolutions auto-pilotées, CA récupéré. Tout est traçable. Les cas complexes remontent dans l'onglet « À traiter ».",
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
        title="Produit Actero — Agent IA Shopify pour SAV et relance paniers"
        description="Comment fonctionne Actero : agent IA qui répond au SAV Shopify (email, chat, Gorgias, Zendesk) et relance les paniers abandonnés. Installation OAuth 15 min. RGPD, hébergé UE."
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
                Un agent IA pour votre SAV,
                <br />
                <span className="italic text-[#716D5C]">pas un chatbot de plus.</span>
              </h1>
            </FadeInUp>

            <FadeInUp delay={0.1} className="mb-2">
              <p className="text-[15px] md:text-base text-[#5A5A5A] leading-[1.55] max-w-xl mx-auto">
                Actero connecte votre Shopify, apprend votre ton et vos politiques, et répond à
                vos clients 24h/24 sur email, chat et helpdesk. Chaque réponse est sourcée par
                vos vraies données produit et commande.
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
                <button
                  onClick={() => onNavigate('/tarifs')}
                  className="inline-flex items-center gap-2 px-6 py-[14px] rounded-full bg-transparent text-[#262626] text-[15px] font-semibold border border-black/10 hover:border-black/20 transition-colors"
                >
                  Voir les tarifs
                </button>
                <TalkToHumanButton source="product_hero" variant="light" />
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

        {/* ═══════════ COMMENT ÇA MARCHE — 4 ÉTAPES ═══════════ */}
        <section id="comment-ca-marche" className="py-24 md:py-32 bg-[#F9F7F1] px-6">
          <div className="max-w-[900px] mx-auto">
            <FadeInUp className="text-center mb-14">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
                Setup
              </p>
              <h2
                className="font-normal leading-[1.05] text-[#1A1A1A] mb-4"
                style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
              >
                Installé en 15 minutes,<br className="hidden md:block" />
                <span className="italic text-[#716D5C]">sans ligne de code.</span>
              </h2>
              <p className="text-[17px] text-[#5A5A5A] max-w-xl mx-auto leading-[1.5]">
                4 étapes pour passer de zéro à un agent qui répond à vos premiers tickets.
              </p>
            </FadeInUp>

            <div className="flex flex-col gap-4">
              {howItWorks.map((s, i) => (
                <FadeInUp key={i}>
                  <div className="flex gap-5 md:gap-6 p-6 md:p-7 bg-white rounded-[18px] border border-black/[0.06]">
                    <div
                      className="text-[13px] font-medium text-[#9ca3af] font-mono pt-1 w-8 flex-shrink-0"
                    >
                      {s.step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[18px] font-bold text-[#1A1A1A] mb-1">{s.title}</h3>
                      <p className="text-[14.5px] text-[#716D5C] leading-[1.55]">{s.desc}</p>
                    </div>
                  </div>
                </FadeInUp>
              ))}
            </div>
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
                <button
                  onClick={() => onNavigate('/tarifs')}
                  className="inline-flex items-center gap-2 bg-transparent text-white border border-[#F4F0E6]/25 px-6 py-[14px] rounded-full text-[15px] font-semibold hover:bg-white/10 transition-colors"
                >
                  Voir les tarifs
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
