import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ArrowUpRight,
  Plus,
  Zap,
} from "lucide-react";
import { Logo } from "../components/layout/Logo";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { ButtonColorful } from "../components/ui/button-colorful";
import { GptBadge } from "../components/ui/GptBadge";
import { trackEvent } from "../lib/analytics";

export const PricingPage = ({ onNavigate }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [openFaq, setOpenFaq] = useState(null);

  const plans = [
    {
      id: "free",
      name: "Audit System",
      price: "Gratuit",
      period: "",
      description:
        "Un diagnostic complet de vos opérations e-commerce et des quick wins immédiats.",
      features: [
        "Audit IA de votre site en temps réel",
        "Rapport d'opportunités automatisé",
        "Recommandations stratégiques personnalisées",
        "1 appel de restitution (30 min)",
        "Accès au dashboard de suivi",
      ],
      cta: "Lancer mon audit",
      highlighted: false,
      color: "white",
    },
    {
      id: "croissance_automatisee",
      name: "Croissance Automatisée",
      price: "Sur devis",
      period: "",
      description:
        "L'infrastructure complète pour automatiser votre croissance sur 3 canaux avec un agent IA dédié.",
      features: [
        "Tout dans Audit System",
        <span key="ia" className="inline-flex items-center flex-wrap gap-2">Agent IA support client Niveau 1 <GptBadge /></span>,
        <span key="auto" className="inline-flex items-center flex-wrap gap-2">Automatisations Make/Zapier illimitées <GptBadge /></span>,
        "Intégration Shopify + CRM + Klaviyo",
        "Relances panier abandonné IA",
        "Dashboard de performance en temps réel",
        "Account manager dédié",
        "Reporting hebdomadaire",
      ],
      cta: "Réserver un appel",
      highlighted: true,
      color: "emerald",
    },
    {
      id: "contact",
      name: "Scale sur Mesure",
      price: "Sur devis",
      period: "",
      description:
        "Pour les marques qui scalent au-delà de 500K€/mois et ont besoin d'une infra sur mesure.",
      features: [
        "Tout dans Croissance Automatisée",
        <span key="ia-agents" className="inline-flex items-center flex-wrap gap-2">Agents IA multi-canaux personnalisés <GptBadge /></span>,
        "Architecture data warehouse",
        "Intégrations API custom",
        "Équipe dédiée (2+ agents IA)",
        "SLA prioritaire",
        "Onboarding white-glove",
        "Optimisation continue par data science",
      ],
      cta: "Nous contacter",
      highlighted: false,
      color: "purple",
    },
  ];

  const faqs = [
    {
      q: "Comment fonctionne la période d'essai ?",
      a: "L'Audit System est entièrement gratuit et sans engagement. Vous obtenez un diagnostic complet de vos opérations avant de décider de passer à l'étape suivante.",
    },
    {
      q: "Puis-je changer de plan à tout moment ?",
      a: "Oui, vous pouvez upgrader ou downgrader votre plan à tout moment. Les changements prennent effet au prochain cycle de facturation.",
    },
    {
      q: "Mes données sont-elles sécurisées ?",
      a: "Absolument. Nous utilisons un chiffrement AES-256, des audits SOC 2 réguliers, et vos données ne sont jamais partagées avec des tiers.",
    },
    {
      q: "Combien de temps prend le déploiement ?",
      a: "En moyenne 7 jours ouvrés pour le plan Croissance Automatisée. Le plan Scale sur Mesure nécessite un onboarding plus approfondi de 2-3 semaines.",
    },
    {
      q: "Quelles intégrations supportez-vous ?",
      a: "Nous nous connectons nativement à Shopify, Klaviyo, Gorgias, Make, Zapier, et des dizaines d'autres outils.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans selection:bg-white/20">
      <Navbar onNavigate={onNavigate} onAuditOpen={() => onNavigate("/audit")} trackEvent={trackEvent} />

      <main className="pt-32 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Investissez dans votre <span className="text-zinc-400">liberté.</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Des tarifs clairs, indexés sur la valeur générée et le temps économisé.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative p-8 md:p-10 rounded-[32px] border transition-all duration-500 hover:scale-[1.02] ${
                  plan.highlighted
                    ? "bg-white/5 border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.05)]"
                    : "bg-[#0a0a0a] border-white/10"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-black text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full shadow-lg">
                    Recommandé
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-500 text-sm font-medium">
                      {plan.period}
                    </span>
                  </div>
                  <p className="mt-4 text-gray-400 text-sm font-medium leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                <div className="space-y-4 mb-10">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-sm font-medium text-gray-300">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => onNavigate("/audit")}
                  className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                    plan.highlighted
                      ? "bg-white text-black hover:bg-zinc-200"
                      : "bg-white/5 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  {plan.cta} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-32 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Questions fréquentes
            </h2>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-6 text-left"
                  >
                    <span className="font-bold">{faq.q}</span>
                    <Plus
                      className={`w-5 h-5 transition-transform duration-300 ${
                        openFaq === i ? "rotate-45" : ""
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-6 pb-6 overflow-hidden"
                      >
                        <p className="text-gray-400 text-sm leading-relaxed">
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
};
