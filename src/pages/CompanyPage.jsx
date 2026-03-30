import React, { useEffect } from "react";
// framer-motion animations handled via scroll-animations components
import {
  Cpu,
  Target,
  Zap,
  ShieldCheck,
  Users,
  BrainCircuit,
  ArrowRight,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { Logo } from "../components/layout/Logo";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { ButtonColorful } from "../components/ui/button-colorful";
import { trackEvent } from "../lib/analytics";
import { SEO } from "../components/SEO";

export const CompanyPage = ({ onNavigate }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const values = [
    {
      icon: <Cpu className="w-7 h-7" />,
      title: "Systèmes, pas services",
      desc: "Nous construisons des infrastructures autonomes qui fonctionnent 24/7, pas des prestations ponctuelles.",
    },
    {
      icon: <Target className="w-7 h-7" />,
      title: "Performance mesurable",
      desc: "Chaque action est traçable. Chaque automatisation doit prouver son ROI en conditions réelles.",
    },
    {
      icon: <Zap className="w-7 h-7" />,
      title: "Vitesse d'exécution",
      desc: "Nous livrons en sprints courts. Votre infra tourne en jours, pas en mois.",
    },
    {
      icon: <ShieldCheck className="w-7 h-7" />,
      title: "Transparence totale",
      desc: "Accès complet à vos données, vos workflows et vos résultats. Zéro boîte noire.",
    },
    {
      icon: <Users className="w-7 h-7" />,
      title: "Partenariat, pas prestation",
      desc: "On s'intègre à votre équipe. Votre croissance est notre croissance.",
    },
    {
      icon: <BrainCircuit className="w-7 h-7" />,
      title: "IA pragmatique",
      desc: "On utilise l'IA là où elle crée de la valeur réelle, pas comme argument marketing.",
    },
  ];

  return (
    <>
      <SEO
        title="A propos d'Actero — Agence IA specialisee e-commerce et immobilier"
        description="Actero est une agence IA francaise specialisee dans l'automatisation pour e-commerce Shopify et agences immobilieres. Fondee en 2026."
        canonical="/entreprise"
      />
    <div className="min-h-screen bg-white text-[#262626] font-sans selection:bg-[#003725]/10">
      <Navbar onNavigate={onNavigate} onAuditOpen={() => onNavigate("/audit")} trackEvent={trackEvent} />

      <main className="pt-32 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-24">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8" style={{ fontFamily: "var(--font-display)" }}>
              L'ingénierie au service de <br />
              votre <span className="text-[#716D5C]">croissance.</span>
            </h1>
            <p className="text-xl text-[#716D5C] max-w-3xl mx-auto leading-relaxed">
              Actero redéfinit l'excellence opérationnelle pour le e-commerce et l'immobilier. Nous construisons les systèmes IA qui permettent aux entreprises ambitieuses de scaler sans augmenter leur complexité humaine.
            </p>
          </div>

          {/* Vision Section */}
          <div className="grid md:grid-cols-2 gap-16 items-center mb-32">
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=1000"
                alt="Vision"
                className="rounded-3xl border border-gray-200 shadow-lg relative z-10 grayscale hover:grayscale-0 transition-all duration-700"
              />
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-6 tracking-tight text-[#262626]" style={{ fontFamily: "var(--font-display)" }}>Notre Vision</h2>
              <p className="text-[#716D5C] text-lg leading-relaxed mb-6">
                Les entreprises de demain ne seront pas gérées par des armées d'opérateurs, mais par des infrastructures intelligentes et coordonnées.
              </p>
              <p className="text-[#716D5C] text-lg leading-relaxed">
                Notre mission est de démocratiser l'accès à l'automatisation IA de haut niveau — que ce soit pour automatiser le support e-commerce ou déployer des agents IA dans les agences immobilières — pour permettre à chaque entreprise ambitieuse de se concentrer sur ce qui compte.
              </p>
            </div>
          </div>

          {/* Values Grid */}
          <div className="bg-[#F9F7F1] rounded-[40px] p-8 md:p-12 mb-32">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {values.map((v, i) => (
                <div
                  key={i}
                  className="p-8 rounded-3xl bg-white border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className="w-14 h-14 bg-[#F9F7F1] rounded-2xl flex items-center justify-center mb-6 text-[#003725]">
                    {v.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-[#262626]">{v.title}</h3>
                  <p className="text-[#716D5C] text-sm leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Team/CTA Section */}
          <div className="bg-[#F9F7F1] rounded-[40px] p-12 border border-gray-200 text-center relative overflow-hidden">
             <h2 className="text-3xl md:text-5xl font-bold mb-8 relative z-10 text-[#262626]" style={{ fontFamily: "var(--font-display)" }}>Rejoignez l'ère de l'entreprise autonome.</h2>
             <ButtonColorful onClick={() => onNavigate("/audit")} className="relative z-10">
               Demander une étude d'architecture <ArrowUpRight className="ml-2 w-5 h-5" />
             </ButtonColorful>
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
    </>
  );
};
