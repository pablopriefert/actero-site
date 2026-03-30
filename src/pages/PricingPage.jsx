import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Plus,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { SEO } from "../components/SEO";
import { GptBadge } from "../components/ui/GptBadge";
import { MagneticButton } from "../components/ui/magnetic-button";
import { trackEvent } from "../lib/analytics";

export const PricingPage = ({ onNavigate }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const isAnnual = false;
  const [openFaq, setOpenFaq] = useState(null);

  const plans = [
    {
      id: "free",
      name: "Audit System",
      monthlyPrice: null,
      annualPrice: null,
      priceLabel: "Gratuit",
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
      glowColor: "white",
    },
    {
      id: "croissance_automatisee",
      name: "Croissance Automatisée",
      monthlyPrice: null,
      annualPrice: null,
      priceLabel: "Sur devis",
      period: "",
      description:
        "L'infrastructure complète pour automatiser votre croissance sur 3 canaux avec un agent IA dédié.",
      features: [
        "Tout dans Audit System",
        { text: "Agent IA support client Niveau 1", badge: true },
        { text: "Automatisations Make/Zapier illimitées", badge: true },
        "Intégration Shopify + CRM + Klaviyo",
        "Relances panier abandonné IA",
        "Dashboard de performance en temps réel",
        "Account manager dédié",
        "Reporting hebdomadaire",
      ],
      cta: "Réserver un appel",
      highlighted: true,
      glowColor: "emerald",
    },
    {
      id: "contact",
      name: "Scale sur Mesure",
      monthlyPrice: null,
      annualPrice: null,
      priceLabel: "Sur devis",
      period: "",
      description:
        "Pour les marques qui scalent au-delà de 500K€/mois et ont besoin d'une infra sur mesure.",
      features: [
        "Tout dans Croissance Automatisée",
        { text: "Agents IA multi-canaux personnalisés", badge: true },
        "Architecture data warehouse",
        "Intégrations API custom",
        "Équipe dédiée (2+ agents IA)",
        "SLA prioritaire",
        "Onboarding white-glove",
        "Optimisation continue par data science",
      ],
      cta: "Nous contacter",
      highlighted: false,
      glowColor: "purple",
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

  const getPrice = (plan) => {
    if (plan.priceLabel) return plan.priceLabel;
    const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
    return `${price}€`;
  };

  const getPeriod = (plan) => {
    if (plan.priceLabel) return plan.period;
    return isAnnual ? "/mois (facturé annuellement)" : "/mois";
  };

  return (
    <>
      <SEO
        title="Tarifs Actero — Automatisation IA sur devis"
        description="Decouvrez les offres Actero : agents IA SAV pour e-commerce Shopify et automatisation pour agences immobilieres. Tarif sur devis."
        canonical="/tarifs"
      />
    <div className="min-h-screen bg-white text-[#262626] font-sans selection:bg-[#003725]/10">
      <Navbar onNavigate={onNavigate} onAuditOpen={() => onNavigate("/audit")} trackEvent={trackEvent} />

      <main className="pt-32 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-bold tracking-tight mb-6"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Investissez dans votre <span className="text-[#716D5C]">liberté.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl text-[#716D5C] max-w-2xl mx-auto mb-10"
            >
              Des tarifs clairs, indexés sur la valeur générée et le temps économisé.
            </motion.p>

            {/* Pricing label */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-3 bg-[#F9F7F1] border border-gray-200 rounded-full px-5 py-2.5"
            >
              <span className="text-sm font-bold text-[#262626]">Mensuel</span>
            </motion.div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i + 0.3 }}
                className={`group relative p-8 md:p-10 rounded-3xl border transition-all duration-500 hover:scale-[1.02] ${
                  plan.highlighted
                    ? "bg-white border-[#0F5F35]/30 shadow-lg"
                    : "bg-white border-gray-200 hover:border-gray-300"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="flex items-center gap-1.5 bg-[#0F5F35] text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-[#0F5F35]/25">
                      <Sparkles className="w-3 h-3" />
                      Recommandé
                    </div>
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="text-xl font-bold text-[#262626] mb-3">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={`${plan.id}-${isAnnual}`}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="text-4xl font-bold text-[#262626]"
                      >
                        {getPrice(plan)}
                      </motion.span>
                    </AnimatePresence>
                    <span className="text-[#716D5C] text-sm font-medium">
                      {getPeriod(plan)}
                    </span>
                  </div>
                  <p className="mt-4 text-[#716D5C] text-sm font-medium leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                <div className="space-y-4 mb-10">
                  {plan.features.map((feature, idx) => {
                    const isObj = typeof feature === 'object' && feature !== null;
                    const text = isObj ? feature.text : feature;
                    const hasBadge = isObj && feature.badge;
                    return (
                      <div key={idx} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-[#0F5F35] shrink-0 mt-0.5" />
                        <span className="text-sm font-medium text-[#716D5C] inline-flex items-center flex-wrap gap-2">
                          {text} {hasBadge && <GptBadge />}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <MagneticButton
                  onClick={() => {
                    trackEvent("Pricing_CTA_Clicked", { plan: plan.id });
                    onNavigate("/audit");
                  }}
                  className={`w-full py-4 rounded-full font-bold transition-all flex items-center justify-center gap-2 ${
                    plan.highlighted
                      ? "bg-[#0F5F35] text-white hover:bg-[#003725]"
                      : "bg-[#F9F7F1] border border-gray-200 text-[#262626] hover:bg-gray-100"
                  }`}
                >
                  {plan.cta} <ChevronRight className="w-4 h-4" />
                </MagneticButton>
              </motion.div>
            ))}
          </div>

          {/* FAQ */}
          <div className="mt-32 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-[#262626] mb-12" style={{ fontFamily: "var(--font-display)" }}>
              Questions fréquentes
            </h2>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="bg-[#F9F7F1] border border-gray-200 rounded-2xl overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-6 text-left"
                  >
                    <span className="font-bold text-[#262626]">{faq.q}</span>
                    <Plus
                      className={`w-5 h-5 text-[#716D5C] transition-transform duration-300 ${
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
                        <p className="text-[#716D5C] text-sm leading-relaxed">
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
    </>
  );
};
