import React from 'react'
import { HelpCircle } from 'lucide-react'
import { Logo } from './Logo'

export const Footer = ({ onNavigate }) => {
  return (
    <footer className="bg-[#0a0a0a] border-t border-white/5 py-16 px-6 relative z-10 w-full mt-auto">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col items-center md:items-start gap-2">
          <div className="flex items-center gap-2">
            <Logo light={false} className="w-6 h-6" />
            <span className="font-bold tracking-tight text-white text-lg">
              Actero
            </span>
          </div>
          <p className="text-sm font-medium text-gray-400">
            L'infrastructure autopilotée des E-commerçants.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-8 text-sm font-bold text-gray-400">
          <button
            onClick={() => onNavigate("/faq")}
            className="hover:text-emerald-400 transition-colors flex items-center gap-1"
          >
            <HelpCircle className="w-3.5 h-3.5" /> FAQ
          </button>
          <button
            onClick={() => alert("Page à venir prochainement !")}
            className="hover:text-white transition-colors"
          >
            Contact
          </button>
          <button
            onClick={() => alert("Page à venir prochainement !")}
            className="hover:text-white transition-colors"
          >
            Mentions légales
          </button>
          <button
            onClick={() => alert("Page à venir prochainement !")}
            className="hover:text-white transition-colors"
          >
            Confidentialité
          </button>
        </div>

        <div className="text-center md:text-right">
          <p className="text-xs font-semibold text-gray-400">
            © {new Date().getFullYear()} Actero. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
