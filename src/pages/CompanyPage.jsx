import React, { useEffect } from "react";
import { motion } from "framer-motion";
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
    <div className="min-h-screen bg-[#030303] text-white font-sans selection:bg-white/20">
      <Navbar onNavigate={onNavigate} onAuditOpen={() => onNavigate("/audit")} trackEvent={trackEvent} />

      <main className="pt-32 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-24">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
              L'ingénierie au service de <br />
              votre <span className="text-zinc-500">croissance.</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Actero redéfinit l'excellence opérationnelle pour le e-commerce. Nous construisons les systèmes qui permettent aux marques de scaler sans augmenter leur complexité humaine.
            </p>
          </div>

          {/* Vision Section */}
          <div className="grid md:grid-cols-2 gap-16 items-center mb-32">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/10 blur-[100px] rounded-full"></div>
              <img
                src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=1000"
                alt="Vision"
                className="rounded-[32px] border border-white/10 shadow-2xl relative z-10 grayscale hover:grayscale-0 transition-all duration-700"
              />
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-6 tracking-tight">Notre Vision</h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-6">
                Le e-commerce de demain ne sera pas géré par des armées d'opérateurs, mais par des infrastructures intelligentes et coordonnées.
              </p>
              <p className="text-gray-400 text-lg leading-relaxed">
                Notre mission est de démocratiser l'accès à l'automatisation de haut niveau, autrefois réservée aux géants tech, pour permettre à chaque marque ambitieuse de se concentrer sur son produit et sa communauté.
              </p>
            </div>
          </div>

          {/* Values Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-32">
            {values.map((v, i) => (
              <div
                key={i}
                className="p-8 rounded-[32px] bg-[#0a0a0a] border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-6 text-zinc-400">
                  {v.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{v.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>

          {/* Team/CTA Section */}
          <div className="bg-[#0a0a0a] rounded-[40px] p-12 border border-white/10 text-center relative overflow-hidden">
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-white/5 rounded-full blur-[100px] -mt-40"></div>
             <h2 className="text-3xl md:text-5xl font-bold mb-8 relative z-10">Rejoignez l'ère de l'E-commerce Autonome.</h2>
             <ButtonColorful onClick={() => onNavigate("/audit")} className="relative z-10">
               Demander une étude d'architecture <ArrowUpRight className="ml-2 w-5 h-5" />
             </ButtonColorful>
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
};
