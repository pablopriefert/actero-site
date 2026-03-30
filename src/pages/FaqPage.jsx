import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  HelpCircle,
  Clock,
  ShieldCheck,
  Zap,
  ArrowRight,
  Search,
} from "lucide-react";
import { Logo } from "../components/layout/Logo";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { SEO } from "../components/SEO";
import { ButtonColorful } from "../components/ui/button-colorful";
import { trackEvent } from "../lib/analytics";

export const FaqPage = ({ onNavigate }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [openFaq, setOpenFaq] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    {
      title: "Général",
      questions: [
        {
          q: "Qu'est-ce qu'Actero exactement ?",
          a: "Actero est une Infrastructure as a Service (IaaS) pour l'e-commerce. Nous construisons et gérons des systèmes d'automatisation et d'IA qui remplacent ou optimisent vos processus manuels (SAV, logistique, marketing).",
        },
        {
          q: "Est-ce une agence ou un logiciel ?",
          a: "C'est le meilleur des deux mondes. Vous avez une plateforme SaaS pour suivre vos métriques et valider les actions, couplée à une équipe d'ingénieurs qui déploie des architectures sur mesure pour votre marque.",
        },
      ],
    },
    {
      title: "Technique & Sécurité",
      questions: [
        {
          q: "Mes données sont-elles en sécurité ?",
          a: "Oui. Nous utilisons le chiffrement AES-256 et des connexions OAuth sécurisées. Nous ne stockons jamais vos mots de passe et respectons strictement le RGPD.",
        },
        {
          q: "Actero modifie-t-il le code de mon site Shopify ?",
          a: "Non. Nous opérons en 'back-end' via API. Votre site frontal reste intact, ce qui garantit une stabilité totale et aucune interférence avec votre thème ou vos autres apps.",
        },
      ],
    },
    {
      title: "Prix & Engagement",
      questions: [
        {
          q: "Y a-t-il un engagement de durée ?",
          a: "Nos plans Starter et Growth sont sans engagement. Le plan Scale peut inclure des engagements spécifiques selon la complexité de l'infrastructure à déployer.",
        },
        {
          q: "Comment est calculé le ROI ?",
          a: "Nous mesurons le temps économisé par tâche automatisée et les revenus additionnels générés (ex: récupération de paniers par IA). Ces données sont visibles en temps réel sur votre dashboard.",
        },
      ],
    },
  ];

  const filteredCategories = searchQuery
    ? categories.map(cat => ({
        ...cat,
        questions: cat.questions.filter(q =>
          q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(cat => cat.questions.length > 0)
    : categories;

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": categories.flatMap(cat =>
      cat.questions.map(faq => ({
        "@type": "Question",
        "name": faq.q,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.a
        }
      }))
    )
  };

  return (
    <>
      <SEO
        title="FAQ Actero | Questions sur l'automatisation IA e-commerce & immobilier"
        description="Réponses à toutes vos questions sur les agents IA Actero : fonctionnement, tarifs, intégration Shopify, délais, sécurité et résultats."
        canonical="/faq"
        schemaData={faqSchema}
      />
    <div className="min-h-screen bg-white text-[#262626] font-sans selection:bg-[#003725]/10">
      <Navbar onNavigate={onNavigate} onAuditOpen={() => onNavigate("/audit")} trackEvent={trackEvent} />

      <main className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-[#262626]" style={{ fontFamily: "var(--font-display)" }}>
              Centre d'aide.
            </h1>
            <p className="text-xl text-[#716D5C] max-w-2xl mx-auto mb-10">
              Tout ce que vous devez savoir sur Actero et l'avenir de l'automatisation.
            </p>

            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#716D5C]" />
              <input
                type="text"
                placeholder="Rechercher une question..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#F9F7F1] border border-gray-200 rounded-2xl py-4 pl-12 pr-4 text-[#262626] focus:ring-2 focus:ring-[#0F5F35]/30 outline-none transition-all font-medium"
              />
            </div>
          </div>

          <div className="space-y-12">
            {filteredCategories.map((category, catIdx) => (
              <div key={catIdx}>
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[#716D5C] mb-6 ml-2">
                  {category.title}
                </h2>
                <div className="space-y-3">
                  {category.questions.map((faq, i) => {
                    const uniqueId = `${catIdx}-${i}`;
                    return (
                      <div
                        key={i}
                        className="bg-[#F9F7F1] border border-gray-200 rounded-2xl overflow-hidden group hover:border-gray-300 transition-colors"
                      >
                        <button
                          onClick={() => setOpenFaq(openFaq === uniqueId ? null : uniqueId)}
                          className="w-full flex items-center justify-between p-6 text-left"
                        >
                          <span className="font-bold text-lg text-[#262626]">{faq.q}</span>
                          <div className={`transition-transform duration-300 ${openFaq === uniqueId ? 'rotate-45' : ''}`}>
                            <Plus className="w-5 h-5 text-[#716D5C]" />
                          </div>
                        </button>
                        <AnimatePresence>
                          {openFaq === uniqueId && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="px-6 pb-6 overflow-hidden"
                            >
                              <p className="text-[#716D5C] leading-relaxed font-medium">
                                {faq.a}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredCategories.length === 0 && (
              <div className="text-center py-20 bg-[#F9F7F1] rounded-3xl border border-gray-200 border-dashed">
                <HelpCircle className="w-12 h-12 text-[#716D5C] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#262626]">Aucun résultat trouvé</h3>
                <p className="text-[#716D5C] mt-2">Essayez d'autres mots-clés ou contactez-nous.</p>
              </div>
            )}
          </div>

          <div className="mt-24 p-10 bg-[#F9F7F1] border border-gray-200 rounded-3xl text-center">
            <h3 className="text-2xl font-bold mb-4 text-[#262626]" style={{ fontFamily: "var(--font-display)" }}>Besoin d'une réponse immédiate ?</h3>
            <p className="text-[#716D5C] mb-8 max-w-md mx-auto">
              Notre équipe d'ingénieurs est disponible pour discuter de votre architecture spécifique.
            </p>
            <ButtonColorful onClick={() => onNavigate("/audit")}>
              Lancer un scan gratuit <ArrowRight className="ml-2 w-4 h-4" />
            </ButtonColorful>
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
    </>
  );
};
