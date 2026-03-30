import React from 'react'
import { HelpCircle } from 'lucide-react'
import { Logo } from './Logo'

export const Footer = ({ onNavigate }) => {
  return (
    <footer className="bg-[#F9F7F1] border-t border-gray-200 py-16 px-6 relative z-10 w-full mt-auto">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col items-center md:items-start gap-4">
          <div className="flex items-center gap-2">
            <Logo light={false} className="w-6 h-6" />
            <span className="font-bold tracking-tight text-[#262626] text-lg">
              Actero
            </span>
          </div>
          <p className="text-sm font-medium text-[#716D5C]">
            L'infrastructure autopilotée des E-commerçants.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://elevenlabs.io/startup-grants"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity"
            >
              <span className="text-xs font-semibold text-[#716D5C] uppercase tracking-widest">Powered by</span>
              <img
                src="/elevenlabs-grants.webp"
                alt="ElevenLabs Startup Grants"
                className="h-4 w-auto grayscale"
              />
            </a>
            <span className="text-gray-300">|</span>
            <a
              href="https://www.shopify.com/partners"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center opacity-70 hover:opacity-100 transition-opacity"
            >
              <img
                src="/shopify-partners.svg"
                alt="Shopify Partners"
                className="h-5 w-auto grayscale"
              />
            </a>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-8 text-sm font-bold text-[#716D5C]">
          <button
            onClick={() => onNavigate("/faq")}
            className="hover:text-[#262626] transition-colors flex items-center gap-1"
          >
            <HelpCircle className="w-3.5 h-3.5" /> FAQ
          </button>
          <button
            onClick={() => alert("Page à venir prochainement !")}
            className="hover:text-[#262626] transition-colors"
          >
            Contact
          </button>
          <button
            onClick={() => alert("Page à venir prochainement !")}
            className="hover:text-[#262626] transition-colors"
          >
            Mentions légales
          </button>
          <button
            onClick={() => alert("Page à venir prochainement !")}
            className="hover:text-[#262626] transition-colors"
          >
            Confidentialité
          </button>
        </div>

        <div className="text-center md:text-right">
          <p className="text-xs font-semibold text-[#716D5C]">
            © {new Date().getFullYear()} Actero. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
