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
        title="Audit IA Gratuit | Analysez votre boutique Shopify en 15 min"
        description="Réservez votre audit stratégie gratuit de 15 minutes. Estimation ROI personnalisée, 3 workflows prioritaires, plan d'architecture technique."
        canonical="/audit"
      />
    <div className="min-h-screen bg-[#030303] text-zinc-50 font-sans selection:bg-white/20 relative overflow-hidden flex flex-col">
      <Navbar onNavigate={onNavigate} onAuditOpen={() => onNavigate("/audit")} trackEvent={trackEvent} />

      <main className="pt-32 pb-24 relative z-10 flex-grow px-6">
        {/* Ambassador referral banner */}
        {ambassadorRef && !referralCode && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-5xl mx-auto mb-8"
          >
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 p-6">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                      <Sparkles className="w-3 h-3" />
                      {ambassadorName ? `Recommandé par ${ambassadorName}` : 'Recommandation ambassadeur'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    Vous avez été recommandé par un partenaire Actero
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
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
            <div className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 p-6">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl" />
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-6 h-6 text-violet-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {referrerName && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-bold">
                        <Sparkles className="w-3 h-3" />
                        Recommandé par {referrerName}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    Vos frais de setup de <span className="line-through text-gray-500">800€</span> sont <span className="text-emerald-400">offerts</span>
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
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
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-white mb-6 leading-[1.1]">
                    {referralCode ? "Audit offert par votre parrain." : "Audit stratégique offert."}
                  </h1>
                  <p className="text-xl text-gray-400 font-medium leading-relaxed">
                    {referralCode
                      ? "15 minutes pour découvrir comment automatiser votre business — frais d'installation offerts."
                      : "15 minutes pour identifier précisément où vous perdez de la marge, sans aucun engagement."}
                  </p>
                </div>

                <div className="bg-[#0a0a0a] rounded-[24px] border border-white/5 p-8">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">
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
                        <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 flex-shrink-0">
                          <Zap className="w-3 h-3" />
                        </div>
                        <span className="text-gray-300 font-medium">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-900/20 border border-emerald-500/30 text-xs font-bold text-emerald-400">
                  <Clock className="w-3.5 h-3.5" />3 créneaux restants cette semaine
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 bg-zinc-400/5 blur-3xl transform scale-110 rounded-full"></div>
                <div className="bg-[#0a0a0a] rounded-[32px] border border-white/10 shadow-2xl relative overflow-hidden h-[700px] flex justify-center w-full">
                  <iframe
                    src="https://calendly.com/actero-fr/30min?embed_domain=actero.fr&embed_type=Inline"
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    title="Calendly Scheduling"
                    className="bg-[#0a0a0a] absolute inset-0 w-full h-full"
                  ></iframe>
                </div>
              </div>
            </div>
          </FadeInUp>
        </div>

        <OnboardingTimer />

        <section className="py-24 mt-12 bg-transparent relative z-10 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6">
            <FadeInUp className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Ce que nous allons analyser
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                En 15 minutes chrono, nous passons au peigne fin l'architecture de votre boutique en ligne.
              </p>
            </FadeInUp>

            <div className="grid md:grid-cols-3 gap-6">
              <FadeInUp delay={0.1}>
                <div className="bg-[#0a0a0a] rounded-2xl p-8 border border-white/5 h-full hover:border-white/10 transition-colors">
                  <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-6 text-indigo-400">
                    <Database className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">Audit de votre Stack</h3>
                  <p className="text-gray-400 leading-relaxed text-sm">
                    Revue complète de vos outils actuels (Shopify, CRM, Helpdesk). Nous identifions les silos de données.
                  </p>
                </div>
              </FadeInUp>
              <FadeInUp delay={0.2}>
                <div className="bg-[#0a0a0a] rounded-2xl p-8 border border-white/5 h-full hover:border-white/10 transition-colors">
                  <div className="w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center mb-6 text-rose-400">
                    <Activity className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">Détection des Failles</h3>
                  <p className="text-gray-400 leading-relaxed text-sm">
                    Mise en évidence précise des process manuels et des coûts cachés.
                  </p>
                </div>
              </FadeInUp>
              <FadeInUp delay={0.3}>
                <div className="bg-[#0a0a0a] rounded-2xl p-8 border border-white/5 h-full hover:border-white/10 transition-colors">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6 text-emerald-400">
                    <ArrowUpRight className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">Plan d'Action Sur-Mesure</h3>
                  <p className="text-gray-400 leading-relaxed text-sm">
                    Recommandation immédiate avec les 3 workflows d'automatisation à déployer d'urgence.
                  </p>
                </div>
              </FadeInUp>
            </div>
          </div>
        </section>

        <section className="py-24 relative bg-transparent border-t border-white/5">
          <div className="max-w-3xl mx-auto px-6">
            <FadeInUp className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Questions fréquentes</h2>
            </FadeInUp>
            <div className="space-y-3">
              {auditFaqs.map((faq, i) => (
                <div key={i} className="bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-6 text-left">
                    <span className="font-bold">{faq.q}</span>
                    <Plus className={`w-5 h-5 transition-transform ${openFaq === i ? 'rotate-45' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="px-6 pb-6 overflow-hidden">
                        <p className="text-gray-400">{faq.a}</p>
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
