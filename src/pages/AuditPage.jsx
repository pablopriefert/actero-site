import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Zap,
  Clock,
  Database,
  Activity,
  ArrowUpRight,
  Plus,
  HelpCircle,
  Gift,
  Sparkles,
} from "lucide-react";
import { Logo } from "../components/layout/Logo";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { FadeInUp } from "../components/ui/scroll-animations";
import { trackEvent } from "../lib/analytics";
import { OnboardingTimer } from "../components/landing/OnboardingTimer";
import { SEO } from "../components/SEO";

export const AuditPage = ({ onNavigate }) => {
  const [openFaq, setOpenFaq] = useState(null);
  const [referralCode, setReferralCode] = useState(null);
  const [referrerName, setReferrerName] = useState(null);
  const [ambassadorRef, setAmbassadorRef] = useState(null);
  const [ambassadorName, setAmbassadorName] = useState(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const params = new URLSearchParams(window.location.search);

    // Check for client referral code — only from URL param
    const code = params.get('referral_code');
    if (code) {
      setReferralCode(code);
      fetch('/api/referral/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      })
        .then(r => r.json())
        .then(d => { if (d.referrer_name) setReferrerName(d.referrer_name); })
        .catch(() => {});
    }

    // Check for ambassador ref code — only from URL param, not cookie
    const ref = params.get('ref');
    if (ref) {
      setAmbassadorRef(ref);
      // Save cookie for 90 days
      document.cookie = `actero_ambassador_ref=${ref}; path=/; max-age=${90 * 24 * 60 * 60}; SameSite=Lax`;
      // Track click
      fetch(`/api/ambassador/track-click?code=${ref}`).catch(() => {});
      // Fetch ambassador name
      import('@supabase/supabase-js').then(({ createClient }) => {
        const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
        sb.from('ambassadors').select('first_name').eq('ambassador_code', ref).maybeSingle()
          .then(({ data }) => { if (data?.first_name) setAmbassadorName(data.first_name); });
      });
    }
  }, []);

  const auditFaqs = [
    {
      q: "Est-ce vraiment 100% gratuit sans engagement ?",
      a: "Absolument. Cet audit de 15 minutes est conçu pour vous montrer exactement comment notre infrastructure peut optimiser vos process.",
    },
    {
      q: "À qui s'adresse cet audit ?",
      a: "Nous aidons principalement les e-commerçants générant déjà plus de 10 000€ par mois.",
    },
    {
      q: "Que dois-je préparer avant l'appel ?",
      a: "Pas besoin de préparer de présentation. Connaissez simplement vos outils actuels.",
    },
    {
      q: "Quelle est la suite si je suis convaincu ?",
      a: "Si nous identifions un potentiel d'optimisation fort, nous vous proposerons de concevoir votre infrastructure sur mesure.",
    },
  ];

  return (
    <>
      <SEO
        title="Audit gratuit — Analysez le potentiel IA de votre entreprise | Actero"
        description="Reservez votre audit gratuit avec Actero. On analyse votre service client et on vous montre combien de temps et d'argent l'IA peut vous faire gagner."
        canonical="/audit"
      />
    <div className="min-h-screen bg-white text-[#262626] font-sans selection:bg-[#003725]/10 relative overflow-hidden flex flex-col">
      <Navbar onNavigate={onNavigate} onAuditOpen={() => onNavigate("/audit")} trackEvent={trackEvent} />

      <main className="pt-32 pb-24 relative z-10 flex-grow px-6">
        {/* Ambassador referral banner */}
        {ambassadorRef && !referralCode && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-5xl mx-auto mb-8"
          >
            <div className="relative overflow-hidden rounded-2xl border border-cta/20 bg-cta/5 p-6">
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cta/10 border border-cta/20 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-6 h-6 text-cta" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cta/10 border border-cta/20 text-[#003725] text-xs font-bold">
                      <Sparkles className="w-3 h-3" />
                      {ambassadorName ? `Recommandé par ${ambassadorName}` : 'Recommandation ambassadeur'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#262626]">
                    Vous avez été recommandé par un partenaire Actero
                  </h3>
                  <p className="text-sm text-[#716D5C] mt-1">
                    Réservez votre audit stratégie gratuit de 15 minutes et découvrez comment automatiser votre business.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Client referral banner */}
        {referralCode && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-5xl mx-auto mb-8"
          >
            <div className="relative overflow-hidden rounded-2xl border border-violet-200 bg-violet-50 p-6">
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-6 h-6 text-violet-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {referrerName && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-violet-100 border border-violet-200 text-violet-700 text-xs font-bold">
                        <Sparkles className="w-3 h-3" />
                        Recommandé par {referrerName}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-[#262626]">
                    Vos frais de setup de <span className="line-through text-[#716D5C]">800€</span> sont <span className="text-cta">offerts</span>
                  </h3>
                  <p className="text-sm text-[#716D5C] mt-1">
                    Grâce à votre parrain, vous bénéficiez d'une installation gratuite. Réservez votre audit pour en profiter.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="max-w-5xl mx-auto">
          <FadeInUp>
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-10">
                <div>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-[#262626] mb-6 leading-[1.1]" style={{ fontFamily: "var(--font-display)" }}>
                    {referralCode ? "Audit offert par votre parrain." : "Audit stratégique offert."}
                  </h1>
                  <p className="text-xl text-[#716D5C] font-medium leading-relaxed">
                    {referralCode
                      ? "15 minutes pour découvrir comment automatiser votre business — frais d'installation offerts."
                      : "15 minutes pour identifier précisément où vous perdez de la marge, sans aucun engagement."}
                  </p>
                </div>

                <div className="bg-[#F9F7F1] rounded-3xl border border-gray-200 p-8">
                  <p className="text-xs font-bold text-[#716D5C] uppercase tracking-widest mb-6">
                    Pendant cet appel vous recevrez :
                  </p>
                  <ul className="space-y-4">
                    {[
                      "Estimation ROI personnalisée",
                      "3 workflows prioritaires à activer",
                      "Plan d'architecture technique recommandé",
                      "Projection de croissance sur 90 jours",
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-cta/10 text-cta flex items-center justify-center border border-cta/20 flex-shrink-0">
                          <Zap className="w-3 h-3" />
                        </div>
                        <span className="text-[#262626] font-medium">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cta/10 border border-cta/20 text-xs font-bold text-[#003725]">
                  <Clock className="w-3.5 h-3.5" />Disponibilités limitées cette semaine
                </div>
              </div>

              <div className="relative">
                <div className="bg-white rounded-3xl border border-gray-200 shadow-lg relative overflow-hidden h-[700px] flex justify-center w-full">
                  <iframe
                    src="https://calendly.com/actero-fr/30min?embed_domain=actero.fr&embed_type=Inline"
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    title="Calendly Scheduling"
                    className="bg-white absolute inset-0 w-full h-full"
                  ></iframe>
                </div>
              </div>
            </div>
          </FadeInUp>
        </div>

        <OnboardingTimer />

        <section className="py-24 mt-12 bg-[#F9F7F1] relative z-10 border-t border-gray-200 -mx-6 px-6">
          <div className="max-w-6xl mx-auto">
            <FadeInUp className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-[#262626]" style={{ fontFamily: "var(--font-display)" }}>
                Ce que nous allons analyser
              </h2>
              <p className="text-[#716D5C] text-lg max-w-2xl mx-auto">
                En 15 minutes chrono, nous passons au peigne fin l'architecture de votre boutique en ligne.
              </p>
            </FadeInUp>

            <div className="grid md:grid-cols-3 gap-6">
              <FadeInUp delay={0.1}>
                <div className="bg-white rounded-2xl p-8 border border-gray-200 h-full hover:border-gray-300 transition-colors">
                  <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-6 text-indigo-600">
                    <Database className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-[#262626] mb-3">Audit de votre Stack</h3>
                  <p className="text-[#716D5C] leading-relaxed text-sm">
                    Revue complète de vos outils actuels (Shopify, CRM, Helpdesk). Nous identifions les silos de données.
                  </p>
                </div>
              </FadeInUp>
              <FadeInUp delay={0.2}>
                <div className="bg-white rounded-2xl p-8 border border-gray-200 h-full hover:border-gray-300 transition-colors">
                  <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mb-6 text-rose-600">
                    <Activity className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-[#262626] mb-3">Détection des Failles</h3>
                  <p className="text-[#716D5C] leading-relaxed text-sm">
                    Mise en évidence précise des process manuels et des coûts cachés.
                  </p>
                </div>
              </FadeInUp>
              <FadeInUp delay={0.3}>
                <div className="bg-white rounded-2xl p-8 border border-gray-200 h-full hover:border-gray-300 transition-colors">
                  <div className="w-12 h-12 bg-cta/10 rounded-xl flex items-center justify-center mb-6 text-cta">
                    <ArrowUpRight className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-[#262626] mb-3">Plan d'Action Sur-Mesure</h3>
                  <p className="text-[#716D5C] leading-relaxed text-sm">
                    Recommandation immédiate avec les 3 workflows d'automatisation à déployer d'urgence.
                  </p>
                </div>
              </FadeInUp>
            </div>
          </div>
        </section>

        <section className="py-24 relative bg-white border-t border-gray-200 -mx-6 px-6">
          <div className="max-w-3xl mx-auto">
            <FadeInUp className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-[#262626]" style={{ fontFamily: "var(--font-display)" }}>Questions fréquentes</h2>
            </FadeInUp>
            <div className="space-y-3">
              {auditFaqs.map((faq, i) => (
                <div key={i} className="bg-[#F9F7F1] border border-gray-200 rounded-2xl overflow-hidden">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-6 text-left">
                    <span className="font-bold text-[#262626]">{faq.q}</span>
                    <Plus className={`w-5 h-5 text-[#716D5C] transition-transform ${openFaq === i ? 'rotate-45' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="px-6 pb-6 overflow-hidden">
                        <p className="text-[#716D5C]">{faq.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
    </>
  );
};
