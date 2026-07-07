import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu,
  X,
} from 'lucide-react'
import { Logo } from './Logo'
import { ButtonColorful } from '../ui/button-colorful'

export const Navbar = ({ onNavigate, trackEvent }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      {/* Top accent gradient bar — Actero greens → gold */}
      <div className="h-[3px] w-full bg-gradient-to-r from-[#0B4B2C] via-[#14A85C] to-[#8B7A50]" />
      <nav className="w-full bg-white/95 backdrop-blur-sm border-b border-black/[0.06] transition-all duration-300">
        <div className={`max-w-6xl mx-auto px-6 md:px-8 flex justify-between items-center transition-all duration-500 ${
          scrolled ? 'h-14 md:h-[56px]' : 'h-16 md:h-[64px]'
        }`}>
          <div
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => onNavigate("/")}
          >
            <Logo
              className="w-7 h-7 text-[#262626] group-hover:scale-105 transition-transform"
            />
            <span className="font-bold text-xl tracking-tight text-[#262626]">
              Actero
            </span>
          </div>

          <div className="hidden lg:flex items-center absolute left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-1 rounded-full bg-[#F9F7F1] border border-[#EFE7D6] p-1">
              <button
                onClick={() => onNavigate("/produit")}
                className="px-4 py-1.5 rounded-full text-[14px] font-semibold text-[#3A3A3A] hover:bg-white hover:text-[#003725] hover:shadow-sm transition-all"
              >
                Produit
              </button>
              <button
                onClick={() => onNavigate("/tarifs")}
                className="px-4 py-1.5 rounded-full text-[14px] font-semibold text-[#3A3A3A] hover:bg-white hover:text-[#003725] hover:shadow-sm transition-all"
              >
                Tarifs
              </button>
              <button
                onClick={() => onNavigate("/entreprise")}
                className="px-4 py-1.5 rounded-full text-[14px] font-semibold text-[#3A3A3A] hover:bg-white hover:text-[#003725] hover:shadow-sm transition-all"
              >
                Entreprise
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate("/login")}
              className="hidden lg:inline-flex items-center h-12 px-6 rounded-full bg-white border border-[#E7E1D2] text-[14px] font-semibold text-[#1A1A1A] hover:border-[#003725]/40 hover:text-[#003725] transition-colors"
            >
              Connexion
            </button>
            <div className="hidden sm:block">
              <ButtonColorful
                onClick={() => {
                  trackEvent?.("Header_CTA_Clicked", { location: "navbar" });
                  onNavigate('/signup');
                }}
              >
                Demarrer gratuitement
              </ButtonColorful>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full bg-[#F9F7F1] border border-gray-200 hover:bg-[#F9F7F1] transition-colors"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-[#262626]" />
              ) : (
                <Menu className="w-5 h-5 text-[#262626]" />
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
                label: "Produit",
                action: () => {
                  setIsMobileMenuOpen(false);
                  onNavigate("/produit");
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
                className="w-full text-left p-3 rounded-2xl text-sm font-bold text-[#716D5C] hover:text-[#262626] hover:bg-[#F9F7F1] transition-all"
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
