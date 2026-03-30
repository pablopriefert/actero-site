import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  Menu,
  X,
  Bot,
  Zap,
  Sparkles
} from 'lucide-react'
import { Logo } from './Logo'
import { ButtonColorful } from '../ui/button-colorful'

export const Navbar = ({ onNavigate, onAuditOpen, trackEvent }) => {
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <nav className={`w-full bg-white border-b border-gray-200 transition-all duration-300 ${
        scrolled ? 'shadow-sm' : ''
      }`}>
        <div className={`max-w-6xl mx-auto px-6 md:px-8 flex justify-between items-center transition-all duration-500 ${
          scrolled ? 'h-14 md:h-[56px]' : 'h-16 md:h-[64px]'
        }`}>
          <div
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => onNavigate("/")}
          >
            <Logo
              light={true}
              className="w-7 h-7 text-gray-900 group-hover:scale-105 transition-transform"
            />
            <span className="font-bold text-xl tracking-tight text-gray-900">
              Actero
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            <div
              className="relative"
              onMouseEnter={() => setIsMegaMenuOpen(true)}
              onMouseLeave={() => setIsMegaMenuOpen(false)}
            >
              <div className="flex items-center gap-1 cursor-pointer py-4 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors group">
                Produits
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-300 ${isMegaMenuOpen ? "rotate-180 text-gray-900" : ""}`}
                />
              </div>

              <AnimatePresence>
                {isMegaMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[850px] bg-white border border-gray-200 rounded-3xl shadow-xl p-6 gap-6 grid grid-cols-3"
                  >
                    <div
                      onClick={() => {
                        setIsMegaMenuOpen(false);
                        scrollToId("comment-ca-marche");
                      }}
                      className="flex flex-col p-6 rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer group"
                    >
                      <div className="w-14 h-14 bg-[#1B7D3A] rounded-2xl flex items-center justify-center mb-6 text-white shadow-lg shadow-[#1B7D3A]/20 group-hover:scale-105 transition-transform">
                        <Bot className="w-7 h-7" />
                      </div>
                      <h3 className="text-gray-900 font-semibold text-[19px] mb-2">
                        Agents IA
                      </h3>
                      <p className="text-[15px] text-gray-500 font-medium leading-relaxed">
                        Vos employés virtuels qui ne dorment jamais.
                      </p>
                    </div>

                    <div
                      onClick={() => {
                        setIsMegaMenuOpen(false);
                        scrollToId("comment-ca-marche");
                      }}
                      className="flex flex-col p-6 rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer group"
                    >
                      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-6 text-amber-500 shadow-md border border-gray-200 group-hover:scale-105 transition-transform">
                        <Zap className="w-7 h-7 fill-amber-500" />
                      </div>
                      <h3 className="text-gray-900 font-semibold text-[19px] mb-2">
                        Automatisations
                      </h3>
                      <p className="text-[15px] text-gray-500 font-medium leading-relaxed">
                        Connectez Shopify, votre CRM et vos factures.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setIsMegaMenuOpen(false);
                        onAuditOpen?.();
                      }}
                      className="flex flex-col p-6 rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer group text-left"
                    >
                      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-6 text-orange-500 shadow-md border border-gray-200 group-hover:scale-105 transition-transform">
                        <Sparkles className="w-7 h-7 fill-orange-500" />
                      </div>
                      <h3 className="text-gray-900 font-semibold text-[19px] mb-2">
                        Audit IA
                      </h3>
                      <p className="text-[15px] text-gray-500 font-medium leading-relaxed">
                        Analyse gratuite de votre business en temps réel.
                      </p>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => onNavigate("/tarifs")}
              className="text-[13px] font-semibold text-gray-700 hover:text-gray-900 transition-colors"
            >
              Tarifs
            </button>
            <button
              onClick={() => onNavigate("/entreprise")}
              className="text-[13px] font-semibold text-gray-700 hover:text-gray-900 transition-colors"
            >
              Entreprise
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate("/login")}
              className="hidden lg:block text-[13px] font-semibold text-gray-700 hover:text-gray-900 transition-colors px-1"
            >
              Connexion
            </button>
            <div className="hidden sm:block">
              <ButtonColorful
                onClick={() => {
                  trackEvent?.("Header_CTA_Clicked", { location: "navbar" });
                  onAuditOpen?.();
                }}
              >
                Demander un audit
              </ButtonColorful>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-gray-900" />
              ) : (
                <Menu className="w-5 h-5 text-gray-900" />
              )}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="mx-4 mt-2 bg-white border border-gray-200 rounded-3xl shadow-xl p-6 space-y-1"
          >
            {[
              {
                label: "Produits",
                action: () => {
                  setIsMobileMenuOpen(false);
                  scrollToId("comment-ca-marche");
                },
              },
              {
                label: "Tarification",
                action: () => {
                  setIsMobileMenuOpen(false);
                  onNavigate("/tarifs");
                },
              },
              {
                label: "Entreprise",
                action: () => {
                  setIsMobileMenuOpen(false);
                  onNavigate("/entreprise");
                },
              },
              {
                label: "FAQ",
                action: () => {
                  setIsMobileMenuOpen(false);
                  onNavigate("/faq");
                },
              },
              {
                label: "Simulateur",
                action: () => {
                  setIsMobileMenuOpen(false);
                  onNavigate("/demo");
                },
              },
              {
                label: "Ressources",
                action: () => {
                  setIsMobileMenuOpen(false);
                  onNavigate("/ressources");
                },
              },
              {
                label: "Connexion",
                action: () => {
                  setIsMobileMenuOpen(false);
                  onNavigate("/login");
                },
              },
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={item.action}
                className="w-full text-left p-3 rounded-2xl text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all"
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
