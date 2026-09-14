import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu,
  X,
} from 'lucide-react'
import { Logo } from './Logo'

export const Navbar = ({ onNavigate, trackEvent }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    // Header flottant : une pilule posée sur la page, pas une barre collée en
    // haut. C'est la forme de gorgias.com, relevée dans leur DOM — fixe, 24 px
    // du haut, 40 px de chaque côté, entièrement arrondie, ombre douce et sans
    // décalage. La barre pleine largeur avec bordure basse coupait la page en
    // deux ; la pilule la laisse respirer.
    <div className="fixed top-0 left-0 right-0 z-50 px-4 lg:px-10 pt-4 lg:pt-6">
      <nav
        style={{
          fontFamily: 'var(--font-sans, "Inter Tight"), system-ui, sans-serif',
          boxShadow: '0 0 10px rgba(26, 30, 35, 0.10)',
        }}
        className="relative mx-auto max-w-[1320px] rounded-full bg-white transition-all duration-300"
      >
        <div className={`px-6 lg:px-8 flex justify-between items-center transition-all duration-500 ${
          scrolled ? 'h-[64px]' : 'h-[72px]'
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

          <div className="hidden lg:flex items-center gap-11 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {[
              { label: 'Produit', to: '/produit' },
              { label: 'Tarifs', to: '/tarifs' },
              { label: 'Entreprise', to: '/entreprise' },
              { label: 'Ressources', to: '/ressources' },
            ].map((item) => (
              <button
                key={item.to}
                onClick={() => onNavigate(item.to)}
                className="text-[14px] font-medium text-[#4A4A4A] hover:text-[#1A1A1A] tracking-[-0.01em] transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => onNavigate("/login")}
              className="hidden lg:inline-flex items-center text-[14px] font-medium text-[#4A4A4A] hover:text-[#1A1A1A] tracking-[-0.01em] transition-colors"
            >
              Connexion
            </button>
            <button
              onClick={() => {
                trackEvent?.("Header_CTA_Clicked", { location: "navbar" });
                onNavigate('/signup');
              }}
              className="hidden sm:inline-flex items-center px-[18px] py-2 rounded-full bg-[#1A1A1A] hover:bg-black text-white text-[14px] font-medium tracking-[-0.01em] transition-colors"
            >
              Demarrer gratuitement
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full bg-surface border border-gray-200 hover:bg-surface transition-colors"
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
            className="mt-3 mx-auto max-w-[1320px] bg-white border border-[#E6E8EC] rounded-3xl shadow-xl p-6 space-y-1"
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
                className="w-full text-left p-3 rounded-2xl text-sm font-bold text-[#716D5C] hover:text-[#262626] hover:bg-surface transition-all"
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
